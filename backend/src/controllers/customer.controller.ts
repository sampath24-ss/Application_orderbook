// src/controllers/customer.controller.ts - Updated with Cache-First Pattern
import { Request, Response } from 'express';
import { KafkaService } from '../kafka';
import { RedisService } from '../cache/redies.service';
import { DatabaseService } from '../Engine/Services/database.service';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { CreateCustomerRequest } from '../types';

export class CustomerController {
    private static kafkaService = KafkaService.getInstance();
    private static redisService = RedisService.getInstance();
    private static databaseService = new DatabaseService();

    // WRITE OPERATIONS (Async via Kafka)
    public static async createCustomer(req: Request, res: Response): Promise<void> {
        try {
            const customerData: CreateCustomerRequest = req.body;
            const customerId = uuidv4();
            const correlationId = req.headers['x-correlation-id'] as string || uuidv4();

            // Validate required fields
            if (!customerData.name || !customerData.email) {
                res.status(400).json({
                    success: false,
                    message: 'Name and email are required',
                    timestamp: new Date()
                });
                return;
            }

            // Publish to Kafka for async processing
            await CustomerController.kafkaService.publishCustomerEvent('CUSTOMER_CREATE_REQUESTED', {
                id: customerId,
                ...customerData
            }, {
                correlationId,
                userId: req.headers['x-user-id'],
                tenantId: req.headers['x-tenant-id']
            });

            res.status(202).json({
                success: true,
                data: {
                    id: customerId,
                    correlationId
                },
                message: 'Customer creation initiated. You will receive real-time updates.',
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Error creating customer:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to initiate customer creation',
                timestamp: new Date()
            });
        }
    }

    public static async updateCustomer(req: Request, res: Response): Promise<void> {
        try {
            const customerId = req.params.id as string;
            const updateData = req.body;
            const correlationId = req.headers['x-correlation-id'] as string || uuidv4();

            // Publish to Kafka for async processing
            await CustomerController.kafkaService.publishCustomerEvent('CUSTOMER_UPDATE_REQUESTED', {
                id: customerId,
                ...updateData
            }, {
                correlationId,
                userId: req.headers['x-user-id'],
                tenantId: req.headers['x-tenant-id']
            });

            res.status(202).json({
                success: true,
                data: {
                    id: customerId,
                    correlationId
                },
                message: 'Customer update initiated. You will receive real-time updates.',
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Error updating customer:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to initiate customer update',
                timestamp: new Date()
            });
        }
    }

    public static async deleteCustomer(req: Request, res: Response): Promise<void> {
        try {
            const customerId = req.params.id as string;
            const correlationId = req.headers['x-correlation-id'] as string || uuidv4();

            // Publish to Kafka for async processing
            await CustomerController.kafkaService.publishCustomerEvent('CUSTOMER_DELETE_REQUESTED', {
                id: customerId
            }, {
                correlationId,
                userId: req.headers['x-user-id'],
                tenantId: req.headers['x-tenant-id']
            });

            res.status(202).json({
                success: true,
                data: {
                    id: customerId,
                    correlationId
                },
                message: 'Customer deletion initiated. You will receive real-time updates.',
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Error deleting customer:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to initiate customer deletion',
                timestamp: new Date()
            });
        }
    }

    // READ OPERATIONS (Sync with Cache-First Pattern)
    public static async getCustomerById(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
        const customerId = req.params.id as string;
        
        if (!customerId) {
            res.status(400).json({
                success: false,
                message: 'Customer ID is required',
                timestamp: new Date()
            });
            return;
        }
        
        let customer = null;
        let cacheHit = false;

        // Step 1: Check Redis cache first
        customer = await CustomerController.redisService.getCachedCustomer(customerId);
        
        if (customer) {
            cacheHit = true;
            logger.debug(`Cache HIT for customer ${customerId}`, {
                responseTime: Date.now() - startTime
            });
        } else {
            // Step 2: Cache MISS - Query database
            logger.debug(`Cache MISS for customer ${customerId}`);
            
            // Initialize database connection if needed
            if (!CustomerController.databaseService.isConnected()) {
                await CustomerController.databaseService.connect();
            }
            
            customer = await CustomerController.databaseService.getCustomerById(customerId);
            
            if (customer) {
                // Step 3: Update cache for future requests
                await CustomerController.redisService.cacheCustomer(customer);
                logger.debug(`Cached customer ${customerId} after DB fetch`);
            }
        }

        const responseTime = Date.now() - startTime;

        if (!customer) {
            res.status(404).json({
                success: false,
                message: 'Customer not found',
                timestamp: new Date(),
                metadata: {
                    responseTime,
                    cacheHit
                }
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: customer,
            message: 'Customer retrieved successfully',
            timestamp: new Date(),
            metadata: {
                responseTime,
                cacheHit,
                source: cacheHit ? 'cache' : 'database'
            }
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;
        logger.error('Error getting customer:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve customer',
            timestamp: new Date(),
            metadata: {
                responseTime
            }
        });
    }
}

    public static async getCustomers(req: Request, res: Response): Promise<void> {
        const startTime = Date.now();

        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const search = req.query.search as string || '';

            let result = null;
            let cacheHit = false;

            // Step 1: Check cache first
            result = await CustomerController.redisService.getCachedCustomerList(page, limit, search);

            if (result) {
                cacheHit = true;
                logger.debug(`Cache HIT for customer list page:${page} limit:${limit}`, {
                    responseTime: Date.now() - startTime
                });
            } else {
                // Step 2: Cache MISS - Query database
                logger.debug(`Cache MISS for customer list page:${page} limit:${limit}`);

                // Initialize database connection if needed
                if (!CustomerController.databaseService.isConnected()) {
                    await CustomerController.databaseService.connect();
                }

                result = await CustomerController.databaseService.getCustomers(page, limit, search);

                if (result) {
                    // Step 3: Cache the result
                    await CustomerController.redisService.cacheCustomerList(page, limit, search, result);
                    logger.debug(`Cached customer list page:${page} limit:${limit}`);
                }
            }

            const responseTime = Date.now() - startTime;
            const totalPages = Math.ceil(result.total / limit);

            res.status(200).json({
                success: true,
                data: result.customers,
                message: 'Customers retrieved successfully',
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrevious: page > 1
                },
                timestamp: new Date(),
                metadata: {
                    responseTime,
                    cacheHit,
                    source: cacheHit ? 'cache' : 'database',
                    count: result.customers.length
                }
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;
            logger.error('Error getting customers:', error);

            res.status(500).json({
                success: false,
                message: 'Failed to retrieve customers',
                timestamp: new Date(),
                metadata: {
                    responseTime
                }
            });
        }
    }

    // Cache invalidation endpoint (for testing)
   public static async invalidateCache(req: Request, res: Response): Promise<void> {
    try {
        const customerId = req.params.id as string;
        
        if (!customerId) {
            res.status(400).json({
                success: false,
                message: 'Customer ID is required',
                timestamp: new Date()
            });
            return;
        }
        
        const result = await CustomerController.redisService.invalidateCustomer(customerId);
        
        res.status(200).json({
            success: true,
            data: { invalidated: result },
            message: 'Cache invalidated successfully',
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error invalidating cache:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to invalidate cache',
            timestamp: new Date()
        });
    }
}

    // Cache statistics endpoint
    public static async getCacheStats(req: Request, res: Response): Promise<void> {
        try {
            const stats = await CustomerController.redisService.getCacheStats();

            res.status(200).json({
                success: true,
                data: stats,
                message: 'Cache statistics retrieved successfully',
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Error getting cache stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve cache statistics',
                timestamp: new Date()
            });
        }
    }
}
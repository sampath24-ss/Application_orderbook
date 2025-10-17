// src/controllers/order.controller.ts - Fixed with proper types
import { Request, Response } from 'express';
import { KafkaService } from '../kafka';
import { RedisService } from '../cache/redies.service';
import { DatabaseService } from '../Engine/Services/database.service';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { CreateOrderRequest } from '../types';
import { string } from 'joi';

export class OrderController {
    private static kafkaService = KafkaService.getInstance();
    private static redisService = RedisService.getInstance();
    private static databaseService = new DatabaseService();

    // WRITE OPERATIONS (Async via Kafka)
    public static async createOrder(req: Request, res: Response): Promise<void> {
        try {
            const orderData: CreateOrderRequest = req.body;
            const orderId = uuidv4();
            const correlationId = req.headers['x-correlation-id'] as string || uuidv4();

            // Validate required fields
            if (!orderData.customerId || !orderData.items || orderData.items.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'CustomerId and items array are required',
                    timestamp: new Date()
                });
                return;
            }

            // Publish to Kafka for async processing
            await OrderController.kafkaService.publishOrderEvent('ORDER_CREATE_REQUESTED', {
                id: orderId,
                ...orderData
            }, {
                correlationId,
                userId: req.headers['x-user-id'],
                tenantId: req.headers['x-tenant-id']
            });

            res.status(202).json({
                success: true,
                data: {
                    id: orderId,
                    correlationId
                },
                message: 'Order creation initiated. You will receive real-time updates.',
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Error creating order:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to initiate order creation',
                timestamp: new Date()
            });
        }
    }

    public static async updateOrder(req: Request, res: Response): Promise<void> {
        try {
            const orderId = req.params.id;
            const updateData = req.body;
            const correlationId = req.headers['x-correlation-id'] as string || uuidv4();

            // Publish to Kafka for async processing
            await OrderController.kafkaService.publishOrderEvent('ORDER_UPDATE_REQUESTED', {
                id: orderId,
                ...updateData
            }, {
                correlationId,
                userId: req.headers['x-user-id'],
                tenantId: req.headers['x-tenant-id']
            });

            res.status(202).json({
                success: true,
                data: {
                    id: orderId,
                    correlationId
                },
                message: 'Order update initiated. You will receive real-time updates.',
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Error updating order:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to initiate order update',
                timestamp: new Date()
            });
        }
    }

    public static async cancelOrder(req: Request, res: Response): Promise<void> {
        try {
            const orderId = req.params.id;
            const correlationId = req.headers['x-correlation-id'] as string || uuidv4();

            // Publish to Kafka for async processing
            await OrderController.kafkaService.publishOrderEvent('ORDER_CANCEL_REQUESTED', {
                id: orderId
            }, {
                correlationId,
                userId: req.headers['x-user-id'],
                tenantId: req.headers['x-tenant-id']
            });

            res.status(202).json({
                success: true,
                data: {
                    id: orderId,
                    correlationId
                },
                message: 'Order cancellation initiated. You will receive real-time updates.',
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Error cancelling order:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to initiate order cancellation',
                timestamp: new Date()
            });
        }
    }

    public static async deleteOrder(req: Request, res: Response): Promise<void> {
        try {
            const orderId = req.params.id;
            const correlationId = req.headers['x-correlation-id'] as string || uuidv4();

            // Publish to Kafka for async processing
            await OrderController.kafkaService.publishOrderEvent('ORDER_DELETE_REQUESTED', {
                id: orderId
            }, {
                correlationId,
                userId: req.headers['x-user-id'],
                tenantId: req.headers['x-tenant-id']
            });

            res.status(202).json({
                success: true,
                data: {
                    id: orderId,
                    correlationId
                },
                message: 'Order deletion initiated. You will receive real-time updates.',
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Error deleting order:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to initiate order deletion',
                timestamp: new Date()
            });
        }
    }

    // READ OPERATIONS (Sync with Cache-First Pattern)
    public static async getOrderById(req: Request, res: Response): Promise<void> {
        const startTime = Date.now();

        try {
            const orderId = req.params.id as string;

            if (!orderId) {
                res.status(400).json({
                    success: false,
                    message: 'Order ID is required',
                    timestamp: new Date()
                });
                return;
            }

            let order = null;
            let cacheHit = false;

            // Step 1: Check Redis cache first
            const orderCacheKey = `order:${orderId}`;
            order = await OrderController.redisService.get(orderCacheKey);

            if (order) {
                cacheHit = true;
                logger.debug(`Cache HIT for order ${orderId}`, {
                    responseTime: Date.now() - startTime
                });
            } else {
                // Step 2: Cache MISS - Query database
                logger.debug(`Cache MISS for order ${orderId}`);

                // Initialize database connection if needed
                if (!OrderController.databaseService.isConnected()) {
                    await OrderController.databaseService.connect();
                }

                order = await OrderController.databaseService.getOrderById(orderId);

                if (order) {
                    // Step 3: Update cache for future requests
                    await OrderController.redisService.set(orderCacheKey, order, 900); // 15 minutes TTL
                    logger.debug(`Cached order ${orderId} after DB fetch`);
                }
            }

            const responseTime = Date.now() - startTime;

            if (!order) {
                res.status(404).json({
                    success: false,
                    message: 'Order not found',
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
                data: order,
                message: 'Order retrieved successfully',
                timestamp: new Date(),
                metadata: {
                    responseTime,
                    cacheHit,
                    source: cacheHit ? 'cache' : 'database'
                }
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;
            logger.error('Error getting order:', error);

            res.status(500).json({
                success: false,
                message: 'Failed to retrieve order',
                timestamp: new Date(),
                metadata: {
                    responseTime
                }
            });
        }
    }

    public static async getOrdersByCustomerId(req: Request, res: Response): Promise<void> {
        const startTime = Date.now();

        try {
            const page: number = parseInt(req.query.page as string) || 1;
            const limit: number = parseInt(req.query.limit as string) || 10;
            const status: string = req.query.status as string;

            let result: { orders: any[]; total: number } | null = null;

            let cacheHit = false;

            const customerId = req.params.customerId;
            if (!customerId) {
                res.status(400).json({ success: false, message: 'CustomerId is required' });
                return;
            }
            // Step 1: Check cache first
            const customerOrdersCacheKey = `orders:customer:${customerId}:${page}:${limit}:${status || ''}`;
            result = await OrderController.redisService.get(customerOrdersCacheKey);

            if (result) {
                cacheHit = true;
                logger.debug(`Cache HIT for customer orders ${customerId} page:${page} limit:${limit}`, {
                    responseTime: Date.now() - startTime
                });
            } else {
                // Step 2: Cache MISS - Query database
                logger.debug(`Cache MISS for customer orders ${customerId} page:${page} limit:${limit}`);

                // Initialize database connection if needed
                if (!OrderController.databaseService.isConnected()) {
                    await OrderController.databaseService.connect();
                }

                result = await OrderController.databaseService.getCustomerOrders(
                    customerId, page, limit, status
                );

                if (result) {
                    // Step 3: Cache the result
                    await OrderController.redisService.set(customerOrdersCacheKey, result, 300); // 5 minutes TTL
                    logger.debug(`Cached customer orders ${customerId} page:${page} limit:${limit}`);
                }
            }

            const responseTime = Date.now() - startTime;
            const totalPages = Math.ceil(result.total / limit);

            res.status(200).json({
                success: true,
                data: result.orders,
                message: 'Customer orders retrieved successfully',
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
                    count: result.orders.length
                }
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;
            logger.error('Error getting customer orders:', error);

            res.status(500).json({
                success: false,
                message: 'Failed to retrieve customer orders',
                timestamp: new Date(),
                metadata: {
                    responseTime
                }
            });
        }
    }

    public static async getAllOrders(req: Request, res: Response): Promise<void> {
        const startTime = Date.now();

        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const status = req.query.status as string;

            let result: { orders: any[]; total: number } | null = null;

            let cacheHit = false;

            // Step 1: Check cache first
            const allOrdersCacheKey = `orders:list:${page}:${limit}:${status || ''}`;
            result = await OrderController.redisService.get(allOrdersCacheKey);

            if (result) {
                cacheHit = true;
                logger.debug(`Cache HIT for all orders page:${page} limit:${limit}`, {
                    responseTime: Date.now() - startTime
                });
            } else {
                // Step 2: Cache MISS - Query database
                logger.debug(`Cache MISS for all orders page:${page} limit:${limit}`);

                // Initialize database connection if needed
                if (!OrderController.databaseService.isConnected()) {
                    await OrderController.databaseService.connect();
                }

                result = await OrderController.databaseService.getAllOrders(page, limit, status);

                if (result) {
                    // Step 3: Cache the result
                    await OrderController.redisService.set(allOrdersCacheKey, result, 300); // 5 minutes TTL
                    logger.debug(`Cached all orders page:${page} limit:${limit}`);
                }
            }

            const responseTime = Date.now() - startTime;
            const totalPages = Math.ceil(result.total / limit);

            res.status(200).json({
                success: true,
                data: result.orders,
                message: 'Orders retrieved successfully',
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
                    count: result.orders.length
                }
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;
            logger.error('Error getting all orders:', error);

            res.status(500).json({
                success: false,
                message: 'Failed to retrieve orders',
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
            const orderId = req.params.id as string;

            if (!orderId) {
                res.status(400).json({
                    success: false,
                    message: 'Order ID is required',
                    timestamp: new Date()
                });
                return;
            }

            // Delete the order cache key and related patterns
            const orderKey = `order:${orderId}`;
            const result = await OrderController.redisService.delete(orderKey);
            await OrderController.redisService.deletePattern('orders:list:*');
            await OrderController.redisService.deletePattern('orders:customer:*');

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
            const stats = await OrderController.redisService.getCacheStats();

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
//items.controller.ts - Updated with Redis caching
import { Request, Response } from 'express';
import { RedisService } from '../cache/redies.service';
import { DatabaseService } from '../Engine/Services/database.service';
import { ItemService } from '../Engine/Services/item.service';
import { logger } from '../utils/logger';
import { ApiResponse, CreateCustomerItemRequest, UpdateCustomerItemRequest, CustomerItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';
import { KafkaService } from '../kafka';

const kafkaService = KafkaService.getInstance();

const createCustomerItemSchema = Joi.object({
    customerId: Joi.string().uuid().required(),
    name: Joi.string().min(2).max(200).required(),
    description: Joi.string().max(1000).optional(),
    price: Joi.number().positive().precision(2).required(),
    quantity: Joi.number().integer().min(0).required(),
    category: Joi.string().max(100).optional()
});

const updateCustomerItemSchema = Joi.object({
    name: Joi.string().min(2).max(200).optional(),
    description: Joi.string().max(1000).optional(),
    price: Joi.number().positive().precision(2).optional(),
    quantity: Joi.number().integer().min(0).optional(),
    category: Joi.string().max(100).optional()
}).min(1);

export class itemController {
    // Add Redis service instance
    private static redisService = RedisService.getInstance();
    private static databaseService = new DatabaseService();
    private static itemService = new ItemService(itemController.databaseService);

    public static async createCustomerItem(req: Request, res: Response): Promise<void> {
        try {
            const { error, value } = createCustomerItemSchema.validate(req.body);
            if (error) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Validation failed',
                    errors: error.details.map(detail => detail.message),
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            const itemData: CreateCustomerItemRequest = value;
            const itemId = uuidv4();

            const itemWithId = {
                id: itemId,
                ...itemData,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await kafkaService.publishCustomerItemEvent(
                'ITEM_CREATED',
                itemWithId,
                {
                    correlationId: uuidv4(),
                    userId: req.headers['x-user-id'] as string,
                    tenantId: req.headers['x-tenant-id'] as string
                }
            );

            // Invalidate related caches after creation event
            await itemController.redisService.deletePattern('items:list:*');
            await itemController.redisService.deletePattern(`items:customer:${itemData.customerId}*`);

            logger.info(`Customer item creation event published for ID: ${itemId}`);

            const response: ApiResponse = {
                success: true,
                data: {
                    id: itemId,
                    customerId: itemData.customerId,
                    message: 'Customer item creation initiated'
                },
                message: 'Customer item will be created shortly',
                timestamp: new Date()
            };

            res.status(202).json(response);
        } catch (error) {
            logger.error('Error in createCustomerItem:', error);
            throw error;
        }
    }

    public static async getCustomerItems(req: Request, res: Response): Promise<void> {
        const startTime = Date.now();

        try {
            const customerId = req.params.customerId;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const category = req.query.category as string || '';
            const search = req.query.search as string || '';

            if (!customerId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Customer ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            let result: { items: CustomerItem[]; total: number } | null = null;
            let cacheHit = false;

            // Step 1: Check Redis cache first
            result = await itemController.redisService.getCachedCustomerItemsList(
                customerId, page, limit, category, search
            );

            if (result) {
                cacheHit = true;
                logger.debug(`Cache HIT for customer items list`, {
                    customerId,
                    page,
                    limit,
                    responseTime: Date.now() - startTime
                });

                const responseTime = Date.now() - startTime;

                res.status(200).json({
                    success: true,
                    data: {
                        items: result.items,
                        total: result.total,
                        page,
                        limit,
                        totalPages: Math.ceil(result.total / limit)
                    },
                    message: 'Customer items retrieved successfully from cache',
                    timestamp: new Date(),
                    metadata: {
                        responseTime,
                        cacheHit,
                        source: 'cache',
                        count: result.items.length
                    }
                });
                return;
            }

            // Step 2: Cache MISS - Use existing Kafka flow but also query DB directly for immediate response
            logger.debug(`Cache MISS for customer items list`, { customerId, page, limit });

            // Initialize database connection if needed
            if (!itemController.databaseService.isConnected()) {
                await itemController.databaseService.connect();
            }

            // Get data from database directly for immediate response
            result = await itemController.itemService.getCustomerItems(
                customerId, page, limit, category, search
            );

            if (result) {
                // Step 3: Update cache for future requests
                await itemController.redisService.cacheCustomerItemsList(
                    customerId, page, limit, category, search, result
                );
                logger.debug(`Cached customer items list after DB fetch`);

                const responseTime = Date.now() - startTime;

                res.status(200).json({
                    success: true,
                    data: {
                        items: result.items,
                        total: result.total,
                        page,
                        limit,
                        totalPages: Math.ceil(result.total / limit)
                    },
                    message: 'Customer items retrieved successfully from database',
                    timestamp: new Date(),
                    metadata: {
                        responseTime,
                        cacheHit: false,
                        source: 'database',
                        count: result.items.length
                    }
                });
            } else {
                // Fallback to your original Kafka flow
                await kafkaService.publishCustomerItemEvent(
                    'ITEMS_REQUESTED',
                    {
                        customerId,
                        page,
                        limit,
                        category,
                        search,
                        requestId: uuidv4()
                    },
                    {
                        correlationId: uuidv4(),
                        userId: req.headers['x-user-id'] as string,
                        tenantId: req.headers['x-tenant-id'] as string
                    }
                );

                const response: ApiResponse = {
                    success: true,
                    message: 'Customer items request processed. Results will be available via WebSocket.',
                    data: {
                        customerId,
                        requestId: uuidv4(),
                        message: 'Subscribe to item-updates topic for real-time results'
                    },
                    timestamp: new Date()
                };

                res.status(200).json(response);
            }
        } catch (error) {
            logger.error('Error in getCustomerItems:', error);

            // Fallback to original Kafka flow on error
            try {
                await kafkaService.publishCustomerItemEvent(
                    'ITEMS_REQUESTED',
                    {
                        customerId: req.params.customerId,
                        page: parseInt(req.query.page as string) || 1,
                        limit: parseInt(req.query.limit as string) || 10,
                        category: req.query.category as string,
                        search: req.query.search as string,
                        requestId: uuidv4()
                    },
                    {
                        correlationId: uuidv4(),
                        userId: req.headers['x-user-id'] as string,
                        tenantId: req.headers['x-tenant-id'] as string
                    }
                );

                const response: ApiResponse = {
                    success: true,
                    message: 'Customer items request processed. Results will be available via WebSocket.',
                    data: {
                        customerId: req.params.customerId,
                        requestId: uuidv4(),
                        message: 'Subscribe to item-updates topic for real-time results'
                    },
                    timestamp: new Date()
                };

                res.status(200).json(response);
            } catch (kafkaError) {
                logger.error('Error in fallback Kafka flow:', kafkaError);
                throw error;
            }
        }
    }

    public static async getAllItems(req: Request, res: Response): Promise<void> {
        const startTime = Date.now();

        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const category = req.query.category as string | undefined || '';
            const search = req.query.search as string | undefined || '';
            const customerId = req.query.customerId as string | undefined || '';

            let result: { items: CustomerItem[]; total: number } | null = null;
            let cacheHit = false;

            // Step 1: Check Redis cache first
            const cacheKey = itemController.getItemsListCacheKey(page, limit, category, search, customerId);
            result = await itemController.redisService.get<{ items: CustomerItem[]; total: number }>(cacheKey);

            
            if (result) {
                cacheHit = true;
                logger.debug(`Cache HIT for all items list`, {
                    page,
                    limit,
                    responseTime: Date.now() - startTime
                });

                const responseTime = Date.now() - startTime;

                res.status(200).json({
                    success: true,
                    data: {
                        items: result.items,
                        total: result.total,
                        page, 
                        limit,
                        totalPages: Math.ceil(result.total / limit),
                        filters: { category, search, customerId }
                    },
                    message: 'Items retrieved successfully from cache',
                    timestamp: new Date(),
                    metadata: {
                        responseTime,
                        cacheHit,
                        source: 'cache',
                        count: result.items.length
                    }
                });
                return;
            }

            // Step 2: Cache MISS - Get from database directly
            logger.debug(`Cache MISS for all items list`);

            // Initialize database connection if needed
            if (!itemController.databaseService.isConnected()) {
                await itemController.databaseService.connect();
            }

            // Get data from database directly for immediate response
            result = await itemController.itemService.getAllItems(
                page, limit, category, search, customerId
            );

            if (result) {
                // Step 3: Update cache for future requests
                await itemController.redisService.set(
                    cacheKey,
                    result,
                    itemController.redisService.getTTL('itemList')
                );
                logger.debug(`Cached all items list after DB fetch`);

                const responseTime = Date.now() - startTime;

                res.status(200).json({
                    success: true,
                    data: {
                        items: result.items,
                        total: result.total,
                        page,
                        limit,
                        totalPages: Math.ceil(result.total / limit),
                        filters: { category, search, customerId }
                    },
                    message: 'Items retrieved successfully from database',
                    timestamp: new Date(),
                    metadata: {
                        responseTime,
                        cacheHit: false,
                        source: 'database',
                        count: result.items.length
                    }
                });
            } else {
                // Fallback to original Kafka flow
                const requestId = uuidv4();

                await kafkaService.publishCustomerItemEvent(
                    'ALL_ITEMS_REQUESTED',
                    {
                        page,
                        limit,
                        category,
                        search,
                        customerId,
                        requestId
                    },
                    {
                        correlationId: uuidv4(),
                        userId: req.headers['x-user-id'] as string,
                        tenantId: req.headers['x-tenant-id'] as string
                    }
                );

                res.status(200).json({
                    success: true,
                    message: 'Items request processed. Results will be available via WebSocket.',
                    data: {
                        requestId,
                        customerId,
                        page,
                        limit,
                        filters: { category, search },
                        message: 'Subscribe to item-updates topic for real-time results'
                    },
                    timestamp: new Date()
                });
            }
        } catch (error) {
            logger.error('Error in getAllItems:', error);
            try {
                const requestId = uuidv4();

                await kafkaService.publishCustomerItemEvent(
                    'ALL_ITEMS_REQUESTED',
                    {
                        page: parseInt(req.query.page as string) || 1,
                        limit: parseInt(req.query.limit as string) || 10,
                        category: req.query.category as string | undefined,
                        search: req.query.search as string | undefined,
                        customerId: req.query.customerId as string | undefined,
                        requestId
                    },
                    {
                        correlationId: uuidv4(),
                        userId: req.headers['x-user-id'] as string,
                        tenantId: req.headers['x-tenant-id'] as string
                    }
                );

                res.status(200).json({
                    success: true,
                    message: 'Items request processed. Results will be available via WebSocket.',
                    data: {
                        requestId,
                        customerId: req.query.customerId,
                        page: parseInt(req.query.page as string) || 1,
                        limit: parseInt(req.query.limit as string) || 10,
                        filters: { category: req.query.category, search: req.query.search },
                        message: 'Subscribe to item-updates topic for real-time results'
                    },
                    timestamp: new Date()
                });
            } catch (kafkaError) {
                logger.error('Error in fallback Kafka flow:', kafkaError);
                throw error;
            }
        }
    }

    public static async getCustomerItemById(req: Request, res: Response): Promise<void> {
        const startTime = Date.now();

        try {
            const itemId = req.params.id;

            if (!itemId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Item ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            let item: CustomerItem | null = null;
            let cacheHit = false;

            // Step 1: Check Redis cache first
            item = await itemController.redisService.getCachedCustomerItem(itemId);

            if (item) {
                cacheHit = true;
                logger.debug(`Cache HIT for item ${itemId}`, {
                    responseTime: Date.now() - startTime
                });

                const responseTime = Date.now() - startTime;

                res.status(200).json({
                    success: true,
                    data: item,
                    message: 'Item retrieved successfully from cache',
                    timestamp: new Date(),
                    metadata: {
                        responseTime,
                        cacheHit,
                        source: 'cache'
                    }
                });
                return;
            }

            // Step 2: Cache MISS - Get from database directly
            logger.debug(`Cache MISS for item ${itemId}`);

            // Initialize database connection if needed
            if (!itemController.databaseService.isConnected()) {
                await itemController.databaseService.connect();
            }

            item = await itemController.itemService.getCustomerItemById(itemId);

            if (item) {
                // Step 3: Update cache for future requests
                await itemController.redisService.cacheCustomerItem(item);
                logger.debug(`Cached item ${itemId} after DB fetch`);

                const responseTime = Date.now() - startTime;

                res.status(200).json({
                    success: true,
                    data: item,
                    message: 'Item retrieved successfully from database',
                    timestamp: new Date(),
                    metadata: {
                        responseTime,
                        cacheHit: false,
                        source: 'database'
                    }
                });
            } else { 
                // Fallback to original Kafka flow
                await kafkaService.publishCustomerItemEvent(
                    'ITEM_REQUESTED',
                    {
                        itemId,
                        requestId: uuidv4()
                    },
                    {
                        correlationId: uuidv4(),
                        userId: req.headers['x-user-id'] as string,
                        tenantId: req.headers['x-tenant-id'] as string
                    }
                );

                const response: ApiResponse = {
                    success: true,
                    message: 'Item request processed. Result will be available via WebSocket.',
                    data: {
                        itemId,
                        message: 'Subscribe to item-updates topic for real-time result'
                    },
                    timestamp: new Date()
                };

                res.status(200).json(response);
            }
        } catch (error) {
            logger.error('Error in getCustomerItemById:', error);

            // Fallback to original Kafka flow on error
            try {
                await kafkaService.publishCustomerItemEvent(
                    'ITEM_REQUESTED',
                    {
                        itemId: req.params.id,
                        requestId: uuidv4()
                    },
                    {
                        correlationId: uuidv4(),
                        userId: req.headers['x-user-id'] as string,
                        tenantId: req.headers['x-tenant-id'] as string
                    }
                );

                const response: ApiResponse = {
                    success: true,
                    message: 'Item request processed. Result will be available via WebSocket.',
                    data: {
                        itemId: req.params.id,
                        message: 'Subscribe to item-updates topic for real-time result'
                    },
                    timestamp: new Date()
                };

                res.status(200).json(response);
            } catch (kafkaError) {
                logger.error('Error in fallback Kafka flow:', kafkaError);
                throw error;
            }
        }
    }

    public static async updateCustomerItem(req: Request, res: Response): Promise<void> {
        try {
            const itemId = req.params.id;

            if (!itemId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Item ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            const { error, value } = updateCustomerItemSchema.validate(req.body);
            if (error) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Validation failed',
                    errors: error.details.map(detail => detail.message),
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            const updateData: UpdateCustomerItemRequest = value;

            await kafkaService.publishCustomerItemEvent(
                'ITEM_UPDATED',
                {
                    id: itemId,
                    ...updateData,
                    updatedAt: new Date()
                },
                {
                    correlationId: uuidv4(),
                    userId: req.headers['x-user-id'] as string,
                    tenantId: req.headers['x-tenant-id'] as string
                }
            );

            // Invalidate related caches after update event
            await itemController.redisService.invalidateCustomerItem(itemId);

            logger.info(`Customer item update event published for ID: ${itemId}`);

            const response: ApiResponse = {
                success: true,
                data: {
                    id: itemId,
                    message: 'Customer item update initiated'
                },
                message: 'Customer item will be updated shortly',
                timestamp: new Date()
            };

            res.status(202).json(response);
        } catch (error) {
            logger.error('Error in updateCustomerItem:', error);
            throw error;
        }
    }

    public static async deleteCustomerItem(req: Request, res: Response): Promise<void> {
        try {
            const itemId = req.params.id;

            if (!itemId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Item ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            await kafkaService.publishCustomerItemEvent(
                'ITEM_DELETED',
                {
                    id: itemId,
                    deletedAt: new Date()
                },
                {
                    correlationId: uuidv4(),
                    userId: req.headers['x-user-id'] as string,
                    tenantId: req.headers['x-tenant-id'] as string
                }
            );

            // Invalidate related caches after deletion event
            await itemController.redisService.invalidateCustomerItem(itemId);

            logger.info(`Customer item deletion event published for ID: ${itemId}`);

            const response: ApiResponse = {
                success: true,
                data: {
                    id: itemId,
                    message: 'Customer item deletion initiated'
                },
                message: 'Customer item will be deleted shortly',
                timestamp: new Date()
            };

            res.status(202).json(response);
        } catch (error) {
            logger.error('Error in deleteCustomerItem:', error);
            throw error;
        }
    }

    public static async updateItemQuantity(req: Request, res: Response): Promise<void> {
        try {
            const itemId = req.params.id;
            const { quantity, operation } = req.body;

            if (!itemId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Item ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            const quantitySchema = Joi.object({
                quantity: Joi.number().integer().min(0).required(),
                operation: Joi.string().valid('set', 'add', 'subtract').default('set')
            });

            const { error, value } = quantitySchema.validate({ quantity, operation });
            if (error) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Validation failed',
                    errors: error.details.map(detail => detail.message),
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            await kafkaService.publishCustomerItemEvent(
                'ITEM_QUANTITY_UPDATED',
                {
                    id: itemId,
                    quantity: value.quantity,
                    operation: value.operation,
                    updatedAt: new Date()
                },
                {
                    correlationId: uuidv4(),
                    userId: req.headers['x-user-id'] as string,
                    tenantId: req.headers['x-tenant-id'] as string
                }
            );

            // Invalidate related caches after quantity update event
            await itemController.redisService.invalidateCustomerItem(itemId);

            logger.info(`Item quantity update event published for ID: ${itemId}`);

            const response: ApiResponse = {
                success: true,
                data: {
                    id: itemId,
                    quantity: value.quantity,
                    operation: value.operation,
                    message: 'Item quantity update initiated'
                },
                message: 'Item quantity will be updated shortly',
                timestamp: new Date()
            };

            res.status(202).json(response);
        } catch (error) {
            logger.error('Error in updateItemQuantity:', error);
            throw error;
        }
    }

    // Cache Management Operations
    public static async invalidateItemCache(req: Request, res: Response): Promise<void> {
        try {
            const itemId:any = req.params.id;
            const customerId = req.query.customerId as string;

            const result = await itemController.redisService.invalidateCustomerItem(itemId, customerId);

            res.status(200).json({
                success: true,
                data: { invalidated: result },
                message: 'Item cache invalidated successfully',
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Error invalidating item cache:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to invalidate item cache',
                timestamp: new Date()
            });
        }
    }

    // Helper Methods
    private static getItemsListCacheKey(
        page: number,
        limit: number,
        category: string,
        search: string,
        customerId: string
    ): string {
        const categoryPart = category ? `:${category}` : '';
        const searchPart = search ? `:${Buffer.from(search).toString('base64')}` : '';
        const customerPart = customerId ? `:${customerId}` : '';
        return `items:list:${page}:${limit}${categoryPart}${searchPart}${customerPart}`;
    }
}
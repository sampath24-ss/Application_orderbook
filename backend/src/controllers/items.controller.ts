import { Request, Response } from 'express';

import { logger } from '../utils/logger';
import { ApiResponse, CreateCustomerItemRequest, UpdateCustomerItemRequest } from '../types';
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
        try {
            const customerId = req.params.customerId;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const category = req.query.category as string;
            const search = req.query.search as string;

            if (!customerId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Customer ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }
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
        } catch (error) {
            logger.error('Error in getCustomerItems:', error);
            throw error;
        }
    }

public static async getAllItems(req: Request, res: Response): Promise<void> {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const category = req.query.category as string | undefined;
        const search = req.query.search as string | undefined;
        const customerId = req.query.customerId as string | undefined;

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
    } catch (error) {
        logger.error('Error in getAllItems:', error);
        throw error;
    }
}


    public static async getCustomerItemById(req: Request, res: Response): Promise<void> {
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

            // Publish query event
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
        } catch (error) {
            logger.error('Error in getCustomerItemById:', error);
            throw error;
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
}
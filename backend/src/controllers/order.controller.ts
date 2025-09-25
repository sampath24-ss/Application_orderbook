import { Request, Response } from 'express';
import { KafkaService } from '../kafka';
import { logger } from '../utils/logger';
import { ApiResponse, CreateOrderRequest, UpdateOrderRequest, OrderStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';

const kafkaService = KafkaService.getInstance();

const createOrderSchema = Joi.object({
    customerId: Joi.string().uuid().required(),
    items: Joi.array().items(
        Joi.object({
            itemId: Joi.string().uuid().required(),
            quantity: Joi.number().integer().positive().required()
        })
    ).min(1).required(),
    notes: Joi.string().max(1000).optional(),
    deliveryDate: Joi.date().iso().greater('now').optional()
});

const updateOrderSchema = Joi.object({
    status: Joi.string().valid(...Object.values(OrderStatus)).optional(),
    deliveryDate: Joi.date().iso().greater('now').optional(),
    notes: Joi.string().max(1000).optional()
}).min(1);

export class OrderController {


    public static async createOrder(req: Request, res: Response): Promise<void> {
        try {
            const { error, value } = createOrderSchema.validate(req.body);
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

            const orderData: CreateOrderRequest = value;
            const orderId = uuidv4();

            const orderWithId = {
                id: orderId,
                ...orderData,
                status: OrderStatus.PENDING,
                orderDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await kafkaService.publishOrderEvent(
                'ORDER_CREATED',
                orderWithId,
                {
                    correlationId: uuidv4(),
                    userId: req.headers['x-user-id'] as string,
                    tenantId: req.headers['x-tenant-id'] as string
                }
            );

            logger.info(`Order creation event published for ID: ${orderId}`);

            const response: ApiResponse = {
                success: true,
                data: {
                    id: orderId,
                    customerId: orderData.customerId,
                    status: OrderStatus.PENDING,
                    message: 'Order creation initiated'
                },
                message: 'Order will be processed shortly',
                timestamp: new Date()
            };

            res.status(202).json(response);
        } catch (error) {
            logger.error('Error in createOrder:', error);
            throw error;
        }
    }


    public static async getOrderById(req: Request, res: Response): Promise<void> {
        try {
            const orderId = req.params.id;

            if (!orderId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Order ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            await kafkaService.publishOrderEvent(
                'ORDER_REQUESTED',
                {
                    orderId,
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
                message: 'Order request processed. Result will be available via WebSocket.',
                data: {
                    orderId,
                    message: 'Subscribe to order-updates topic for real-time result'
                },
                timestamp: new Date()
            };

            res.status(200).json(response);
        } catch (error) {
            logger.error('Error in getOrderById:', error);
            throw error;
        }
    }


    public static async getOrdersByCustomerId(req: Request, res: Response): Promise<void> {
        try {
            const customerId = req.params.customerId;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const status = req.query.status as OrderStatus;
            const startDate = req.query.startDate as string;
            const endDate = req.query.endDate as string;

            if (!customerId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Customer ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            if (status && !Object.values(OrderStatus).includes(status)) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Invalid order status',
                    errors: [`Status must be one of: ${Object.values(OrderStatus).join(', ')}`],
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            await kafkaService.publishOrderEvent(
                'CUSTOMER_ORDERS_REQUESTED',
                {
                    customerId,
                    page,
                    limit,
                    status,
                    startDate,
                    endDate,
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
                message: 'Customer orders request processed. Results will be available via WebSocket.',
                data: {
                    customerId,
                    requestId: uuidv4(),
                    message: 'Subscribe to order-updates topic for real-time results'
                },
                timestamp: new Date()
            };

            res.status(200).json(response);
        } catch (error) {
            logger.error('Error in getOrdersByCustomerId:', error);
            throw error;
        }
    }


    public static async getAllOrders(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const status = req.query.status as OrderStatus;
            const startDate = req.query.startDate as string;
            const endDate = req.query.endDate as string;
            const customerId = req.query.customerId as string;

            if (status && !Object.values(OrderStatus).includes(status)) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Invalid order status',
                    errors: [`Status must be one of: ${Object.values(OrderStatus).join(', ')}`],
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            // Publish query event
            await kafkaService.publishOrderEvent(
                'ALL_ORDERS_REQUESTED',
                {
                    page,
                    limit,
                    status,
                    startDate,
                    endDate,
                    customerId,
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
                message: 'Orders request processed. Results will be available via WebSocket.',
                data: {
                    requestId: uuidv4(),
                    message: 'Subscribe to order-updates topic for real-time results'
                },
                timestamp: new Date()
            };

            res.status(200).json(response);
        } catch (error) {
            logger.error('Error in getAllOrders:', error);
            throw error;
        }
    }


    public static async updateOrder(req: Request, res: Response): Promise<void> {
        try {
            const orderId = req.params.id;

            if (!orderId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Order ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            const { error, value } = updateOrderSchema.validate(req.body);
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

            const updateData: UpdateOrderRequest = value;

            await kafkaService.publishOrderEvent(
                'ORDER_UPDATED',
                {
                    id: orderId,
                    ...updateData,
                    updatedAt: new Date()
                },
                {
                    correlationId: uuidv4(),
                    userId: req.headers['x-user-id'] as string,
                    tenantId: req.headers['x-tenant-id'] as string
                }
            );

            logger.info(`Order update event published for ID: ${orderId}`);

            const response: ApiResponse = {
                success: true,
                data: {
                    id: orderId,
                    message: 'Order update initiated'
                },
                message: 'Order will be updated shortly',
                timestamp: new Date()
            };

            res.status(202).json(response);
        } catch (error) {
            logger.error('Error in updateOrder:', error);
            throw error;
        }
    }

    public static async cancelOrder(req: Request, res: Response): Promise<void> {
        try {
            const orderId = req.params.id;
            const { reason } = req.body;

            if (!orderId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Order ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            await kafkaService.publishOrderEvent(
                'ORDER_CANCELLED',
                {
                    id: orderId,
                    status: OrderStatus.CANCELLED,
                    reason: reason || 'Cancelled by user',
                    cancelledAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    correlationId: uuidv4(),
                    userId: req.headers['x-user-id'] as string,
                    tenantId: req.headers['x-tenant-id'] as string
                }
            );

            logger.info(`Order cancellation event published for ID: ${orderId}`);

            const response: ApiResponse = {
                success: true,
                data: {
                    id: orderId,
                    status: OrderStatus.CANCELLED,
                    message: 'Order cancellation initiated'
                },
                message: 'Order will be cancelled shortly',
                timestamp: new Date()
            };

            res.status(202).json(response);
        } catch (error) {
            logger.error('Error in cancelOrder:', error);
            throw error;
        }
    }


    public static async deleteOrder(req: Request, res: Response): Promise<void> {
        try {
            const orderId = req.params.id;

            if (!orderId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Order ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            // Publish delete event
            await kafkaService.publishOrderEvent(
                'ORDER_DELETED',
                {
                    id: orderId,
                    deletedAt: new Date()
                },
                {
                    correlationId: uuidv4(),
                    userId: req.headers['x-user-id'] as string,
                    tenantId: req.headers['x-tenant-id'] as string
                }
            );

            logger.info(`Order deletion event published for ID: ${orderId}`);

            const response: ApiResponse = {
                success: true,
                data: {
                    id: orderId,
                    message: 'Order deletion initiated'
                },
                message: 'Order will be deleted shortly',
                timestamp: new Date()
            };

            res.status(202).json(response);
        } catch (error) {
            logger.error('Error in deleteOrder:', error);
            throw error;
        }
    }
}
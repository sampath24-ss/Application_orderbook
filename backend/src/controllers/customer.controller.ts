import { Request, Response } from 'express';
import { KafkaService } from '../kafka';
import { logger } from '../utils/logger';
import { ApiResponse, CreateCustomerRequest, UpdateCustomerRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';

const kafkaService = KafkaService.getInstance();


const createCustomerSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional(),
    address: Joi.string().max(500).optional()
});

const updateCustomerSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional(),
    address: Joi.string().max(500).optional()
}).min(1);

export class CustomerController {

    public static async createCustomer(req: Request, res: Response): Promise<void> {
        try {
            const { error, value } = createCustomerSchema.validate(req.body);
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

            const customerData: CreateCustomerRequest = value;
            const customerId = uuidv4();

            const customerWithId = {
                id: customerId,
                ...customerData,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await kafkaService.publishCustomerEvent(
                'CUSTOMER_CREATED',
                customerWithId,
                {
                    correlationId: uuidv4(),
                    userId: req.headers['x-user-id'] as string,
                    tenantId: req.headers['x-tenant-id'] as string
                }
            );

            logger.info(`Customer creation event published for ID: ${customerId}`);

            const response: ApiResponse = {
                success: true,
                data: { id: customerId, message: 'Customer creation initiated' },
                message: 'Customer will be created shortly',
                timestamp: new Date()
            };

            res.status(202).json(response);
        } catch (error) {
            logger.error('Error in createCustomer:', error);
            throw error;
        }
    }


    public static async getAllCustomers(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const search = req.query.search as string;

            await kafkaService.publishCustomerEvent(
                'CUSTOMERS_REQUESTED',
                { page, limit, search, requestId: uuidv4() },
                {
                    correlationId: uuidv4(),
                    userId: req.headers['x-user-id'] as string,
                    tenantId: req.headers['x-tenant-id'] as string
                }
            );

            const response: ApiResponse = {
                success: true,
                message: 'Customer list request processed. Results will be available via WebSocket.',
                data: { requestId: uuidv4(), message: 'Subscribe to customer-updates topic for real-time results' },
                timestamp: new Date()
            };

            res.status(200).json(response);
        } catch (error) {
            logger.error('Error in getAllCustomers:', error);
            throw error;
        }
    }


    public static async getCustomerById(req: Request, res: Response): Promise<void> {
        try {
            const customerId = req.params.id;

            if (!customerId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Customer ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            await kafkaService.publishCustomerEvent(
                'CUSTOMER_REQUESTED',
                { id: customerId, requestId: uuidv4() },
                {
                    correlationId: uuidv4(),
                    userId: req.headers['x-user-id'] as string,
                    tenantId: req.headers['x-tenant-id'] as string
                }
            );

            const response: ApiResponse = {
                success: true,
                message: 'Customer request processed. Result will be available via WebSocket.',
                data: { id: customerId, message: 'Subscribe to customer-updates topic for real-time result' },
                timestamp: new Date()
            };

            res.status(200).json(response);
        } catch (error) {
            logger.error('Error in getCustomerById:', error);
            throw error;
        }
    }


    public static async updateCustomer(req: Request, res: Response): Promise<void> {
        try {
            const customerId = req.params.id;

            if (!customerId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Customer ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            const { error, value } = updateCustomerSchema.validate(req.body);
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

            const updateData: UpdateCustomerRequest = value;

            await kafkaService.publishCustomerEvent(
                'CUSTOMER_UPDATED',
                { id: customerId, ...updateData, updatedAt: new Date() },
                {
                    correlationId: uuidv4(),
                    userId: req.headers['x-user-id'] as string,
                    tenantId: req.headers['x-tenant-id'] as string
                }
            );

            logger.info(`Customer update event published for ID: ${customerId}`);

            const response: ApiResponse = {
                success: true,
                data: { id: customerId, message: 'Customer update initiated' },
                message: 'Customer will be updated shortly',
                timestamp: new Date()
            };

            res.status(202).json(response);
        } catch (error) {
            logger.error('Error in updateCustomer:', error);
            throw error;
        }
    }


    public static async deleteCustomer(req: Request, res: Response): Promise<void> {
        try {
            const customerId = req.params.id;

            if (!customerId) {
                const response: ApiResponse = {
                    success: false,
                    message: 'Customer ID is required',
                    timestamp: new Date()
                };
                res.status(400).json(response);
                return;
            }

            await kafkaService.publishCustomerEvent(
                'CUSTOMER_DELETED',
                { id: customerId, deletedAt: new Date() },
                {
                    correlationId: uuidv4(),
                    userId: req.headers['x-user-id'] as string,
                    tenantId: req.headers['x-tenant-id'] as string
                }
            );

            logger.info(`Customer deletion event published for ID: ${customerId}`);

            const response: ApiResponse = {
                success: true,
                data: { id: customerId, message: 'Customer deletion initiated' },
                message: 'Customer will be deleted shortly',
                timestamp: new Date()
            };

            res.status(202).json(response);
        } catch (error) {
            logger.error('Error in deleteCustomer:', error);
            throw error;
        }
    }
}

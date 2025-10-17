// engine/services/customer.service.ts
import { DatabaseService } from './database.service';
import { logger } from '../../utils/logger';
import {
    Customer,
    CreateCustomerRequest,
    UpdateCustomerRequest
} from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class CustomerService {
    constructor(private databaseService: DatabaseService) { }

    public async createCustomer(data: CreateCustomerRequest | Customer): Promise<Customer> {
        try {
            const existingCustomers = await this.databaseService.getCustomers(1, 1, data.email);
            if (existingCustomers.customers.length > 0) {
                throw new Error(`Customer with email ${data.email} already exists`);
            }

            const customer: Customer = {
                id: 'id' in data ? data.id : uuidv4(),
                name: data.name,
                email: data.email,
                phone: data.phone,
                address: data.address,
                createdAt: 'createdAt' in data ? data.createdAt : new Date(),
                updatedAt: 'updatedAt' in data ? data.updatedAt : new Date(),
                status: 'ACTIVE'
            };

            const createdCustomer = await this.databaseService.createCustomer(customer);

            logger.info(`Customer created successfully:`, {
                customerId: createdCustomer.id,
                email: createdCustomer.email
            });

            return createdCustomer;

        } catch (error) {
            logger.error('Error creating customer:', error);
            throw error;
        }
    }

    public async getCustomerById(id: string): Promise<Customer | null> {
        try {
            if (!id || !this.isValidUuid(id)) {
                throw new Error('Invalid customer ID format');
            }

            const customer = await this.databaseService.getCustomerById(id);

            if (customer) {
                logger.info(`Customer retrieved:`, { customerId: id });
            } else {
                logger.warn(`Customer not found:`, { customerId: id });
            }

            return customer;

        } catch (error) {
            logger.error('Error getting customer by ID:', error);
            throw error;
        }
    }

    public async getCustomers(
        page: number = 1,
        limit: number = 10,
        search?: string
    ): Promise<{ customers: Customer[]; total: number; page: number; limit: number; totalPages: number }> {
        try {
            if (page < 1) page = 1;
            if (limit < 1 || limit > 100) limit = 10;

            const result = await this.databaseService.getCustomers(page, limit, search);
            const totalPages = Math.ceil(result.total / limit);

            logger.info(`Retrieved customers:`, {
                page,
                limit,
                total: result.total,
                totalPages,
                search: search || 'none'
            });

            return {
                customers: result.customers,
                total: result.total,
                page,
                limit,
                totalPages
            };

        } catch (error) {
            logger.error('Error getting customers:', error);
            throw error;
        }
    }

    public async updateCustomer(id: string, updates: UpdateCustomerRequest): Promise<Customer | null> {
    try {
        if (!id || !this.isValidUuid(id)) {
            throw new Error('Invalid customer ID format');
        }

        const existingCustomer = await this.databaseService.getCustomerById(id);
        if (!existingCustomer) {
            logger.warn(`Attempted to update non-existent customer:`, { customerId: id });
            return null;
        }

        if (updates.email && updates.email !== existingCustomer.email) {
            try {
                const emailCheck = await this.databaseService.getCustomers(1, 1, updates.email);
                if (emailCheck && emailCheck.customers && emailCheck.customers.length > 0) {
                    const existingEmailCustomer = emailCheck.customers[0];
                    if (existingEmailCustomer && existingEmailCustomer.id !== id) {
                        throw new Error(`Customer with email ${updates.email} already exists`);
                    }
                }
            } catch (emailCheckError) {
                logger.error('Error checking email uniqueness:', emailCheckError);
                throw new Error('Unable to validate email uniqueness');
            }
        }

        const updatedCustomer = await this.databaseService.updateCustomer(id, updates);
        
        if (updatedCustomer) {
            logger.info(`Customer updated successfully:`, {
                customerId: id,
                updatedFields: Object.keys(updates)
            });
        }

        return updatedCustomer;

    } catch (error) {
        logger.error('Error updating customer:', error);
        throw error;
    }
}

    public async deleteCustomer(id: string): Promise<boolean> {
        try {
            if (!id || !this.isValidUuid(id)) {
                throw new Error('Invalid customer ID format');
            }

            const existingCustomer = await this.databaseService.getCustomerById(id);
            if (!existingCustomer) {
                logger.warn(`Attempted to delete non-existent customer:`, { customerId: id });
                return false;
            }

            const deleted = await this.databaseService.deleteCustomer(id);

            if (deleted) {
                logger.info(`Customer deleted successfully:`, { customerId: id });
            } else {
                logger.warn(`Failed to delete customer:`, { customerId: id });
            }

            return deleted;

        } catch (error) {
            logger.error('Error deleting customer:', error);
            throw error;
        }
    }

    private isValidUuid(uuid: string): boolean {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
}
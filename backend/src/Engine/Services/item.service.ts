// engine/services/item.service.ts
import { DatabaseService } from './database.service';
import { logger } from '../../utils/logger';
import {
    CustomerItem,
    CreateCustomerItemRequest,
    UpdateCustomerItemRequest
} from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class ItemService {
    constructor(private databaseService: DatabaseService) { }

    public async createCustomerItem(data: CreateCustomerItemRequest | CustomerItem): Promise<CustomerItem> {
        try {
            const customer = await this.databaseService.getCustomerById(data.customerId);
            if (!customer) {
                throw new Error(`Customer with ID ${data.customerId} not found`);
            }
            const item: CustomerItem = {
                id: 'id' in data ? data.id : uuidv4(),
                customerId: data.customerId,
                name: data.name,
                description: data.description,
                price: data.price,
                quantity: data.quantity,
                category: data.category,
                createdAt: 'createdAt' in data ? data.createdAt : new Date(),
                updatedAt: 'updatedAt' in data ? data.updatedAt : new Date(),
                status: 'ACTIVE'
            };

            const createdItem = await this.databaseService.createCustomerItem(item);

            logger.info(`Customer item created successfully:`, {
                itemId: createdItem.id,
                customerId: createdItem.customerId,
                name: createdItem.name
            });

            return createdItem;

        } catch (error) {
            logger.error('Error creating customer item:', error);
            throw error;
        }
    }

    public async getCustomerItemById(id: string): Promise<CustomerItem | null> {
        try {
            if (!id || !this.isValidUuid(id)) {
                throw new Error('Invalid item ID format');
            }

            const item = await this.databaseService.getCustomerItemById(id);

            if (item) {
                logger.info(`Customer item retrieved:`, { itemId: id });
            } else {
                logger.warn(`Customer item not found:`, { itemId: id });
            }

            return item;

        } catch (error) {
            logger.error('Error getting customer item by ID:', error);
            throw error;
        }
    }

    public async getCustomerItems(
        customerId: string,
        page: number = 1,
        limit: number = 10,
        category?: string,
        search?: string
    ): Promise<{ items: CustomerItem[]; total: number; page: number; limit: number; totalPages: number }> {
        try {
            if (!customerId || !this.isValidUuid(customerId)) {
                throw new Error('Invalid customer ID format');
            }

            if (page < 1) page = 1;
            if (limit < 1 || limit > 100) limit = 10;

            const customer = await this.databaseService.getCustomerById(customerId);
            if (!customer) {
                throw new Error(`Customer with ID ${customerId} not found`);
            }

            const result = await this.databaseService.getCustomerItems(
                customerId,
                page,
                limit,
                category,
                search
            );

            const totalPages = Math.ceil(result.total / limit);

            logger.info(`Retrieved customer items:`, {
                customerId,
                page,
                limit,
                total: result.total,
                totalPages,
                category: category || 'all',
                search: search || 'none'
            });

            return {
                items: result.items,
                total: result.total,
                page,
                limit,
                totalPages
            };

        } catch (error) {
            logger.error('Error getting customer items:', error);
            throw error;
        }
    }

    public async getAllItems(
        page: number = 1,
        limit: number = 10,
        category?: string,
        search?: string,
        customerId?: string
    ): Promise<{ items: CustomerItem[]; total: number; page: number; limit: number; totalPages: number }> {
        try {
            if (page < 1) page = 1;
            if (limit < 1 || limit > 100) limit = 10;

            let query = 'SELECT * FROM customer_items';
            let countQuery = 'SELECT COUNT(*) FROM customer_items';
            const params: any[] = [];
            const conditions: string[] = [];

            if (customerId) {
                if (!this.isValidUuid(customerId)) {
                    throw new Error('Invalid customer ID format');
                }
                conditions.push(`customer_id = $${params.length + 1}`);
                params.push(customerId);
            }

            if (category) {
                conditions.push(`category = $${params.length + 1}`);
                params.push(category);
            }

            if (search) {
                conditions.push(`name ILIKE $${params.length + 1}`);
                params.push(`%${search}%`);
            }

            if (conditions.length > 0) {
                const whereClause = ' WHERE ' + conditions.join(' AND ');
                query += whereClause;
                countQuery += whereClause;
            }

            query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            const offset = (page - 1) * limit;
            const queryParams = [...params, limit, offset];

            const results = await Promise.all([
                this.databaseService.executeQuery<any>(query, queryParams),
                this.databaseService.executeQuery<{ count: string }>(countQuery, params)
            ]);

            const itemsResult = results[0];
            const countResult = results[1];

            // Fix: Add comprehensive null checks
            const itemRows = itemsResult?.rows || [];
            const countRows = countResult?.rows || [];

            // Safe access to count with fallback
            const total = countRows.length > 0 && countRows[0]?.count
                ? parseInt(countRows[0].count)
                : 0;

            const totalPages = Math.ceil(total / limit);

            logger.info(`Retrieved all items:`, {
                page,
                limit,
                total,
                totalPages,
                filters: { customerId, category, search }
            });

            return {
                items: itemRows.map(row => ({
                    id: row.id,
                    customerId: row.customer_id,
                    name: row.name,
                    description: row.description,
                    price: parseFloat(row.price),
                    quantity: row.quantity,
                    category: row.category,
                    status: row.status,
                    minStockLevel: row.min_stock_level,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at),
                    tenantId: row.tenant_id
                })),
                total,
                page,
                limit,
                totalPages
            };

        } catch (error) {
            logger.error('Error getting all items:', error);
            throw error;
        }
    }

    public async updateCustomerItem(id: string, updates: UpdateCustomerItemRequest): Promise<CustomerItem | null> {
        try {
            if (!id || !this.isValidUuid(id)) {
                throw new Error('Invalid item ID format');
            }

            const existingItem = await this.databaseService.getCustomerItemById(id);
            if (!existingItem) {
                logger.warn(`Attempted to update non-existent item:`, { itemId: id });
                return null;
            }

            const updatedItem = await this.databaseService.updateCustomerItem(id, updates);

            if (updatedItem) {
                logger.info(`Customer item updated successfully:`, {
                    itemId: id,
                    updatedFields: Object.keys(updates)
                });
            }

            return updatedItem;

        } catch (error) {
            logger.error('Error updating customer item:', error);
            throw error;
        }
    }

    public async updateItemQuantity(
        id: string,
        quantity: number,
        operation: 'set' | 'add' | 'subtract' = 'set'
    ): Promise<CustomerItem | null> {
        try {
            if (!id || !this.isValidUuid(id)) {
                throw new Error('Invalid item ID format');
            }

            const existingItem = await this.databaseService.getCustomerItemById(id);
            if (!existingItem) {
                logger.warn(`Attempted to update quantity of non-existent item:`, { itemId: id });
                return null;
            }

            let newQuantity: number;
            switch (operation) {
                case 'add':
                    newQuantity = existingItem.quantity + quantity;
                    break;
                case 'subtract':
                    newQuantity = Math.max(0, existingItem.quantity - quantity);
                    break;
                case 'set':
                default:
                    newQuantity = quantity;
                    break;
            }

            if (newQuantity < 0) {
                throw new Error('Quantity cannot be negative');
            }

            const updatedItem = await this.databaseService.updateCustomerItem(id, { quantity: newQuantity });

            if (updatedItem) {
                logger.info(`Item quantity updated:`, {
                    itemId: id,
                    operation,
                    oldQuantity: existingItem.quantity,
                    newQuantity: updatedItem.quantity
                });
            }

            return updatedItem;

        } catch (error) {
            logger.error('Error updating item quantity:', error);
            throw error;
        }
    }

    public async deleteCustomerItem(id: string): Promise<boolean> {
        try {
            if (!id || !this.isValidUuid(id)) {
                throw new Error('Invalid item ID format');
            }

            const existingItem = await this.databaseService.getCustomerItemById(id);
            if (!existingItem) {
                logger.warn(`Attempted to delete non-existent item:`, { itemId: id });
                return false;
            }

            const deleted = await this.databaseService.deleteCustomerItem(id);

            if (deleted) {
                logger.info(`Customer item deleted successfully:`, { itemId: id });
            } else {
                logger.warn(`Failed to delete customer item:`, { itemId: id });
            }

            return deleted;

        } catch (error) {
            logger.error('Error deleting customer item:', error);
            throw error;
        }
    }

    private isValidUuid(uuid: string): boolean {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
}
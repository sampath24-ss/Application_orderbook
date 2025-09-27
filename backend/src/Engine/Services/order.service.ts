// engine/services/order.service.ts - Fixed Version
import { DatabaseService } from './database.service';
import { ItemService } from './item.service';
import { logger } from '../../utils/logger';
import {
    Order,
    OrderItem,
    CreateOrderRequest,
    UpdateOrderRequest,
    OrderStatus,
    PaymentStatus,
    OrderPriority
} from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class OrderService {
    constructor(
        private databaseService: DatabaseService,
        private itemService: ItemService
    ) {}

    public async createOrder(data: CreateOrderRequest | Order): Promise<Order> {
        return this.databaseService.executeTransaction(async (client) => {
            try {
                const customer = await this.databaseService.getCustomerById(data.customerId);
                if (!customer) {
                    throw new Error(`Customer with ID ${data.customerId} not found`);
                }

                if ('id' in data && 'totalAmount' in data) {
                    const order = data as Order;
                    const query = `
                        INSERT INTO orders (
                            id, customer_id, total_amount, status, order_date, delivery_date, 
                            notes, payment_status, shipping_address, discount, tax_amount, 
                            shipping_cost, order_number, priority, created_at, updated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                        RETURNING *
                    `;
                    const values = [
                        order.id,
                        order.customerId,
                        order.totalAmount,
                        order.status,
                        order.orderDate,
                        order.deliveryDate,
                        order.notes,
                        order.paymentStatus,
                        order.shippingAddress,
                        order.discount,
                        order.taxAmount,
                        order.shippingCost,
                        order.orderNumber,
                        order.priority,
                        order.createdAt,
                        order.updatedAt
                    ];

                    const result = await client.query(query, values);
                    const createdOrder = result.rows[0];

                    for (const item of order.items) {
                        const itemQuery = `
                            INSERT INTO order_items (
                                id, order_id, item_id, name, description, price, quantity, 
                                subtotal, discount_amount, tax_amount, sku
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        `;
                        await client.query(itemQuery, [
                            item.id || uuidv4(),
                            createdOrder.id,
                            item.itemId,
                            item.name,
                            item.description,
                            item.price,
                            item.quantity,
                            item.subtotal,
                            item.discountAmount,
                            item.taxAmount,
                            item.sku
                        ]);
                    }

                    logger.info(`Order created successfully:`, {
                        orderId: createdOrder.id,
                        customerId: createdOrder.customer_id,
                        totalAmount: createdOrder.total_amount
                    });

                    return this.mapDbOrderToOrder({ ...createdOrder, items: order.items });
                }

                const createRequest = data as CreateOrderRequest;
                const orderId = uuidv4();
                const orderNumber = this.generateOrderNumber();
                const orderItems: OrderItem[] = [];
                let totalAmount = 0;
                let totalTax = 0;

                for (const requestItem of createRequest.items) {
                    const item = await this.itemService.getCustomerItemById(requestItem.itemId);
                    if (!item) {
                        throw new Error(`Item with ID ${requestItem.itemId} not found`);
                    }

                    if (item.customerId !== createRequest.customerId) {
                        throw new Error(`Item ${requestItem.itemId} does not belong to customer ${createRequest.customerId}`);
                    }

                    if (item.quantity < requestItem.quantity) {
                        throw new Error(`Insufficient quantity for item ${item.name}. Available: ${item.quantity}, Requested: ${requestItem.quantity}`);
                    }

                    const subtotal = item.price * requestItem.quantity;
                    const taxAmount = subtotal * 0.1; // 10% tax rate
                    totalAmount += subtotal;
                    totalTax += taxAmount;

                    const orderItem: OrderItem = {
                        id: uuidv4(),
                        itemId: item.id,
                        name: item.name,
                        description: item.description || null,
                        price: item.price,
                        quantity: requestItem.quantity,
                        subtotal,
                        discountAmount: 0,
                        taxAmount,
                        sku: null
                    };

                    orderItems.push(orderItem);

                    // Update item quantity
                    await this.itemService.updateItemQuantity(item.id, requestItem.quantity, 'subtract');
                }

                const shippingCost = this.calculateShippingCost(totalAmount);
                const finalTotal = totalAmount + totalTax + shippingCost;

                const orderQuery = `
                    INSERT INTO orders (
                        id, customer_id, total_amount, status, order_date, delivery_date, 
                        notes, payment_status, shipping_address, discount, tax_amount, 
                        shipping_cost, order_number, priority, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                    RETURNING *
                `;
                const orderValues = [
                    orderId,
                    createRequest.customerId,
                    finalTotal,
                    OrderStatus.PENDING,
                    new Date(),
                    createRequest.deliveryDate,
                    createRequest.notes,
                    PaymentStatus.PENDING,
                    createRequest.shippingAddress,
                    0, // discount
                    totalTax,
                    shippingCost,
                    orderNumber,
                    createRequest.priority || OrderPriority.NORMAL,
                    new Date(),
                    new Date()
                ];

                const orderResult = await client.query(orderQuery, orderValues);
                const createdOrder = orderResult.rows[0];

                // Insert order items
                for (const item of orderItems) {
                    const itemQuery = `
                        INSERT INTO order_items (
                            id, order_id, item_id, name, description, price, quantity, 
                            subtotal, discount_amount, tax_amount, sku
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    `;
                    await client.query(itemQuery, [
                        item.id,
                        orderId,
                        item.itemId,
                        item.name,
                        item.description,
                        item.price,
                        item.quantity,
                        item.subtotal,
                        item.discountAmount,
                        item.taxAmount,
                        item.sku
                    ]);
                }

                logger.info(`Order created successfully:`, {
                    orderId,
                    customerId: createRequest.customerId,
                    itemCount: orderItems.length,
                    totalAmount: finalTotal
                });

                return this.mapDbOrderToOrder({ ...createdOrder, items: orderItems });

            } catch (error) {
                logger.error('Error creating order:', error);
                throw error;
            }
        });
    }

    public async getOrderById(id: string): Promise<Order | null> {
        try {
            if (!id || !this.isValidUuid(id)) {
                throw new Error('Invalid order ID format');
            }

            const orderQuery = `
                SELECT 
                    id, customer_id, total_amount, status, order_date, delivery_date,
                    notes, payment_status, shipping_address, discount, tax_amount,
                    shipping_cost, order_number, priority, created_at, updated_at
                FROM orders 
                WHERE id = $1
            `;
            const orderResult = await this.databaseService.executeQuery(orderQuery, [id]);

            if (orderResult.rows.length === 0) {
                return null;
            }

            const order = orderResult.rows[0];
            
            const itemsQuery = `
                SELECT 
                    id, order_id, item_id, name, description, price, quantity,
                    subtotal, discount_amount, tax_amount, sku
                FROM order_items 
                WHERE order_id = $1
            `;
            const itemsResult = await this.databaseService.executeQuery(itemsQuery, [id]);

            const orderWithItems = {
                ...order,
                items: itemsResult.rows.map(item => ({
                    id: item.id,
                    itemId: item.item_id,
                    name: item.name,
                    description: item.description,
                    price: parseFloat(item.price),
                    quantity: item.quantity,
                    subtotal: parseFloat(item.subtotal),
                    discountAmount: parseFloat(item.discount_amount || '0'),
                    taxAmount: parseFloat(item.tax_amount || '0'),
                    sku: item.sku
                }))
            };

            return this.mapDbOrderToOrder(orderWithItems);

        } catch (error) {
            logger.error('Error getting order by ID:', error);
            throw error;
        }
    }

    public async updateOrder(id: string, updates: UpdateOrderRequest): Promise<Order | null> {
        try {
            if (!id || !this.isValidUuid(id)) {
                throw new Error('Invalid order ID format');
            }

            const existingOrder = await this.getOrderById(id);
            if (!existingOrder) {
                return null;
            }

            // Validate status transition
            if (updates.status && !this.isValidStatusTransition(existingOrder.status, updates.status)) {
                throw new Error(`Invalid status transition from ${existingOrder.status} to ${updates.status}`);
            }

            const updateFields: string[] = [];
            const values: any[] = [id];
            let paramIndex = 2;

            if (updates.status !== null && updates.status !== undefined) {
                updateFields.push(`status = $${paramIndex++}`);
                values.push(updates.status);
            }

            if (updates.deliveryDate !== undefined) {
                updateFields.push(`delivery_date = $${paramIndex++}`);
                values.push(updates.deliveryDate);
            }

            if (updates.notes !== undefined) {
                updateFields.push(`notes = $${paramIndex++}`);
                values.push(updates.notes);
            }

            if (updates.paymentStatus !== null && updates.paymentStatus !== undefined) {
                updateFields.push(`payment_status = $${paramIndex++}`);
                values.push(updates.paymentStatus);
            }

            if (updates.shippingAddress !== undefined) {
                updateFields.push(`shipping_address = $${paramIndex++}`);
                values.push(updates.shippingAddress);
            }

            if (updates.priority !== null && updates.priority !== undefined) {
                updateFields.push(`priority = $${paramIndex++}`);
                values.push(updates.priority);
            }

            if (updateFields.length === 0) {
                return existingOrder;
            }

            updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

            const query = `
                UPDATE orders 
                SET ${updateFields.join(', ')}
                WHERE id = $1 
                RETURNING *
            `;

            const result = await this.databaseService.executeQuery(query, values);
            
            if (result.rows.length === 0) {
                return null;
            }

            logger.info(`Order updated successfully:`, {
                orderId: id,
                updatedFields: Object.keys(updates)
            });

            return await this.getOrderById(id);

        } catch (error) {
            logger.error('Error updating order:', error);
            throw error;
        }
    }

    public async cancelOrder(id: string, reason: string | null = null): Promise<Order | null> {
        try {
            const existingOrder = await this.getOrderById(id);
            if (!existingOrder) {
                return null;
            }

            if (!this.canBeCancelled(existingOrder.status)) {
                throw new Error(`Order with status ${existingOrder.status} cannot be cancelled`);
            }

            return await this.databaseService.executeTransaction(async (client) => {
                // Update order status
                const updateQuery = `
                    UPDATE orders 
                    SET status = $1, notes = COALESCE(notes || ' | ', '') || $2, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $3
                    RETURNING *
                `;
                const updateValues = [OrderStatus.CANCELLED, `Cancelled: ${reason || 'No reason provided'}`, id];
                await client.query(updateQuery, updateValues);

                // Restore item quantities
                for (const item of existingOrder.items) {
                    await this.itemService.updateItemQuantity(item.itemId, item.quantity, 'add');
                }

                logger.info(`Order cancelled successfully:`, {
                    orderId: id,
                    reason: reason || 'No reason provided'
                });

                return await this.getOrderById(id);
            });

        } catch (error) {
            logger.error('Error cancelling order:', error);
            throw error;
        }
    }

    public async deleteOrder(id: string): Promise<boolean> {
        try {
            if (!id || !this.isValidUuid(id)) {
                throw new Error('Invalid order ID format');
            }

            const existingOrder = await this.getOrderById(id);
            if (!existingOrder) {
                return false;
            }

            return await this.databaseService.executeTransaction(async (client) => {
                // Delete order items first (foreign key constraint)
                await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
                
                // Delete order
                const result = await client.query('DELETE FROM orders WHERE id = $1', [id]);
                
                const deleted = (result.rowCount || 0) > 0;
                
                if (deleted) {
                    logger.info(`Order deleted successfully:`, { orderId: id });
                }

                return deleted;
            });

        } catch (error) {
            logger.error('Error deleting order:', error);
            throw error;
        }
    }

    private mapDbOrderToOrder(dbOrder: any): Order {
        return {
            id: dbOrder.id,
            customerId: dbOrder.customer_id || dbOrder.customerId,
            items: dbOrder.items,
            totalAmount: parseFloat(dbOrder.total_amount || dbOrder.totalAmount),
            status: dbOrder.status,
            orderDate: new Date(dbOrder.order_date || dbOrder.orderDate),
            deliveryDate: dbOrder.delivery_date ? new Date(dbOrder.delivery_date) : null,
            notes: dbOrder.notes || null,
            paymentStatus: dbOrder.payment_status || PaymentStatus.PENDING,
            shippingAddress: dbOrder.shipping_address || null,
            discount: parseFloat(dbOrder.discount || '0'),
            taxAmount: parseFloat(dbOrder.tax_amount || '0'),
            shippingCost: parseFloat(dbOrder.shipping_cost || '0'),
            orderNumber: dbOrder.order_number || '',
            priority: dbOrder.priority || OrderPriority.NORMAL,
            createdAt: new Date(dbOrder.created_at || dbOrder.createdAt),
            updatedAt: new Date(dbOrder.updated_at || dbOrder.updatedAt),
            tenantId: dbOrder.tenant_id || null
        };
    }

    private isValidStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
        const validTransitions: { [key in OrderStatus]: OrderStatus[] } = {
            [OrderStatus.DRAFT]: [OrderStatus.PENDING, OrderStatus.CANCELLED],
            [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
            [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
            [OrderStatus.PROCESSING]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
            [OrderStatus.PACKED]: [OrderStatus.SHIPPED],
            [OrderStatus.SHIPPED]: [OrderStatus.OUT_FOR_DELIVERY],
            [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.FAILED],
            [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
            [OrderStatus.CANCELLED]: [],
            [OrderStatus.REFUNDED]: [],
            [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
            [OrderStatus.FAILED]: [OrderStatus.CANCELLED, OrderStatus.PENDING]
        };

        return validTransitions[currentStatus].includes(newStatus);
    }

    private canBeCancelled(status: OrderStatus): boolean {
        return [
            OrderStatus.DRAFT,
            OrderStatus.PENDING, 
            OrderStatus.CONFIRMED, 
            OrderStatus.PROCESSING
        ].includes(status);
    }

    private generateOrderNumber(): string {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `ORD-${timestamp.slice(-8)}-${random}`;
    }

    private calculateShippingCost(orderAmount: number): number {
        if (orderAmount >= 100) return 0; // Free shipping over $100
        if (orderAmount >= 50) return 5;  // $5 shipping for $50-$99
        return 10; // $10 shipping for under $50
    }

    private isValidUuid(uuid: string): boolean {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
}
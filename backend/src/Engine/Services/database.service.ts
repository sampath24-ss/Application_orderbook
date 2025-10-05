// engine/services/database.service.ts - Complete Fixed Implementation
import { Pool, PoolClient } from 'pg';
import { logger } from '../../utils/logger';
import {
    Customer,
    CustomerItem,
    CreateCustomerRequest,
    UpdateCustomerRequest,
    CreateCustomerItemRequest,
    UpdateCustomerItemRequest
} from '../../types';

export class DatabaseService {
    private pool: Pool;
    private connected: boolean = false;

    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'multitenant_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'sampath123',
            max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }

    public async connect(): Promise<void> {
        try {
            await this.pool.connect();
            await this.createTables();
            await this.createIndexes();
            await this.createPartitions();
            this.connected = true;
            logger.info('Database connected successfully with optimized indexes');
        } catch (error) {
            logger.error('Database connection failed:', error);
            throw error;
        }
    }

    public async getOrderById(id: string): Promise<any> {
        try {
            const query = `
            SELECT o.*, 
                   json_agg(
                       json_build_object(
                           'id', oi.id,
                           'itemId', oi.item_id,
                           'name', oi.name,
                           'description', oi.description,
                           'price', oi.price,
                           'quantity', oi.quantity,
                           'subtotal', oi.subtotal,
                           'discountAmount', oi.discount_amount,
                           'taxAmount', oi.tax_amount,
                           'sku', oi.sku
                       )
                   ) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.id = $1
            GROUP BY o.id
        `;

            const result = await this.executeQuery<any>(query, [id]);

            if (!result || !result.rows || result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                id: row.id,
                customerId: row.customer_id,
                totalAmount: parseFloat(row.total_amount),
                status: row.status,
                orderDate: new Date(row.order_date),
                deliveryDate: row.delivery_date ? new Date(row.delivery_date) : null,
                notes: row.notes,
                paymentStatus: row.payment_status,
                shippingAddress: row.shipping_address,
                discount: parseFloat(row.discount || 0),
                taxAmount: parseFloat(row.tax_amount || 0),
                shippingCost: parseFloat(row.shipping_cost || 0),
                orderNumber: row.order_number,
                priority: row.priority,
                items: row.items || [],
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            };
        } catch (error) {
            logger.error('Error getting order by ID:', error);
            throw error;
        }
    }

    public async getCustomerOrders(
        customerId: string | undefined,
        page: number,
        limit: number,
        status?: string
    ): Promise<{ orders: any[]; total: number }> {
        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM orders WHERE customer_id = $1';
        let countQuery = 'SELECT COUNT(*) FROM orders WHERE customer_id = $1';
        const params: any[] = [customerId];

        if (status) {
            query += ' AND status = $2';
            countQuery += ' AND status = $2';
            params.push(status);
        }

        query += ' ORDER BY order_date DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        const queryParams = [...params, limit, offset];

        try {
            const results = await Promise.all([
                this.executeQuery<any>(query, queryParams),
                this.executeQuery<{ count: string }>(countQuery, params)
            ]);

            const orders = results[0];
            const count = results[1];

            const orderRows = orders?.rows || [];
            const countRows = count?.rows || [];
            const totalCount: number = countRows.length > 0 && countRows[0]?.count ? parseInt(countRows[0].count) : 0;

            return {
                orders: orderRows.map(row => ({
                    id: row.id,
                    customerId: row.customer_id,
                    totalAmount: parseFloat(row.total_amount),
                    status: row.status,
                    orderDate: new Date(row.order_date),
                    deliveryDate: row.delivery_date ? new Date(row.delivery_date) : null,
                    notes: row.notes,
                    paymentStatus: row.payment_status,
                    shippingAddress: row.shipping_address,
                    orderNumber: row.order_number,
                    priority: row.priority,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at)
                })),
                total: totalCount
            };
        } catch (error) {
            logger.error('Error getting customer orders:', error);
            throw error;
        }
    }

    public async getAllOrders(
        page: number = 1,
        limit: number = 10,
        status?: string
    ): Promise<{ orders: any[]; total: number }> {
        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM orders';
        let countQuery = 'SELECT COUNT(*) FROM orders';
        const params: any[] = [];

        if (status) {
            query += ' WHERE status = $1';
            countQuery += ' WHERE status = $1';
            params.push(status);
        }

        query += ' ORDER BY order_date DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        const queryParams = [...params, limit, offset];

        try {
            const results = await Promise.all([
                this.executeQuery<any>(query, queryParams),
                this.executeQuery<{ count: string }>(countQuery, params)
            ]);

            const orders = results[0];
            const count = results[1];

            const orderRows = orders?.rows || [];
            const countRows = count?.rows || [];
            const totalCount = countRows.length > 0 && countRows[0]?.count ? parseInt(countRows[0].count) : 0;

            return {
                orders: orderRows.map(row => ({
                    id: row.id,
                    customerId: row.customer_id,
                    totalAmount: parseFloat(row.total_amount),
                    status: row.status,
                    orderDate: new Date(row.order_date),
                    deliveryDate: row.delivery_date ? new Date(row.delivery_date) : null,
                    notes: row.notes,
                    paymentStatus: row.payment_status,
                    shippingAddress: row.shipping_address,
                    discount: parseFloat(row.discount || 0),
                    taxAmount: parseFloat(row.tax_amount || 0),
                    shippingCost: parseFloat(row.shipping_cost || 0),
                    orderNumber: row.order_number,
                    priority: row.priority,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at)
                })),
                total: totalCount
            };
        } catch (error) {
            logger.error('Error getting all orders:', error);
            throw error;
        }
    }

    private async createTables(): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

            await client.query(`
                CREATE TABLE IF NOT EXISTS customers (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    phone VARCHAR(20),
                    address TEXT,
                    tenant_id UUID,
                    status VARCHAR(20) DEFAULT 'ACTIVE',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS customer_items (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                    name VARCHAR(200) NOT NULL,
                    description TEXT,
                    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
                    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
                    category VARCHAR(100),
                    tenant_id UUID,
                    status VARCHAR(20) DEFAULT 'ACTIVE',
                    min_stock_level INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS orders (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                    total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
                    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                    order_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    delivery_date TIMESTAMP,
                    notes TEXT,
                    payment_status VARCHAR(20) DEFAULT 'PENDING',
                    shipping_address TEXT,
                    discount DECIMAL(10,2) DEFAULT 0,
                    tax_amount DECIMAL(10,2) DEFAULT 0,
                    shipping_cost DECIMAL(10,2) DEFAULT 0,
                    order_number VARCHAR(50) UNIQUE,
                    priority VARCHAR(20) DEFAULT 'NORMAL',
                    tenant_id UUID,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS order_items (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                    item_id UUID NOT NULL REFERENCES customer_items(id) ON DELETE CASCADE,
                    name VARCHAR(200) NOT NULL,
                    description TEXT,
                    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
                    quantity INTEGER NOT NULL CHECK (quantity > 0),
                    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
                    discount_amount DECIMAL(10,2) DEFAULT 0,
                    tax_amount DECIMAL(10,2) DEFAULT 0,
                    sku VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query('COMMIT');
            logger.info('Database tables created successfully');

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error creating database tables:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    private async createIndexes(): Promise<void> {
        const client = await this.pool.connect();
        try {
            logger.info('Creating database indexes...');

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email_unique 
                ON customers USING btree (email)
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_name_search 
                ON customers USING gin (to_tsvector('english', name))
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_tenant_id 
                ON customers (tenant_id) WHERE tenant_id IS NOT NULL
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_created_at 
                ON customers USING btree (created_at DESC)
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_status_active 
                ON customers (status) WHERE status = 'ACTIVE'
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_items_customer_id 
                ON customer_items (customer_id)
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_items_category 
                ON customer_items (category) WHERE category IS NOT NULL
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_items_name_search 
                ON customer_items USING gin (to_tsvector('english', name))
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_items_price_range 
                ON customer_items (price) WHERE status = 'ACTIVE'
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_items_quantity_low 
                ON customer_items (quantity) WHERE quantity <= 10 AND status = 'ACTIVE'
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_items_tenant_customer 
                ON customer_items (tenant_id, customer_id) WHERE tenant_id IS NOT NULL
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_id 
                ON orders (customer_id)
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status 
                ON orders (status)
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_order_date 
                ON orders USING btree (order_date DESC)
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_delivery_date 
                ON orders (delivery_date) WHERE delivery_date IS NOT NULL
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tenant_status 
                ON orders (tenant_id, status) WHERE tenant_id IS NOT NULL
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_status_date 
                ON orders (customer_id, status, order_date DESC)
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_amount_range 
                ON orders (total_amount) WHERE status NOT IN ('CANCELLED', 'REFUNDED')
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id 
                ON order_items (order_id)
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_item_id 
                ON order_items (item_id)
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_item_composite 
                ON order_items (order_id, item_id)
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_customer_category_price 
                ON customer_items (customer_id, category, price) WHERE status = 'ACTIVE'
            `);

            await client.query(`
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_date_status 
                ON orders (customer_id, order_date DESC, status)
            `);

            logger.info('Database indexes created successfully');

        } catch (error) {
            logger.error('Error creating indexes:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    private async createPartitions(): Promise<void> {
        const client = await this.pool.connect();
        try {
            logger.info('Setting up table partitions for scalability...');

            await client.query(`
    CREATE TABLE IF NOT EXISTS orders_partitioned (
        id UUID NOT NULL,
        customer_id UUID NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        order_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        delivery_date TIMESTAMP,
        notes TEXT,
        payment_status VARCHAR(20) DEFAULT 'PENDING',
        shipping_address TEXT,
        discount DECIMAL(10,2) DEFAULT 0,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        shipping_cost DECIMAL(10,2) DEFAULT 0,
        order_number VARCHAR(50),
        priority VARCHAR(20) DEFAULT 'NORMAL',
        tenant_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, order_date)
    ) PARTITION BY RANGE (order_date);
`);


            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;

            for (let i = 0; i < 12; i++) {
                const month = ((currentMonth + i - 1) % 12) + 1;
                const year = currentYear + Math.floor((currentMonth + i - 1) / 12);
                const nextMonth = (month % 12) + 1;
                const nextYear = year + Math.floor(month / 12);

                await client.query(`
        CREATE TABLE IF NOT EXISTS orders_${year}_${month.toString().padStart(2, '0')} 
        PARTITION OF orders_partitioned
        FOR VALUES FROM ('${year}-${month.toString().padStart(2, '0')}-01') 
        TO ('${nextYear}-${nextMonth.toString().padStart(2, '0')}-01')
    `);
            }

            logger.info('Table partitions created successfully');

        } catch (error) {
            logger.error('Error creating partitions:', error);
        } finally {
            client.release();
        }
    }

    public async createCustomer(customer: Customer): Promise<Customer> {
        const query = `
            INSERT INTO customers (id, name, email, phone, address, tenant_id, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;
        const values = [
            customer.id,
            customer.name,
            customer.email,
            customer.phone,
            customer.address,
            customer.tenantId,
            customer.status,
            customer.createdAt,
            customer.updatedAt
        ];

        const result = await this.executeQuery<any>(query, values);
        const row = result.rows[0];

        return {
            id: row.id,
            name: row.name,
            email: row.email,
            phone: row.phone,
            address: row.address,
            status: row.status,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            tenantId: row.tenant_id
        };
    }

    public async getCustomerById(id: string): Promise<Customer | null> {
        try {
            const query = 'SELECT * FROM customers WHERE id = $1';
            const result = await this.executeQuery<any>(query, [id]);

            if (!result || !result.rows || result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                id: row.id,
                name: row.name,
                email: row.email,
                phone: row.phone || null,
                address: row.address || null,
                status: row.status || 'ACTIVE',
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at),
                tenantId: row.tenant_id || null
            };
        } catch (error) {
            logger.error('Error getting customer by ID:', error);
            throw error;
        }
    }

    public async getCustomers(
        page: number = 1,
        limit: number = 10,
        search?: string
    ): Promise<{ customers: Customer[]; total: number }> {
        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM customers WHERE status = $1';
        let countQuery = 'SELECT COUNT(*) FROM customers WHERE status = $1';
        const params: any[] = ['ACTIVE'];

        if (search) {
            query += ' AND (name ILIKE $2 OR email ILIKE $2)';
            countQuery += ' AND (name ILIKE $2 OR email ILIKE $2)';
            params.push(`%${search}%`);
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        try {
            const results = await Promise.all([
                this.executeQuery<any>(query, params),
                this.executeQuery<{ count: string }>(countQuery, params.slice(0, -2))
            ]);

            const customers = results[0];
            const count = results[1];

            const customerRows = customers?.rows || [];
            const countRows = count?.rows || [];
            const totalCount = countRows.length > 0 && countRows[0]?.count ? parseInt(countRows[0].count) : 0;

            return {
                customers: customerRows.map(row => ({
                    id: row.id,
                    name: row.name,
                    email: row.email,
                    phone: row.phone,
                    address: row.address,
                    status: row.status,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at),
                    tenantId: row.tenant_id
                })),
                total: totalCount
            };
        } catch (error) {
            logger.error('Error getting customers:', error);
            throw error;
        }
    }

    public async updateCustomer(id: string, updates: UpdateCustomerRequest): Promise<Customer | null> {
        const fields = Object.keys(updates).filter(key => updates[key as keyof UpdateCustomerRequest] !== undefined);

        if (fields.length === 0) {
            return await this.getCustomerById(id);
        }

        const setClause = fields.map((key, index) => `${key} = $${index + 2}`).join(', ');

        const query = `
            UPDATE customers 
            SET ${setClause}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 
            RETURNING *
        `;

        const values = [id, ...fields.map(key => updates[key as keyof UpdateCustomerRequest])];
        const result = await this.executeQuery<any>(query, values);

        if (!result || !result.rows || result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            email: row.email,
            phone: row.phone,
            address: row.address,
            status: row.status,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            tenantId: row.tenant_id
        };
    }

    public async deleteCustomer(id: string): Promise<boolean> {
        const query = 'DELETE FROM customers WHERE id = $1';
        const result = await this.executeQuery(query, [id]);
        return (result?.rowCount || 0) > 0;
    }

    public async createCustomerItem(item: CustomerItem): Promise<CustomerItem> {
        const query = `
            INSERT INTO customer_items (
                id, customer_id, name, description, price, quantity, category, 
                tenant_id, status, min_stock_level, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `;
        const values = [
            item.id,
            item.customerId,
            item.name,
            item.description,
            item.price,
            item.quantity,
            item.category,
            item.tenantId,
            item.status,
            item.minStockLevel,
            item.createdAt,
            item.updatedAt
        ];

        const result = await this.executeQuery<any>(query, values);
        const row = result.rows[0];

        return this.mapRowToCustomerItem(row);
    }

    public async getCustomerItemById(id: string): Promise<CustomerItem | null> {
        try {
            const query = 'SELECT * FROM customer_items WHERE id = $1';
            const result = await this.executeQuery<any>(query, [id]);

            if (!result || !result.rows || result.rows.length === 0) {
                return null;
            }

            return this.mapRowToCustomerItem(result.rows[0]);
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
    ): Promise<{ items: CustomerItem[]; total: number }> {
        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM customer_items WHERE customer_id = $1 AND status = $2';
        let countQuery = 'SELECT COUNT(*) FROM customer_items WHERE customer_id = $1 AND status = $2';
        const params: any[] = [customerId, 'ACTIVE'];

        if (category) {
            query += ' AND category = $' + (params.length + 1);
            countQuery += ' AND category = $' + (params.length + 1);
            params.push(category);
        }

        if (search) {
            query += ' AND name ILIKE $' + (params.length + 1);
            countQuery += ' AND name ILIKE $' + (params.length + 1);
            params.push(`%${search}%`);
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        const queryParams = [...params, limit, offset];

        try {
            const results = await Promise.all([
                this.executeQuery<any>(query, queryParams),
                this.executeQuery<{ count: string }>(countQuery, params)
            ]);

            const items = results[0];
            const count = results[1];

            const itemRows = items?.rows || [];
            const countRows = count?.rows || [];
            const totalCount = countRows.length > 0 && countRows[0]?.count ? parseInt(countRows[0].count) : 0;

            return {
                items: itemRows.map(row => this.mapRowToCustomerItem(row)),
                total: totalCount
            };
        } catch (error) {
            logger.error('Error getting customer items:', error);
            throw error;
        }
    }

    public async updateCustomerItem(id: string, updates: UpdateCustomerItemRequest): Promise<CustomerItem | null> {
        const fields = Object.keys(updates).filter(key => updates[key as keyof UpdateCustomerItemRequest] !== undefined);

        if (fields.length === 0) {
            return await this.getCustomerItemById(id);
        }

        const setClause = fields.map((key, index) => `${key} = $${index + 2}`).join(', ');

        const query = `
            UPDATE customer_items 
            SET ${setClause}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 
            RETURNING *
        `;

        const values = [id, ...fields.map(key => updates[key as keyof UpdateCustomerItemRequest])];
        const result = await this.executeQuery<any>(query, values);

        if (!result || !result.rows || result.rows.length === 0) {
            return null;
        }

        return this.mapRowToCustomerItem(result.rows[0]);
    }

    public async deleteCustomerItem(id: string): Promise<boolean> {
        const query = 'UPDATE customer_items SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
        const result = await this.executeQuery(query, ['INACTIVE', id]);
        return (result?.rowCount || 0) > 0;
    }

    private mapRowToCustomerItem(row: any): CustomerItem {
        return {
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
        };
    }

    public async getCustomersOptimized(
        page: number = 1,
        limit: number = 10,
        search?: string,
        tenantId?: string
    ): Promise<{ customers: Customer[]; total: number }> {
        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM customers';
        let countQuery = 'SELECT COUNT(*) FROM customers';
        const params: any[] = [];
        const conditions: string[] = [];

        if (tenantId) {
            conditions.push(`tenant_id = $${params.length + 1}`);
            params.push(tenantId);
        }

        conditions.push(`status = $${params.length + 1}`);
        params.push('ACTIVE');

        if (search) {
            conditions.push(`(
            to_tsvector('english', name) @@ plainto_tsquery('english', $${params.length + 1})
            OR email ILIKE $${params.length + 2}
        )`);
            params.push(search, `%${search}%`);
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        try {
            const results = await Promise.all([
                this.executeQuery<any>(query, params),
                this.executeQuery<{ count: string }>(countQuery, params.slice(0, -2))
            ]);

            const customers = results[0];
            const count = results[1];

            const customerRows = customers?.rows || [];
            const countRows = count?.rows || [];
            const totalCount = countRows.length > 0 && countRows[0]?.count ? parseInt(countRows[0].count) : 0;

            return {
                customers: customerRows.map(row => ({
                    id: row.id,
                    name: row.name,
                    email: row.email,
                    phone: row.phone,
                    address: row.address,
                    status: row.status,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at),
                    tenantId: row.tenant_id
                })),
                total: totalCount
            };
        } catch (error) {
            logger.error('Error getting customers optimized:', error);
            throw error;
        }
    }

    public async getItemsOptimized(
        customerId?: string,
        category?: string,
        minPrice?: number,
        maxPrice?: number,
        search?: string,
        lowStock?: boolean,
        page: number = 1,
        limit: number = 10
    ): Promise<{ items: CustomerItem[]; total: number }> {
        const offset = (page - 1) * limit;
        let query = `
        SELECT ci.*, c.name as customer_name 
        FROM customer_items ci 
        JOIN customers c ON ci.customer_id = c.id
    `;
        let countQuery = 'SELECT COUNT(*) FROM customer_items ci';

        const params: any[] = [];
        const conditions: string[] = ['ci.status = $1'];
        params.push('ACTIVE');

        if (customerId) {
            conditions.push(`ci.customer_id = $${params.length + 1}`);
            params.push(customerId);
        }

        if (category) {
            conditions.push(`ci.category = $${params.length + 1}`);
            params.push(category);
        }

        if (minPrice !== undefined) {
            conditions.push(`ci.price >= $${params.length + 1}`);
            params.push(minPrice);
        }

        if (maxPrice !== undefined) {
            conditions.push(`ci.price <= $${params.length + 1}`);
            params.push(maxPrice);
        }

        if (lowStock) {
            conditions.push(`ci.quantity <= 10`);
        }

        if (search) {
            conditions.push(`to_tsvector('english', ci.name) @@ plainto_tsquery('english', $${params.length + 1})`);
            params.push(search);
        }

        const whereClause = ' WHERE ' + conditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;

        query += ' ORDER BY ci.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        try {
            const results = await Promise.all([
                this.executeQuery<any>(query, params),
                this.executeQuery<{ count: string }>(countQuery, params.slice(0, -2))
            ]);

            const items = results[0];
            const count = results[1];

            const itemRows = items?.rows || [];
            const countRows = count?.rows || [];
            const totalCount = countRows.length > 0 && countRows[0]?.count ? parseInt(countRows[0].count) : 0;

            return {
                items: itemRows.map(row => this.mapRowToCustomerItem(row)),
                total: totalCount
            };
        } catch (error) {
            logger.error('Error getting items optimized:', error);
            throw error;
        }
    }

    public async getOrderAnalytics(
        tenantId?: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<any> {
        let query = `
            SELECT 
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue,
                AVG(total_amount) as avg_order_value,
                COUNT(DISTINCT customer_id) as unique_customers,
                status,
                DATE_TRUNC('day', order_date) as order_day
            FROM orders 
        `;

        const params: any[] = [];
        const conditions: string[] = [];

        if (tenantId) {
            conditions.push(`tenant_id = $${params.length + 1}`);
            params.push(tenantId);
        }

        if (startDate) {
            conditions.push(`order_date >= $${params.length + 1}`);
            params.push(startDate);
        }

        if (endDate) {
            conditions.push(`order_date <= $${params.length + 1}`);
            params.push(endDate);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' GROUP BY status, DATE_TRUNC(\'day\', order_date) ORDER BY order_day DESC';

        const result = await this.executeQuery(query, params);
        return result?.rows || [];
    }

    public async maintainIndexes(): Promise<void> {
        const client = await this.pool.connect();
        try {
            logger.info('Running index maintenance...');

            await client.query('ANALYZE customers');
            await client.query('ANALYZE customer_items');
            await client.query('ANALYZE orders');
            await client.query('ANALYZE order_items');

            if (process.env.NODE_ENV === 'maintenance') {
                await client.query('REINDEX TABLE CONCURRENTLY customers');
                await client.query('REINDEX TABLE CONCURRENTLY customer_items');
                await client.query('REINDEX TABLE CONCURRENTLY orders');
                await client.query('REINDEX TABLE CONCURRENTLY order_items');
            }

            logger.info('Index maintenance completed');
        } catch (error) {
            logger.error('Error during index maintenance:', error);
        } finally {
            client.release();
        }
    }

    public async executeQuery<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return {
                rows: result.rows,
                rowCount: result.rowCount || 0
            };
        } catch (error) {
            logger.error('Database query error:', { query: text, params, error });
            throw error;
        } finally {
            client.release();
        }
    }

    public async executeTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    public isConnected(): boolean {
        return this.connected;
    }

    public async disconnect(): Promise<void> {
        try {
            await this.pool.end();
            this.connected = false;
            logger.info('Database disconnected');
        } catch (error) {
            logger.error('Error disconnecting database:', error);
        }
    }
}
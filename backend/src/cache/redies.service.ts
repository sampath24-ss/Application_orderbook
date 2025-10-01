// src/cache/redis.service.ts - Updated with Items and Orders caching
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { Customer, CustomerItem, Order, CacheOptions } from '../types';

export class RedisService {
    private static instance: RedisService;
    private redis: Redis;
    private connected: boolean = false;

    private constructor() {
        const redisConfig: any = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            db: parseInt(process.env.REDIS_DB || '0'),
            maxRetriesPerRequest: 3,
            lazyConnect: true,
        };

        // Only add password if it exists
        if (process.env.REDIS_PASSWORD) {
            redisConfig.password = process.env.REDIS_PASSWORD;
        }

        this.redis = new Redis(redisConfig);
        this.setupEventHandlers();
    }

    public static getInstance(): RedisService {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }

    private setupEventHandlers(): void {
        this.redis.on('connect', () => {
            this.connected = true;
            logger.info('Redis connected successfully');
        });

        this.redis.on('error', (error) => {
            this.connected = false;
            logger.error('Redis connection error:', error);
        });

        this.redis.on('close', () => {
            this.connected = false;
            logger.warn('Redis connection closed');
        });
    }

    public async connect(): Promise<void> {
    // If already connected or connecting, do nothing
    if (this.connected || (this.redis && (this.redis.status === 'ready' || this.redis.status === 'connecting'))) {
        logger.info('Redis already connected or connecting');
        return;
    }

    try {
        await this.redis.connect(); // use the existing Redis instance
        this.connected = true;
        logger.info('Redis connection ready');
    } catch (error) {
        this.connected = false;
        logger.error('Redis connection failed:', error);
        throw error;
    }
}

    public isHealthy(): boolean {
        return this.connected && this.redis.status === 'ready';
    }

    // Generic cache operations
    public async get<T>(key: string): Promise<T | null> {
        try {
            const value = await this.redis.get(key);
            if (!value) return null;

            return JSON.parse(value) as T;
        } catch (error) {
            logger.error(`Error getting cache key ${key}:`, error);
            return null; // Graceful degradation
        }
    }

    public async set(key: string, value: any, ttl?: number): Promise<boolean> {
        try {
            const serialized = JSON.stringify(value);
            
            if (ttl) {
                await this.redis.setex(key, ttl, serialized);
            } else {
                await this.redis.set(key, serialized);
            }
            
            return true;
        } catch (error) {
            logger.error(`Error setting cache key ${key}:`, error);
            return false;
        }
    }

    public async delete(key: string): Promise<boolean> {
        try {
            const result = await this.redis.del(key);
            return result > 0;
        } catch (error) {
            logger.error(`Error deleting cache key ${key}:`, error);
            return false;
        }
    }

    public async deletePattern(pattern: string): Promise<number> {
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length === 0) return 0;

            const result = await this.redis.del(...keys);
            return result;
        } catch (error) {
            logger.error(`Error deleting cache pattern ${pattern}:`, error);
            return 0;
        }
    }

    // ===================
    // CUSTOMER CACHE OPERATIONS
    // ===================
    public async cacheCustomer(customer: Customer): Promise<boolean> {
        const key = this.getCustomerKey(customer.id);
        return await this.set(key, customer, this.getTTL('customer'));
    }

    public async getCachedCustomer(customerId: string): Promise<Customer | null> {
        const key = this.getCustomerKey(customerId);
        return await this.get<Customer>(key);
    }

    public async invalidateCustomer(customerId: string): Promise<boolean> {
        const customerKey = this.getCustomerKey(customerId);
        
        // Also invalidate related lists
        await this.deletePattern('customers:list:*');
        await this.deletePattern(`items:customer:${customerId}*`);
        await this.deletePattern(`orders:customer:${customerId}*`);
        
        return await this.delete(customerKey);
    }

    // Customer list caching
    public async cacheCustomerList(
        page: number, 
        limit: number, 
        search: string = '', 
        data: { customers: Customer[]; total: number }
    ): Promise<boolean> {
        const key = this.getCustomerListKey(page, limit, search);
        return await this.set(key, data, this.getTTL('customerList'));
    }

    public async getCachedCustomerList(
        page: number, 
        limit: number, 
        search: string = ''
    ): Promise<{ customers: Customer[]; total: number } | null> {
        const key = this.getCustomerListKey(page, limit, search);
        return await this.get<{ customers: Customer[]; total: number }>(key);
    }

    // ===================
    // ITEM CACHE OPERATIONS
    // ===================
    public async cacheCustomerItem(item: CustomerItem): Promise<boolean> {
        const key = this.getItemKey(item.id);
        return await this.set(key, item, this.getTTL('item'));
    }

    public async getCachedCustomerItem(itemId: string): Promise<CustomerItem | null> {
        const key = this.getItemKey(itemId);
        return await this.get<CustomerItem>(key);
    }

    public async invalidateCustomerItem(itemId: string, customerId?: string): Promise<boolean> {
        const itemKey = this.getItemKey(itemId);
        
        // Invalidate related caches
        if (customerId) {
            await this.deletePattern(`items:customer:${customerId}*`);
        }
        await this.deletePattern('items:list:*');
        
        return await this.delete(itemKey);
    }

    // Customer items list caching
    public async cacheCustomerItemsList(
        customerId: string,
        page: number,
        limit: number,
        category: string = '',
        search: string = '',
        data: { items: CustomerItem[]; total: number }
    ): Promise<boolean> {
        const key = this.getCustomerItemsListKey(customerId, page, limit, category, search);
        return await this.set(key, data, this.getTTL('itemList'));
    }

    public async getCachedCustomerItemsList(
        customerId: string,
        page: number,
        limit: number,
        category: string = '',
        search: string = ''
    ): Promise<{ items: CustomerItem[]; total: number } | null> {
        const key = this.getCustomerItemsListKey(customerId, page, limit, category, search);
        return await this.get<{ items: CustomerItem[]; total: number }>(key);
    }

    // ===================
    // ORDER CACHE OPERATIONS
    // ===================
    public async cacheOrder(order: Order): Promise<boolean> {
        const key = this.getOrderKey(order.id);
        return await this.set(key, order, this.getTTL('order'));
    }

    public async getCachedOrder(orderId: string): Promise<Order | null> {
        const key = this.getOrderKey(orderId);
        return await this.get<Order>(key);
    }

    public async invalidateOrder(orderId: string, customerId?: string): Promise<boolean> {
        const orderKey = this.getOrderKey(orderId);
        
        // Invalidate related caches
        if (customerId) {
            await this.deletePattern(`orders:customer:${customerId}*`);
        }
        await this.deletePattern('orders:list:*');
        
        return await this.delete(orderKey);
    }

    // Customer orders list caching
    public async cacheCustomerOrdersList(
        customerId: string,
        page: number,
        limit: number,
        status: string = '',
        search: string = '',
        data: { orders: Order[]; total: number }
    ): Promise<boolean> {
        const key = this.getCustomerOrdersListKey(customerId, page, limit, status, search);
        return await this.set(key, data, this.getTTL('orderList'));
    }

    public async getCachedCustomerOrdersList(
        customerId: string,
        page: number,
        limit: number,
        status: string = '',
        search: string = ''
    ): Promise<{ orders: Order[]; total: number } | null> {
        const key = this.getCustomerOrdersListKey(customerId, page, limit, status, search);
        return await this.get<{ orders: Order[]; total: number }>(key);
    }

    // All orders list caching
    public async cacheOrdersList(
        page: number,
        limit: number,
        status: string = '',
        customerId: string = '',
        search: string = '',
        data: { orders: Order[]; total: number }
    ): Promise<boolean> {
        const key = this.getOrdersListKey(page, limit, status, customerId, search);
        return await this.set(key, data, this.getTTL('orderList'));
    }

    public async getCachedOrdersList(
        page: number,
        limit: number,
        status: string = '',
        customerId: string = '',
        search: string = ''
    ): Promise<{ orders: Order[]; total: number } | null> {
        const key = this.getOrdersListKey(page, limit, status, customerId, search);
        return await this.get<{ orders: Order[]; total: number }>(key);
    }

    // ===================
    // CACHE KEY GENERATORS
    // ===================
    private getCustomerKey(customerId: string): string {
        return `customer:${customerId}`;
    }

    private getCustomerListKey(page: number, limit: number, search: string): string {
        const searchHash = search ? `:${Buffer.from(search).toString('base64')}` : '';
        return `customers:list:${page}:${limit}${searchHash}`;
    }

    private getItemKey(itemId: string): string {
        return `item:${itemId}`;
    }

    private getCustomerItemsListKey(
        customerId: string, 
        page: number, 
        limit: number, 
        category: string, 
        search: string
    ): string {
        const categoryPart = category ? `:${category}` : '';
        const searchPart = search ? `:${Buffer.from(search).toString('base64')}` : '';
        return `items:customer:${customerId}:${page}:${limit}${categoryPart}${searchPart}`;
    }

    private getOrderKey(orderId: string): string {
        return `order:${orderId}`;
    }

    private getCustomerOrdersListKey(
        customerId: string,
        page: number,
        limit: number,
        status: string,
        search: string
    ): string {
        const statusPart = status ? `:${status}` : '';
        const searchPart = search ? `:${Buffer.from(search).toString('base64')}` : '';
        return `orders:customer:${customerId}:${page}:${limit}${statusPart}${searchPart}`;
    }

    private getOrdersListKey(
        page: number,
        limit: number,
        status: string,
        customerId: string,
        search: string
    ): string {
        const statusPart = status ? `:${status}` : '';
        const customerPart = customerId ? `:${customerId}` : '';
        const searchPart = search ? `:${Buffer.from(search).toString('base64')}` : '';
        return `orders:list:${page}:${limit}${statusPart}${customerPart}${searchPart}`;
    }

    // ===================
    // TTL CONFIGURATION
    // ===================
    public getTTL(type: string): number {
        const ttls = {
            customer: 3600,      // 1 hour
            customerList: 600,   // 10 minutes
            item: 1800,          // 30 minutes
            itemList: 600,       // 10 minutes
            order: 900,          // 15 minutes
            orderList: 300       // 5 minutes
        };
        return ttls[type as keyof typeof ttls] || 3600;
    }

    // ===================
    // CACHE STATISTICS
    // ===================
    public async getCacheStats(): Promise<any> {
        try {
            const info = await this.redis.info('memory');
            const keyspace = await this.redis.info('keyspace');
            
            return {
                connected: this.connected,
                memory: this.parseMemoryInfo(info),
                keyspace: this.parseKeyspaceInfo(keyspace),
                timestamp: new Date()
            };
        } catch (error) {
            logger.error('Error getting cache stats:', error);
            return null;
        }
    }

    private parseMemoryInfo(info: string): any {
        const lines = info.split('\r\n');
        const memory: any = {};
        
        lines.forEach(line => {
            if (line.includes('used_memory:')) {
                memory.used = line.split(':')[1];
            }
            if (line.includes('used_memory_human:')) {
                memory.used_human = line.split(':')[1];
            }
        });
        
        return memory;
    }

    private parseKeyspaceInfo(info: string): any {
        const lines = info.split('\r\n');
        const keyspace: any = {};
        
        lines.forEach(line => {
            if (line.startsWith('db0:')) {
                const stats = line.split(':')[1];
                keyspace.db0 = stats;
            }
        });
        
        return keyspace;
    }

    // ===================
    // CACHE WARMING
    // ===================
    public async warmCache(): Promise<void> {
        try {
            logger.info('Starting cache warming...');
            
            // This would typically load frequently accessed data
            // Implementation depends on your business requirements
            
            logger.info('Cache warming completed');
        } catch (error) {
            logger.error('Error during cache warming:', error);
        }
    }

    
    public async disconnect(): Promise<void> {
        try {
            await this.redis.disconnect();
            this.connected = false;
            logger.info('Redis disconnected');
        } catch (error) {
            logger.error('Error disconnecting Redis:', error);
        }
    }

    public async ping(): Promise<boolean> {
        try {
            const result = await this.redis.ping();
            return result === 'PONG';
        } catch (error) {
            return false;
        }
    }
}
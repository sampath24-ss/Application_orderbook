// src/cache/redis.service.ts
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { Customer, CustomerItem, CacheOptions } from '../types';

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
        try {
            await this.redis.connect();
            logger.info('Redis service initialized');
        } catch (error) {
            logger.error('Failed to connect to Redis:', error);
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

    // Customer-specific cache operations
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

    // Item-specific cache operations
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

    // Cache key generators
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

    // TTL configuration
    private getTTL(type: string): number {
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

    // Cache statistics
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

    // Cache warming (for popular data)
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

    // Health check method
    public async ping(): Promise<boolean> {
        try {
            const result = await this.redis.ping();
            return result === 'PONG';
        } catch (error) {
            return false;
        }
    }
}
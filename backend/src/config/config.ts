// src/config/config.ts - Add Redis configuration
import dotenv from 'dotenv';

dotenv.config();

export const config = {
    // Existing configurations...
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database configuration
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'multitenant_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'sampath123',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    },

    // Redis configuration (NEW)
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        ttl: {
            customer: parseInt(process.env.CACHE_TTL_CUSTOMER || '3600'),      // 1 hour
            customerList: parseInt(process.env.CACHE_TTL_CUSTOMER_LIST || '600'), // 10 minutes
            item: parseInt(process.env.CACHE_TTL_ITEM || '1800'),             // 30 minutes
            itemList: parseInt(process.env.CACHE_TTL_ITEM_LIST || '600'),     // 10 minutes
            order: parseInt(process.env.CACHE_TTL_ORDER || '900'),            // 15 minutes
            orderList: parseInt(process.env.CACHE_TTL_ORDER_LIST || '300'),   // 5 minutes
        }
    },

    // API configuration
    api: {
        maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
        rateLimit: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
            maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        }
    },

    // Kafka configuration
    Kafka: {
        broker: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
        clientId: process.env.KAFKA_CLIENT_ID || 'multi-tenant-api',
        groupId: process.env.KAFKA_GROUP_ID || 'api-customer-group',

        topics: {
            customerEvents: 'customer-events',
            customerItemsEvents: 'customer-items-events',
            orderEvents: 'order-events',
            customerUpdates: 'customer-updates',
            itemUpdates: 'item-updates',
            orderUpdates: 'order-updates',
            cacheInvalidation: 'cache-invalidation', // NEW for cache updates
        },

        producer: {
            allowAutoTopicCreation: true,
            transactionTimeout: 30000,
        },

        consumer: {
            allowAutoTopicCreation: true,
            sessionTimeout: 30000,
            heartbeatInterval: 3000,
        }
    },

    // WebSocket configuration (NEW)
    websocket: {
        cors: {
            origin: process.env.WS_ALLOWED_ORIGINS?.split(',') || [
                'http://localhost:3000',
                'http://localhost:3001'
            ],
            credentials: true
        },
        pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000'),
        pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '5000'),
    },

    // Cache configuration (NEW)
    cache: {
        enabled: process.env.CACHE_ENABLED !== 'false', // Default enabled
        defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '3600'),
        keyPrefix: process.env.CACHE_KEY_PREFIX || 'mt-api:',

        // Cache strategies
        strategies: {
            writeThrough: process.env.CACHE_WRITE_THROUGH === 'true',
            writeBehind: process.env.CACHE_WRITE_BEHIND === 'true',
            readThrough: process.env.CACHE_READ_THROUGH !== 'false', // Default enabled
        }
    },

    // Monitoring configuration (NEW)
    monitoring: {
        metricsEnabled: process.env.METRICS_ENABLED !== 'false',
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
        logLevel: process.env.LOG_LEVEL || 'info',
    },

    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
};
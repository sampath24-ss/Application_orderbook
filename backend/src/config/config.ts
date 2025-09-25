import { truncate } from "fs";
import { Kafka } from "kafkajs";

export const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    Kafka: {
        broker: process.env.KAFKA_BROKERS?.split(',') || ["localhost:9092"],
        clientId: process.env.KAFKA_CLIENT_ID || 'multi-tenant-api',
        groupId: process.env.KAFKA_GROUP_ID || 'api-customer-group',

        topics: {
            customerEvents: 'customer-events',
            customerItemsEvents: 'customer-items-events',
            orderEvents: 'order-events',

            customerUpdates: 'customer-updates',
            orderUpdates: 'order-updates',
            itemUpdates: 'item-updates'
        },

        producer: {
            maxInFlightRequest: 1,
            idempotent: true,
            transactionTimeout: 30000,
            retry: {
                retries: 5,
                initialRetryTime: 100, 
                maxRetryTime: 30000
            }
        },

        consumer: {
            sessionTimeout: 30000,
            rebalanceTimeout: 60000,
            heartbeatInterval: 3000,
            maxBytesPerPartition: 1048576,
            minBytes: 1,
            maxBytes: 10485760,
            maxWaitTimeInMs: 5000
        }
    },

    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'combined'
    },

    api: {
        requestTimeout: 30000,
        maxRequestSize: '10mb',
        rateLimitWindowMs: 15*60*1000,
        rateLimitMaxRequests: 100
    }

};


// src/Engine/Processors/event.processors.ts - Updated with Cache Integration
import { KafkaService } from '../../kafka';
import { DatabaseService } from '../Services/database.service';
import { RedisService } from '../../cache/redies.service'; // NEW
import { CustomerService } from '../Services/customer.service';
import { ItemService } from '../Services/item.service';
import { OrderService } from '../Services/order.service';
import { logger } from '../../utils/logger';
import { EachMessagePayload } from 'kafkajs';
import { config } from '../../config/config';

export class EventProcessor {
    private static instance: EventProcessor;
    private kafkaService: KafkaService;
    private databaseService: DatabaseService;
    private redisService: RedisService; // NEW
    private customerService: CustomerService;
    private itemService: ItemService;
    private orderService: OrderService;
    private isRunning: boolean = false;

    private constructor() {
        this.kafkaService = KafkaService.getInstance();
        this.databaseService = new DatabaseService();
        this.redisService = RedisService.getInstance(); // NEW
        this.customerService = new CustomerService(this.databaseService);
        this.itemService = new ItemService(this.databaseService);
        this.orderService = new OrderService(this.databaseService, this.itemService);
    }

    public static getInstance(): EventProcessor {
        if (!EventProcessor.instance) {
            EventProcessor.instance = new EventProcessor();
        }
        return EventProcessor.instance;
    }

    public async start(): Promise<void> {
        try {
            logger.info('Starting Event Processor...');

            // Connect to database
            await this.databaseService.connect();

            // Connect to Redis cache
            const redis = this.redisService.getClient();

            // Subscribe to Kafka topics
            await this.subscribeToTopics();

            // Start Kafka consumer
            await this.kafkaService.startConsumer(); // NEW

            this.isRunning = true;
            logger.info('Event Processor started successfully');
        } catch (error) {
            logger.error('Failed to start Event Processor:', error);
            throw error;
        }
    }

    private async subscribeToTopics(): Promise<void> {
        // Subscribe to all topics first (without starting consumer)
        await this.kafkaService.subscribeToTopic(
            config.Kafka.topics.customerEvents,
            this.handleCustomerEvent.bind(this)
        );

        await this.kafkaService.subscribeToTopic(
            config.Kafka.topics.customerItemsEvents,
            this.handleCustomerItemEvent.bind(this)
        );

        await this.kafkaService.subscribeToTopic(
            config.Kafka.topics.orderEvents,
            this.handleOrderEvent.bind(this)
        );

        logger.info('Subscribed to all Kafka topics');
    }

    private async handleCustomerEvent(payload: EachMessagePayload): Promise<void> {
    try {
        const message = JSON.parse(payload.message.value?.toString() || '{}');
        const { eventType, data, metadata } = message;

        logger.info(`Processing customer event: ${eventType}`, {
            eventId: message.eventId,
            correlationId: metadata?.correlationId
        });

        let responseData: any = null;
        let success = false;

        switch (eventType) {
            case 'CUSTOMER_CREATE_REQUESTED':
                responseData = await this.customerService.createCustomer(data);
                success = true;

                if (responseData) {
                    await this.redisService.cacheCustomer(responseData);
                    await this.redisService.deletePattern('customers:list:*');
                }
                break;

            case 'CUSTOMER_UPDATE_REQUESTED':
                responseData = await this.customerService.updateCustomer(data.id, data);
                success = true;

                if (responseData) {
                    await this.redisService.cacheCustomer(responseData);
                    await this.redisService.deletePattern('customers:list:*');
                }
                break;

            case 'CUSTOMER_DELETE_REQUESTED':
                success = await this.customerService.deleteCustomer(data.id);

                if (success) {
                    await this.redisService.invalidateCustomer(data.id);
                }
                break;

            default:
                logger.warn(`Unknown customer event type: ${eventType}`);
                return;
        }

        // Publish update event for real-time notifications
        await this.kafkaService.publishEvent(config.Kafka.topics.customerUpdates, {
            eventId: message.eventId + '-response',
            eventType: eventType.replace('_REQUESTED', '_COMPLETED'),
            timestamp: new Date(),
            data: {
                success,
                data: responseData,
                originalEventId: message.eventId
            },
            metadata
        });

        logger.info(`Customer event processed successfully: ${eventType}`, {
            success,
            correlationId: metadata?.correlationId
        });

    } catch (error) {
        logger.error('Error processing customer event:', error);

        const message = JSON.parse(payload.message.value?.toString() || '{}');
        await this.kafkaService.publishEvent(config.Kafka.topics.customerUpdates, {
            eventId: message.eventId + '-error',
            eventType: message.eventType.replace('_REQUESTED', '_FAILED'),
            timestamp: new Date(),
            data: {
                success: false,
                error: error,
                originalEventId: message.eventId
            },
            metadata: message.metadata
        });
    }
}

    private async handleCustomerItemEvent(payload: EachMessagePayload): Promise<void> {
        try {
            const message = JSON.parse(payload.message.value?.toString() || '{}');
            const { eventType, data, metadata } = message;

            logger.info(`Processing item event: ${eventType}`, {
                eventId: message.eventId,
                correlationId: metadata?.correlationId
            });

            let responseData: any = null;
            let success = false;

            switch (eventType) {
                case 'ITEM_CREATED':
                case 'ITEM_CREATE_REQUESTED':
                    responseData = await this.itemService.createCustomerItem(data);
                    success = true;

                    // Update cache
                    if (responseData) {
                        await this.redisService.cacheCustomerItem(responseData);
                        // Invalidate customer item lists
                        await this.redisService.deletePattern(`items:customer:${data.customerId}*`);
                        await this.redisService.deletePattern('items:list:*');
                    }
                    break;
                case 'ITEM_UPDATED': 
                case 'ITEM_UPDATE_REQUESTED':
                    responseData = await this.itemService.updateCustomerItem(data.id, data);
                    success = true;

                    // Update cache
                    if (responseData) {
                        await this.redisService.cacheCustomerItem(responseData);
                        await this.redisService.deletePattern(`items:customer:${responseData.customerId}*`);
                    }
                    break;
                case 'ITEM_REQUESTED':
                    responseData = await this.itemService.getCustomerItemById(data.id);
                    success = true;
    
                    if (responseData) {
                        await this.redisService.cacheCustomerItem(responseData);
                    }
                    break;
                case 'ITEM_DELETED':
                case 'ITEM_DELETE_REQUESTED':
                    // Get item first to know which customer cache to invalidate
                    const existingItem = await this.redisService.getCachedCustomerItem(data.id);
                    success = await this.itemService.deleteCustomerItem(data.id);

                    // Remove from cache
                    if (success) {
                        await this.redisService.invalidateCustomerItem(data.id, existingItem?.customerId);
                    }
                    break;

                default:
                    logger.warn(`Unknown item event type: ${eventType}`);
                    return;
            }

            // Publish update event
            await this.kafkaService.publishEvent(config.Kafka.topics.itemUpdates, {
                eventId: message.eventId + '-response',
                eventType: eventType.replace('_REQUESTED', '_COMPLETED'),
                timestamp: new Date(),
                data: {
                    success,
                    data: responseData,
                    originalEventId: message.eventId
                },
                metadata
            });

        } catch (error) {
            logger.error('Error processing item event:', error);

            // Publish error event
            const message = JSON.parse(payload.message.value?.toString() || '{}');
            await this.kafkaService.publishEvent(config.Kafka.topics.itemUpdates, {
                eventId: message.eventId + '-error',
                eventType: message.eventType.replace('_REQUESTED', '_FAILED'),
                timestamp: new Date(),
                data: {
                    success: false,
                    error: error,
                    originalEventId: message.eventId
                },
                metadata: message.metadata
            });
        }
    }

    private async handleOrderEvent(payload: EachMessagePayload): Promise<void> {
        try {
            const message = JSON.parse(payload.message.value?.toString() || '{}');
            const { eventType, data, metadata } = message;

            logger.info(`Processing order event: ${eventType}`, {
                eventId: message.eventId,
                correlationId: metadata?.correlationId
            });

            let responseData: any | null = null;
            let success: boolean = false;

            switch (eventType) {
                case 'ORDER_CREATE_REQUESTED':
                    responseData = await this.orderService.createOrder(data);
                    success = true;

                    // Cache invalidation for orders
                    if (responseData) {
                        await this.redisService.deletePattern(`orders:customer:${data.customerId}*`);
                        await this.redisService.deletePattern('orders:list:*');
                    }
                    break;

                case 'ORDER_UPDATE_REQUESTED':
                    responseData = await this.orderService.updateOrder(data.id, data);
                    success = true;

                    // Cache invalidation
                    if (responseData) {
                        await this.redisService.deletePattern(`orders:customer:${responseData.customerId}*`);
                    }
                    break;

                case 'ORDER_CANCEL_REQUESTED':
                    const cancelResult = await this.orderService.cancelOrder(data.id);
                    success = cancelResult !== null; // Convert Order|null to boolean
                    responseData = cancelResult;
                    break;

                default:
                    logger.warn(`Unknown order event type: ${eventType}`);
                    return;
            }

            // Publish update event
            await this.kafkaService.publishEvent(config.Kafka.topics.orderUpdates, {
                eventId: message.eventId + '-response',
                eventType: eventType.replace('_REQUESTED', '_COMPLETED'),
                timestamp: new Date(),
                data: {
                    success,
                    data: responseData,
                    originalEventId: message.eventId
                },
                metadata
            });

        } catch (error) {
            logger.error('Error processing order event:', error);

            // Publish error event
            const message = JSON.parse(payload.message.value?.toString() || '{}');
            await this.kafkaService.publishEvent(config.Kafka.topics.orderUpdates, {
                eventId: message.eventId + '-error',
                eventType: message.eventType.replace('_REQUESTED', '_FAILED'),
                timestamp: new Date(),
                data: {
                    success: false,
                    error: error,
                    originalEventId: message.eventId
                },
                metadata: message.metadata
            });
        }
    }

    public getStatus(): any {
        return {
            running: this.isRunning,
            eventProcessor: this.isRunning,
            services: {
                database: this.databaseService.isConnected(),
                redis: this.redisService.isHealthy(),
                kafka: this.kafkaService.isHealthy()
            }
        };
    }

    public isProcessorRunning(): boolean {
        return this.isRunning;
    }

    public async stop(): Promise<void> {
        try {
            this.isRunning = false;

            // Disconnect Redis
            await this.redisService.disconnect();

            // Disconnect database
            await this.databaseService.disconnect();

            logger.info('Event Processor stopped successfully');
        } catch (error) {
            logger.error('Error stopping Event Processor:', error);
        }
    }

}


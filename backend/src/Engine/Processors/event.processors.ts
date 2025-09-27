// backend/src/Engine/Processors/event.processors.ts
import { KafkaService } from '../../kafka';
import { DatabaseService } from '../Services/database.service';
import { CustomerService } from '../Services/customer.service';
import { ItemService } from '../Services/item.service';
import { OrderService } from '../Services/order.service';
import { logger } from '../../utils/logger';
import { EachMessagePayload } from 'kafkajs';
import { 
    CustomerEvent, 
    CustomerItemEvent, 
    OrderEvent,
    CustomerUpdateEventType,
    ItemUpdateEventType,
    OrderUpdateEventType
} from '../../types';
import { config } from '../../config/config';

export class EventProcessor {
    private static instance: EventProcessor;
    private kafkaService: KafkaService;
    private databaseService: DatabaseService;
    private customerService: CustomerService;
    private itemService: ItemService;
    private orderService: OrderService;
    private isRunning: boolean = false;

    private constructor() {
        this.kafkaService = KafkaService.getInstance();
        this.databaseService = new DatabaseService();
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

            // Subscribe to Kafka topics
            await this.subscribeToTopics();

            this.isRunning = true;
            logger.info('Event Processor started successfully');
        } catch (error) {
            logger.error('Failed to start Event Processor:', error);
            throw error;
        }
    }

    private async subscribeToTopics(): Promise<void> {
        // Subscribe to customer events
        await this.kafkaService.subscribeToTopic(
            config.Kafka.topics.customerEvents,
            this.handleCustomerEvent.bind(this)
        );

        // Subscribe to customer item events
        await this.kafkaService.subscribeToTopic(
            config.Kafka.topics.customerItemsEvents,
            this.handleCustomerItemEvent.bind(this)
        );

        // Subscribe to order events
        await this.kafkaService.subscribeToTopic(
            config.Kafka.topics.orderEvents,
            this.handleOrderEvent.bind(this)
        );
    }

    private async handleCustomerEvent(payload: EachMessagePayload): Promise<void> {
        try {
            const message = JSON.parse(payload.message.value?.toString() || '{}');
            const event: CustomerEvent = message;

            logger.info(`Processing customer event: ${event.eventType}`, { 
                eventId: event.eventId,
                correlationId: event.metadata?.correlationId 
            });

            let updateEventType: CustomerUpdateEventType;
            let responseData: any;
            let success = true;
            let errorMessage: string | undefined;

            try {
                switch (event.eventType) {
                    case 'CUSTOMER_CREATED':
                        responseData = await this.customerService.createCustomer(event.data);
                        updateEventType = 'CUSTOMER_CREATED_SUCCESS';
                        break;

                    case 'CUSTOMER_UPDATED':
                        responseData = await this.customerService.updateCustomer(event.data.id, event.data);
                        updateEventType = responseData ? 'CUSTOMER_UPDATED_SUCCESS' : 'CUSTOMER_UPDATED_FAILED';
                        if (!responseData) {
                            success = false;
                            errorMessage = 'Customer not found';
                        }
                        break;

                    case 'CUSTOMER_DELETED':
                        const deleted = await this.customerService.deleteCustomer(event.data.id);
                        updateEventType = deleted ? 'CUSTOMER_DELETED_SUCCESS' : 'CUSTOMER_DELETED_FAILED';
                        responseData = { deleted, customerId: event.data.id };
                        if (!deleted) {
                            success = false;
                            errorMessage = 'Customer not found or could not be deleted';
                        }
                        break;

                    case 'CUSTOMER_REQUESTED':
                        responseData = await this.customerService.getCustomerById(event.data.id);
                        updateEventType = responseData ? 'CUSTOMER_FOUND' : 'CUSTOMER_NOT_FOUND';
                        if (!responseData) {
                            success = false;
                            errorMessage = 'Customer not found';
                        }
                        break;

                    case 'CUSTOMERS_REQUESTED':
                        responseData = await this.customerService.getCustomers(
                            event.data.page,
                            event.data.limit,
                            event.data.search
                        );
                        updateEventType = 'CUSTOMERS_LIST_RESPONSE';
                        break;

                    default:
                        logger.warn(`Unknown customer event type: ${event.eventType}`);
                        return;
                }
            } catch (serviceError) {
                success = false;
                errorMessage = serviceError instanceof Error ? serviceError.message : 'Unknown error';
                updateEventType = this.getFailureEventType(event.eventType);
                responseData = { error: errorMessage };
            }

            // Publish update event
            await this.publishUpdateEvent(
                config.Kafka.topics.customerUpdates,
                updateEventType,
                {
                    success,
                    data: responseData,
                    error: errorMessage,
                    originalEvent: {
                        eventId: event.eventId,
                        eventType: event.eventType,
                        correlationId: event.metadata?.correlationId
                    }
                },
                event.metadata
            );

        } catch (error) {
            logger.error('Error handling customer event:', error);
            throw error;
        }
    }

    private async handleCustomerItemEvent(payload: EachMessagePayload): Promise<void> {
        try {
            const message = JSON.parse(payload.message.value?.toString() || '{}');
            const event: CustomerItemEvent = message;

            logger.info(`Processing customer item event: ${event.eventType}`, { 
                eventId: event.eventId,
                correlationId: event.metadata?.correlationId 
            });

            let updateEventType: ItemUpdateEventType;
            let responseData: any;
            let success = true;
            let errorMessage: string | undefined;

            try {
                switch (event.eventType) {
                    case 'ITEM_CREATED':
                        responseData = await this.itemService.createCustomerItem(event.data);
                        updateEventType = 'ITEM_CREATED_SUCCESS';
                        break;

                    case 'ITEM_UPDATED':
                        responseData = await this.itemService.updateCustomerItem(event.data.id, event.data);
                        updateEventType = responseData ? 'ITEM_UPDATED_SUCCESS' : 'ITEM_UPDATED_FAILED';
                        if (!responseData) {
                            success = false;
                            errorMessage = 'Item not found';
                        }
                        break;

                    case 'ITEM_DELETED':
                        const deleted = await this.itemService.deleteCustomerItem(event.data.id);
                        updateEventType = deleted ? 'ITEM_DELETED_SUCCESS' : 'ITEM_DELETED_FAILED';
                        responseData = { deleted, itemId: event.data.id };
                        if (!deleted) {
                            success = false;
                            errorMessage = 'Item not found or could not be deleted';
                        }
                        break;

                    case 'ITEM_REQUESTED':
                        responseData = await this.itemService.getCustomerItemById(event.data.itemId);
                        updateEventType = responseData ? 'ITEM_FOUND' : 'ITEM_NOT_FOUND';
                        if (!responseData) {
                            success = false;
                            errorMessage = 'Item not found';
                        }
                        break;

                    case 'ITEMS_REQUESTED':
                        responseData = await this.itemService.getCustomerItems(
                            event.data.customerId,
                            event.data.page,
                            event.data.limit,
                            event.data.category,
                            event.data.search
                        );
                        updateEventType = 'CUSTOMER_ITEMS_RESPONSE';
                        break;

                    case 'ALL_ITEMS_REQUESTED':
                        responseData = await this.itemService.getAllItems(
                            event.data.page,
                            event.data.limit,
                            event.data.category,
                            event.data.search,
                            event.data.customerId
                        );
                        updateEventType = 'ALL_ITEMS_RESPONSE';
                        break;

                    case 'ITEM_QUANTITY_UPDATED':
                        responseData = await this.itemService.updateItemQuantity(
                            event.data.id,
                            event.data.quantity,
                            event.data.operation
                        );
                        updateEventType = responseData ? 'ITEM_QUANTITY_UPDATED_SUCCESS' : 'ITEM_QUANTITY_UPDATED_FAILED';
                        if (!responseData) {
                            success = false;
                            errorMessage = 'Failed to update item quantity';
                        }
                        break;

                    default:
                        logger.warn(`Unknown customer item event type: ${event.eventType}`);
                        return;
                }
            } catch (serviceError) {
                success = false;
                errorMessage = serviceError instanceof Error ? serviceError.message : 'Unknown error';
                updateEventType = this.getItemFailureEventType(event.eventType);
                responseData = { error: errorMessage };
            }

            // Publish update event
            await this.publishUpdateEvent(
                config.Kafka.topics.itemUpdates,
                updateEventType,
                {
                    success,
                    data: responseData,
                    error: errorMessage,
                    originalEvent: {
                        eventId: event.eventId,
                        eventType: event.eventType,
                        correlationId: event.metadata?.correlationId
                    }
                },
                event.metadata
            );

        } catch (error) {
            logger.error('Error handling customer item event:', error);
            throw error;
        }
    }

    private async handleOrderEvent(payload: EachMessagePayload): Promise<void> {
        try {
            const message = JSON.parse(payload.message.value?.toString() || '{}');
            const event: OrderEvent = message;

            logger.info(`Processing order event: ${event.eventType}`, { 
                eventId: event.eventId,
                correlationId: event.metadata?.correlationId 
            });

            let updateEventType: OrderUpdateEventType;
            let responseData: any;
            let success = true;
            let errorMessage: string | undefined;

            try {
                switch (event.eventType) {
                    case 'ORDER_CREATED':
                        responseData = await this.orderService.createOrder(event.data);
                        updateEventType = 'ORDER_CREATED_SUCCESS';
                        break;

                    case 'ORDER_UPDATED':
                        responseData = await this.orderService.updateOrder(event.data.id, event.data);
                        updateEventType = responseData ? 'ORDER_UPDATED_SUCCESS' : 'ORDER_UPDATED_FAILED';
                        if (!responseData) {
                            success = false;
                            errorMessage = 'Order not found';
                        }
                        break;

                    case 'ORDER_CANCELLED':
                        responseData = await this.orderService.cancelOrder(event.data.id, event.data.reason);
                        updateEventType = responseData ? 'ORDER_CANCELLED_SUCCESS' : 'ORDER_CANCEL_FAILED';
                        if (!responseData) {
                            success = false;
                            errorMessage = 'Order not found or cannot be cancelled';
                        }
                        break;

                    case 'ORDER_REQUESTED':
                        responseData = await this.orderService.getOrderById(event.data.orderId);
                        updateEventType = responseData ? 'ORDER_FOUND' : 'ORDER_NOT_FOUND';
                        if (!responseData) {
                            success = false;
                            errorMessage = 'Order not found';
                        }
                        break;

                    case 'ORDER_DELETED':
                        const deleted = await this.orderService.deleteOrder(event.data.id);
                        updateEventType = deleted ? 'ORDER_DELETED_SUCCESS' : 'ORDER_DELETE_FAILED';
                        responseData = { deleted, orderId: event.data.id };
                        if (!deleted) {
                            success = false;
                            errorMessage = 'Order not found or could not be deleted';
                        }
                        break;

                    default:
                        logger.warn(`Unknown order event type: ${event.eventType}`);
                        return;
                }
            } catch (serviceError) {
                success = false;
                errorMessage = serviceError instanceof Error ? serviceError.message : 'Unknown error';
                updateEventType = this.getOrderFailureEventType(event.eventType);
                responseData = { error: errorMessage };
            }

            // Publish update event
            await this.publishUpdateEvent(
                config.Kafka.topics.orderUpdates,
                updateEventType,
                {
                    success,
                    data: responseData,
                    error: errorMessage,
                    originalEvent: {
                        eventId: event.eventId,
                        eventType: event.eventType,
                        correlationId: event.metadata?.correlationId
                    }
                },
                event.metadata
            );

        } catch (error) {
            logger.error('Error handling order event:', error);
            throw error;
        }
    }

    private async publishUpdateEvent(
        topic: string,
        eventType: string,
        data: any,
        originalMetadata?: any
    ): Promise<void> {
        try {
            await this.kafkaService.publishEvent(topic, {
                eventId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                eventType,
                timestamp: new Date(),
                data,
                metadata: {
                    ...originalMetadata,
                    source: 'ENGINE' as const,
                    processedAt: new Date()
                }
            });
        } catch (error) {
            logger.error(`Failed to publish update event to ${topic}:`, error);
            throw error;
        }
    }

    private getFailureEventType(eventType: string): CustomerUpdateEventType {
        switch (eventType) {
            case 'CUSTOMER_CREATED': return 'CUSTOMER_CREATED_FAILED';
            case 'CUSTOMER_UPDATED': return 'CUSTOMER_UPDATED_FAILED';
            case 'CUSTOMER_DELETED': return 'CUSTOMER_DELETED_FAILED';
            default: return 'CUSTOMER_UPDATED_FAILED';
        }
    }

    private getItemFailureEventType(eventType: string): ItemUpdateEventType {
        switch (eventType) {
            case 'ITEM_CREATED': return 'ITEM_CREATED_FAILED';
            case 'ITEM_UPDATED': return 'ITEM_UPDATED_FAILED';
            case 'ITEM_DELETED': return 'ITEM_DELETED_FAILED';
            case 'ITEM_QUANTITY_UPDATED': return 'ITEM_QUANTITY_UPDATED_FAILED';
            default: return 'ITEM_UPDATED_FAILED';
        }
    }

    private getOrderFailureEventType(eventType: string): OrderUpdateEventType {
        switch (eventType) {
            case 'ORDER_CREATED': return 'ORDER_CREATED_FAILED';
            case 'ORDER_UPDATED': return 'ORDER_UPDATED_FAILED';
            case 'ORDER_CANCELLED': return 'ORDER_CANCEL_FAILED';
            case 'ORDER_DELETED': return 'ORDER_DELETE_FAILED';
            default: return 'ORDER_UPDATED_FAILED';
        }
    }

    public async stop(): Promise<void> {
        try {
            this.isRunning = false;
            await this.databaseService.disconnect();
            logger.info('Event Processor stopped successfully');
        } catch (error) {
            logger.error('Error stopping Event Processor:', error);
            throw error;
        }
    }

    public IsRunning(): boolean {
        return this.isRunning;
    }
}
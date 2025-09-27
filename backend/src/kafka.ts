//Kafka.ts
import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { config } from './config/config';
import { logger } from './utils/logger';
import { KafkaEvent } from './types';
import { v4 as uuidv4 } from 'uuid';

export class KafkaService {
    private static instance: KafkaService;
    private kafka: Kafka;
    private producer: Producer | null = null;
    private consumer: Consumer | null = null;
    private isConnected: boolean = false;

    private constructor() {
        this.kafka = new Kafka({
            clientId: config.Kafka.clientId,
            brokers: config.Kafka.broker,
            retry: {
                retries: 8,
                initialRetryTime: 100,
                maxRetryTime: 30000
            }
        });
    }

    public static getInstance(): KafkaService {
        if (!KafkaService.instance) {
            KafkaService.instance = new KafkaService();
        }
        return KafkaService.instance;
    }

    public async connect(): Promise<void> {
        try {
            logger.info('Connecting to Kafka...');

    
            this.producer = this.kafka.producer(config.Kafka.producer);
            await this.producer.connect();

    
            this.consumer = this.kafka.consumer({
                groupId: config.Kafka.groupId,
                ...config.Kafka.consumer
            });
            await this.consumer.connect();

            this.isConnected = true;
            logger.info('Successfully connected to Kafka');

    
            await this.createTopics();

        } catch (error) {
            logger.error('Failed to connect to Kafka:', error);
            throw new Error('Kafka connection failed');
        }
    }

    public async disconnect(): Promise<void> {
        try {
            if (this.producer) {
                await this.producer.disconnect();
                this.producer = null;
            }

            if (this.consumer) {
                await this.consumer.disconnect();
                this.consumer = null;
            }

            this.isConnected = false;
            logger.info('Disconnected from Kafka');
        } catch (error) {
            logger.error('Error disconnecting from Kafka:', error);
        }
    }

    private async createTopics(): Promise<void> {
        try {
            const admin = this.kafka.admin();
            await admin.connect();

            const topics = Object.values(config.Kafka.topics);
            const existingTopics = await admin.listTopics();

            const topicsToCreate = topics
                .filter(topic => !existingTopics.includes(topic))
                .map(topic => ({
                    topic,
                    numPartitions: 3,
                    replicationFactor: 1,
                    configEntries: [
                        { name: 'cleanup.policy', value: 'delete' },
                        { name: 'retention.ms', value: '86400000' } // 1 day
                    ]
                }));

            if (topicsToCreate.length > 0) {
                await admin.createTopics({ topics: topicsToCreate });
                logger.info(`Created topics: ${topicsToCreate.map(t => t.topic).join(', ')}`);
            }

            await admin.disconnect();
        } catch (error) {
            logger.error('Error creating topics:', error);
        }
    }

    public async publishEvent(topic: string, event: KafkaEvent): Promise<void> {
        if (!this.producer || !this.isConnected) {
            throw new Error('Kafka producer not connected');
        }

        try {
            const message = {
                key: event.eventId,
                value: JSON.stringify(event),
                timestamp: event.timestamp.getTime().toString(),
                headers: {
                    eventType: Buffer.from(event.eventType),
                    correlationId: Buffer.from(event.metadata?.correlationId || uuidv4())
                }
            };

            await this.producer.send({
                topic,
                messages: [message]
            });

            logger.info(`Published event to topic ${topic}:`, {
                eventId: event.eventId,
                eventType: event.eventType
            });
        } catch (error) {
            logger.error(`Failed to publish event to topic ${topic}:`, error);
            throw error;
        }
    }

    public async subscribeToTopic(
        topic: string,
        messageHandler: (payload: EachMessagePayload) => Promise<void>
    ): Promise<void> {
        if (!this.consumer || !this.isConnected) {
            throw new Error('Kafka consumer not connected');
        }

        try {
            await this.consumer.subscribe({ topic, fromBeginning: false });

            await this.consumer.run({
                eachMessage: async (payload: EachMessagePayload) => {
                    try {
                        logger.info(`Received message from topic ${topic}:`, {
                            partition: payload.partition,
                            offset: payload.message.offset,
                            key: payload.message.key?.toString()
                        });

                        await messageHandler(payload);
                    } catch (error) {
                        logger.error(`Error processing message from topic ${topic}:`, error);
                        throw error;
                    }
                }
            });

            logger.info(`Subscribed to topic: ${topic}`);
        } catch (error) {
            logger.error(`Failed to subscribe to topic ${topic}:`, error);
            throw error;
        }
    }
    public async publishCustomerEvent(eventType: string, data: any, metadata?: any): Promise<void> {
        const event: KafkaEvent = {
            eventId: uuidv4(),
            eventType,
            timestamp: new Date(),
            data,
            metadata
        };

        await this.publishEvent(config.Kafka.topics.customerEvents, event);
    }

    public async publishCustomerItemEvent(eventType: string, data: any, metadata?: any): Promise<void> {
        const event: KafkaEvent = {
            eventId: uuidv4(),
            eventType,
            timestamp: new Date(),
            data,
            metadata
        };

        await this.publishEvent(config.Kafka.topics.customerItemsEvents, event);
    }

    public async publishOrderEvent(eventType: string, data: any, metadata?: any): Promise<void> {
        const event: KafkaEvent = {
            eventId: uuidv4(),
            eventType,
            timestamp: new Date(),
            data,
            metadata
        };

        await this.publishEvent(config.Kafka.topics.orderEvents, event);
    }

    public isHealthy(): boolean {
        return this.isConnected && this.producer !== null;
    }
}


// backend/src/services/websocket.service.ts
import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WebSocketMessage, WebSocketClient, WebSocketSubscription } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { KafkaService } from '../../kafka';
import { config } from '../../config/config';

export class WebSocketService {
    private static instance: WebSocketService;
    private wss: WebSocketServer | null = null;
    private clients: Map<string, WebSocketClient & { ws: WebSocket }> = new Map();
    private kafkaService: KafkaService;
    private isRunning: boolean = false;

    private constructor() {
        this.kafkaService = KafkaService.getInstance();
    }
    
    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        console.log('testing');
        return WebSocketService.instance;
    }

    public async initialize(server: Server): Promise<void> {
        try {
            logger.info(' Initializing WebSocket service...');

            this.wss = new WebSocketServer({ 
                server,
                path: '/ws',
                perMessageDeflate: false
            });

            this.setupWebSocketServer();
            await this.subscribeToKafkaUpdates();

            this.isRunning = true;
            logger.info('WebSocket service initialized successfully');
        } catch (error) {
            logger.error(' Failed to initialize WebSocket service:', error);
            throw error;
        }
    }

    private setupWebSocketServer(): void {
        if (!this.wss) return;

        this.wss.on('connection', (ws: WebSocket, request: any) => {
            const clientId = uuidv4();
            const clientInfo = this.extractClientInfo(request);

            const client: WebSocketClient & { ws: WebSocket } = {
                id: clientId,
                userId: clientInfo.userId,
                tenantId: clientInfo.tenantId,
                subscriptions: [],
                connectedAt: new Date(),
                lastActivity: new Date(),
                ws
            };

            this.clients.set(clientId, client);

            logger.info(` WebSocket client connected:`, {
                clientId,
                userId: client.userId,
                tenantId: client.tenantId,
                totalClients: this.clients.size
            });

            // Send connection acknowledgment
            this.sendToClient(clientId, {
                type: 'CONNECTION_ACK',
                data: {
                    clientId,
                    connectedAt: client.connectedAt,
                    availableChannels: [
                        'customer-updates',
                        'item-updates', 
                        'order-updates'
                    ]
                },
                timestamp: new Date()
            });

            // Setup message handlers
            ws.on('message', (data: { toString: () => string; }) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleClientMessage(clientId, message);
                } catch (error) {
                    logger.error(`Invalid message from client ${clientId}:`, error);
                    this.sendError(clientId, 'Invalid message format');
                }
            });

            ws.on('close', () => {
                this.clients.delete(clientId);
                logger.info(`WebSocket client disconnected: ${clientId}`, {
                    totalClients: this.clients.size
                });
            });

            // Handle errors
            ws.on('error', (error: any) => {
                logger.error(`WebSocket error for client ${clientId}:`, error);
                this.clients.delete(clientId);
            });

            // Setup ping/pong for connection health
            ws.on('pong', () => {
                const client = this.clients.get(clientId);
                if (client) {
                    client.lastActivity = new Date();
                }
            });
        });

        // Setup connection health monitoring
        this.setupHealthMonitoring();
    }

    private extractClientInfo(request: any): { userId?: string; tenantId?: string } {
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        
        return {
            userId: url.searchParams.get('userId') || request.headers['x-user-id'] || undefined,
            tenantId: url.searchParams.get('tenantId') || request.headers['x-tenant-id'] || undefined
        };
    }

    private handleClientMessage(clientId: string, message: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.lastActivity = new Date();

        logger.debug(` Received message from client ${clientId}:`, { 
            type: message.type,
            userId: client.userId 
        });

        switch (message.type) {
            case 'SUBSCRIBE':
                this.handleSubscription(clientId, message.data);
                break;

            case 'UNSUBSCRIBE':
                this.handleUnsubscription(clientId, message.data);
                break;

            case 'PING':
                this.sendToClient(clientId, {
                    type: 'PONG',
                    data: { timestamp: new Date() },
                    timestamp: new Date()
                });
                break;

            default:
                logger.warn(` Unknown message type from client ${clientId}: ${message.type}`);
                this.sendError(clientId, `Unknown message type: ${message.type}`);
        }
    }

    private handleSubscription(clientId: string, subscriptionData: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { eventTypes, channels } = subscriptionData;

        if (!Array.isArray(eventTypes) || !Array.isArray(channels)) {
            this.sendError(clientId, 'Invalid subscription data. Expected eventTypes and channels arrays.');
            return;
        }

        const subscription: WebSocketSubscription = {
            userId: client.userId,
            tenantId: client.tenantId,
            eventTypes,
            channels
        };

        client.subscriptions.push(subscription);

        logger.info(` Client ${clientId} subscribed to:`, {
            eventTypes,
            channels,
            userId: client.userId,
            tenantId: client.tenantId
        });

        this.sendToClient(clientId, {
            type: 'SUBSCRIPTION_ACK',
            data: {
                subscribed: true,
                eventTypes,
                channels,
                timestamp: new Date()
            },
            timestamp: new Date()
        });
    }

    private handleUnsubscription(clientId: string, unsubscriptionData: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { eventTypes, channels } = unsubscriptionData;

        // Remove matching subscriptions
        client.subscriptions = client.subscriptions.filter(sub => {
            const matchesEventTypes = eventTypes ? 
                !eventTypes.some((et: string) => sub.eventTypes.includes(et)) : true;
            const matchesChannels = channels ? 
                !channels.some((ch: string) => sub.channels.includes(ch)) : true;
            
            return matchesEventTypes && matchesChannels;
        });

        logger.info(` Client ${clientId} unsubscribed from:`, {
            eventTypes,
            channels,
            userId: client.userId
        });

        this.sendToClient(clientId, {
            type: 'SUBSCRIPTION_ACK',
            data: {
                unsubscribed: true,
                eventTypes,
                channels,
                timestamp: new Date()
            },
            timestamp: new Date()
        });
    }

    private async subscribeToKafkaUpdates(): Promise<void> {
        // Subscribe to customer updates
        await this.kafkaService.subscribeToTopic(
            config.Kafka.topics.customerUpdates,
            (payload) => this.handleKafkaUpdate('customer-updates', payload)
        );

        // Subscribe to item updates
        await this.kafkaService.subscribeToTopic(
            config.Kafka.topics.itemUpdates,
            (payload) => this.handleKafkaUpdate('item-updates', payload)
        );

        // Subscribe to order updates
        await this.kafkaService.subscribeToTopic(
            config.Kafka.topics.orderUpdates,
            (payload) => this.handleKafkaUpdate('order-updates', payload)
        );

        logger.info(' Subscribed to all Kafka update topics');
    }

    private async handleKafkaUpdate(channel: string, payload: any): Promise<void> {
        try {
            const message = JSON.parse(payload.message.value?.toString() || '{}');
            
            logger.debug(` Received update from Kafka topic:`, {
                channel,
                eventType: message.eventType,
                eventId: message.eventId
            });

            // Broadcast to relevant WebSocket clients
            this.broadcastUpdate(channel, message);

        } catch (error) {
            logger.error(` Error handling Kafka update for channel ${channel}:`, error);
        }
    }

    private broadcastUpdate(channel: string, updateData: any): void {
        const message: WebSocketMessage = {
            type: 'EVENT_UPDATE',
            data: {
                channel,
                event: updateData,
                timestamp: new Date()
            },
            timestamp: new Date(),
            correlationId: updateData.metadata?.correlationId
        };

        let sentCount = 0;

        // Send to all subscribed clients
        for (const [clientId, client] of this.clients.entries()) {
            if (this.shouldReceiveUpdate(client, channel, updateData)) {
                this.sendToClient(clientId, message);
                sentCount++;
            }
        }

        logger.debug(` Broadcasted update to ${sentCount} clients:`, {
            channel,
            eventType: updateData.eventType,
            totalClients: this.clients.size
        });
    }

    private shouldReceiveUpdate(
        client: WebSocketClient, 
        channel: string, 
        updateData: any
    ): boolean {
        // Check if client has relevant subscriptions
        return client.subscriptions.some(sub => {
            const channelMatch = sub.channels.includes(channel);
            const eventTypeMatch = sub.eventTypes.length === 0 || 
                sub.eventTypes.includes(updateData.eventType);
            
            // Tenant isolation
            const tenantMatch = !client.tenantId || 
                !updateData.metadata?.tenantId || 
                client.tenantId === updateData.metadata.tenantId;

            return channelMatch && eventTypeMatch && tenantMatch;
        });
    }

    private sendToClient(clientId: string, message: WebSocketMessage): void {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            client.ws.send(JSON.stringify(message));
        } catch (error) {
            logger.error(` Failed to send message to client ${clientId}:`, error);
            this.clients.delete(clientId);
        }
    }

    private sendError(clientId: string, errorMessage: string): void {
        this.sendToClient(clientId, {
            type: 'ERROR',
            data: { error: errorMessage },
            timestamp: new Date()
        });
    }

    private setupHealthMonitoring(): void {
        // Ping clients every 30 seconds
        setInterval(() => {
            for (const [clientId, client] of this.clients.entries()) {
                if (client.ws.readyState === WebSocket.OPEN) {
                    try {
                        client.ws.ping();
                    } catch (error) {
                        logger.warn(` Failed to ping client ${clientId}, removing:`, error);
                        this.clients.delete(clientId);
                    }
                } else {
                    this.clients.delete(clientId);
                }
            }
        }, 30000);

        // Remove inactive clients
        setInterval(() => {
            const now = new Date();
            const timeout = 5 * 60 * 1000; // 5 minutes

            for (const [clientId, client] of this.clients.entries()) {
                if (now.getTime() - client.lastActivity.getTime() > timeout) {
                    logger.info(` Removing inactive client: ${clientId}`);
                    client.ws.terminate();
                    this.clients.delete(clientId);
                }
            }
        }, 60000); // Check every minute
    }

    public getStats(): {
        isRunning: boolean;
        connectedClients: number;
        clientsByTenant: Record<string, number>;
        totalSubscriptions: number;
    } {
        const clientsByTenant: Record<string, number> = {};
        let totalSubscriptions = 0;

        for (const client of this.clients.values()) {
            const tenant = client.tenantId || 'default';
            clientsByTenant[tenant] = (clientsByTenant[tenant] || 0) + 1;
            totalSubscriptions += client.subscriptions.length;
        }

        return {
            isRunning: this.isRunning,
            connectedClients: this.clients.size,
            clientsByTenant,
            totalSubscriptions
        };
    }

    public async shutdown(): Promise<void> {
        try {
            logger.info(' Shutting down WebSocket service...');

            // Close all client connections
            for (const [clientId, client] of this.clients.entries()) {
                client.ws.close(1001, 'Server shutting down');
            }

            // Close WebSocket server
            if (this.wss) {
                this.wss.close();
            }

            this.clients.clear();
            this.isRunning = false;

            logger.info(' WebSocket service shut down successfully');
        } catch (error) {
            logger.error(' Error shutting down WebSocket service:', error);
            throw error;
        }
    }
}
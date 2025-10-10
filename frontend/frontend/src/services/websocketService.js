// frontend/src/services/websocketService.js

class WebSocketService {
    constructor() {
        this.ws = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.isConnected = false;
        this.subscriptions = [];
    }

    connect(userId = 'default-user', tenantId = null) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        const wsUrl = `ws://localhost:3000/ws?userId=${userId}${tenantId ? `&tenantId=${tenantId}` : ''}`;
        
        console.log('Connecting to WebSocket:', wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('✅ WebSocket connected successfully');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            // Resubscribe to all channels after reconnection
            this.resubscribeAll();
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('📨 Received WebSocket message:', message);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            this.isConnected = false;
            this.attemptReconnect();
        };
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('❌ Max reconnection attempts reached');
        }
    }

    subscribe(eventTypes, channels, callback) {
        const subscription = { eventTypes, channels, callback };
        this.subscriptions.push(subscription);

        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.sendSubscription(eventTypes, channels);
        }

        // Register callback for specific event types
        eventTypes.forEach(eventType => {
            if (!this.listeners.has(eventType)) {
                this.listeners.set(eventType, []);
            }
            this.listeners.get(eventType).push(callback);
        });
    }

    sendSubscription(eventTypes, channels) {
        const subscribeMessage = {
            type: 'SUBSCRIBE',
            data: {
                eventTypes,
                channels
            }
        };
        
        console.log('📤 Subscribing to:', subscribeMessage);
        this.send(subscribeMessage);
    }

    resubscribeAll() {
        console.log('🔄 Resubscribing to all channels...');
        this.subscriptions.forEach(({ eventTypes, channels }) => {
            this.sendSubscription(eventTypes, channels);
        });
    }

    handleMessage(message) {
        switch (message.type) {
            case 'CONNECTION_ACK':
                console.log('✅ Connection acknowledged:', message.data);
                break;

            case 'SUBSCRIPTION_ACK':
                console.log('✅ Subscription confirmed:', message.data);
                break;

            case 'EVENT_UPDATE':
                console.log('📬 Event update received:', message.data);
                this.notifyListeners(message.data.event);
                break;

            case 'PONG':
                // Handle pong response
                break;

            default:
                console.warn('⚠️ Unknown message type:', message.type);
        }
    }

    notifyListeners(event) {
        const eventType = event.eventType;
        const listeners = this.listeners.get(eventType) || [];
        
        console.log(`📢 Notifying ${listeners.length} listeners for event: ${eventType}`);
        
        listeners.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Error in event listener:', error);
            }
        });
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('⚠️ WebSocket is not connected. Message not sent:', message);
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
            this.listeners.clear();
            this.subscriptions = [];
        }
    }

    // Send periodic ping to keep connection alive
    startPingInterval() {
        setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'PING' });
            }
        }, 30000); // Every 30 seconds
    }
}

export default new WebSocketService();
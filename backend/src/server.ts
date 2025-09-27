//server.ts - Complete Fixed Version
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/config';
import { logger } from './utils/logger';
import { KafkaService } from './kafka'; // Fixed import path
import { Engine } from './Engine/Engine'; // Added Engine import
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Import routes
import customerRoutes from './routes/customer.route';
import orderRoutes from './routes/order.route';
import itemsRoutes from './routes/items.route';

class App {
    public app: express.Application;
    private kafkaService: KafkaService;
    private engine: Engine; // Added Engine
    private isSystemReady: boolean = false; // System readiness flag

    constructor() {
        this.app = express();
        this.kafkaService = KafkaService.getInstance();
        this.engine = Engine.getInstance(); // Initialize Engine
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    private initializeMiddlewares(): void {
        this.app.use(helmet());

        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-tenant-id', 'x-correlation-id']
        }));

        this.app.use(compression());

        this.app.use(express.json({
            limit: config.api.maxRequestSize,
            strict: true
        }));
        this.app.use(express.urlencoded({
            extended: true,
            limit: config.api.maxRequestSize
        }));

        this.app.use(requestLogger);

        this.app.use((req, res, next) => {
            req.setTimeout(config.api.requestTimeout, () => {
                logger.warn('Request timeout:', {
                    method: req.method,
                    url: req.url,
                    ip: req.ip
                });
                if (!res.headersSent) {
                    res.status(408).json({
                        success: false,
                        message: 'Request timeout',
                        timestamp: new Date()
                    });
                }
            });
            next();
        });
    }

    private initializeRoutes(): void {
        // Enhanced Health Check - Now includes Engine status
        this.app.get('/health', (req, res) => {
            const kafkaHealthy = this.kafkaService.isHealthy();
            const engineStatus = this.engine.getStatus();
            const systemHealthy = kafkaHealthy && engineStatus.running && engineStatus.eventProcessor && this.isSystemReady;

            const status = systemHealthy ? 'healthy' : 'degraded';
            const statusCode = systemHealthy ? 200 : 503;

            res.status(statusCode).json({
                status,
                timestamp: new Date().toISOString(),
                service: 'multi-tenant-api',
                version: '1.0.0',
                components: {
                    api: 'healthy',
                    kafka: kafkaHealthy ? 'healthy' : 'unhealthy',
                    engine: engineStatus.running ? 'healthy' : 'unhealthy',
                    eventProcessor: engineStatus.eventProcessor ? 'healthy' : 'unhealthy'
                },
                systemReady: this.isSystemReady
            });
        });

        // Enhanced Readiness Check
        this.app.get('/ready', (req, res) => {
            const ready = this.isSystemReady &&
                this.kafkaService.isHealthy() &&
                this.engine.getStatus().running &&
                this.engine.getStatus().eventProcessor;
            const statusCode = ready ? 200 : 503;

            res.status(statusCode).json({
                ready,
                timestamp: new Date().toISOString(),
                service: 'multi-tenant-api',
                components: {
                    kafka: this.kafkaService.isHealthy(),
                    engine: this.engine.getStatus().running,
                    eventProcessor: this.engine.getStatus().eventProcessor
                }
            });
        });

        this.app.get('/api/docs', (req, res) => {
            res.json({
                title: 'Multi-Tenant API Documentation',
                version: '1.0.0',
                baseUrl: `http://localhost:${config.port}/api`,
                authentication: {
                    headers: {
                        'x-user-id': 'Optional user identifier',
                        'x-tenant-id': 'Optional tenant identifier',
                        'x-correlation-id': 'Optional request correlation ID'
                    }
                },
                endpoints: {
                    customers: {
                        'POST /api/customers': 'Create a new customer',
                        'GET /api/customers': 'Get all customers (with pagination)',
                        'GET /api/customers/:id': 'Get customer by ID',
                        'PUT /api/customers/:id': 'Update customer',
                        'DELETE /api/customers/:id': 'Delete customer'
                    },
                    items: {
                        'POST /api/items': 'Create a new item',
                        'GET /api/items': 'Get all items (with filters)',
                        'GET /api/items/customer/:customerId': 'Get items for specific customer',
                        'GET /api/items/item/:id': 'Get item by ID',
                        'PUT /api/items/item/:id': 'Update item',
                        'DELETE /api/items/item/:id': 'Delete item',
                        'PATCH /api/items/item/:id/quantity': 'Update item quantity'
                    },
                    orders: {
                        'POST /api/orders': 'Create a new order',
                        'GET /api/orders': 'Get all orders (with filters)',
                        'GET /api/orders/customer/:customerId': 'Get orders for specific customer',
                        'GET /api/orders/:id': 'Get order by ID',
                        'PUT /api/orders/:id': 'Update order',
                        'POST /api/orders/:id/cancel': 'Cancel order',
                        'DELETE /api/orders/:id': 'Delete order'
                    }
                },
                responseFormat: {
                    success: true,
                    data: 'Response data or null',
                    message: 'Success/error message',
                    timestamp: 'ISO timestamp'
                },
                asyncProcessing: {
                    note: 'All operations return 202 Accepted',
                    realTimeUpdates: 'Subscribe to WebSocket for real-time results',
                    eventFlow: 'API → Kafka → Engine → Database → Kafka Updates → WebSocket'
                }
            });
        });
        // Enhanced API Info
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'Multi-Tenant Backend API',
                version: '1.0.0',
                description: 'Event-driven multi-tenant backend with Kafka integration',
                architecture: 'Event Sourcing with CQRS',
                components: {
                    api: 'REST API (Event Publisher)',
                    engine: 'Event Processor (Business Logic)',
                    kafka: 'Message Queue & Event Bus',
                    database: 'PostgreSQL with Optimizations'
                },
                endpoints: {
                    customers: '/api/customers',
                    customerItems: '/api/items',
                    orders: '/api/orders'
                },
                documentation: '/api/docs',
                timestamp: new Date().toISOString()
            });
        });

        // Route validation
        if (!customerRoutes || !itemsRoutes || !orderRoutes) {
            logger.error('Route modules failed to load properly');
            throw new Error('Route modules not loaded');
        }

        this.app.use('/api/customers', customerRoutes);
        this.app.use('/api/items', itemsRoutes);
        this.app.use('/api/orders', orderRoutes);

        logger.info('Routes initialized successfully');

        // 404 handler
        this.app.use('/{*any}', (req, res) => {
            res.status(404).json({
                success: false,
                message: `Route ${req.method} ${req.originalUrl} not found`,
                timestamp: new Date()
            });
        });
    }

    private initializeErrorHandling(): void {
        this.app.use(errorHandler);
    }

    public async start(): Promise<void> {
        try {
            logger.info('Starting Multi-Tenant System...');

            // Step 1: Initialize Kafka Service
            logger.info('Step 1: Connecting to Kafka...');
            await this.kafkaService.connect();
            logger.info('Kafka service initialized successfully');

            // Step 2: Start Engine (Event Processor)
            logger.info('Step 2: Starting Engine (Event Processor)...');
            await this.engine.start();
            logger.info('Engine started successfully - Now processing events');

            // Step 3: Mark system as ready
            this.isSystemReady = true;
            logger.info('Step 3: System components ready');

            // Step 4: Start API Server
            logger.info('Step 4: Starting API Server...');
            const server = this.app.listen(config.port, () => {
                logger.info('SYSTEM STARTUP COMPLETE!', {
                    port: config.port,
                    environment: config.nodeEnv,
                    pid: process.pid
                });

                logger.info('System Status:', {
                    api: 'Running & Accepting Requests',
                    kafka: 'Connected & Processing Messages',
                    engine: 'Processing Events from Queue',
                    database: 'Connected & Optimized'
                });

                logger.info('Access Points:', {
                    apiInfo: `http://localhost:${config.port}/api`,
                    healthCheck: `http://localhost:${config.port}/health`,
                    readinessCheck: `http://localhost:${config.port}/ready`
                });

                logger.info('Available Endpoints:', {
                    customers: `http://localhost:${config.port}/api/customers`,
                    items: `http://localhost:${config.port}/api/items`,
                    orders: `http://localhost:${config.port}/api/orders`
                });

                logger.info('System Flow:', {
                    request: 'Browser → API → Kafka Queue → Engine → Database',
                    response: 'Engine → Database → Kafka Updates → (WebSocket) → Browser',
                    note: 'All API calls return 202 Accepted - Processing is asynchronous'
                });
            });

            // Setup graceful shutdown
            this.setupGracefulShutdown(server);

        } catch (error) {
            logger.error('Failed to start Multi-Tenant System:', error);
            await this.gracefulShutdown();
            process.exit(1);
        }
    }

    private setupGracefulShutdown(server: any): void {
        const gracefulShutdown = async (signal: string) => {
            logger.info(`Received ${signal}, starting graceful shutdown...`);

            server.close(async () => {
                await this.gracefulShutdown();
                logger.info('Graceful shutdown completed');
                process.exit(0);
            });

            // Force shutdown after 30 seconds
            setTimeout(() => {
                logger.error('Forced shutdown due to timeout');
                process.exit(1);
            }, 30000);
        };

        // Handle shutdown signals
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            this.gracefulShutdown().then(() => process.exit(1));
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.gracefulShutdown().then(() => process.exit(1));
        });
    }

    private async gracefulShutdown(): Promise<void> {
        try {
            this.isSystemReady = false;

            // Stop Engine first (stops event processing)
            logger.info('Stopping Engine...');
            await this.engine.stop();
            logger.info('Engine stopped successfully');

            // Disconnect Kafka
            logger.info('Disconnecting Kafka...');
            await this.kafkaService.disconnect();
            logger.info('Kafka disconnected successfully');

        } catch (error) {
            logger.error('Error during graceful shutdown:', error);
            throw error;
        }
    }
}

// Start the application
const app = new App();
app.start().catch((error) => {
    logger.error('Application startup failed:', error);
    process.exit(1);
});
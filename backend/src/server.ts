// src/server.ts - Updated with Redis Integration
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/config';
import { logger } from './utils/logger';
import { KafkaService } from './kafka';
import { Engine } from './Engine/Engine';
import { RedisService } from './cache/redies.service'; // NEW
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Import routes
import customerRoutes from './routes/customer.route';
import orderRoutes from './routes/order.route';
import itemsRoutes from './routes/items.route';

class App {
    public app: express.Application;
    private kafkaService: KafkaService;
    private engine: Engine;
    private redisService: RedisService;
    private isSystemReady: boolean = false;

    constructor() {
        this.app = express();
        this.kafkaService = KafkaService.getInstance();
        this.engine = Engine.getInstance();
        this.redisService = RedisService.getInstance(); // NEW
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
        // Enhanced Health Check - Now includes Redis status
        this.app.get('/health', (req, res) => {
            const kafkaHealthy = this.kafkaService.isHealthy();
            const redisHealthy = this.redisService.isHealthy(); // NEW
            const engineStatus = this.engine.getStatus();
            const systemHealthy = kafkaHealthy && redisHealthy && engineStatus.running && engineStatus.eventProcessor && this.isSystemReady;

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
                    redis: redisHealthy ? 'healthy' : 'unhealthy', // NEW
                    engine: engineStatus.running ? 'healthy' : 'unhealthy',
                    eventProcessor: engineStatus.eventProcessor ? 'healthy' : 'unhealthy',
                    database: engineStatus.services?.database ? 'healthy' : 'unhealthy'
                },
                systemReady: this.isSystemReady
            });
        });

        // Enhanced Readiness Check
        this.app.get('/ready', (req, res) => {
            const ready = this.isSystemReady &&
                this.kafkaService.isHealthy() &&
                this.redisService.isHealthy() && // NEW
                this.engine.getStatus().running &&
                this.engine.getStatus().eventProcessor;
            const statusCode = ready ? 200 : 503;

            res.status(statusCode).json({
                ready,
                timestamp: new Date().toISOString(),
                service: 'multi-tenant-api',
                components: {
                    kafka: this.kafkaService.isHealthy(),
                    redis: this.redisService.isHealthy(), // NEW
                    engine: this.engine.getStatus().running,
                    eventProcessor: this.engine.getStatus().eventProcessor
                }
            });
        });

        // Cache statistics endpoint
        this.app.get('/cache/stats', async (req, res) => {
            try {
                const stats = await this.redisService.getCacheStats();
                res.json({
                    success: true,
                    data: stats,
                    timestamp: new Date()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to get cache statistics',
                    timestamp: new Date()
                });
            }
        });

        // Updated API Info
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'Multi-Tenant Backend API',
                version: '1.0.0',
                description: 'Event-driven multi-tenant backend with Redis caching and Kafka integration',
                architecture: 'Event Sourcing with CQRS and Cache-First Reads',
                components: {
                    api: 'REST API (Hybrid sync/async)',
                    engine: 'Event Processor (Business Logic)',
                    kafka: 'Message Queue & Event Bus',
                    redis: 'Cache Layer (Performance)', // NEW
                    database: 'PostgreSQL with Optimizations'
                },
                features: [
                    'Cache-first read operations (<50ms response)',
                    'Async write operations via Kafka',
                    'Real-time WebSocket updates',
                    'Automatic cache invalidation',
                    'Event sourcing and replay capability'
                ],
                endpoints: {
                    customers: '/api/customers',
                    customerItems: '/api/items',
                    orders: '/api/orders'
                },
                monitoring: {
                    health: '/health',
                    readiness: '/ready',
                    cacheStats: '/cache/stats'
                },
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
            logger.info('Starting Multi-Tenant System with Cache Layer...');

            // Step 1: Initialize Redis Cache
            logger.info('Step 1: Connecting to Redis Cache...');
            await this.redisService.connect();
            logger.info('Redis cache service initialized successfully');

            // Step 2: Initialize Kafka Service
            logger.info('Step 2: Connecting to Kafka...');
            await this.kafkaService.connect();
            logger.info('Kafka service initialized successfully');

            // Step 3: Start Engine (Event Processor)
            logger.info('Step 3: Starting Engine (Event Processor)...');
            await this.engine.start();
            logger.info('Engine started successfully - Now processing events');

            // Step 4: Warm cache if enabled
            if (config.cache.enabled) {
                logger.info('Step 4: Warming cache...');
                await this.redisService.warmCache();
                logger.info('Cache warming completed');
            }

            // Step 5: Mark system as ready
            this.isSystemReady = true;
            logger.info('Step 5: System components ready');

            // Step 6: Start API Server
            logger.info('Step 6: Starting API Server...');
            const server = this.app.listen(config.port, () => {
                logger.info('SYSTEM STARTUP COMPLETE!', {
                    port: config.port,
                    environment: config.nodeEnv,
                    pid: process.pid
                });

                logger.info('System Status:', {
                    api: 'Running & Accepting Requests',
                    kafka: 'Connected & Processing Messages',
                    redis: 'Connected & Caching Data',
                    engine: 'Processing Events from Queue',
                    database: 'Connected & Optimized'
                });

                logger.info('Performance Features:', {
                    cacheEnabled: config.cache.enabled,
                    cacheStrategy: 'Cache-first reads, Write-through updates',
                    expectedReadLatency: '<50ms (cache hits)',
                    expectedWriteLatency: '<100ms (async processing)'
                });

                logger.info('Access Points:', {
                    apiInfo: `http://localhost:${config.port}/api`,
                    healthCheck: `http://localhost:${config.port}/health`,
                    readinessCheck: `http://localhost:${config.port}/ready`,
                    cacheStats: `http://localhost:${config.port}/cache/stats`
                });

                logger.info('Available Endpoints:', {
                    customers: `http://localhost:${config.port}/api/customers`,
                    items: `http://localhost:${config.port}/api/items`,
                    orders: `http://localhost:${config.port}/api/orders`
                });

                logger.info('System Flow:', {
                    reads: 'Browser → API → Redis Cache → Database (fallback) → Response',
                    writes: 'Browser → API → Kafka → Engine → Database → Cache Update → WebSocket',
                    caching: 'Write-through updates, Cache-first reads, Smart invalidation'
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

            // Disconnect Redis
            logger.info('Disconnecting Redis...');
            await this.redisService.disconnect();
            logger.info('Redis disconnected successfully');

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
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/config';
import { logger } from './utils/logger';
import { KafkaService } from './kafka.js';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';


import customerRoutes from './routes/customer.route';
import orderRoutes from './routes/order.route';
import itemsRoutes from './routes/items.route';


class App {
    public app: express.Application;
    private kafkaService: KafkaService;

    constructor() {
        this.app = express();
        this.kafkaService = KafkaService.getInstance();
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
        this.app.get('/health', (req, res) => {
            const kafkaHealthy = this.kafkaService.isHealthy();
            const status = kafkaHealthy ? 'healthy' : 'degraded';
            const statusCode = kafkaHealthy ? 200 : 503;

            res.status(statusCode).json({
                status,
                timestamp: new Date().toISOString(),
                service: 'multi-tenant-api',
                version: '1.0.0',
                components: {
                    kafka: kafkaHealthy ? 'healthy' : 'unhealthy'
                }
            });
        });

        this.app.get('/ready', (req, res) => {
            const ready = this.kafkaService.isHealthy();
            const statusCode = ready ? 200 : 503;

            res.status(statusCode).json({
                ready,
                timestamp: new Date().toISOString(),
                service: 'multi-tenant-api'
            });
        });

        this.app.get('/api', (req, res) => {
            res.json({
                name: 'Multi-Tenant Backend API',
                version: '1.0.0',
                description: 'Event-driven multi-tenant backend with Kafka integration',
                endpoints: {
                    customers: '/api/customers',
                    customerItems: '/api/items',
                    orders: '/api/orders'
                },
                documentation: '/api/docs',
                timestamp: new Date().toISOString()
            });
        });

        if (!customerRoutes || !itemsRoutes || !orderRoutes) {
            logger.error('Route modules failed to load properly');
            throw new Error('Route modules not loaded');
        }

        this.app.use('/api/customers', customerRoutes);
        this.app.use('/api/items', itemsRoutes);
        this.app.use('/api/orders', orderRoutes);

        logger.info('Routes initialized successfully');

        this.app.use('/*splat', (req, res) => {
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
            await this.kafkaService.connect();
            logger.info('Kafka service initialized successfully');

            const server = this.app.listen(config.port, () => {
                logger.info(`Server started successfully!`, {
                    port: config.port,
                    environment: config.nodeEnv,
                    pid: process.pid
                });

                logger.info(`API Documentation available at http://localhost:${config.port}/api`);
                logger.info(` Health check available at http://localhost:${config.port}/health`);
            });
            const gracefulShutdown = async (signal: string) => {
                logger.info(`Received ${signal}, starting graceful shutdown...`);

                server.close(async () => {
                    try {
                        await this.kafkaService.disconnect();
                        logger.info('Kafka service disconnected successfully');

                        logger.info('Graceful shutdown completed');
                        process.exit(0);
                    } catch (error) {
                        logger.error('Error during graceful shutdown:', error);
                        process.exit(1);
                    }
                });
            };

            process.on('SIGINT', () => gracefulShutdown('SIGINT'));
            process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
            process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

            process.on('uncaughtException', (error) => {
                logger.error('Uncaught Exception:', error);
                process.exit(1);
            });

            process.on('unhandledRejection', (reason, promise) => {
                logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
                process.exit(1);
            });

        } catch (error) {
            logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }
}

const app = new App();
app.start().catch((error) => {
    logger.error('Application startup failed:', error);
    process.exit(1);
});
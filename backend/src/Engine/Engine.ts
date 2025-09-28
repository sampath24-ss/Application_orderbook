// backend/src/Engine/Engine.ts
import { EventProcessor } from './Processors/event.processors';
import { logger } from '../utils/logger';

export class Engine {
    private static instance: Engine;
    private eventProcessor: EventProcessor;
    private isRunning: boolean = false;

    private constructor() {
        this.eventProcessor = EventProcessor.getInstance();
    }

    public static getInstance(): Engine {
        if (!Engine.instance) {
            Engine.instance = new Engine();
        }
        return Engine.instance;
    }

    public async start(): Promise<void> {
        try {
            logger.info('Starting Engine...');

            await this.eventProcessor.start();

            this.isRunning = true;
            logger.info('Engine started successfully and ready to process events');

            // Setup graceful shutdown
            this.setupGracefulShutdown();

        } catch (error) {
            logger.error('Failed to start Engine:', error);
            throw error;
        }
    }

    private setupGracefulShutdown(): void {
        const gracefulShutdown = async (signal: string) => {
            logger.info(` Received ${signal}, starting graceful shutdown of Engine...`);

            try {
                await this.stop();
                logger.info('Engine graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error('Error during Engine graceful shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception in Engine:', error);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection in Engine at:', promise, 'reason:', reason);
            process.exit(1);
        });
    }

    public async stop(): Promise<void> {
        try {
            if (!this.isRunning) {
                logger.warn('Engine is not running');
                return;
            }

            logger.info(' Stopping Engine...');

            await this.eventProcessor.stop();

            this.isRunning = false;
            logger.info('Engine stopped successfully');
        } catch (error) {
            logger.error('Error stopping Engine:', error);
            throw error;
        }
    }

    public isProcessorRunning(): boolean {
        return this.isRunning;
    }

    public getStatus(): {
        services: any; running: boolean; eventProcessor: boolean
    } {
        return {
            running: this.isRunning,
            eventProcessor: this.isRunning,
            services: undefined,
        };
    }
}

if (require.main === module) {
    const engine = Engine.getInstance();

    engine.start().catch((error) => {
        logger.error('Failed to start Engine:', error);
        process.exit(1);
    });
}
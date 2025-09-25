import winston from 'winston';
import { config } from '../config/config';

const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({stack: true}),
    winston.format.json(),
    winston.format.prettyPrint()
);


const logger = winston.createLogger({
    level: config.logging.level,
    format: logFormat,
    defaultMeta: {service: 'multi-tenant-api'},
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

if(config.nodeEnv === 'production'){
    logger.add(
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: logFormat
        })
    );

    logger.add(
        new winston.transports.File({
            filename: 'logs/combined.log',
            format: logFormat
        })
    );
}

export {logger};
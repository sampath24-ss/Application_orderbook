//requestLogger
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    logger.info('Incoming request:', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type'),
        contentLength: req.get('Content-Length')
    });

    const originalEnd = res.end;

    res.end = function (chunk?: any, encoding?: any): Response {
        const duration = Date.now() - start;

        logger.info('Response sent:', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            contentLength: res.get('Content-Length')
        });

        return originalEnd.call(this, chunk, encoding);
    };

    next();
};
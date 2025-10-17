//errorhandler
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

export class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

export const errorHandler = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    let errors: string[] = [];

    if (error instanceof AppError) {
        statusCode = error.statusCode;
        message = error.message;
    }

    else if (error.message.includes('Kafka')) {
        statusCode = 503;
        message = 'Service temporarily unavailable';
        errors.push('Message queue service is unavailable');
    }

    else if (error.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
        errors = [error.message];
    }

    else if (error instanceof SyntaxError && 'body' in error) {
        statusCode = 400;
        message = 'Invalid JSON format';
    }

    logger.error('API Error:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    const response: ApiResponse = {
        success: false,
        message,
        errors: errors.length > 0 ? errors : [error.message],
        timestamp: new Date()
    };

    res.status(statusCode).json(response);
};

export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        fn(req, res, next).catch(next);
    };
};

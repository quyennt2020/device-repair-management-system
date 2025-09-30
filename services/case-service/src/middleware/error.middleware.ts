import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorMiddleware = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error middleware caught:', error);

  // Default error values
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let isOperational = error.isOperational || false;

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    isOperational = true;
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
    isOperational = true;
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
    isOperational = true;
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Resource not found';
    isOperational = true;
  } else if (error.name === 'ConflictError') {
    statusCode = 409;
    message = 'Resource conflict';
    isOperational = true;
  }

  // Database errors
  if (error.message?.includes('duplicate key')) {
    statusCode = 409;
    message = 'Resource already exists';
    isOperational = true;
  } else if (error.message?.includes('foreign key')) {
    statusCode = 400;
    message = 'Invalid reference';
    isOperational = true;
  } else if (error.message?.includes('not null')) {
    statusCode = 400;
    message = 'Required field missing';
    isOperational = true;
  }

  // Prepare error response
  const errorResponse: any = {
    error: message,
    status: statusCode
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = error.message;
  }

  // Add request info for debugging
  if (process.env.NODE_ENV === 'development') {
    errorResponse.request = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    };
  }

  res.status(statusCode).json(errorResponse);
};

export const notFoundMiddleware = (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
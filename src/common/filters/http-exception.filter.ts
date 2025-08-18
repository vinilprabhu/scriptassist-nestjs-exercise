import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface HttpExceptionResponse {
  statusCode: number;
  message: string | string[];
  error: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();

      const errorResponse = exception.getResponse();
      if (typeof errorResponse === 'string') {
        message = errorResponse;
      } else if (typeof errorResponse === 'object' && errorResponse !== null) {
        message = (errorResponse as HttpExceptionResponse).message || exception.message;
        error = (errorResponse as HttpExceptionResponse).error ?? null;
      } else {
        message = exception.message;
      }
    }

    // error payload for logging
    const logPayload = {
      status,
      method: request.method,
      path: request.url,
      message,
      error,
    };

    const stack = (exception as Error).stack;

    this.logger.error(`HTTP Exception: ${JSON.stringify(logPayload)}`, stack);

    // error response for client
    const responsePayload = {
      success: false,
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(responsePayload);
  }
}

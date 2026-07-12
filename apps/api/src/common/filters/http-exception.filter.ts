import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status = this.getStatus(exception);
    const body = this.getBody(exception, status, request.path);

    response.status(status).json(body);
  }

  private getStatus(exception: unknown) {
    if (exception instanceof HttpException) {
      return Number(exception.getStatus());
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getBody(exception: unknown, status: number, path: string) {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return {
          statusCode: status,
          message: response,
          error: exception.name,
          path,
        };
      }

      if (response && typeof response === 'object') {
        return {
          ...response,
          statusCode: Number((response as { statusCode?: number | string }).statusCode ?? status),
          path,
        };
      }
    }

    return {
      statusCode: status,
      message: 'Internal server error',
      error: 'Internal Server Error',
      path,
    };
  }
}

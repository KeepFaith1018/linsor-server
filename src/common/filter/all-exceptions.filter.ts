import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorCode } from '../utils/errorCodes';
import { Result } from '../utils/result';
import { AppException } from '../exception/appException';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
type HttpExceptionResponse = {
  message: string;
  error?: string;
  statusCode: number;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger;

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let code = ErrorCode.UNKNOWN_ERROR;
    let message = '服务器内部错误';
    let status = HttpStatus.OK;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (exception instanceof AppException) {
        // 处理自定义异常，只针对业务中的异常
        response.status(status).json(res);
        this.logger.error(
          `自定义异常 AppException: ${JSON.stringify(res)}`,
          null,
          AllExceptionsFilter.name,
        );
        return;
      }
      // 对于其他基于http的异常
      const httpStatus = exception.getStatus();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object') {
        message = (res as HttpExceptionResponse).message;
      }
      status = httpStatus;
      code = httpStatus;
      this.logger.error(
        `其他Http类异常 HttpException(${exception.name}): ${JSON.stringify(res)}`,
        null,
        AllExceptionsFilter.name,
      );
    } else if (exception instanceof Error) {
      // 处理普通JavaScript错误
      message = exception.message;
      this.logger.error(
        `JS错误 Error: ${exception.stack}`,
        null,
        AllExceptionsFilter.name,
      );
    } else {
      // 处理其他类型的异常
      message = String(exception);
      this.logger.error(
        `未识别的异常 Exception: ${message}`,
        null,
        AllExceptionsFilter.name,
      );
    }
    // 返回统一的响应格式
    response.status(status).json(Result.error(code, message));
  }
}

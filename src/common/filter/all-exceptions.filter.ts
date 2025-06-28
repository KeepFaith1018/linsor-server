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
import { Result } from '../utils/result';
import { AppException } from '../exception/appException';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger;

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let code = 500;
    let message = '服务出错了，稍后重试';
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
      const httpStatus = exception.getStatus() as HttpStatus;

      switch (httpStatus) {
        case HttpStatus.BAD_REQUEST:
          message = '请求参数不正确，请检查后再试';
          break;
        case HttpStatus.UNAUTHORIZED:
          message = '未登录或登录已失效，请重新登录';
          break;
        case HttpStatus.FORBIDDEN:
          message = '您没有权限执行此操作';
          break;
        case HttpStatus.NOT_FOUND:
          message = '资源不存在或已被删除';
          break;
        case HttpStatus.CONFLICT:
          message = '资源已存在，无法重复操作';
          break;
        case HttpStatus.PAYLOAD_TOO_LARGE:
          message = '请求体过大，已被服务器拒绝';
          break;
        case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
          message = '不支持的文件或数据类型';
          break;
        case HttpStatus.UNPROCESSABLE_ENTITY:
          message = '数据验证未通过，请检查提交信息';
          break;
        case HttpStatus.TOO_MANY_REQUESTS:
          message = '请求过于频繁，请稍后再试';
          break;
        case HttpStatus.INTERNAL_SERVER_ERROR:
          message = '服务器异常，请稍后再试';
          break;
        case HttpStatus.NOT_IMPLEMENTED:
          message = '接口暂未实现';
          break;
        case HttpStatus.SERVICE_UNAVAILABLE:
          message = '服务暂不可用，请稍后再试';
          break;
        case HttpStatus.GATEWAY_TIMEOUT:
          message = '网关超时，请重试';
          break;
        default:
          message = '服务异常，请稍后再试';
          break;
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

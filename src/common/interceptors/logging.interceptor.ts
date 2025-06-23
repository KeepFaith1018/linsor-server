import {
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Result } from 'src/common/utils/result';
import { Logger } from 'winston';

export class LoggingInterceptor implements NestInterceptor {
  @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest();

    const { method, originalUrl, body, query, params } = request;
    this.logger.info(`--- Request Start ---`, {
      context: LoggingInterceptor.name,
      url: `${method} ${originalUrl}`,
      query: Object.keys(query).length ? query : undefined,
      params: Object.keys(params).length ? params : undefined,
      body: Object.keys(body).length ? body : undefined,
    });

    return (
      next
        .handle()
        // 响应
        .pipe(
          map((data) => {
            // 用自定义Result.success包装返回结果
            return Result.success(data);
          }),
          tap((data) => {
            const duration = Date.now() - now;
            this.logger.info(`--- Request End ---`, {
              context: LoggingInterceptor.name,
              response: data,
              duration: `${duration}ms`,
            });
          }),
        )
    );
  }
}

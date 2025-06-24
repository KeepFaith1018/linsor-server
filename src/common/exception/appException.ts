import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorMessageMap } from '../utils/errorCodes';
import { Result } from '../utils/result';

export class AppException extends HttpException {
  constructor(code: any, message?: string) {
    if (code in ErrorCode) {
      message = ErrorMessageMap[code];
    }
    const result = Result.error(code, message || '网络错误，稍后重试');
    super(result, HttpStatus.OK);
  }
}

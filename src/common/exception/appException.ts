import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorMessageMap } from '../utils/errorCodes';
import { Result } from '../utils/result';

export class AppException extends HttpException {
  constructor(code: ErrorCode, message?: string) {
    const result = Result.error(code, message || ErrorMessageMap[code]);
    super(result, HttpStatus.OK);
  }
}

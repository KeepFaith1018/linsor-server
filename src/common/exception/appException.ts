import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorMessageMap } from '../utils/errorCodes';
import { Result } from '../utils/result';

export class AppException extends HttpException {
  constructor(code: ErrorCode) {
    const result = Result.error(code, ErrorMessageMap[code]);
    super(result, HttpStatus.OK);
  }
}

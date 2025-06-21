import { ErrorCode, ErrorMessageMap } from './errorCodes';

export class Result<T> {
  private code: number = 200;
  private msg: string = 'success';
  private data: T;
  constructor(code: number, msg: string, data: T) {
    this.code = code;
    this.msg = msg;
    this.data = data;
  }
  /**
   * 成功
   * @param data
   * @returns
   */
  public static success<T>(data: T) {
    return new Result<T>(200, 'success', data);
  }

  /**
   * 自定义错误返回
   * @param code
   * @param msg
   * @returns
   */
  public static error(code: number, msg: string) {
    return new Result<null>(code, msg, null);
  }

  /**
   * 统一错误返回
   * @param code
   * @returns
   */
  public static errorEnum(code: ErrorCode) {
    return Result.error(code, ErrorMessageMap[code]);
  }
}

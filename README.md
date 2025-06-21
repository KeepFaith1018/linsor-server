# Nest-template

nest项目开发模版，完成后端开发基础建设

## 自定义业务错误码及提示信息

这里为了和方便进行前端的错误提示等，进行自定义。
对于常用的 http错误码， 例如 未找到的资源（404），没有权限（403）等；
直接使用 http 错误码， 例如 404，403 等。 提取 message和statuscode 作为 code和message

对于业务错误码，统一返回 httpstatus 200
返回的信息遵循统一返回格式
{
code: 10001,
message: '未授权或登录失效',
}

## 自定义异常

参考代码：src/common/exception/appException.ts
自定义异常 AppException

## 统一返回格式

参考代码：src/common/utils/result.ts

{
code: 0,
message: '成功',
data: {},
}

## 统一异常处理

参考代码：src/common/exception/all-exceptions.filter.ts

捕获处理了

- 自定义异常
- nest内置的http异常
- js执行错误
- 其他
  统一返回

## 集成日志系统

集成nest-winston winston
通过配置项，日志输出到控制台和文件
参考代码： src/common/config/winston.config.ts

## 集成JWT

## pirsma

pnpm install prisma --save-dev
pnpm install @prisma/client
初始化
npx prisma init

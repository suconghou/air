export default `
用法:
    air [命令] [参数]
命令:
    serve           启动 http server
    compress        压缩 less 或 javascript 文件

参数:
    -v              查看版本
    -h              查看帮助
    -p              服务监听端口, 默认 8088
    -d              工作目录
    -q              less 渲染 urlArgs 参数
    -m              less 渲染 modifyVars 参数, 如: env=beta
    --proxy         /前缀=http(s)://目标 或 =本地目录, 可多次指定
    --debug         compress 调试模式(仅合并不压缩)
    --clean         compress 清理模式(移除 console/debugger)
    --dry           纯静态服务, 不编译 less/js
    --cors          响应携带 Access-Control-Allow-Origin
`;

export const version = '0.8.0';

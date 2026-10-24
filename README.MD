## air

静态站点服务器 + 前端构建工具,单文件 JS 分发,运行仅需系统装有 node。

```bash
air              # 启动服务器,默认端口 8088
air serve        # 同上
air serve --cors # 带 CORS 头启动
air -p 9000      # 指定端口
air -d site/     # 指定工作目录
air --dry        # 纯静态服务,不做 less/js 编译
air -v           # 版本
air -h           # 帮助
```

## 构建

```bash
yarn install
make build   # esbuild 打包为单文件可执行 air (2.8MB,内含 shebang)
make check   # tsc 类型检查
```

构建产物 `air` 自包含 less/terser/nodeserve,无需 node_modules。

## 能力

- **serve**: 静态文件服务(304/range/路径穿越防护),`.css`/`.js` 请求按 `static.json` 或连字符规则实时编译返回,`.html` 走 SSI
- **ssi**: `<!--# include file="inc/header.html" -->`,嵌套上限 6 层
- **compress**: 命令行压缩,less 输出 `.min.css`,js 经 terser 输出 `.min.js`
- **watch**: 配置文件 `static.json` 变更自动热更新

```bash
air compress style.less a.js b.js            # 相对当前目录
air compress --clean --debug                 # clean 移除 console/debugger
```

## 反向代理

`--proxy /前缀=目标`,可多次指定挂载不同前缀。目标有两种:

**http(s) 地址**——转发到远端,前端与接口同域:

```bash
air serve --proxy /api=http://localhost:3000 --proxy /wx=https://api.example.com
```

**本地目录**(相对工作目录或绝对路径)——按前缀映射本地文件,适合 mock 数据或挂载静态目录:

```bash
air serve --proxy /api=./mock
```

`/api/user.json` 将返回 `./mock/user.json`;目录请求返回其中 `index.html`。

- 匹配规则: 前缀整段匹配(`/api` 命中 `/api/users`,不命中 `/api2`)
- http 目标: 路径原样透传(与 vite/webpack 代理默认行为一致),POST body 流式转发,Host 改写为目标,支持 websocket upgrade 透传,上游不可达返回 502
- 本地目录: mime/304/range/路径穿越防护与静态服务一致,GET/POST 均返回文件

## static.json

查找规则: 从工作目录的 `static/` 起逐级向上找 `static.json`,也可手动放于 `static/` 下。

```json
{
  "lessOptions": { "urlArgs": "", "modifyVars": { "env": "beta" } },
  "static": {
    "css": { "css/all.css": ["css/a.less", "css/b.less"] },
    "js":  { "js/all.js":  ["js/x.js", "js/y.js"] }
  }
}
```

css/js 合并规则: 配置文件优先;其次连字符拆分(`a-b.css` → `a.less` + `b.less`);最后按单文件输出。

## 结构

```
src/index.ts            入口
src/libs/cli.ts         参数解析与命令分发
src/libs/command.ts     子命令 (compress)
src/libs/server.ts      路由与配置热更新
src/libs/compress.ts    less/js 编译 (less + less-plugin-autoprefix + terser)
src/libs/ssi.ts         SSI 解析
src/nodeserve           HTTP 框架 (软链至本机 nodeserve 仓库, github.com/suconghou/nodeserve)
```

## 版本说明

0.8.0 起移除 lint/gitlint/commitlint/install/template(art-template)能力,依赖仅剩 less/terser。

# serve static files in the air

静态站点服务器 + 前端构建工具。单文件分发，零依赖，安装后无需任何 node_modules。

- http server: `.less` 请求现场编译为 css（含 autoprefix），`.js` 请求实时合并压缩（terser），`.html` 走 SSI
- `air compress`: 命令行压缩 less / javascript
- `static.json` 配置文件变更自动热更新，编译结果带 mtime 缓存

# 安装

```bash
npm install airs -g
```

或 `yarn global add airs`，或免安装直接 `npx airs`。

# 使用

```bash
air                  # 启动 http server，默认端口 8088
air serve            # 同上
air serve --cors     # 带 CORS 头
air -p 9090          # 指定端口
air -d /tmp/         # 指定根目录
air --dry            # 纯静态服务，不做 less/js 编译
air -v / air -h      # 版本 / 帮助
```

```bash
air compress a.less b.js           # 输出 a.min.css / b.min.js
air compress a.less b.js --clean   # 清除 console / debugger
air compress --debug               # debug 模式（不压缩，仅合并）
air compress -d path/to/static     # 按 static.json 配置批量产出
```

# 静态资源规则

`.css` / `.js` 请求按以下优先级解析：

1. **配置文件** `static.json` 中的映射
2. **连字符** `a-b.css` 拆分为 `a.less` + `b.less`（若带连字符的完整文件确实存在则不拆分）
3. **静态文件** 直接输出

# static.json

查找规则：从工作目录的 `static/` 起逐级向上查找。

```json
{
	"lessOptions": {
		"math": "always",
		"urlArgs": "",
		"modifyVars": { "env": "beta" }
	},
	"static": {
		"js": {
			"js/all.js": ["js/jquery.js", "js/etpl.js"]
		},
		"css": {
			"css/style.css": ["css/page.less", "css/admin.less"]
		}
	}
}
```

- `lessOptions.math`：less 4.0 起除法必须加括号，设为 `always` 可还原 3.x 行为（详见 [less 4.0 release](https://github.com/less/less.js/releases/tag/v4.0.0)）
- `urlArgs` / `modifyVars` / `globalVars`：可被 query 参数（http 方式）与 `-q` / `-m`（命令行）及环境变量 `URLARGS` / `MODIFYVARS` / `GLOBALVARS` 覆盖，优先级：参数 > 环境变量 > 配置文件

SSI 语法：`<!--# include file="inc/header.html" -->`，嵌套上限 6 层。

# 反向代理

`--proxy /前缀=目标`，可多次指定挂载不同前缀。目标有两种：

**http(s) 地址**——转发到远端，前端与接口同域：

```bash
air serve --proxy /api=http://localhost:3000 --proxy /wx=https://api.example.com
```

**本地目录**（相对工作目录或绝对路径）——按前缀映射本地文件，适合 mock 数据或挂载静态目录：

```bash
air serve --proxy /api=./mock
```

`/api/user.json` 将返回 `./mock/user.json`；目录请求返回其中 `index.html`。

- 匹配规则：前缀整段匹配（`/api` 命中 `/api/users`，不命中 `/api2`）
- http 目标：路径原样透传（与 vite/webpack 代理默认行为一致），POST body 流式转发，Host 改写为目标，支持 websocket upgrade 透传，上游不可达返回 502
- 本地目录：mime/304/range/路径穿越防护与静态服务一致，GET/POST 均返回文件

# 0.8.0 破坏性变更

- **单文件自包含**：less / terser 已打包进可执行文件，不再依赖 node_modules，`dependencies` 清零
- **移除** `air lint` / `air gitlint` / `air commitlint` / `air install`（eslint / prettier 相关）
- **移除** `air template` 与服务端 `--art` 模式（art-template 相关），SSI 保留

# 源码构建

源码位于 [github.com/suconghou/air](https://github.com/suconghou/air)，构建需全局 esbuild：

```bash
yarn install
make build   # 产出单文件 air（约 3MB）
make check   # typescript 类型检查（tsc 7）
```

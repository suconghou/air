
# serve static files in the air

在线解析压缩合并Less,打包压缩Javascript.


# 安装
`npm install airs -g`

或

`yarn global add airs`

# 使用

直接执行`air`启动http server

`air -p 9090`  指定端口

`air -d /tmp/` 指定根目录

所有less文件改为css后缀访问直接现场解析

> 可以使用连字符将资源合并
>
> 连字符的优先级高于配置文件
>
> less文件解析和配置文件优先级高于静态文件



### 命令

### air serve

开启http server

与直接执行`air`一样



### air compress

压缩less,javascript

后面可以跟文件列表,将会处理less和js后缀文件

`air compress hello.less hi.less jquery.js etpl.js`

`--debug` 以debug模式压缩

`--clean` 更强的压缩模式,清除console,debugger等



### air install

安装git hooks

要使用格式化和lint,需要全局安装`prettier`,`eslint`

为启用对vue的支持还需要`eslint-plugin-html`

对`async`支持,还需要添加`babel-eslint`

```
yarn global add prettier eslint babel-eslint vue-eslint-parser eslint-plugin-vue

```

需 eslint > 5.0.0

要跳过eslint检查,使用

`git commit -n`

或者

`git commit --no-verify`



### air lint

手动对指定文件进行格式化和lint

例如:`air lint src/index.js`

> 该命令必须在项目根目录执行,会查找当前目录下的config配置
>
> 该命令与commit时执行的命令逻辑相同
>
> 可以使用通配符 air lint src/*.js



**忽略部分lint**

`// eslint-disable-line` 对当前行忽略

`// eslint-disable-next-line` 对下一行忽略

`/* eslint-disable */` 关闭eslint

`/* eslint-enable */`开启eslint








# 使用配置文件

`http server` 和  `air compress` 命令可以使用配置文件

使用配置文件需要有规则的目录结构

在根目录下建立static文件夹

在static目录内建立static.json文件,配置Less和Javascript映射

static.json

```
{
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
此时,在static目录下执行`air compress` 将会将上述js文件压缩为all.js

less文件解析合并压缩为style.css

`air compress`可在项目中的任意文件夹位置执行









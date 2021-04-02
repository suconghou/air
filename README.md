
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

类似于nginx的ssi(server side include)功能自动启用

> 可以使用连字符将资源合并
>
> 连字符的优先级高于配置文件
>
> 文件查找解析优先级高于配置文件
>
> less文件解析和配置文件优先级高于静态文件

对于js文件

> 同名静态文件的优先级高于配置文件.

对于js,css

优先级: 连字符>配置文件>静态文件



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



**break change**

https://github.com/less/less.js/releases/tag/v4.0.0

less 4.0 开始, math 默认值发生了改变, 除法必须使用括号了.

http://lesscss.org/usage/#less-options-math

可以使用配置文件 `lessOptions` 端, 还原到旧版行为

```json
{
	"lessOptions": {
		"math": "always"
	},
	"static": {
		"js": {
			"js/all.js": [
				"js/jquery.js",
				"js/etpl.js"
			]
		},
		"css": {
			"css/style.css": [
				"css/page.less",
				"css/admin.less"
			]
		}
	}
}
```

lessOptions 指定 math 为 `always`, 行为同3.0版本

lessOptions的配置项有

> math
> 
> urlArgs , 如果是启动http server方式,query上的参数`urlArgs`,可覆盖此配置文件值


### air install

安装git hooks, 会将指定目录的git钩子安装到当前仓库, 当前位置必须是仓库根目录

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

**参数**

> -dir somedir  可以指定配置文件的目录



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

**参数**

> -dir somedir 执行lint和格式化时可以指定配置文件所在目录
> 
> --lint 默认执行完毕后会使用`git add -u`再次添加此文件,此参数可以阻止该行为

### air template

使用`art-template`模板渲染

`air template index.html data.json -o output.html --debug`

加上`--debug`为不压缩

`-o`指定输出文件,如果不指定则直接输出到标准输出




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

注意

> 被压缩的js需要为es5语法
> 若要使用ssi,请不要使用中文命名html文件



### 使用服务端模板渲染



* 默认已支持nginx ssi 规则,且默认启用
* 支持另一种模板 `art-template`

如需使用`art-template`模板引擎,使用`air -p 8899 --art`启动

同时,可以使用配置文件对模板填充数据,配置文件声明在`template`段内

```json
{
	"static": {
		"js": {
			"js/all.js": ["js/jquery.js", "js/etpl.js"]
		},
		"css": {
			"css/style.min.css": ["css/page.less", "css/admin.less"]
		}
	},
	"template": {
		"index.html": "data/index.json"
	}
}

```

其中为`index.html`这个请求路径指定了模板数据,数据可使用三种格式

* 直接在配置文件里以对象的方式声明
* 在配置文件里指定使用一个json文件声明
* 在配置文件里指定使用一个js文件申明,js文件需为commonJs模块化



> 模板文件的修改会立即生效
>
> 配置文件的修改需重启
>
> 模板数据文件的修改需重启
>
> query 参数会自动传递给模板,如果有申明同名的模板数据则被覆盖


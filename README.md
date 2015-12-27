
# serve static files in the air

在线解析压缩合并Less,打包压缩Javascript.

手动压缩打包,执行Lint,静态服务器,缓存版本控制,完美结合CDN

# 安装
`npm install airs -g`

# 基本参数
* 纯静态项目,在项目根目录直接执行`air`

> 即可开启http服务,直接输出编译后的结果

* PHP项目,项目根目录执行`air develop`

> 会开启静态服务器,同时开启一个PHP Server

> PHP Server 端口号为静态服务器端口号+1

* 服务器模式 `air server`

> 编译将做优化和代码压缩

**指令**

> 使用`air lint ` 执行Jslint,而不开启http服务,文件修改实时触发

> 使用`air lint jsfile1.js jsfile2.js jsfile3.js` 可对指定文件进行Jslint,可对一个或多个文件

> 使用`air compress` 在static目录下执行,将会根据static.json文件描述,压缩合并输出到指定文件

> 使用`air compress lessfile1.less lessfile2.less` 将对less文件解析压缩,多个less文件将会压缩合并为一个css文件

> 使用`air compress jsfile1.js jsfile2.js` 将对js文件压缩,多个js文件将合并为一个js文件

> 可以参数中同时存在less文件和js文件,`air compress less1.less file1.js file2.less file3.js`
> 工具自动按类型分组,less文件和js文件,各自压缩合并,其他文件类型忽略.

**参数**

> 参数-w,使用Jslint,文件修改实时触发,本地开发建议加上

> 参数-g,每分钟定时拉取git更新,可用于测试服务器上

> 参数-k,设定webhook的密码,服务器模式建议加上

> 参数-p,指定服务监听的端口,PHP Server 端口号也会依此变化.

> 参数-v,打印出版本并退出

> 参数-d,以daemon模式运行

> 同时可添加参数 `--less=/data/pathto/lesslib` 指定lessLib路径,可接受相对路径和绝对路径


# 目录结构
目录结构采用类似 `项目名/static/css/style.less`

项目名可选,Javascript路径类似 `项目名/static/js/main.js`

Http访问 `/项目名/static/css/style.css` 即可得出style.less编译后的css.

注意:如果文件夹内确实存在此文件,则此文件则会如实输出

因此Http直接访问 `/项目名/static/js/main.js` 则会如实输出main.js文件	

工具支持`-连接符`配置,因此可以Http访问 `/项目名/static/js/main-page.js`	

则会按顺序合并main.js和page.js两个文件	

less文件同样可以按照此种模式,此外less文件还可以使用索引模式

使用less自身语法,style.less作为入口,import其他less文件

此外,如果文件过多,使用连字符麻烦,工具还支持配置文件模式

在static目录内建立static.json文件,配置Less和Javascript映射

static.json

```
{
	"static":
	{
		"js":
		{
			"all":["jquery.min.js","etpl.js","tpl.js","iscroll.js","chat.js","aside.js"]
		}
		"css":
		{
			"style":["page.less","less/admin.less"]
		}
	}
}
```
此时,在static目录下执行`air compress` 将会将上述js文件压缩为all.min.js

less文件解析合并压缩为style.min.css

在static目录下执行`air server`,http访问`/static/js/all.js` `/static/css/style.css` 同样得出上述压缩合并的结果


# Webhook
* `/webhook/gitpull` 执行 `git pull origin master` 立刻拉取代码更新.
* `/webhook/viewlog` 查看运行日志
* `/webhook/clear` 执行清理内存操作,立即清除所有日志和编译缓存

> 添加-k参数后,webhook需要密码才能查看.

> 在网址后面添加?key=密码即可


# 性能
所有的Less编译和压缩,Javascript合并与压缩均在第一次访问的时候执行

并且结果被缓存到内存,下次直接内存读取并输出,直到有文件发生修改才会再次执行编译.

编译缓存储存到一定数量将会执行GC,存储了2000个编译后的文件后,再次存储将会清除旧的缓存以释放内存

运行日志积累到一定数量也会清除旧的日志,以节省内存.

本地开发和线上服务都完全无需担心.

# 缓存
内存缓存保存最近一次编译的版本号.

资源版本号以类似`style.css?ver=v1`的形式.

修改版本号后,less内部所有引用资源如`background-image`等,都会立即更新引用地址,防止旧的缓存.

可以放心开启强缓存.

# 共享
根目录下`less`文件夹作为共享文件夹.

其他任何项目里的less文件都可以任意 `@import` 此文件夹下的文件,无需指明具体路径.

可放置mixins等.



# 示例

> 本地开发 `air develop -w`

> 服务器模式 `air server -k 123456 -d`


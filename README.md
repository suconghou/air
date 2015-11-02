
# serve static files in the air

# 安装
`npm install airs -g`

# 基本参数
1. 纯静态项目,在项目根目录直接执行`air`
2. PHP项目,项目根目录执行`air develop`
会开启静态服务器,同时开启一个PHP Server
3. 服务器模式 `air server`

参数-w,使用Jslint,文件修改实时触发,本地开发建议加上
参数-g,每分钟定时拉取git更新,可用于测试服务器上
参数-k,设定webhook的密码,服务器模式建议加上
# 目录结构
目录结构采用类似 `项目名/static/css/style.less`
项目名可选,Javascript路径类似 `项目名/static/js/main.js`
Http访问 `/项目名/static/css/style.css` 即可得出style.less编译后的css.	注意:如果文件夹内确实存在此文件,则此文件则会如实输出
因此Http直接访问 `/项目名/static/js/main.js` 则会如实输出main.js文件			工具支持-连接符配置,因此可以Http访问 `/项目名/static/js/main-page.js`	则会按顺序合并main.js和page.js两个文件	less文件同样可以按照此种模式,此外less文件还可以使用索引模式
使用less自身语法,style.less作为入口,import其他less文件
此外,如果文件过多,使用连字符麻烦,工具还支持配置文件模式
在static目录内建立static.json文件,配置Less和Javascript映射


# 性能
所有的Less编译和压缩,Javascript合并与压缩均在第一次访问的时候执行
并且结果被缓存到内存,下次直接内存读取并输出,直到有文件发生修改才会再次执行编译.
本地开发和线上服务都完全无需担心.
# 示例
本地开发 `air develop -w`
服务器模式 `air server -k 123456`

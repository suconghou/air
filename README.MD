## air server

start air server

```bash
air
```

开发 `ag --ts -l | entr make dev`

```
yarn add less less-plugin-autoprefix art-template terser 

prettier-eslint

core-js
eslint
eslint-plugin-vue
@typescript-eslint/parser
vue-eslint-parser

@types/node


```

优先级 .eslintrc.js >  .eslintrc > package.json

并且会向父级查找


air gitlint 必须接受文件地址

air lint 可接受文件地址,也可在根目录直接执行从git获取变更的文件


对vue的lint需要

可以在项目里安装,也可以全局安装

但是项目里安装,每个项目都要安装

全局安装由于yarn全局安装并不安装在NODE_PATH里,所有yarn的全局安装不带可执行文件的依赖其实没什么卵用

修改NODE_PATH可能导致已安装的npm无法使用

npm的安装会安装在NODE_PATH下

cnpm i -g eslint-plugin-vue eslint --no-bin-links 

即可在本地查找不到时,查找全局的

若要typescript的lint需要

cnpm i -g @typescript-eslint/parser typescript --no-bin-links 



### options

> -v show version
> -h show help message
> -p serve port , default: 8088
> --art use art template instand of ssi , default use ssi
> --watch watch config file change and reload, default : true

## air template

use art template build html files from template

### options

> --debug do not minify html files


## air compress 

compress and concat javascript and less files

### options

> --debug  compress but not ug
> --clean  remove console and debugger

## air install

install git hooks file

### options 

> --dir
> 

## air lint


### air gitlint





跳过

`git commit -n`

`git commit --no-verify`

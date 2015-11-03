var path=require('path');
var url=require('url');
var fs=require('fs');
var zlib=require('zlib');
var http=require('http');
var https=require('https');
var exec=require('child_process').exec;
var less=require('less');
var UglifyJS=require('uglify-js');
var express=require('express');
var compression=require('compression');
var LessPluginAutoPrefix=require('less-plugin-autoprefix');
var autoprefixPlugin=new LessPluginAutoPrefix();
var args=process.argv.splice(2);
var app=express();
var config=
{
	port:8088,
	debug:true,
	staticPath:process.cwd(),
	lessLibPath:path.join(process.cwd(),'less'),
	gitexec:'git pull origin master',
	error404:"<title>Error..</title><center><span style='font-size:300px;color:gray;font-family:黑体'>404...</span></center>"
};
app.set('port', process.env.PORT || config.port);
app.disable('x-powered-by');
app.use(compression());
app.use(express.static(config.staticPath,{maxAge:'1y'}));
var server=app.listen(app.get('port'),function()
{
	config.port=server.address().port;
	app.log('Server listening on port '+config.port);
	if(args.length>0)
	{
		switch(args[0])
		{
			case "server":
				config.debug=false;
			break;
			case "develop":
				service.phpserver();
			break;
			default:
			break;
		}
		service.init();
	}
});

app.use(/\/([\w\-]+\/)?static\/css\/[\w\-]+\.css/,function(req,res,next)
{
	return compile.less(req,res,next);
});
app.use(/\/([\w\-]+\/)?static\/js\/[\w\-]+\.js/,function(req,res,next)
{
	return compile.js(req,res,next);
});
app.use(/\/webhook\/\w+/,function(req,res,next)
{
	return service.webhook(req,res,next);
});
app.use(function(req,res,next)
{
	return res.status(404).send(config.error404);
});


var compile=
{

	less:function(req,res,next)
	{
		var pathInfo=req.baseUrl.replace('.css','').split('/css/');
		var staticPath=path.join(config.staticPath,pathInfo[0]);
		var configFile=path.join(staticPath,'static.json');
		var cfg={};
		var hotPath=[];
		var lessPathArray;
		if(fs.existsSync(configFile))
		{
			try
			{
				cfg=require(configFile);
				hotPath=Object.keys(cfg.static.css).unique();
			}
			catch(e)
			{
				app.log('Ignored invalid json file '+configFile);
			}
		}
		if(hotPath.indexOf(pathInfo[1])>-1)
		{
			lessPathArray=cfg.static.css[pathInfo[1]].unique().map(function(item){return path.join(staticPath,'css',item);});
		}
		else
		{
			lessPathArray=pathInfo[1].split('-').filter(function(item){return item;}).unique().map(function(item){return path.join(staticPath,'css',item+'.less');});
		}
		var filename=lessPathArray.join('-');
		var mtimes=[];
		for(var i=0;i<lessPathArray.length;i++)
		{
			var item=lessPathArray[i];
			if(!fs.existsSync(item))
			{
				var errMsg=item+' not found';
				app.log(errMsg);
				return res.status(404).send(config.error404);
			}
			var stat=fs.statSync(item);
			mtimes.push(stat.mtime.getTime());
		}
		var updateTime=Math.max.apply(this,mtimes);
		var lastParsed=app.getLast(filename);
		if(lastParsed.updateTime>=updateTime)
		{
			return res.type('css').send(lastParsed.content);
		}
		var lessInput=lessPathArray.map(function(item){return '@import "'+item+'";';}).join("\r\n");
		var option={plugins:[autoprefixPlugin],urlArgs:req.query.ver?'ver='+req.query.ver:null};
		if(!config.debug)
		{
			option.compress=true;
			option.yuicompress=true;
			option.optimization=1;
		}
		less.render(lessInput,option).then(function(output)
		{
			lastParsed={content:output.css,updateTime:updateTime};
			app.setLast(filename,lastParsed);
			return res.type('css').send(lastParsed.content);
		},function(error)
		{
			var errMsg=error.type+' Error : '+error.message+' in file '+error.filename+' on line '+error.line+':'+error.index+' '+error.extract.join('');
			app.log(errMsg);
			return res.status(500).send(errMsg);
		});

	},
	js:function(req,res,next)
	{
		var pathInfo=req.baseUrl.replace('.js','').split('/js/');
		var staticPath=path.join(config.staticPath,pathInfo[0]);
		var configFile=path.join(staticPath,'static.json');
		var cfg={};
		var hotPath=[];
		var jsPathArray;
		if(fs.existsSync(configFile))
		{
			try
			{
				cfg=require(configFile);
				hotPath=Object.keys(cfg.static.js).unique();
			}
			catch(e)
			{
				app.log('Ignored invalid json file '+configFile);
			}
		}
		if(hotPath.indexOf(pathInfo[1])>-1)
		{
			jsPathArray=cfg.static.js[pathInfo[1]].unique().map(function(item){return path.join(staticPath,'js',item);});
		}
		else
		{
			jsPathArray=pathInfo[1].split('-').filter(function(item){return item;}).unique().map(function(item){return path.join(staticPath,'js',item+'.js');});
		}
		var filename=jsPathArray.join('-');
		var mtimes=[];
		for(var i=0;i<jsPathArray.length;i++)
		{
			var item=jsPathArray[i];
			if(!fs.existsSync(item))
			{
				var errMsg=item+' not found';
				app.log(errMsg);
				return res.status(404).send(config.error404);
			}
			var stat=fs.statSync(item);
			mtimes.push(stat.mtime.getTime());
		}
		var updateTime=Math.max.apply(this,mtimes);
		var lastParsed=app.getLast(filename);
		if(lastParsed.updateTime>=updateTime)
		{
			return res.type('js').send(lastParsed.content);
		}
		var option={};
		if(!config.debug)
		{
			option.mangle=true;
			option.compress={sequences:true,dead_code:true,unused:true,booleans:true,join_vars:true};
		}
		try
		{
			result=UglifyJS.minify(jsPathArray,option).code;
			return res.type('js').send(result);
		}
		catch(e)
		{
			var errMsg=e.message+' in file '+e.filename+' on line '+e.line+':'+e.col;
			app.log(errMsg);
			return res.status(500).send(errMsg);
		}

	}
};

var service=
{
	delay:null,
	init:function()
	{
		if(args.indexOf('-g')>=0)
		{
			service.timer();
		}
		if(args.indexOf('-w')>=0)
		{
			jshint=require('jshint');
			watch=require('watch');
			tools.watch();
		}
		if(args.indexOf('-k')>=0)
		{
			config.key=args[args.indexOf('-k')+1];
		}
	},
	timer:function()
	{
		service.pulltimer=setInterval(function()
		{
			service.gitpull();
		},60000);
		app.log('service timer start');
	},
	gitpull:function(req,res,next)
	{
		if(!service.delay)
		{
			exec(config.gitexec,function(error,stdout,stderr)
			{
				if(error)
				{
					app.log(error.toString());
				}
				else
				{
					app.log(stderr+stdout);
				}
			});
			service.delay=setTimeout(function(){ service.delay=null;},5000);
			return res&&res.send('starting git pull');
		}
		else
		{
			return res&&res.send('git pulled just now');
		}
	},
	phpserver:function()
	{
		var server=exec("php -S 0.0.0.0:"+(config.port+1),function(error)
		{
			if(error)
			{
				app.log('php server start failed');
			}
		});
		server.on('exit',function(code)
		{
			app.log('php server is stoped ');
		});
	},
	webhook:function(req,res,next)
	{
		var hook=req.baseUrl.split('/')[2];
		if(typeof service.hooks[hook] == 'function' && req.query.key==config.key)
		{
			return service.hooks[hook](req,res,next);
		}
		return res.status(404).send(config.error404);
	},
	hooks:
	{
		gitpull:function(req,res,next)
		{
			return service.gitpull(req,res,next);
		},
		viewlog:function(req,res,next)
		{
			return res.send(app.getLog());
		}

	}

};



var tools=
{
	watch:function()
	{
		var options={ignoreDotFiles:true,ignoreUnreadableDir:true,ignoreNotPermitted:true};
		options.filter=function(f,stats)
		{
			if(stats.isDirectory())
			{
				return true;
			}
			else if(stats.isFile())
			{
				return f.substr(-3)=='.js';
			}
			return false;
		};
		watch.watchTree(config.staticPath,options,function(f,curr,prev)
		{
			if(typeof f == "object" && prev === null && curr === null)
			{
				app.log('watcher start');
			}
			else if(prev === null)
			{
				//added
				tools.hint(f);
			}
			else if(curr.nlink === 0)
			{
				//removed
			}
			else
			{
				//changed
				tools.hint(f);
			}
		});
			

	},
	hint:function(filePath)
	{
		if(filePath.substr(-3)=='.js')
		{
			fs.readFile(filePath,'utf-8',function(err,data)
			{
				if(data)
				{
					jshint.JSHINT(data);
					var error=jshint.JSHINT.errors;
					if(error.length>0)
					{
						var errMsg=[];
						for(var i=0;i<error.length;i++)
						{
							var item=error[i];
							if(item)
							{
								var str=item.reason+" on line "+item.line+':'+item.character+"\r\n"+item.evidence;
								errMsg.push(str);
							}
						}
						console.log("\r\n"+filePath+":\r\n"+errMsg.join("\r\n"));
					}
					else
					{
						console.log("\r\n"+filePath+":\r\nLint Ok");
					}
				}
			});
		}
	}
};


(function(){
	Date.prototype.Format=function(fmt)
	{
		var o=
		{
			"M+": this.getMonth() + 1, //月份 
			"d+": this.getDate(), //日 
			"h+": this.getHours(), //小时 
			"m+": this.getMinutes(), //分 
			"s+": this.getSeconds(), //秒 
			"q+": Math.floor((this.getMonth() + 3) / 3), //季度 
			"S": this.getMilliseconds() //毫秒 
		};
		if(/(y+)/.test(fmt))
		{
			fmt=fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
		}
		for(var k in o)
		{
			if(new RegExp("(" + k + ")").test(fmt))
			{
				fmt=fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
			}
		}
		return fmt;
	};
	Array.prototype.unique=function()
	{
		var n={},r=[];
		for(var i=0;i<this.length;i++)
		{
			if(!n[this[i]])
			{
				n[this[i]]=true;
				r.push(this[i]);
			}
		}
		return r;
	};
	app.errorlog=[];
	app.log=function(msg)
	{
		if(app.errorlog.length>1000)
		{
			app.errorlog=[];
		}
		msg=new Date().Format('yyyy-MM-dd hh:mm:ss')+"\r\n"+msg;
		app.errorlog.push(msg);
		console.log(msg);
	};
	app.getLog=function(split)
	{
		return (app.errorlog.join("\r\n"));
	};
	app.lastList=[];
	app.getLast=function(key)
	{
		var list=app.lastList[key];
		if(!list)
		{
			list={content:'',updateTime:0};
		}
		return list;
	};
	app.setLast=function(key,content)
	{
		app.lastList[key]=content;
		return app.lastList;
	};
})();


/**	
命名空间
编译缓存(内存缓存)
项目名称+资源类型+资源路径+后缀
优先级 :配置文件>文件
/static/css/style.css
自动拉取,钩子拉取



*/
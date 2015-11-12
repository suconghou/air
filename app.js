var path=require('path');
var fs=require('fs');
var exec=require('child_process').exec;
var less=require('less');
var UglifyJS=require('uglify-js');
var express=require('express');
var compression=require('compression');
var jshint=require('jshint');
var watch=require('watch');
var LessPluginAutoPrefix=require('less-plugin-autoprefix');
var autoprefixPlugin=new LessPluginAutoPrefix();
var args=process.argv.splice(2);
var app=express();
var config=
{
	debug:true,
	port:args.indexOf('-p')>=0?(parseInt(args[args.indexOf('-p')+1])?parseInt(args[args.indexOf('-p')+1]):8088):8088,
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
		var ver=req.query.ver?req.query.ver.substr(0,32):null;
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
				app.log(item+' not found');
				return res.status(404).send(config.error404);
			}
			var stat=fs.statSync(item);
			mtimes.push(stat.mtime.getTime());
		}
		var updateTime=Math.max.apply(this,mtimes);
		var lastParsed=app.getLast(filename);
		if((lastParsed.updateTime>=updateTime)&&(lastParsed.ver==ver))
		{
			return res.type('css').send(lastParsed.content);
		}
		var lessInput=lessPathArray.map(function(item){return '@import "'+item+'";';}).join("\r\n");
		var option={plugins:[autoprefixPlugin],paths:config.lessLibPath,urlArgs:ver?'ver='+ver:ver};
		if(!config.debug)
		{
			option.compress=true;
			option.yuicompress=true;
			option.optimization=1;
		}
		less.render(lessInput,option).then(function(output)
		{
			res.type('css').send(output.css);
			lastParsed={content:output.css,updateTime:updateTime,ver:ver};
			return app.setLast(filename,lastParsed);
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
		var ver=req.query.ver?req.query.ver.substr(0,32):null;
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
				app.log(item+' not found');
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
		if(config.debug)
		{
			var content=[];
			for(i=0;i<jsPathArray.length;i++)
			{
				content.push(fs.readFileSync(jsPathArray[i],'utf-8'));
			}
			content=content.join('\r\n');
			res.type('js').send(content);
			lastParsed={content:content,updateTime:updateTime,ver:ver};
			return app.setLast(filename,lastParsed);
		}
		else
		{
			try
			{
				var option={mangle:true,compress:{sequences:true,dead_code:true,unused:true,booleans:true,join_vars:true}};
				var result=UglifyJS.minify(jsPathArray,option).code;
				res.type('js').send(result);
				lastParsed={content:result,updateTime:updateTime,ver:ver};
				return app.setLast(filename,lastParsed);
			}
			catch(e)
			{
				var errMsg=e.message+' in file '+e.filename+' on line '+e.line+':'+e.col;
				app.log(errMsg);
				return res.status(500).send(errMsg);
			}
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
			service.delay=setTimeout(function(){ service.delay=null;},15000);
			return res&&res.type('json').send(JSON.stringify({code:0,msg:'starting git pull'}));
		}
		else
		{
			return res&&res.type('json').send(JSON.stringify({code:0,msg:'git pulled just now'}));
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
		},
		clear:function(req,res,next)
		{
			return res.send(tools.gc(true,true));
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
				if(!err)
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
								var str=item.reason+' on line '+item.line+':'+item.character+"\r\n"+item.evidence;
								errMsg.push(str);
							}
						}
						console.log('\r\n'+filePath+':\r\n'+errMsg.join('\r\n'));
					}
					else
					{
						console.log('\r\n'+filePath+':\r\nLint Ok');
					}
				}
			});
		}
	},
	gc:function(clearLog,clearCache)
	{
		var msg;
		if(clearLog)
		{
			msg=app.errorlog.length+' log items was cleared';
			app.errorlog=[];
			app.log(msg);
		}
		if(clearCache)
		{
			msg=app.lastList.length+' cache items was cleared';
			app.lastList=[];
			app.log(msg);
		}
		return JSON.stringify({log:clearLog,cache:clearCache});
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
			tools.gc(true,false);
		}
		msg=new Date().Format('yyyy-MM-dd hh:mm:ss')+'\r\n'+msg;
		app.errorlog.push(msg);
		console.log(msg);
	};
	app.getLog=function(split)
	{
		return app.errorlog.join(split?split:'\r\n');
	};
	app.lastList=[];
	app.getLast=function(key)
	{
		var list=app.lastList[key];
		if(!list)
		{
			list={content:'',updateTime:0,ver:null};
		}
		return list;
	};
	app.setLast=function(key,content)
	{
		if(app.lastList.length>2000)
		{
			tools.gc(false,true);
		}
		app.lastList[key]=content;
		return app.lastList;
	};
})();



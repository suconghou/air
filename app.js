var path=require('path');
var fs=require('fs');
var child_process=require('child_process');
var less=require('less');
var UglifyJS=require('uglify-js');
var tinify=require("tinify");
var express=require('express');
var compression=require('compression');
var jshint=require('jshint');
var watch=require('watch');
var LessPluginAutoPrefix=require('less-plugin-autoprefix');
var autoprefixPlugin=new LessPluginAutoPrefix();
var processArgv=[].concat(process.argv);
var args=processArgv.splice(2);
var app=express();
var config=
{
	debug:true,
	version:'0.3.0',
	port:args.indexOf('-p')>=0?(parseInt(args[args.indexOf('-p')+1])?parseInt(args[args.indexOf('-p')+1]):8088):8088,
	staticPath:process.cwd(),
	lessLibPath:path.join(process.cwd(),'less'),
	gitexec:'git pull origin master',
	k:'uyX0XAGKE89TIXTxPv81WqFgj4if6AUa',
	error404:"<title>Error..</title><center><span style='font-size:300px;color:gray;font-family:黑体'>404...</span></center>"
};
app.disable('x-powered-by');
app.set('port', process.env.PORT||config.port);
app.use(function(req,res,next)
{
	res.header('Access-Control-Allow-Origin','*');
	res.header('Access-Control-Allow-Headers','X-Requested-With');
	next();
});
app.use(compression());
app.use(express.static(config.staticPath,{maxAge:'1y'}));
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
		var ver=req.query.ver?req.query.ver.substr(0,9):null;
		var cfg={};
		var hotPath=[];
		var lessPathArray;
		if(fs.existsSync(configFile))
		{
			try
			{
				cfg=require(configFile);
				if(cfg.static&&cfg.static.css)
				{
					hotPath=Object.keys(cfg.static.css).unique();
				}
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
				if(cfg.static&&cfg.static.js)
				{
					hotPath=Object.keys(cfg.static.js).unique();
				}
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
		var option;
		if(config.debug)
		{
			option={mangle:false,compress:{sequences:false,properties:false,dead_code:false,unused:false,booleans:false,join_vars:false,if_return:false,conditionals:false,hoist_funs:false,drop_debugger:false,evaluate:false,loops:false}};
		}
		else
		{
			option={mangle:true,compress:{sequences:true,properties:true,dead_code:true,unused:true,booleans:true,join_vars:true,if_return:true,conditionals:true}};
			if(config.optimization)
			{
				option.compress.drop_console=true;
				option.compress.drop_debugger=true;
				option.compress.evaluate=true;
				option.compress.loops=true;
			}
		}
		try
		{
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
			child_process.exec(config.gitexec,function(error,stdout,stderr)
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
		var time=(new Date()).getTime();
		var server=child_process.exec("php -S 0.0.0.0:"+(config.port+1),function(error)
		{
			if(error)
			{
				var msg=((new Date()).getTime()-time)>800?'php server is stoped':'php server start failed';
				return app.log(msg);
			}
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
				app.log('lint watcher start');
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
				else
				{
					console.log(err.toString());
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
	},
	compress:function(args)
	{
		var cwd=config.staticPath;
		if(args.length<=1)
		{
			var configFile=path.join(cwd,'static.json');
			var hotPathJs=[],hotPathLess=[];
			if(fs.existsSync(configFile))
			{
				try
				{
					var cfg=require(configFile);
					if(cfg.static)
					{
						if(cfg.static.js)
						{
							hotPathJs=Object.keys(cfg.static.js).unique();
						}
						if(cfg.static.css)
						{
							hotPathLess=Object.keys(cfg.static.css).unique();
						}
					}
					var hotjsLen=hotPathJs.length;
					var hotlessLen=hotPathLess.length;
					var getRealPathJs=function(item)
					{
						return item.substr(0,1)==path.sep?item:path.join(cwd,'js',item);
					};
					var getRealPathLess=function(item)
					{
						return item.substr(0,1)==path.sep?item:path.join(cwd,'css',item);
					};
					for(var m=0;m<hotjsLen;m++)
					{
						var itemName=hotPathJs[m];
						var itemPath=path.join(cwd,'js',itemName)+'.min.js';
						var itemList=cfg.static.js[itemName].unique().map(getRealPathJs);
						this.compressJs(itemList,itemPath);
					}
					for(var n=0;n<hotlessLen;n++)
					{
						var nitemName=hotPathLess[n];
						var nitemPath=path.join(cwd,'css',nitemName)+'.min.css';
						var nitemList=cfg.static.css[nitemName].unique().map(getRealPathLess);
						this.compressLess(nitemList,nitemPath);
					}
					var env=process.env;
					if(config.watch && !env.watched)
					{
						env.watched=true;
						var options={ignoreDotFiles:true,ignoreUnreadableDir:true,ignoreNotPermitted:true};
						options.filter=function(f,stats)
						{
							if(stats.isDirectory())
							{
								return true;
							}
							else if(stats.isFile())
							{
								return ['js','less','json'].indexOf(f.split('.').pop())>=0;
							}
							return false;
						};
						watch.watchTree(config.staticPath,options,function(f,curr,prev)
						{
							if(!(typeof f == "object" && prev === null && curr === null))
							{
								var filepart=f.split('.');
								if((['js','css'].indexOf(filepart.pop())>=0)&&(filepart.pop()=='min'))
								{
									return false;
								}
								var childArgv=[].concat(process.argv);
								childArgv=childArgv.filter(function(item){return (item!='--watch')&&item;});
								var opt=
								{
									stdio:'inherit',
									env:env,
									cwd:process.cwd
								};
								return child_process.spawn(process.execPath,childArgv.splice(1),opt);
							}
						});
					}
				}
				catch(e)
				{
					return console.log(e.toString());
				}
			}
			else
			{
				return console.log('static.json not found');
			}
		}
		else
		{
			var jsfiles=args.unique().filter(function(item){return item.substr(-3)=='.js';}).map(function(item){return item.substr(0,1)==path.sep?item:path.join(cwd,item);});
			var lessfiles=args.unique().filter(function(item){return item.substr(-5)=='.less';}).map(function(item){return item.substr(0,1)==path.sep?item:path.join(cwd,item);});
			var imgfiles=args.unique().filter(function(item){return /^[\w\-]+\.(png|jpg|jpeg)$/i.test(item);}).map(function(item){return item.substr(0,1)==path.sep?item:path.join(cwd,item);});
			var jsLen=jsfiles.length;
			var lessLen=lessfiles.length;
			var imgLen=imgfiles.length;
			if(jsLen>0)
			{
				this.compressJs(jsfiles);
			}
			if(lessLen>0)
			{
				this.compressLess(lessfiles);
			}
			if(imgLen>0)
			{
				this.compressImages(imgfiles);
			}
		}
	},
	compressJs:function(jsfiles,savename)
	{
		var jsLen=jsfiles.length;
		var jsList=['compress js file:'];
		for(var j=0;j<jsLen;j++)
		{
			var jfile=jsfiles[j];
			if(!fs.existsSync(jfile))
			{
				return console.log(jfile+' not found');
			}
			jsList.push(jfile);
		}
		try
		{
			var joption;
			if(config.debug=='debug')
			{
				joption={mangle:false,compress:{sequences:false,properties:false,dead_code:false,unused:false,booleans:false,join_vars:false,if_return:false,conditionals:false,hoist_funs:false,drop_debugger:false,evaluate:false,loops:false}};
			}
			else
			{
				joption={mangle:true,compress:{sequences:true,properties:true,dead_code:true,unused:true,booleans:true,join_vars:true,if_return:true,conditionals:true}};
				if(config.optimization)
				{
					joption.compress.drop_console=true;
					joption.compress.drop_debugger=true;
					joption.compress.evaluate=true;
					joption.compress.loops=true;
				}
			}
			var result=UglifyJS.minify(jsfiles,joption).code;
			if(!savename)
			{
				savename=path.join(config.staticPath,jsfiles.map(function(item){return path.basename(item.replace('.js',''));}).join('-'))+'.min.js';
			}
			fs.writeFile(savename,result,function(err)
			{
				if(err)
				{
					console.log(err.toString());
				}
				else
				{
					console.log(jsList.join('\r\n')+'\r\nsave as:'+savename);
				}
			});
		}
		catch(e)
		{
			console.log(e.toString());
		}
	},
	compressLess:function(lessfiles,savename)
	{
		var lessLen=lessfiles.length;
		var lessList=['compress less file:'];
		for(var i=0;i<lessLen;i++)
		{
			var file=lessfiles[i];
			if(!fs.existsSync(file))
			{
				return console.log(file+' not found');
			}
			lessList.push(file);
		}
		var lessInput=lessfiles.map(function(item){return '@import "'+item+'";';}).join("\r\n");
		var option={plugins:[autoprefixPlugin],paths:config.lessLibPath,urlArgs:config.ver?'ver='+config.ver:null};
		if(config.debug!='debug')
		{
			option.compress=true;
			option.yuicompress=true;
			option.optimization=1;
		}
		less.render(lessInput,option).then(function(output)
		{
			if(!savename)
			{
				savename=path.join(config.staticPath,lessfiles.map(function(item){return path.basename(item.replace('.less',''));}).join('-'))+'.min.css';
			}
			fs.writeFile(savename,output.css,function(err)
			{
				if(err)
				{
					console.log(err.toString());
				}
				else
				{
					console.log(lessList.join('\r\n')+'\r\nsave as:'+savename);
				}
			});
		},function(error)
		{
			console.log(error.toString());
		});
	},
	compressImages:function(imgfiles)
	{
		var imgLen=imgfiles.length;
		tinify.key=config.k;
		var compressImg=function(file)
		{
			fs.exists(file,function(exists)
			{
				if(exists)
				{
					var minPath=file.replace('.png','.min.png').replace('.jpg','.min.jpg').replace('.jpeg','.min.jpeg');
					fs.exists(minPath,function(minExists)
					{
						if(minExists)
						{
							console.log(minPath+' already exists');
						}
						else
						{
							var source=tinify.fromFile(file);
							source.toFile(minPath,function(err)
							{
								if(err instanceof tinify.AccountError)
								{
									console.log('AccountError:'+err.message+' -- '+file);
								}
								else if(err instanceof tinify.ClientError)
								{
									console.log('ClientError:'+err.message+' -- '+file);
								}
								else if(err instanceof tinify.ServerError)
								{
									console.log('ServerError:'+err.message+' -- '+file);
								}
								else if(err instanceof tinify.ConnectionError)
								{
									console.log('ConnectionError:'+err.message+' -- '+file);
								}
								else if(err)
								{
									console.log(err.toString()+' -- '+file);
								}
								else
								{
									console.log('compressed:'+file);
								}
							});
						}
					});
				}
				else
				{
					console.log(file+' not found');
				}
			});
		};
		for(var i=0;i<imgLen;i++)
		{
			var file=imgfiles[i];
			compressImg(file);
		}
	},
	lint:function(args)
	{
		var cwd=config.staticPath;
		if(args.length<=1)
		{
			return this.watch();
		}
		var files=args.unique().filter(function(item){return item.substr(-3)=='.js';}).map(function(item){return item.substr(0,1)=='/'?item:path.join(cwd,item);});
		var len=files.length;
		if(len>0)
		{
			for(var i=0;i<len;i++)
			{
				this.hint(files[i]);
			}
		}
		else
		{
			return console.log('no js file input');
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



if(args.indexOf('-v')>=0)
{
	return console.log('air version: air/'+config.version);
}
args.forEach(function(item,index)
{
	var les=item.split('--less=');
	var vers=item.split('--ver=');
	var keys=item.split('--key=');
	if(les.length==2)
	{
		delete args[index];
		config.lessLibPath=les[1].substr(0,1)==path.sep?les[1]:path.join(config.staticPath,les[1]);
		app.log('set less lib path: '+config.lessLibPath);
	}
	else if(vers.length==2)
	{
		delete args[index];
		config.ver=vers[1].substr(0,9);
		app.log('set less urlArgs '+config.ver);
	}
	else if(keys.length==2)
	{
		delete args[index];
		config.k=keys[1];
		app.log('set tinify key '+keys[1]);
	}
	else if(item=='--debug')
	{
		delete args[index];
		config.debug='debug';
	}
	else if(item=='--watch')
	{
		delete args[index];
		config.watch=true;
	}
	else if(item=='--o')
	{
		delete args[index];
		config.optimization=true;
	}

});
args=args.filter(function(item){return item;});
if(args[0]=='compress')
{
	return tools.compress(args);
}
if(args[0]=='lint')
{
	return tools.lint(args);
}
if(args.indexOf('-d')>=0)
{
	var env=process.env;
	if(!env.daemon)
	{
		env.daemon=true;
		var opt=
		{
			stdio:'ignore',
			env:env,
			cwd:process.cwd,
			detached:true
		};
		var child=child_process.spawn(process.execPath,process.argv.splice(1),opt);
		return child.unref();
	}
}

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



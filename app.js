var app=
{
	serve:function(cfg)
	{
		var express=require('express');
		var instance=new express();
		instance.disable('x-powered-by');
		instance.use(require('compression')());
		instance.set('port',process.env.PORT||cfg.port);
		instance.use(express.static(cfg.staticPath,{maxAge:cfg.debug?'5s':'1h',setHeaders:function(res,path,stat)
		{
			res.header('Access-Control-Allow-Origin','*');
			res.header('Access-Control-Allow-Credentials','true');
			res.header('Access-Control-Allow-Headers','Origin, X-Requested-With, Content-Type, Accept');
		}}));
		instance.use(function(req,res,next)
		{
			var refer=req.headers.referer;
			if(refer)
			{
				var params=require('url').parse(refer);
				refer=params.protocol+'//'+params.host;
			}
			res.header('Access-Control-Allow-Origin',refer?refer:'*');
			res.header('Access-Control-Allow-Credentials','true');
			res.header('Access-Control-Allow-Headers','Origin, X-Requested-With, Content-Type, Accept');
			next();
		});
		var server=instance.listen(instance.get('port'),function()
		{
			cfg.port=server.address().port;
			m.log('Server listening on port '+cfg.port);
		});
		instance.use('((/:project?/static/)css/):file.css',function(req,res,next)
		{
			req.params.ext='css';
			compress.getRequestFiles(cfg,req,function(files)
			{
				compress.compressLess(files,cfg,function(content)
				{
					res.type(req.params.ext).send(content.content);
				},function(code,errorMsg)
				{
					res.type('txt').status(code).send(errorMsg);
				});
			});
		});
		instance.use('((/:project?/static/)js/):file.js',function(req,res,next)
		{
			var ver=req.query.ver?req.query.ver.substr(0,9):null;
			req.params.ext='js';
			compress.getRequestFiles(cfg,req,function(files)
			{
				compress.compressJs(files,cfg,function(content)
				{
					res.type(req.params.ext).send(content.content);
				},function(code,errorMsg)
				{
					res.type('txt').status(code).send(errorMsg);
				});
			});
		});
		instance.use('/webhook/:action',function(req,res,next)
		{
			var hook=service.hook;
			if(hook[req.params.action]&&req.query.key==cfg.pass)
			{
				return hook[req.params.action](req,res,next,cfg);
			}
			return next();
		});
		instance.get('/reload',function(req,res,next)
		{
			var reload='var a=new XMLHttpRequest;a.open("POST","/reload",1),a.onreadystatechange=function(){4==a.readyState&&location.reload()},a.send();';
			res.type('js').send(reload);
		});
		instance.post('/reload',function(req,res,next)
		{
			if(cfg.watchLint)
			{
				cfg.waitChange.on('fresh',function(file)
				{
					return res.finished||res.send(file);
				});
			}
		});
		instance.use(function(req,res,next)
		{
			return res.status(404).send(cfg.error404);
		});
		delete require.cache[require.resolve('express')];
		delete require.cache[require.resolve('compression')];
		return instance;
	},
	compress:function(args,cfg)
	{
		var watchCompress=function(cfg)
		{
			var env=process.env;
			if(cfg.watch&&!env.watched)
			{
				var child_process=require('child_process');
				env.watched=true;
				tools.watch(cfg);
				cfg.waitChange.on('compress',function(file)
				{
					var childArgv=[].concat(process.argv);
					childArgv=childArgv.filter(function(item){return (item!='--watch')&&item;});
					var opt=
					{
						stdio:'inherit',
						env:env,
						cwd:process.cwd
					};
					return child_process.spawn(process.execPath,childArgv.splice(1),opt);
				});
			}
		};
		if(args.length<=1)
		{
			compress.compressByConfig(cfg,function(files,savename)
			{
				m.log(files.join('\r\n')+'\r\nsave as:'+savename);
			},function(code,errorMsg)
			{
				m.log('Error '+code+' : '+errorMsg);
			});
			return watchCompress(cfg);
		}
		else
		{
			var jsfiles=args.unique().filter(function(item){return item&&item.substr(-3)=='.js';}).map(function(item){return path.resolve(cfg.staticPath,item);});
			var lessfiles=args.unique().filter(function(item){return item&&item.substr(-5)=='.less';}).map(function(item){return path.resolve(cfg.staticPath,item);});
			var imgfiles=args.unique().filter(function(item){return /^.+\.(png|jpg|jpeg)$/i.test(item);}).map(function(item){return path.resolve(cfg.staticPath,item);});
			if(jsfiles.length>0)
			{
				compress.compressJs(jsfiles,cfg,function(content)
				{
					var savename=path.join(cfg.staticPath,jsfiles.map(function(item){return path.basename(item,'.js');}).join('-'))+'.min.js';
					fs.writeFile(savename,content.content,function(err)
					{
						if(err)
						{
							m.log(err.toString());
						}
						else
						{
							m.log('compress js files:\r\n'+jsfiles.join('\r\n')+'\r\nsave as:'+savename);
						}
					});

				},function(code,errorMsg)
				{
					m.log('Error '+code+' : '+errorMsg);
				});
			}
			if(lessfiles.length>0)
			{
				compress.compressLess(lessfiles,cfg,function(content)
				{
					var savename=path.join(cfg.staticPath,lessfiles.map(function(item){return path.basename(item,'.less');}).join('-'))+'.min.css';
					fs.writeFile(savename,content.content,function(err)
					{
						if(err)
						{
							m.log(err.toString());
						}
						else
						{
							m.log('compress less files:\r\n'+lessfiles.join('\r\n')+'\r\nsave as:'+savename);
						}
					});
				},function(code,errorMsg)
				{
					m.log('Error '+code+' : '+errorMsg);
				});
			}
			if(imgfiles.length>0)
			{
				compress.compressImages(imgfiles,cfg,function(file,minPath)
				{
					m.log('compress img files:\r\n'+file+'\r\nsave as:'+minPath);
				},function(code,errorMsg)
				{
					m.log('Error '+code+' : '+errorMsg);
				});
			}
			return watchCompress(cfg);
		}
	},
	lint:function(args,cfg)
	{
		if(args.length<=1)
		{
			tools.watch(cfg);
		}
		else
		{
			var jsfiles=args.unique().filter(function(item){return item&&item.substr(-3)=='.js';}).map(function(item){return path.resolve(cfg.staticPath,item);});
			jsfiles.forEach(function(v,k)
			{
				tools.lint(v);
			});
		}
	},
	runServer:function(cfg)
	{
		this.serve(cfg);
		var time=(new Date()).getTime();
		var child_process=require('child_process');
		var port=parseInt(cfg.port)+1;
		var server=child_process.exec("php -S 0.0.0.0:"+port,function(error)
		{
			if(error)
			{
				var msg=((new Date()).getTime()-time)>800?'php server is stoped':'php server start failed';
				return m.log(msg);
			}
		});
		return m.log('PHP Server listening on port '+port);
	},
	runDaemon:function(cfg)
	{
		m.log('Server listening on port '+cfg.port);
		var env=process.env;
		var child_process=require('child_process');
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
};

var compress=
{
	compressLess:function(lessfiles,cfg,successCallback,errorCallback)
	{
		this.getMaxUpdateTime(lessfiles,errorCallback,function(updateTime,key)
		{
			var content=m.getLast(key);
			if(content.updateTime>=updateTime && content.ver==cfg.ver)
			{
				return successCallback(content);
			}
			else
			{
				var autoprefix=require('less-plugin-autoprefix');
				var includePath=path.isAbsolute(cfg.lessLibPath)?cfg.lessLibPath:[path.join(cfg.staticPath,cfg.lessLibPath),path.join(path.dirname(cfg.staticPath),cfg.lessLibPath),path.join(path.dirname(path.dirname(cfg.staticPath)),cfg.lessLibPath),path.join(path.dirname(path.dirname(path.dirname(cfg.staticPath))),cfg.lessLibPath)];
				var lessInput=lessfiles.map(function(item){return '@import "'+item+'";';}).join("\r\n");
				var option={plugins:[new autoprefix()],paths:includePath,urlArgs:cfg.ver?'ver='+cfg.ver:null};
				if(!cfg.compressDebug)
				{
					option.compress=true;
					option.yuicompress=true;
					option.optimization=1;
				}
				require('less').render(lessInput,option).then(function(output)
				{
					content={content:output.css,updateTime:updateTime,ver:cfg.ver};
					successCallback(content);
					return m.setLast(key,content);
				},function(error)
				{
					var errMsg=error.type+' Error : '+error.message+' in file '+error.filename+' on line '+error.line+':'+error.index+' '+error.extract.join('');
					return errorCallback(500,errMsg);
				});
				delete require.cache[require.resolve('less-plugin-autoprefix')];
				delete require.cache[require.resolve('less')];
			}
		});
	},
	compressJs:function(jsfiles,cfg,successCallback,errorCallback)
	{
		this.getMaxUpdateTime(jsfiles,errorCallback,function(updateTime,key)
		{
			var content=m.getLast(key);
			if(content.updateTime>=updateTime && content.ver==cfg.ver)
			{
				return successCallback(content);
			}
			else
			{
				var option;
				if(cfg.compressDebug)
				{
					option={mangle:false,compress:{sequences:false,properties:false,dead_code:false,unused:false,booleans:false,join_vars:false,if_return:false,conditionals:false,hoist_funs:false,drop_debugger:false,evaluate:false,loops:false}};
				}
				else
				{
					option={mangle:true,compress:{sequences:true,properties:true,dead_code:true,unused:true,booleans:true,join_vars:true,if_return:true,conditionals:true}};
					if(cfg.optimization)
					{
						option.compress.drop_console=true;
						option.compress.drop_debugger=true;
						option.compress.evaluate=true;
						option.compress.loops=true;
					}
				}
				try
				{
					var result=require('uglify-js').minify(jsfiles,option).code;
					content={content:result,updateTime:updateTime,ver:cfg.ver};
					successCallback(content);
					delete require.cache[require.resolve('uglify-js')];
					return m.setLast(key,content);
				}
				catch(e)
				{
					var errMsg=e.message+' in file '+e.filename+' on line '+e.line+':'+e.col;
					return errorCallback(500,errMsg);
				}
			}
		});
	},
	compressImages:function(imgfiles,cfg,successCallback,errorCallback)
	{
		var tinify=require('tinify');
		tinify.key=cfg.key;
		var compressImg=function(file,successCallback,errorCallback)
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
							return errorCallback(500,minPath+' already exists');
						}
						else
						{
							var source=tinify.fromFile(file);
							source.toFile(minPath,function(err)
							{
								if(err instanceof tinify.AccountError)
								{
									return errorCallback(500,'AccountError:'+err.message+' -- '+file);
								}
								else if(err instanceof tinify.ClientError)
								{
									return errorCallback(500,'ClientError:'+err.message+' -- '+file);
								}
								else if(err instanceof tinify.ServerError)
								{
									return errorCallback(500,'ServerError:'+err.message+' -- '+file);
								}
								else if(err instanceof tinify.ConnectionError)
								{
									return errorCallback(500,'ConnectionError:'+err.message+' -- '+file);
								}
								else if(err)
								{
									return errorCallback(500,err.toString()+' -- '+file);
								}
								else
								{
									return successCallback(file,minPath);
								}
							});
						}
					});
				}
				else
				{
					return errorCallback(404,file+' not found');
				}
			});
		};
		imgfiles.forEach(function(v,k)
		{
			compressImg(v,successCallback,errorCallback);
		});
	},
	getMaxUpdateTime:function(files,errorCallback,successCallback)
	{
		var mtimes=[];
		var error=false;
		files.forEach(function(v,k)
		{
			if(!fs.existsSync(v))
			{
				error=true;
				return errorCallback(404,v+' not found');
			}
			var stat=fs.statSync(v);
			mtimes.push(stat.mtime.getTime());
		});
		var updateTime=Math.max.apply(this,mtimes);
		return error||successCallback(updateTime,files.join('-'));
	},
	getRequestFiles:function(cfg,req,callback)
	{
		cfg.ver=req.query.ver?req.query.ver.substr(0,9):null;
		var params=req.params;
		var basePath=path.join(cfg.staticPath,params[0]);
		var configFile=path.join(cfg.staticPath,params[1],'static.json');
		fs.exists(configFile,function(exists)
		{
			var hotPath=[];
			var files,config;
			if(exists)
			{
				try
				{
					config=require(configFile);
					if(config.static&&config.static[params.ext])
					{
						hotPath=Object.keys(config.static[params.ext]).filter(function(item){return item;}).unique();
					}
				}
				catch(e)
				{
					m.log('ignore invalid json file '+configFile);
				}
			}
			var exterPath=(params.ext=='js'?cfg.scriptLibPath:cfg.lessLibPath)+path.sep;
			if(hotPath.indexOf(params.file)>=0)
			{
				files=config.static[params.ext][params.file].filter(function(item){return item;}).unique().map(function(item){return path.resolve(basePath,item.replace(/externals./,exterPath));});
			}
			else
			{
				files=params.file.split('-').filter(function(item){return item;}).unique().map(function(item){return path.resolve(basePath,item.replace(/externals./,exterPath)+'.'+(params.ext=='js'?params.ext:'less'));});
			}
			callback(files);
		});
	},
	compressByConfig:function(cfg,successCallback,errorCallback)
	{
		var configFile=path.join(cfg.staticPath,'static.json');
		var getConfig=function(configFile,successCallback,errorCallback)
		{
			try
			{
				var config=require(configFile);
				var hotPathLess=[],hotPathJs=[];
				if(config.static)
				{
					if(config.static.css)
					{
						hotPathLess=Object.keys(config.static.css).filter(function(item){return item;}).unique();
					}
					if(config.static.js)
					{
						hotPathJs=Object.keys(config.static.js).filter(function(item){return item;}).unique();
					}
					var getRealPathLess=function(item)
					{
						return path.resolve(cfg.static,'css',item.replace(/externals./,cfg.lessLibPath+path.sep));
					};
					var getRealPathJs=function(item)
					{
						return path.resolve(cfg.static,'js',item.replace(/externals./,cfg.scriptLibPath+path.sep));
					};
					hotPathLess.forEach(function(v,k)
					{
						var lessfiles=config.static.css[v].filter(function(item){return item;}).unique().map(getRealPathLess);
						compress.compressLess(lessfiles,cfg,function(content)
						{
							var savename=path.resolve(cfg.static,'css',v+'.min.css');
							fs.writeFile(savename,content.content,function(err)
							{
								if(err)
								{
									errorCallback(500,err.toString());
								}
								else
								{
									successCallback(lessfiles,savename);
								}
							});
						},errorCallback);
					});
					hotPathJs.forEach(function(v,k)
					{
						var jsfiles=config.static.js[v].filter(function(item){return item;}).unique().map(getRealPathJs);
						compress.compressJs(jsfiles,cfg,function(content)
						{
							var savename=path.resolve(cfg.static,'js',v+'.min.js');
							fs.writeFile(savename,content.content,function(err)
							{
								if(err)
								{
									errorCallback(500,err.toString());
								}
								else
								{
									successCallback(jsfiles,savename);
								}
							});
						},errorCallback);
					});
				}
			}
			catch(e)
			{
				return errorCallback(500,e.toString());
			}
		};
		fs.exists(configFile,function(exists)
		{
			if(exists)
			{
				cfg.static=cfg.staticPath;
				getConfig(configFile,successCallback,errorCallback);
			}
			else
			{
				cfg.static=path.join(cfg.staticPath,'static');
				configFile=path.join(cfg.static,'static.json');
				fs.exists(configFile,function(found)
				{
					if(found)
					{
						getConfig(configFile,successCallback,errorCallback);
					}
					else
					{
						errorCallback(404,'static.json not found');
					}
				});
			}
		});
	}
};

var m=
{
	errorlog:[],
	lastList:[],
	setLast:function(key,content)
	{
		if(Object.keys(this.lastList).length>1000)
		{
			this.gc(false,true);
		}
		this.lastList[key]=content;
	},
	getLast:function(key)
	{
		var list=this.lastList[key];
		if(!list)
		{
			list={content:'',updateTime:0,ver:null};
		}
		return list;
	},
	log:function(msg)
	{
		if(this.errorlog.length>1000)
		{
			this.gc(true,false);
		}
		msg=new Date()+'\r\n'+msg;
		this.errorlog.push(msg);
		console.log(msg);
	},
	getLog:function(split)
	{
		return this.errorlog.join(split?split:'\r\n');
	},
	getStatus:function(cfg)
	{
		var os=require('os');
		var data=
		{
			cached:Object.keys(this.lastList).length,
			logs:this.errorlog.length,
			pid:process.pid,
			node:process.version,
			port:cfg.port,
			os:process.platform+process.arch,
			mem:os.freemem()/1048576,
			all:os.totalmem()/1048576,
			cpus:os.cpus(),
			load:os.loadavg(),
			uptime:process.uptime(),
			memory:process.memoryUsage(),
			version:cfg.version
		};
		return JSON.stringify(data);
	},
	gc:function(clearLog,clearCache)
	{
		var msg;
		if(clearLog)
		{
			msg=this.errorlog.length+' log items was cleared';
			this.errorlog=[];
			this.log(msg);
		}
		if(clearCache)
		{
			msg=Object.keys(this.lastList).length+' cache items was cleared';
			this.lastList=[];
			this.log(msg);
		}
		return JSON.stringify({log:clearLog,cache:clearCache});
	}
};

var tools=
{
	helper:function()
	{
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
	},
	lint:function(filePath)
	{
		fs.readFile(filePath,'utf-8',function(err,data)
		{
			if(!err)
			{
				var errMsg=[];
				var jshint=require('jshint');
				jshint.JSHINT(data);
				jshint.JSHINT.errors.forEach(function(item,index)
				{
					if(item)
					{
						var str=item.reason+' on line '+item.line+':'+item.character+"\r\n"+item.evidence;
						errMsg.push(str);
					}
				});
				m.log(filePath+':\r\n'+(errMsg.length?errMsg.join('\r\n'):'Lint Ok'));
			}
			else
			{
				m.log(err.toString());
			}
		});
	},
	watch:function(cfg)
	{
		var chokidar=require('chokidar');
		var option={ignorePermissionErrors:true,ignored: /[\/\\]\./};
		var util=require('util');
		var Et=require('events').EventEmitter;
		function waitChange(){}
		util.inherits(waitChange,Et);
		cfg.waitChange=new waitChange();
		chokidar.watch(cfg.staticPath,option).on('change',function(file,stats)
		{
			var ext=path.extname(file);
			if(['.js','.less','.json'].indexOf(ext)>=0)
			{
				if(!/\.min\./.test(file))
				{
					cfg.waitChange.emit('compress',file);
				}
			}
			if(ext=='.js')
			{
				return /\.min\./.test(file)||tools.lint(file);
			}
			else if(ext=='.json')
			{
				var config=require.cache[file];
				if(config&&config.loaded)
				{
					delete require.cache[file];
					m.log('cleared cache '+file);
				}
			}
			else
			{
				cfg.waitChange.emit('fresh',file);
			}
		});
		m.log('enable watch mode');
	}
};

var service=
{
	gitpull:function(cfg,successCallback,errorCallback)
	{
		if(!service.delay)
		{
			require('child_process').exec(cfg.gitexec,function(error,stdout,stderr)
			{
				if(error)
				{
					m.log(error.toString());
				}
				else
				{
					m.log(stderr+stdout);
				}
			});
			service.delay=setTimeout(function(){ service.delay=null;},15000);
			return successCallback(JSON.stringify({code:0,msg:'starting git pull'}));
		}
		else
		{
			return errorCallback(JSON.stringify({code:0,msg:'git pulled just now'}));
		}
	},
	timer:function(cfg,successCallback,errorCallback)
	{
		service.pulltimer=setInterval(function()
		{
			service.gitpull(cfg,successCallback,errorCallback);
		},60000);
		m.log('git pull timer start');
	},
	hook:
	{
		gitpull:function(req,res,next,cfg)
		{
			var callback=function(data)
			{
				res.type('json').send(data);
			};
			return service.gitpull(cfg,callback,callback);
		},
		viewlog:function(req,res,next,cfg)
		{
			return res.type('txt').send(m.getLog());
		},
		clear:function(req,res,next,cfg)
		{
			return res.type('json').send(m.gc(true,true));
		},
		status:function(req,res,next,cfg)
		{
			return res.type('json').send(m.getStatus(cfg));
		}
	}
};

(function(global)
{
	var processArgv=[].concat(process.argv);
	var args=processArgv.splice(2);
	global.path=require('path');
	global.fs=require('fs');
	tools.helper();
	var cfg=
	{
		port:8088,
		debug:true,
		version:'0.3.4',
		staticPath:process.cwd(),
		lessLibPath:'less',
		scriptLibPath:'script',
		gitexec:'git pull origin master',
		key:'uyX0XAGKE89TIXTxPv81WqFgj4if6AUa',
		error404:"<title>Error..</title><center><span style='font-size:300px;color:gray;font-family:Monaco,arial'>404...</span></center>"
	};
	if(args.indexOf('-v')>=0)
	{
		return console.log('air version: air/'+cfg.version);
	}
	else if(args.indexOf('-h')>=0)
	{
		var help=
		[
			'Usage:\r\n\tair [command] [flags]\r\nCommands:',
			'\tdevelop    run a static server in debug mode,and also run a php server',
			'\tserver     run a static server in server mode,compress js and css',
			'\tlint       use jslint without http server,pass one or more js file or not',
			'\tcompress   compress js files or compile and compress less files',
			'Flags:',
			'\t-v         show air version',
			'\t-h         show this help information',
			'\t-d         run in daemon mode',
			'\t-p         set server listen port',
			'\t-k         set webhook passwort',
			'\t-g         enable git pull,pull origin master every minute',
			'\t-w         enable jslint,jslint when javascript files changed',
			'\t--optimize optimize javascript code,remove console debugger',
			'\t--debug    compress in debug mode,compile and compress lightly',
			'\t--watch    compress in watch mode,compres again when files changed',
			'\t--less     set less lib path,use [air --less=/pathto/lesslib]',
			'\t--script   set script lib path,use [air --script=/pathto/jslib]',
			'\t--key      set tinypng image tinify key,use [air --key=xxx]',
			'\t--ver      set compile less urlArgs,use [air --ver=v123]',
			'\r\nSee more information on http://blog.suconghou.cn/project/air'
		];
		return console.log(help.join('\r\n'));
	}
	else if(args.length===0)
	{
		cfg.compressDebug=true;
		return app.serve(cfg);
	}
	else
	{
		args.forEach(function(item,index)
		{
			var less=item.split('--less=');
			var vers=item.split('--ver=');
			var keys=item.split('--key=');
			var script=item.split('--script=');
			var clone=item.split('--clone=');
			if(less.length==2 && less[1])
			{
				delete args[index];
				cfg.lessLibPath=path.resolve(cfg.staticPath,less[1]);
				m.log('set less lib path: '+cfg.lessLibPath);
			}
			else if(vers.length==2 && vers[1])
			{
				delete args[index];
				cfg.ver=vers[1].substr(0,9);
				m.log('set less urlArgs '+cfg.ver);
			}
			else if(keys.length==2 && keys[1])
			{
				delete args[index];
				cfg.key=keys[1];
				m.log('set tinify key '+cfg.key);
			}
			else if(script.length==2 && script[1])
			{
				delete args[index];
				cfg.scriptLibPath=path.resolve(cfg.staticPath,script[1]);
				m.log('set script lib path: '+cfg.scriptLibPath);
			}
			else if(clone.length==2 && clone[1])
			{
				delete args[index];
				var cwd=path.basename(clone[1]);
				cfg.staticPath=path.join(cfg.staticPath,cwd);
				require('child_process').exec('git clone '+clone[1]+' && cd '+cwd,function(error,stdout,stderr)
				{
					process.chdir(cwd);
					m.log('current working dir '+cfg.staticPath);
					if(error)
					{
						m.log(error.toString());
					}
					else
					{
						m.log(stderr+stdout);
					}
				});
			}
			else if(item=='--debug')
			{
				delete args[index];
				cfg.compressDebug=true;
				m.log('enable compress debug mode');
			}
			else if(item=='--watch')
			{
				delete args[index];
				cfg.watch=true;
			}
			else if(item=='--optimize')
			{
				delete args[index];
				cfg.compressDebug=false;
				cfg.optimization=true;
				m.log('enable compress optimization mode');
			}
			else if(item=='-g')
			{
				delete args[index];
				cfg.gitpull=true;
				m.log('enable git pull mode');
			}
			else if(item=='-p')
			{
				delete args[index];
				cfg.port=args[index+1];
			}
			else if(item=='-k')
			{
				delete args[index];
				cfg.pass=args[index+1];
			}
			else if(item=='compress')
			{
				cfg.compress=true;
			}
			else if(item=='lint' || item=='-w')
			{
				cfg.lint=true;
				cfg.watchLint=item=='-w'?true:false;
				cfg.compressDebug=true;
			}
			else if(item=='server' || item=='-d')
			{
				cfg.debug=false;
				cfg.compressDebug=false;
				if(item=='-d')
				{
					cfg.daemon=true;
				}
				else
				{
					cfg.server=true;
				}
			}
			else if(item=='develop')
			{
				cfg.compressDebug=true;
				cfg.phpserver=true;
			}
		});
		args=args.filter(function(item){return item;});
		if(cfg.compress)
		{
			return app.compress(args,cfg);
		}
		else if(cfg.lint)
		{
			if(cfg.watchLint)
			{
				app.serve(cfg);
			}
			return app.lint(args,cfg);
		}
		else if(cfg.daemon&&!process.env.daemon)
		{
			app.runDaemon(cfg);
		}
		else if(cfg.server)
		{
			app.runServer(cfg);
		}
		else
		{
			return app.serve(cfg)&&cfg.watchLint&&app.lint(args,cfg);
		}
	}
})(global);






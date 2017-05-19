/* jshint undef: true, node: true */
/* globals path,fs,cfg */
var app=
{
	serve:function(cfg)
	{
		var express=require('express');
		var instance=new express();
		instance.set('port',process.env.PORT||cfg.port);
		var server=instance.listen(instance.get('port'),function()
		{
			cfg.port=server.address().port;
			m.log('Server listening on port '+cfg.port);
		}).on('error',function(err)
		{
			console.log(err.toString());
		});
		var setCors=function(req,res)
		{
			var refer='*';
			if(req&&req.headers.referer)
			{
				var params=require('url').parse(req.headers.referer);
				refer=params.protocol+'//'+params.host;
			}
			res.header('Access-Control-Allow-Origin',refer);
			res.header('Access-Control-Allow-Credentials','true');
			res.header('Access-Control-Allow-Headers','Origin, X-Requested-With, Content-Type, Accept');
		};
		instance.use(function(req,res,next)
		{
			setCors(req,res);
			next();
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
			var reload='console.log("reload disabled");';
			if(cfg.watch)
			{
				var url='//'+req.headers.host+'/reload';
				reload='var a=new XMLHttpRequest;a.timeout=0;a.open("POST","'+url+'",1),a.onreadystatechange=function(){4==a.readyState&&location.reload()},a.send();';
			}
			res.type('js').send(reload);
		});
		instance.post('/reload',function(req,res,next)
		{
			if(cfg.watch)
			{
				cfg.waitChange.on('fresh',function(file)
				{
					return res.finished||res.send(file);
				});
			}
		});
		instance.use(express.static(cfg.workPath,{maxAge:cfg.debug?'5s':'1h',setHeaders:function(res,path,stat)
		{
			setCors(null,res);
		}}));
		this.route(instance);
		instance.use(function(req,res,next)
		{
			if(req.headers.serveDir&&path.isAbsolute(req.headers.serveDir))
			{
				var file=path.join(req.headers.serveDir,req.baseUrl);
				fs.exists(file,function(exists)
				{
					return exists?require('send')(req,file).pipe(res):res.status(404).send(cfg.error404);
				});
			}
			return res.status(404).send(cfg.error404);
		});
		return instance;
	},
	route:function(instance)
	{
		instance.disable('x-powered-by');
		instance.use(require('compression')());
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
		instance.use(/[\w\-\/]+\.css$/,function(req,res,next)
		{
			var exterPath=cfg.lessLibPath+path.sep;
			var files=req.baseUrl.replace('.css','').split('-').filter(function(item){return item;}).unique().map(function(item){return path.join(req.headers.serveDir?req.headers.serveDir:cfg.workPath,item.replace(/externals./,exterPath)+'.less');});
			cfg.ver=req.query.ver?req.query.ver.substr(0,9):null;
			compress.compressLess(files,cfg,function(content)
			{
				res.type('css').send(content.content);
			},function(code,errorMsg)
			{
				res.type('txt').status(code).send(errorMsg);
			});
		});
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
			var jsfiles=args.unique().filter(function(item){return item&&item.substr(-3)=='.js';}).map(function(item){return path.resolve(cfg.workPath,item);});
			var lessfiles=args.unique().filter(function(item){return item&&item.substr(-5)=='.less';}).map(function(item){return path.resolve(cfg.workPath,item);});
			var imgfiles=args.unique().filter(function(item){return /^.+\.(png|jpg|jpeg)$/i.test(item);}).map(function(item){return path.resolve(cfg.workPath,item);});
			if(jsfiles.length>0)
			{
				compress.compressJs(jsfiles,cfg,function(content)
				{
					var ext=cfg.replacemode?'.js':'.min.js';
					var savename=path.join(cfg.workPath,jsfiles.map(function(item){return path.basename(item,'.js');}).join('-'))+ext;
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
					var ext=cfg.replacemode?'.css':'.min.css';
					var savename=path.join(cfg.workPath,lessfiles.map(function(item){return path.basename(item,'.less');}).join('-'))+ext;
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
					m.log("\033[31m Error "+code+" : "+errorMsg+" \033[0m",true);
				});
			}
			if(imgfiles.length>0)
			{
				compress.compressImages(imgfiles,cfg,function(file,minPath)
				{
					m.log(file+' =>> '+minPath+' done',true);
				},function(code,errorMsg)
				{
					m.log("\033[31m Error "+code+" : "+errorMsg+" \033[0m",true);
				});
			}
			return watchCompress(cfg);
		}
	},
	lint:function(args,cfg)
	{
		if(args.length<=1 || cfg.watch)
		{
			tools.watch(cfg);
		}
		else
		{
			var jsfiles=args.unique().filter(function(item){return item&&item.substr(-3)=='.js';}).map(function(item){return path.resolve(cfg.workPath,item);});
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
	},
	build:function(args,cfg)
	{
		var entry,compiler,config=m.getConfig();
		var pkg=config.package||{};
		if(args.length>1)
		{
			var f=path.resolve(cfg.workPath,args[1]);
			if(!fs.existsSync(f))
			{
				return m.log(f+' not exists');
			}
			entry=[f];
		}
		else
		{
			if(pkg.entry)
			{
				entry=Array.isArray(pkg.entry)?pkg.entry:[pkg.entry];
				entry=entry.filter(function(item){return item;}).unique().map(function(item){return path.resolve(cfg.cfgPath,item);});
			}
			else
			{
				return m.log(cfg.cfgname+' not exists or error package info');
			}
		}
		var webpack=require('webpack');
		var autoprefixer=require('autoprefixer');
		var ExtractTextPlugin=require("extract-text-webpack-plugin");
		var options=
		{
			module:
			{
				loaders:
				[
					{test:/\.css$/,loader:ExtractTextPlugin.extract("style","css!postcss")},
					{test:/\.less$/,loader:ExtractTextPlugin.extract("style","css!postcss!less")},
					{test:/\.scss$/,loader:ExtractTextPlugin.extract("style","css!postcss!sass")},
					{test:/\.jsx?$/,loader:'babel',exclude:/node_modules/,query:{presets:['latest','stage-0','react']}},
					{test:/\.ts$/,loader:'ts',exclude:/(typings)/},
					{test:/\.coffee$/,loader:'coffee'},
					{test:/\.json$/,loader:'json'},
					{test:/\.txt$/,loader:'raw'},
					{test:/\.vue$/,loader:'vue'},
					{test:/\.(html|tpl)$/,loader:'html'},
					{test:/\.(png|jpg|jpeg|gif|svg|woff|woff2)$/,loader:'url?limit='+(parseInt(pkg.dataUrlLimit)?parseInt(pkg.dataUrlLimit):8192)},
					{test:/\.(eot|ttf|wav|mp3)$/,loader:'file'}
				]
			},
			postcss:[autoprefixer({browsers:['last 5 versions','ie > 8','Firefox ESR']})],
			resolve:
			{
				modulesDirectories:['node_modules'],
				fallback:cfg.nodePath,
				extensions:['','.js','.jsx','.vue'],
				alias:{vue:'vue/dist/vue.js'}
			},
			resolveLoader:
			{
				modulesDirectories:['node_modules'],
				fallback:cfg.nodePath,
				extensions:['','.js','.jsx','.vue']
			},
			plugins:
			[
				new ExtractTextPlugin(cfg.cfgPath?path.join(cfg.cfgPath,'[name].min.css'):"./[name].min.css",{allChunks:true})
			],
			entry:{app:entry},
			output:
			{
				path:cfg.cfgPath?path.join(cfg.cfgPath,'dist'):path.join(cfg.workPath,'dist'),
				filename:'[name].min.js',
				pathinfo:true,
			},
			devtool:cfg.debug?'source-map':'eval'
		};
		if(cfg.watch&&cfg.debug)
		{
			var webpackDevServer=require('webpack-dev-server');
			var HtmlWebpackPlugin=require('html-webpack-plugin');
			options.devtool='eval';
			options.plugins.push(new webpack.HotModuleReplacementPlugin());
			options.plugins.push(new HtmlWebpackPlugin({template:args[2]?args[2]:'index.html',inject:'body'}));
			options.entry.app.unshift("webpack-dev-server/client?http://localhost:"+cfg.port+"/","webpack/hot/dev-server");
			compiler=webpack(options);
			var server=new webpackDevServer(compiler,{hot:true,progress:true});
			this.route(server.app);
			server.listen(cfg.port);
			return m.log('Starting webpack-dev-server on port '+cfg.port);
		}
		else
		{
			if(cfg.optimization)
			{
				options.output.publicPath=cfg.publicPath?cfg.publicPath:(pkg.publicPath?pkg.publicPath:'/dist/');
				options.devtool='cheap-source-map';
				options.plugins.push(new webpack.optimize.DedupePlugin());
				options.plugins.push(new webpack.optimize.AggressiveMergingPlugin());
				options.plugins.push(new webpack.optimize.OccurrenceOrderPlugin());
				options.plugins.push(new webpack.optimize.UglifyJsPlugin({sourceMap:false,output:{comments:false},compress:{warnings:cfg.debug,sequences:true,properties:true,dead_code:true,unused:true,booleans:true,join_vars:true,if_return:true,conditionals:true,drop_console:true,drop_debugger:true,evaluate:true,loops:true}}));
			}
			compiler=webpack(options);
			var callback=function(err,stat)
			{
				if(err)
				{
					return m.log(err);
				}
				var jsonStats=stat.toJson();
				if(jsonStats.errors.length>0)
				{
					return m.log(jsonStats.errors.join('\r\n'));
				}
				if(jsonStats.warnings.length>0)
				{
					return m.log(jsonStats.warnings.join('\r\n'));
				}
				console.log(stat.hash+' build success,cost time %d ms',stat.endTime-stat.startTime);
				if(cfg.cwebpack)
				{
					compress.compressByConfig(cfg,function(files,savename)
					{
						m.log(files.join('\r\n')+'\r\nsave as:'+savename);
					},function(code,errorMsg)
					{
						m.log('Error '+code+' : '+errorMsg);
					});
				}
			};
			if(cfg.watch)
			{
				return compiler.watch({aggregateTimeout:900},callback);
			}
			else
			{
				return compiler.run(callback);
			}
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
				var includePath=path.isAbsolute(cfg.lessLibPath)?cfg.lessLibPath:[path.join(cfg.workPath,cfg.lessLibPath),path.join(path.dirname(cfg.workPath),cfg.lessLibPath),path.join(path.dirname(path.dirname(cfg.workPath)),cfg.lessLibPath),path.join(path.dirname(path.dirname(path.dirname(cfg.workPath))),cfg.lessLibPath)];
				var lessInput=lessfiles.map(function(item){return '@import "'+item+'";';}).join("\r\n");
				var option={plugins:[new autoprefix({browsers: ["last 5 versions"]})],paths:includePath,urlArgs:cfg.ver?'ver='+cfg.ver:null};
				if(!cfg.debug)
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
				if(cfg.debug)
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
		var toFile=function(file,minPath,successCallback,errorCallback)
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
		};
		var compressImg=function(file,successCallback,errorCallback)
		{
			fs.exists(file,function(exists)
			{
				if(exists)
				{
					var minPath=file;
					if(cfg.replacemode)
					{
						return toFile(file,minPath,successCallback,errorCallback);
					}
					else
					{
						minPath=file.replace(/(?:\.min)?\.(png|jpg|jpeg)/,'.min.$1');
						fs.exists(minPath,function(minExists)
						{
							if(minExists)
							{
								return errorCallback(500,minPath+' already exists');
							}
							else
							{
								return toFile(file,minPath,successCallback,errorCallback);
							}
						});
					}
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
		for(var i in files)
		{
			if(files.hasOwnProperty(i))
			{
				var v=files[i];
				if(!fs.existsSync(v))
				{
					return errorCallback(404,v+' not found');
				}
				var stat=fs.statSync(v);
				mtimes.push(stat.mtime.getTime());
			}
		}
		var updateTime=Math.max.apply(this,mtimes);
		return successCallback(updateTime,files.join('-'));
	},
	getRequestFiles:function(cfg,req,callback)
	{
		cfg.ver=req.query.ver?req.query.ver.substr(0,9):null;
		var params=req.params;
		var basePath=path.join(req.headers.serveDir?req.headers.serveDir:cfg.workPath,params[0]);
		var configFile=path.join(req.headers.serveDir?req.headers.serveDir:cfg.workPath,params[1],cfg.cfgname);
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
		var config=m.getConfig();
		if(config&&config.static)
		{
			try
			{
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
						return path.resolve(cfg.cfgPath,'css',item.replace(/externals./,cfg.lessLibPath+path.sep));
					};
					var getRealPathJs=function(item)
					{
						return path.resolve(cfg.cfgPath,'js',item.replace(/externals./,cfg.scriptLibPath+path.sep));
					};
					hotPathLess.forEach(function(v,k)
					{
						var lessfiles=config.static.css[v].filter(function(item){return item;}).unique().map(getRealPathLess);
						compress.compressLess(lessfiles,cfg,function(content)
						{
							var savename=path.resolve(cfg.cfgPath,'css',v+'.min.css');
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
							var savename=path.resolve(cfg.cfgPath,'js',v+'.min.js');
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

		}
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
	log:function(msg,noDate)
	{
		if(this.errorlog.length>1000)
		{
			this.gc(true,false);
		}
		if(!noDate)
		{
			var nowDate = new Date();
			msg=nowDate.toLocaleDateString()+'  '+nowDate.toLocaleTimeString()+'\r\n'+msg;
		}
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
	},
	getConfig:function()
	{
		if(cfg.config)
		{
			return cfg.config;
		}
		var paths=[path.join(cfg.workPath,cfg.cfgname),path.join(path.dirname(cfg.workPath),cfg.cfgname),path.join(cfg.workPath,'static',cfg.cfgname)];
		var configFile;
		for(var i in paths)
		{
			var f=paths[i];
			if(fs.existsSync(f))
			{
				configFile=f;
			}
		}
		if(configFile)
		{
			try
			{
				var config=require(configFile);
				cfg.config=config;
				cfg.cfgPath=path.dirname(configFile);
				return config;
			}
			catch(e)
			{
				m.log(e.toString());
				return {};
			}
		}
		return {};
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
		function posix(path)
		{
			return path.charAt(0) === '/';
		}
		function win32(path)
		{
			var splitDeviceRe = /^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?([\\\/])?([\s\S]*?)$/;
			var result = splitDeviceRe.exec(path);
			var device = result[1] || '';
			var isUnc = !!device && device.charAt(1) !== ':';
			return !!result[2] || isUnc;
		}
		path.isAbsolute=process.platform==='win32'?win32:posix;
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
		chokidar.watch(cfg.workPath,option).on('change',function(file,stats)
		{
			if(/\.min\./.test(file))
			{
				return false;
			}
			var ext=path.extname(file);
			if(['.js','.less','.json'].indexOf(ext)>=0)
			{
				cfg.waitChange.emit('compress',file);
			}
			if(ext=='.js')
			{
				cfg.waitChange.emit('fresh',file);
				return tools.lint(file);
			}
			else if(ext=='.json')
			{
				var config=require.cache[file];
				if(config&&config.loaded)
				{
					delete require.cache[file];
					m.log('cleared cache '+file);
					cfg.waitChange.emit('fresh',file);
				}
			}
			else
			{
				cfg.waitChange.emit('fresh',file);
			}
		});
		m.log('watch mode enabled');
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
	global.cfg=
	{
		port:8088,
		debug:true,
		version:'0.5.1',
		cfgname:'static.json',
		workPath:process.cwd(),
		nodePath:process.env.NODE_PATH,
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
			'\tdevelop    		run a static server in debug mode,and also run a php server',
			'\tserver     		run a static server in server mode,compress js and css',
			'\tlint       		use jslint without http server,pass one or more js file or not',
			'\tcompress   		compress js files or compile and compress less files',
			'\tbuild      		use webpack and webpack-dev-server',
			'Flags:',
			'\t-v         		show air version',
			'\t-h         		show this help information',
			'\t-d         		run in daemon mode',
			'\t-p         		set server listen port',
			'\t-k         		set webhook passwort',
			'\t-g         		enable git pull,pull origin master every minute',
			'\t-w         		enable jslint,jslint when javascript files changed',
			'\t-r         		replace mode,when compress images replace old file',
			'\t--optimize 		optimize javascript code,remove console debugger',
			'\t--debug    		compress in debug mode,compile and compress lightly',
			'\t--watch    		compress in watch mode,compres again when files changed',
			'\t--less     		set less lib path,use [air --less=/pathto/lesslib]',
			'\t--script   		set script lib path,use [air --script=/pathto/jslib]',
			'\t--key      		set tinypng image tinify key,use [air --key=xxx]',
			'\t--ver      		set compile less urlArgs,use [air --ver=v123]',
			'\t--publicPath		set webpack output.publicPath,use [air --publicPath=/path/]',
			'\t--compress		do compress after webpack,use with air build',
			'\r\nSee more information on http://blog.suconghou.cn/project/air\r\n'
		];
		return console.log(help.join('\r\n'));
	}
	else if(args.length===0)
	{
		cfg.debug=true;
		return app.serve(cfg);
	}
	else
	{
		var withDebug = false;
		args.forEach(function(item,index)
		{
			var less=item.split('--less=');
			var vers=item.split('--ver=');
			var keys=item.split('--key=');
			var script=item.split('--script=');
			var clone=item.split('--clone=');
			var publicPath=item.split('--publicPath=');
			if(less.length==2 && less[1])
			{
				delete args[index];
				cfg.lessLibPath=path.resolve(cfg.workPath,less[1]);
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
				cfg.scriptLibPath=path.resolve(cfg.workPath,script[1]);
				m.log('set script lib path: '+cfg.scriptLibPath);
			}
			else if(clone.length==2 && clone[1])
			{
				delete args[index];
				var cwd=path.basename(clone[1]);
				cfg.workPath=path.join(cfg.workPath,cwd);
				require('child_process').exec('git clone '+clone[1]+' && cd '+cwd,function(error,stdout,stderr)
				{
					process.chdir(cwd);
					m.log('current working dir '+cfg.workPath);
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
			else if(publicPath.length==2 &&publicPath[1])
			{
				delete args[index];
				cfg.publicPath=publicPath[1];
				cfg.debug=false;
				cfg.optimization=true;
				m.log('set publicPath: '+publicPath[1]);
			}
			else if(item=='--debug')
			{
				delete args[index];
				cfg.debug=true;
				withDebug=true;
				m.log('enable debug mode');
			}
			else if(item=='--optimize')
			{
				delete args[index];
				cfg.debug=false;
				withDebug=false;
				cfg.optimization=true;
				m.log('enable optimization mode');
			}
			else if(item=='--watch')
			{
				delete args[index];
				cfg.watch=true;
				m.log('enable watch mode');
			}
			else if(item=='--compress')
			{
				delete args[index];
				cfg.cwebpack=true;
			}
			else if(item=='-r')
			{
				delete args[index];
				cfg.replacemode=true;
			}
			else if(item=='-w')
			{
				delete args[index];
				cfg.watch=true;
				m.log('enable watch mode');
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
				cfg.debug=withDebug;
				cfg.compress=true;
			}
			else if(item=='build')
			{
				cfg.build=true;
				cfg.debug=withDebug;
			}
			else if(item=='lint')
			{
				cfg.lint=true;
				cfg.debug=true;
			}
			else if(item=='server' || item=='-d')
			{
				cfg.debug=false;
				if(item=='-d')
				{
					cfg.daemon=true;
				}
			}
			else if(item=='develop')
			{
				cfg.debug=true;
				cfg.server=true;
			}
		});
		args=args.filter(function(item){return item;});
		if(cfg.compress)
		{
			return app.compress(args,cfg);
		}
		else if(cfg.build)
		{
			return app.build(args,cfg);
		}
		else if(cfg.lint)
		{
			if(cfg.watch)
			{
				app.serve(cfg);
			}
			return app.lint(args,cfg);
		}
		else if(cfg.daemon&&!process.env.daemon)
		{
			return app.runDaemon(cfg);
		}
		else if(cfg.server)
		{
			app.runServer(cfg);
			if(cfg.watch)
			{
				app.lint(args,cfg);
			}
		}
		else
		{
			app.serve(cfg);
			if(cfg.watch)
			{
				app.lint(args,cfg);
			}
		}
	}
})(global);






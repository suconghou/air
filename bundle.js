'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs$1 = _interopDefault(require('fs'));
require('util');
var path$1 = _interopDefault(require('path'));
var http = _interopDefault(require('http'));
var process = _interopDefault(require('process'));
var querystring = _interopDefault(require('querystring'));

var util$1 = {
	resolveLookupPaths(pathstr, file) {
		const arr = [];
		const tmp = [];
		pathstr.split(path$1.sep).forEach(item => {
			tmp.push(item);
			arr.push(path$1.resolve(path$1.join(path$1.sep, ...tmp, file)));
		});
		return arr.reverse();
	},
	getConfig(cwd, name) {
		const paths = this.resolveLookupPaths(cwd, name);
		const f = this.findExist(paths);
		if (f) {
			try {
				const json = require(f);
				return json;
			} catch (e) {
				console.error(e.toString());
			}
		}
		return {};
	},
	findExist(paths) {
		for (let i = 0, j = paths.length; i < j; i++) {
			const file = paths[i];
			try {
				fs$1.accessSync(file, fs$1.constants.R_OK);
				return file;
			} catch (e) {}
		}
	},
	getMaxUpdateTime: function(files) {
		const mtimes = [];
		for (let i = 0, j = files.length; i < j; i++) {
			const v = files[i];
			const stat = fs$1.statSync(v);
			mtimes.push(stat.mtime.getTime());
		}
		const updateTime = Math.max.apply(this, mtimes);
		return updateTime;
	}
};

const maxItem = 1e3;
const caches = new Map();
var log = {
	errorlog: [],
	log(msg) {
		msg = msg.toString();
		if (this.errorlog.length > maxItem) {
			this.errorlog = [];
		}
		var nowDate = new Date();
		msg = nowDate.toLocaleDateString() + " " + nowDate.toLocaleTimeString() + " " + msg;
		this.errorlog.push(msg);
		console.log(msg);
	},
	get(k) {
		return caches.get(k);
	},
	set(k, v) {
		return caches.set(k, v);
	}
};

var utiljs = {
	isFunction(value) {
		return typeof value === "function";
	},
	unique(arr) {
		return Array.from(new Set(arr));
	}
};

var compress = {
	compressLessReq(response, matches, query, cwd) {
		const key = matches[0].replace(".css", "");
		const files = key
			.split("-")
			.filter(item => item)
			.map(item => {
				return path$1.join(cwd, item) + ".less";
			});
		let maxTime;
		try {
			maxTime = util$1.getMaxUpdateTime(files);
		} catch (e) {}
		const options = { urlArgs: query.ver ? `ver=${query.ver}` : null, env: "development", useFileCache: false };
		const cache = log.get(key);
		if (cache && cache.maxTime == maxTime && maxTime && options.urlArgs == cache.urlArgs) {
			response.writeHead(200, { "Content-Type": "text/css" });
			return response.end(cache.css);
		}
		this.compressLess(files, options)
			.then(res => {
				response.writeHead(200, { "Content-Type": "text/css" });
				response.end(res.css);
				log.set(key, { css: res.css, urlArgs: options.urlArgs, maxTime });
			})
			.catch(err => {
				response.writeHead(500, { "Content-Type": "text/plain" });
				response.end(err.toString() + "\n");
			});
	},

	compressLess(files, options) {
		let { paths, urlArgs, compress, useFileCache, env } = options || {};
		const lessfiles = utiljs.unique(files);
		var lessInput = lessfiles
			.map(function(item) {
				return '@import "' + item + '";';
			})
			.join("\r\n");
		const less = require("less");
		const autoprefix = require("less-plugin-autoprefix");
		const option = { plugins: [new autoprefix({ browsers: ["last 5 versions", "ie > 8", "Firefox ESR"] })], paths, urlArgs, compress, useFileCache, env };
		return new Promise((resolve, reject) => {
			less.render(lessInput, option)
				.then(resolve, reject)
				.catch(reject);
		});
	},

	compressJs(files) {
		const f = utiljs.unique(files);
		let options;
		{
			options = {
				mangle: false,
				compress: {
					sequences: false,
					properties: false,
					dead_code: false,
					unused: false,
					booleans: false,
					join_vars: false,
					if_return: false,
					conditionals: false,
					hoist_funs: false,
					drop_debugger: false,
					evaluate: false,
					loops: false
				}
			};
		}

		const UglifyJS = require("uglify-js");
		return new Promise((resolve, reject) => {
			this.getContent(files)
				.then(res => {
					const result = UglifyJS.minify(res, options);
					resolve(result);
				})
				.catch(reject);
		});
	},

	compressByConfig() {},

	getContent(files) {
		const arr = files.map(file => {
			return new Promise((resolve, reject) => {
				fs$1.readFile(file, "utf-8", function(err, data) {
					if (err) {
						reject(err);
					} else {
						resolve(data);
					}
				});
			});
		});
		return new Promise((resolve, reject) => {
			Promise.all(arr)
				.then(res => {
					const objs = {};
					files.forEach((file, index) => {
						objs[file] = res[index];
					});
					resolve(objs);
				})
				.catch(reject);
		});
	}
};

const POST = {
	reload(request, response, args, query) {}
};

const GET = {
	reload(request, response, args, query) {}
};

const routers = {
	POST,
	GET
};

const regxpPath = [
	{
		reg: /[\w\-\/]+\.css$/,
		handler: compress.compressLessReq.bind(compress)
	},
	{
		reg: /\d+/,
		handler: () => {}
	}
];

const regRouters = {
	GET: regxpPath
};

var route = {
	getRouter(m) {
		if (routers[m]) {
			return routers[m];
		}
	},
	getRegxpRouter(m, pathinfo) {
		let routers;
		if (regRouters[m]) {
			routers = regRouters[m];
		}
		if (!routers) {
			return;
		}
		for (let i = 0, j = routers.length; i < j; i++) {
			const item = routers[i];
			if (item.reg.test(pathinfo)) {
				return {
					...item,
					matches: pathinfo.match(item.reg)
				};
			}
		}
	}
};

// import mime from "./mime/mime.js";

var sendFile = (response, stat, filePath) => {
	const type = mime.lookup(filePath);
	response.writeHead(200, {
		"Content-Type": type,
		"Content-Length": stat.size
	});
	const readStream = fs.createReadStream(filePath);
	readStream.pipe(response);
};

const defaultPort = 8088;
const defaultRoot = process.cwd();

class httpserver {
	constructor(cfg) {
		const { port, root } = cfg;
		this.port = port || process.env.PORT || defaultPort;
		this.root = root || defaultRoot;
	}
	start() {
		http.createServer((request, response) => {
			try {
				const router = route.getRouter(request.method);
				if (router) {
					const [pathinfo, qs] = request.url.split("?");
					const query = querystring.parse(qs);
					const [fn, ...args] = pathinfo.split("/").filter(item => item);
					if (!fn) {
						return this.noIndex(request, response, pathinfo, query);
					}
					const m = router[fn];
					if (utiljs.isFunction(m)) {
						// 优先级1 预定义函数
						return m(request, response, args, query);
					} else {
						// 优先级2 预处理文件 , 优先级3 静态文件
						const regRouter = route.getRegxpRouter(request.method, pathinfo);
						if (regRouter) {
							return regRouter.handler(response, regRouter.matches, query, this.root);
						}
					}
				}
				this.err404(response);
			} catch (e) {
				console.info(e);
				const err = e.toString();
				log.log(err);
				this.err500(response, err);
			}
		}).listen(this.port);
		console.log("Server running at http://127.0.0.1:%s", this.port);
	}

	noIndex(request, response, pathinfo, query) {
		response.writeHead(200, { "Content-Type": "text/plain" });
		response.end("index\n");
	}

	tryfile(response, filePath) {
		const file = path.join(this.root, filePath);
		fs$1.stat(file, (err, stat) => {
			if (err) {
				return this.err404(response);
			}
			sendFile(response, stat, file);
		});
	}

	err404(response) {
		response.writeHead(404, { "Content-Type": "text/plain" });
		response.end("Not Found\n");
	}

	err500(response, err) {
		response.writeHead(500, { "Content-Type": "text/plain" });
		response.end(err + "\n");
	}
}

const configName = "static.json";

class server {
	constructor(cwd) {
		this.cwd = cwd;
	}

	serve() {
		const cfg = {};
		new httpserver(cfg).start();
	}

	run(args) {}

	lint(args) {}

	install(args) {}

	compress(args) {
		const config = util$1.getConfig(this.cwd, configName);
		const c = new compress(config);
		if (args) {
			console.info(args);
			const less = args
				.filter(item => {
					return item.split(".").pop() == "less";
				})
				.map(item => {
					return path$1.join(this.cwd, item);
				});
			const js = args
				.filter(item => {
					return item.split(".").pop() == "js";
				})
				.map(item => {
					return path$1.join(this.cwd, item);
				});

			c.compressLess(less)
				.then(res => {
					console.info(res);
				})
				.catch(err => {
					console.error(err.toString());
				});
			c.compressJs(js)
				.then(res => {
					console.info(res);
				})
				.catch(err => {
					console.error(err.toString());
				});
		} else {
			c.compressByConfig();
		}
		console.info(args);
	}
}

class cli {
	constructor(server) {
		this.server = server;
	}
	run(argv) {
		const [node, cfile, ...args] = argv;
		this.node = node;
		this.cfile = cfile;
		this.args = args;
		if (args.length > 0) {
			this.runArgs();
		} else {
			this.runInit();
		}
		console.info(node, cfile, args);
	}
	runArgs() {
		const [m, ...args] = this.args;
		console.info(args);
		const f = this.server[m];
		if (utiljs.isFunction(f)) {
			return f.call(this.server, args);
		}
		return this.fallback(m, args);
	}
	runInit() {
		console.info("init");
	}

	fallback(m, args) {
		this.server.serve();
	}
}

new cli(new server(process.cwd())).run(process.argv);

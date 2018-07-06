"use strict";

function _interopDefault(ex) {
	return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex;
}

var fs = _interopDefault(require("fs"));
var util = _interopDefault(require("util"));
var path = _interopDefault(require("path"));
var os = _interopDefault(require("os"));
var http = _interopDefault(require("http"));
var process$1 = _interopDefault(require("process"));
var querystring = _interopDefault(require("querystring"));
var child_process = _interopDefault(require("child_process"));

const fsStat = util.promisify(fs.stat);

var util$1 = {
	resolveLookupPaths(pathstr, file) {
		const arr = [];
		const tmp = [];
		pathstr.split(path.sep).forEach(item => {
			tmp.push(item);
			arr.push(path.resolve(path.join(path.sep, ...tmp, file)));
		});
		return arr.reverse();
	},
	getConfig(cwd, name) {if (!/static$/.test(cwd)) {cwd = path.join(cwd, "static");}
		const paths = this.resolveLookupPaths(cwd, name);
		const f = this.findExist(paths);
		if (f) {
			try {
				const json = require(f);
				json.path = path.dirname(f);
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
				fs.accessSync(file, fs.constants.R_OK);
				return file;
			} catch (e) {}
		}
	},
	getMaxUpdateTime: function(files) {
		const mtimes = [];
		for (let i = 0, j = files.length; i < j; i++) {
			const v = files[i];
			const stat = fs.statSync(v);
			mtimes.push(stat.mtime.getTime());
		}
		const updateTime = Math.max.apply(this, mtimes);
		return updateTime;
	},
	async getUpdateTime(files) {
		const mtimes = [];
		for (let i = 0, j = files.length; i < j; i++) {
			const v = files[i];
			const stat = await fsStat(v);
			mtimes.push(stat.mtime.getTime());
		}
		const updateTime = Math.max.apply(this, mtimes);
		return updateTime;
	},
	getName(cwd, files, ext) {
		const name = files
			.map(item => {
				return path.basename(item, ext);
			})
			.join("-");
		return path.join(cwd, name);
	},

	getStatus() {
		const data = {
			pid: process.pid,
			node: process.version,
			os: process.platform + process.arch,
			freemem: Math.round(os.freemem() / 1048576),
			allmem: Math.round(os.totalmem() / 1048576),
			cpus: os.cpus(),
			load: os.loadavg(),
			uptime: process.uptime(),
			memory: process.memoryUsage()
		};
		return data;
	}
};

const maxItem = 1e3;
const caches = new Map();
var tool = {
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
	},
	getParams(args) {
		const kMap = {
			"-p": "port",
			"-d": "root",
			"--debug": "debug",
			"--clean": "clean"
		};
		const ret = {};
		const keys = Object.keys(kMap);
		let key;
		args.forEach(item => {
			if (keys.includes(item)) {
				if (item.substr(0, 2) == "--") {
					ret[kMap[item]] = true;
				} else {
					key = kMap[item];
				}
			} else if (key && item.toString().charAt(0) != "-") {
				ret[key] = item;
				key = null;
			} else {
				key = null;
			}
		});
		return ret;
	}
};

var compress = {
	compressLessReq(response, matches, query, cwd, config) {
		const key = matches[0].replace(".css", "");
		const files = key
			.split("-")
			.filter(item => item)
			.map(item => {
				return path.join(cwd, item) + ".less";
			});
		const options = { urlArgs: query.ver ? `ver=${query.ver}` : null, env: "development", useFileCache: false };

		return new Promise((resolve, reject) => {
			(async () => {
				try {
					const maxtime = await util$1.getUpdateTime(files);
					const { css, hit } = await this.compressLessCache(maxtime, key, files, options);
					response.writeHead(200, { "Content-Type": "text/css", "X-Cache": hit ? "hit" : "miss" });
					response.end(css);
					resolve(true);
				} catch (e) {
					const k = matches[0].replace(/\/static\//, "");
					const { css } = config.static;
					if (css) {
						const entry = Object.keys(css);
						if (entry.includes(k)) {
							const hotfiles = css[k].map(item => path.join(config.path, item));
							try {
								const mtime = await util$1.getUpdateTime(hotfiles);
								const { css, hit } = await this.compressLessCache(mtime, k, hotfiles, options);
								response.writeHead(200, { "Content-Type": "text/css", "X-Cache": hit ? "hit" : "miss" });
								response.end(css);
								resolve(true);
							} catch (e) {
								reject(e);
							}
						} else {
							resolve(false);
						}
					}
				}
			})();
		});
	},

	async compressLessCache(mtime, key, files, options) {
		const cache = tool.get(key);
		if (cache && cache.maxTime == mtime && options.urlArgs == cache.urlArgs) {
			return { css: cache.css, hit: true };
		}
		const ret = await this.compressLess(files, options);
		tool.set(key, { css: ret.css, urlArgs: options.urlArgs, maxTime: mtime });
		return { css: ret.css, hit: false };
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
		this.cleanLessCache(less, lessfiles);
		return new Promise((resolve, reject) => {
			less.render(lessInput, option)
				.then(resolve, reject)
				.catch(reject);
		});
	},

	cleanLessCache(less, files) {
		const fileManagers = (less.environment && less.environment.fileManagers) || [];
		fileManagers.forEach(fileManager => {
			if (fileManager.contents) {
				Object.keys(fileManager.contents).forEach(k => {
					if (files.includes(k)) {
						delete fileManager.contents[k];
					}
				});
			}
		});
	},

	compressJs(files, ops) {
		const f = utiljs.unique(files);
		let options;
		if (ops.debug) {
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
		} else {
			options = {
				mangle: true,
				compress: { sequences: true, properties: true, dead_code: true, unused: true, booleans: true, join_vars: true, if_return: true, conditionals: true }
			};
			if (ops.clean) {
				options.compress.drop_console = true;
				options.compress.drop_debugger = true;
				options.compress.evaluate = true;
				options.compress.loops = true;
			}
		}

		const UglifyJS = require("uglify-js");
		return new Promise((resolve, reject) => {
			this.getContent(f)
				.then(res => {
					const result = UglifyJS.minify(res, options);
					resolve(result);
				})
				.catch(reject);
		});
	},

	compressByConfig(config, params) {
		if (config && config.static) {
			const { css, js } = config.static;
			if (css) {
				Object.keys(css).forEach(item => {
					const files = css[item].map(item => path.join(config.path, item));
					const dst = path.join(config.path, item);
					this.compressLess(files, params)
						.then(res => {
							fs.writeFileSync(dst, res.css);
						})
						.catch(err => {
							console.error(err.toString());
						});
				});
			}
			if (js) {
				Object.keys(js).forEach(item => {
					const files = js[item].map(item => path.join(config.path, item));
					const dst = path.join(config.path, item);
					console.info(files, dst);
					this.compressJs(files, params)
						.then(res => {
							fs.writeFileSync(dst, res.code);
						})
						.catch(err => {
							console.error(err.toString());
						});
				});
			}
		}
	},

	getContent(files) {
		const arr = files.map(file => {
			return new Promise((resolve, reject) => {
				fs.readFile(file, "utf-8", function(err, data) {
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

var types = {
	"application/andrew-inset": ["ez"],
	"application/applixware": ["aw"],
	"application/atom+xml": ["atom"],
	"application/atomcat+xml": ["atomcat"],
	"application/atomsvc+xml": ["atomsvc"],
	"application/bdoc": ["bdoc"],
	"application/ccxml+xml": ["ccxml"],
	"application/cdmi-capability": ["cdmia"],
	"application/cdmi-container": ["cdmic"],
	"application/cdmi-domain": ["cdmid"],
	"application/cdmi-object": ["cdmio"],
	"application/cdmi-queue": ["cdmiq"],
	"application/cu-seeme": ["cu"],
	"application/dash+xml": ["mpd"],
	"application/davmount+xml": ["davmount"],
	"application/docbook+xml": ["dbk"],
	"application/dssc+der": ["dssc"],
	"application/dssc+xml": ["xdssc"],
	"application/ecmascript": ["ecma"],
	"application/emma+xml": ["emma"],
	"application/epub+zip": ["epub"],
	"application/exi": ["exi"],
	"application/font-tdpfr": ["pfr"],
	"application/font-woff": ["woff"],
	"application/geo+json": ["geojson"],
	"application/gml+xml": ["gml"],
	"application/gpx+xml": ["gpx"],
	"application/gxf": ["gxf"],
	"application/gzip": ["gz"],
	"application/hjson": ["hjson"],
	"application/hyperstudio": ["stk"],
	"application/inkml+xml": ["ink", "inkml"],
	"application/ipfix": ["ipfix"],
	"application/java-archive": ["jar", "war", "ear"],
	"application/java-serialized-object": ["ser"],
	"application/java-vm": ["class"],
	"application/javascript": ["js", "mjs"],
	"application/json": ["json", "map"],
	"application/json5": ["json5"],
	"application/jsonml+json": ["jsonml"],
	"application/ld+json": ["jsonld"],
	"application/lost+xml": ["lostxml"],
	"application/mac-binhex40": ["hqx"],
	"application/mac-compactpro": ["cpt"],
	"application/mads+xml": ["mads"],
	"application/manifest+json": ["webmanifest"],
	"application/marc": ["mrc"],
	"application/marcxml+xml": ["mrcx"],
	"application/mathematica": ["ma", "nb", "mb"],
	"application/mathml+xml": ["mathml"],
	"application/mbox": ["mbox"],
	"application/mediaservercontrol+xml": ["mscml"],
	"application/metalink+xml": ["metalink"],
	"application/metalink4+xml": ["meta4"],
	"application/mets+xml": ["mets"],
	"application/mods+xml": ["mods"],
	"application/mp21": ["m21", "mp21"],
	"application/mp4": ["mp4s", "m4p"],
	"application/msword": ["doc", "dot"],
	"application/mxf": ["mxf"],
	"application/octet-stream": [
		"bin",
		"dms",
		"lrf",
		"mar",
		"so",
		"dist",
		"distz",
		"pkg",
		"bpk",
		"dump",
		"elc",
		"deploy",
		"exe",
		"dll",
		"deb",
		"dmg",
		"iso",
		"img",
		"msi",
		"msp",
		"msm",
		"buffer"
	],
	"application/oda": ["oda"],
	"application/oebps-package+xml": ["opf"],
	"application/ogg": ["ogx"],
	"application/omdoc+xml": ["omdoc"],
	"application/onenote": ["onetoc", "onetoc2", "onetmp", "onepkg"],
	"application/oxps": ["oxps"],
	"application/patch-ops-error+xml": ["xer"],
	"application/pdf": ["pdf"],
	"application/pgp-encrypted": ["pgp"],
	"application/pgp-signature": ["asc", "sig"],
	"application/pics-rules": ["prf"],
	"application/pkcs10": ["p10"],
	"application/pkcs7-mime": ["p7m", "p7c"],
	"application/pkcs7-signature": ["p7s"],
	"application/pkcs8": ["p8"],
	"application/pkix-attr-cert": ["ac"],
	"application/pkix-cert": ["cer"],
	"application/pkix-crl": ["crl"],
	"application/pkix-pkipath": ["pkipath"],
	"application/pkixcmp": ["pki"],
	"application/pls+xml": ["pls"],
	"application/postscript": ["ai", "eps", "ps"],
	"application/pskc+xml": ["pskcxml"],
	"application/raml+yaml": ["raml"],
	"application/rdf+xml": ["rdf"],
	"application/reginfo+xml": ["rif"],
	"application/relax-ng-compact-syntax": ["rnc"],
	"application/resource-lists+xml": ["rl"],
	"application/resource-lists-diff+xml": ["rld"],
	"application/rls-services+xml": ["rs"],
	"application/rpki-ghostbusters": ["gbr"],
	"application/rpki-manifest": ["mft"],
	"application/rpki-roa": ["roa"],
	"application/rsd+xml": ["rsd"],
	"application/rss+xml": ["rss"],
	"application/rtf": ["rtf"],
	"application/sbml+xml": ["sbml"],
	"application/scvp-cv-request": ["scq"],
	"application/scvp-cv-response": ["scs"],
	"application/scvp-vp-request": ["spq"],
	"application/scvp-vp-response": ["spp"],
	"application/sdp": ["sdp"],
	"application/set-payment-initiation": ["setpay"],
	"application/set-registration-initiation": ["setreg"],
	"application/shf+xml": ["shf"],
	"application/smil+xml": ["smi", "smil"],
	"application/sparql-query": ["rq"],
	"application/sparql-results+xml": ["srx"],
	"application/srgs": ["gram"],
	"application/srgs+xml": ["grxml"],
	"application/sru+xml": ["sru"],
	"application/ssdl+xml": ["ssdl"],
	"application/ssml+xml": ["ssml"],
	"application/tei+xml": ["tei", "teicorpus"],
	"application/thraud+xml": ["tfi"],
	"application/timestamped-data": ["tsd"],
	"application/voicexml+xml": ["vxml"],
	"application/wasm": ["wasm"],
	"application/widget": ["wgt"],
	"application/winhlp": ["hlp"],
	"application/wsdl+xml": ["wsdl"],
	"application/wspolicy+xml": ["wspolicy"],
	"application/xaml+xml": ["xaml"],
	"application/xcap-diff+xml": ["xdf"],
	"application/xenc+xml": ["xenc"],
	"application/xhtml+xml": ["xhtml", "xht"],
	"application/xml": ["xml", "xsl", "xsd", "rng"],
	"application/xml-dtd": ["dtd"],
	"application/xop+xml": ["xop"],
	"application/xproc+xml": ["xpl"],
	"application/xslt+xml": ["xslt"],
	"application/xspf+xml": ["xspf"],
	"application/xv+xml": ["mxml", "xhvml", "xvml", "xvm"],
	"application/yang": ["yang"],
	"application/yin+xml": ["yin"],
	"application/zip": ["zip"],
	"audio/3gpp": ["*3gpp"],
	"audio/adpcm": ["adp"],
	"audio/basic": ["au", "snd"],
	"audio/midi": ["mid", "midi", "kar", "rmi"],
	"audio/mp3": ["*mp3"],
	"audio/mp4": ["m4a", "mp4a"],
	"audio/mpeg": ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"],
	"audio/ogg": ["oga", "ogg", "spx"],
	"audio/s3m": ["s3m"],
	"audio/silk": ["sil"],
	"audio/wav": ["wav"],
	"audio/wave": ["*wav"],
	"audio/webm": ["weba"],
	"audio/xm": ["xm"],
	"font/collection": ["ttc"],
	"font/otf": ["otf"],
	"font/ttf": ["ttf"],
	"font/woff": ["*woff"],
	"font/woff2": ["woff2"],
	"image/apng": ["apng"],
	"image/bmp": ["bmp"],
	"image/cgm": ["cgm"],
	"image/g3fax": ["g3"],
	"image/gif": ["gif"],
	"image/ief": ["ief"],
	"image/jp2": ["jp2", "jpg2"],
	"image/jpeg": ["jpeg", "jpg", "jpe"],
	"image/jpm": ["jpm"],
	"image/jpx": ["jpx", "jpf"],
	"image/ktx": ["ktx"],
	"image/png": ["png"],
	"image/sgi": ["sgi"],
	"image/svg+xml": ["svg", "svgz"],
	"image/tiff": ["tiff", "tif"],
	"image/webp": ["webp"],
	"message/disposition-notification": ["disposition-notification"],
	"message/global": ["u8msg"],
	"message/global-delivery-status": ["u8dsn"],
	"message/global-disposition-notification": ["u8mdn"],
	"message/global-headers": ["u8hdr"],
	"message/rfc822": ["eml", "mime"],
	"model/gltf+json": ["gltf"],
	"model/gltf-binary": ["glb"],
	"model/iges": ["igs", "iges"],
	"model/mesh": ["msh", "mesh", "silo"],
	"model/vrml": ["wrl", "vrml"],
	"model/x3d+binary": ["x3db", "x3dbz"],
	"model/x3d+vrml": ["x3dv", "x3dvz"],
	"model/x3d+xml": ["x3d", "x3dz"],
	"text/cache-manifest": ["appcache", "manifest"],
	"text/calendar": ["ics", "ifb"],
	"text/coffeescript": ["coffee", "litcoffee"],
	"text/css": ["css"],
	"text/csv": ["csv"],
	"text/html": ["html", "htm", "shtml"],
	"text/jade": ["jade"],
	"text/jsx": ["jsx"],
	"text/less": ["less"],
	"text/markdown": ["markdown", "md"],
	"text/mathml": ["mml"],
	"text/n3": ["n3"],
	"text/plain": ["txt", "text", "conf", "def", "list", "log", "in", "ini"],
	"text/richtext": ["rtx"],
	"text/rtf": ["*rtf"],
	"text/sgml": ["sgml", "sgm"],
	"text/shex": ["shex"],
	"text/slim": ["slim", "slm"],
	"text/stylus": ["stylus", "styl"],
	"text/tab-separated-values": ["tsv"],
	"text/troff": ["t", "tr", "roff", "man", "me", "ms"],
	"text/turtle": ["ttl"],
	"text/uri-list": ["uri", "uris", "urls"],
	"text/vcard": ["vcard"],
	"text/vtt": ["vtt"],
	"text/xml": ["*xml"],
	"text/yaml": ["yaml", "yml"],
	"video/3gpp": ["3gp", "3gpp"],
	"video/3gpp2": ["3g2"],
	"video/h261": ["h261"],
	"video/h263": ["h263"],
	"video/h264": ["h264"],
	"video/jpeg": ["jpgv"],
	"video/jpm": ["*jpm", "jpgm"],
	"video/mj2": ["mj2", "mjp2"],
	"video/mp2t": ["ts"],
	"video/mp4": ["mp4", "mp4v", "mpg4"],
	"video/mpeg": ["mpeg", "mpg", "mpe", "m1v", "m2v"],
	"video/ogg": ["ogv"],
	"video/quicktime": ["qt", "mov"],
	"video/webm": ["webm"]
};

const typesMap = {};

Object.keys(types).forEach(k => {
	const item = types[k];
	item.forEach(i => {
		typesMap[i] = k;
	});
});

const defaultMime = "application/octet-stream";

var mime = {
	lookup(filePath) {
		const t = filePath.split(".").pop();
		const type = typesMap[t];
		return type ? type : defaultMime;
	}
};

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
const defaultRoot = process$1.cwd();
const index = "index.html";

class httpserver {
	constructor(cfg) {
		const { port, root } = cfg;
		this.port = port || process$1.env.PORT || defaultPort;
		this.root = root || defaultRoot;
	}
	start(config) {
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
							return regRouter
								.handler(response, regRouter.matches, query, this.root, config)
								.then(res => {
									if (!res) {
										this.tryfile(response, pathinfo);
									}
								})
								.catch(e => {
									const err = e.toString();
									tool.log(err);
									this.err500(response, err);
								});
						} else {
							return this.tryfile(response, pathinfo);
						}
					}
				}
				this.err404(response);
			} catch (e) {
				const err = e.toString();
				tool.log(err);
				this.err500(response, err);
			}
		}).listen(this.port);
		console.log("Server running at http://127.0.0.1:%s", this.port);
	}

	noIndex(request, response, pathinfo, query) {
		const file = path.join(this.root, index);
		fs.stat(file, (err, stat) => {
			if (err) {
				const info = util$1.getStatus();
				response.writeHead(200, { "Content-Type": "application/json" });
				return response.end(JSON.stringify(info));
			}
			sendFile(response, stat, file);
		});
	}

	tryfile(response, filePath) {
		const file = path.join(this.root, filePath);
		fs.stat(file, (err, stat) => {
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

const spawnSync = child_process.spawnSync;
const prettyTypes = ["js", "vue", "jsx", "json", "css", "less", "ts", "md"];
const esTypes = ["js", "jsx", "vue"];

const configDir = "config";

const exit = code => process.exit(code);

class lint {
	constructor(cwd, files) {
		this.cwd = cwd;
		if (Array.isArray(files) && files.length > 0) {
			this.prettierrc = path.join(this.cwd, configDir, ".prettierrc");
			this.eslintrc = path.join(this.cwd, configDir, ".eslintrc.js");
			this.files = this.parse(files);
		}
	}
	parse(files) {
		return files.map(item => {
			const name = item.trim();
			const type = item.split(".").pop();
			let p = name;
			if (!path.isAbsolute(name)) {
				p = path.join(this.cwd, name);
			}
			return { name, path: p, type };
		});
	}
	lint() {
		try {
			fs.accessSync(this.prettierrc, fs.constants.R_OK | fs.constants.W_OK);
		} catch (err) {
			console.error(`${this.prettierrc} Not Exist`);
			exit(1);
		}
		try {
			fs.accessSync(this.eslintrc, fs.constants.R_OK | fs.constants.W_OK);
		} catch (err) {
			console.error(`${this.eslintrc} Not Exist`);
			exit(1);
		}
		for (let i = 0, j = this.files.length; i < j; i++) {
			const { path: path$$1, type, name } = this.files[i];

			fs.access(path$$1, fs.constants.R_OK | fs.constants.W_OK, err => {
				if (err) {
					console.error(`${path$$1} Not Exist`);
					exit(1);
					return;
				}
				this.dolint(path$$1, type.toLowerCase(), name);
			});
		}
	}

	dolint(path$$1, type, name) {
		if (prettyTypes.includes(type)) {
			const r1 = this.prettier(path$$1);
			if (r1.status !== 0) {
				exit(r1.status);
			}
		}

		if (esTypes.includes(type)) {
			const r2 = this.eslint(path$$1);
			if (r2.status !== 0) {
				exit(r2.status);
			}
		}
		this.gitadd(path$$1);
	}

	eslint(f) {
		return spawnSync("eslint", ["-c", this.eslintrc, "--fix", f], { stdio: "inherit" });
	}
	prettier(f) {
		return spawnSync("prettier", ["-c", this.prettierrc, "--write", f], { stdio: "inherit" });
	}
	gitadd(f) {
		return spawnSync("git", ["add", f], { stdio: "inherit" });
	}
	install() {
		const git = ".git";
		const hooks = "hooks";
		const precommit = "pre-commit";
		const postcommit = "post-commit";
		const prehook = path.join(this.cwd, configDir, precommit);
		const posthook = path.join(this.cwd, configDir, postcommit);

		const dst = path.join(this.cwd, git, hooks, precommit);
		const postdst = path.join(this.cwd, git, hooks, postcommit);

		try {
			fs.accessSync(prehook, fs.constants.R_OK | fs.constants.W_OK);
		} catch (err) {
			console.error(err.toString());
			exit(1);
		}
		fs.copyFileSync(prehook, dst);
		try {
			fs.accessSync(posthook, fs.constants.R_OK | fs.constants.W_OK);
		} catch (err) {
			console.error(err.toString());
			exit(1);
		}
		fs.copyFileSync(posthook, postdst);
		const mode = 0o755;
		fs.chmodSync(dst, mode);
		fs.chmodSync(postdst, mode);
	}
}

const configName = "static.json";

class server {
	constructor(cwd) {
		this.cwd = cwd;
	}

	serve(args) {
		const params = utiljs.getParams(args);
		const config = util$1.getConfig(this.cwd, configName);
		new httpserver(params).start(config);
	}

	run(args) {}

	lint(args) {}

	gitlint(args) {
		new lint(this.cwd, args).lint();
	}

	install(args) {
		new lint(this.cwd, args).install();
	}

	compress(args) {
		const config = util$1.getConfig(this.cwd, configName);
		const params = utiljs.getParams(args);
		const filed = args.filter(item => item.charAt(0) !== "-").length;
		if (args && args.length > 0 && filed) {
			const less = args
				.filter(item => {
					return item.split(".").pop() == "less";
				})
				.map(item => {
					return path.join(this.cwd, item);
				});
			const js = args
				.filter(item => {
					return item.split(".").pop() == "js";
				})
				.map(item => {
					return path.join(this.cwd, item);
				});

			compress
				.compressLess(less, params)
				.then(res => {
					const file = util$1.getName(this.cwd, less, ".less");
					fs.writeFileSync(`${file}.min.css`, res.css);
				})
				.catch(err => {
					console.error(err.toString());
				});
			compress
				.compressJs(js, params)
				.then(res => {
					const file = util$1.getName(this.cwd, js, ".js");
					fs.writeFileSync(`${file}.min.js`, res.code);
				})
				.catch(err => {
					console.error(err.toString());
				});
		} else {
			compress.compressByConfig(config, params);
		}
	}
}

var help = `
Usage:
	air [command] [flag]
Commands:
	serve		  	start air http server
	lint			eslint js
	compress		compress less or javascript files
	install			install git hooks
Flags:
	-v     			show air version
	-h      		show this help information
	-p     			set server listen port
	-d     			set server document root
	--debug			compress with debug mode
	--clean			compress with clean mode
`;

const version = "0.6.0";

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
	}
	runArgs() {
		const [m, ...args] = this.args;
		const f = this.server[m];
		if (utiljs.isFunction(f)) {
			return f.call(this.server, args);
		}
		return this.fallback(m, args);
	}
	runInit() {
		this.server.serve([]);
	}

	fallback(m, args) {
		if (m == "-v") {
			this.showVersion();
		} else if (m == "-h") {
			this.showHelp();
		} else {
			this.server.serve([m, ...args]);
		}
	}

	showHelp() {
		console.info(help);
	}

	showVersion() {
		console.log("air version: air/" + version);
	}
}

new cli(new server(process$1.cwd())).run(process$1.argv);

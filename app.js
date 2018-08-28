'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var process = _interopDefault(require('process'));
var fs = _interopDefault(require('fs'));
var util = _interopDefault(require('util'));
var path = _interopDefault(require('path'));
var os = _interopDefault(require('os'));
var http = _interopDefault(require('http'));
var querystring = _interopDefault(require('querystring'));
var child_process = _interopDefault(require('child_process'));

const fsStat = util.promisify(fs.stat);
const fsAccess = util.promisify(fs.access);

const fsWriteFile = util.promisify(fs.writeFile);

const fsCopyFile = util.promisify(fs.copyFile);

const fsChmod = util.promisify(fs.chmod);

var utilnode = {
	resolveLookupPaths(pathstr, file) {
		const arr = [];
		const tmp = [];
		pathstr.split(path.sep).forEach(item => {
			if (/^[a-zA-Z]:$/.test(item)) {
				// for windows
				return;
			}
			tmp.push(item);
			arr.push(path.resolve(path.join(path.sep, ...tmp, file)));
		});
		return arr.reverse();
	},
	getConfig(cwd, name) {
		if (!/static$/.test(cwd)) {
			cwd = path.join(cwd, 'static');
		}
		const paths = this.resolveLookupPaths(cwd, name);
		return new Promise((resolve, reject) => {
			(async () => {
				let f,
					json = {};
				try {
					f = await this.tryFiles(paths);
				} catch (e) {
					// no config found
				}
				if (f) {
					try {
						json = require(f);
						json.path = path.dirname(f);
					} catch (e) {
						reject(e);
					}
				}
				resolve(json);
			})();
		});
	},
	tryFiles(paths) {
		return new Promise(async (resolve, reject) => {
			for (let i = 0, j = paths.length; i < j; i++) {
				const file = paths[i];
				try {
					await fsAccess(file, fs.constants.R_OK);
					resolve(file);
					return;
				} catch (e) {
					// not exist try next
				}
			}
			reject('not exist');
		});
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
			.join('-');
		return path.join(cwd, name);
	},

	getStatus() {
		const data = {
			pid: process.pid,
			node: process.version,
			os: process.platform + process.arch,
			uptime: process.uptime()
		};
		return data;
	},

	exit(e, code) {
		const str = e.toString() + os.EOL;
		process.stderr.write(str);
		process.exit(code);
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
		msg = nowDate.toLocaleDateString() + ' ' + nowDate.toLocaleTimeString() + ' ' + msg;
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
		return typeof value === 'function';
	},
	isObject(value) {
		return value && typeof value === 'object' && value.constructor === Object;
	},
	unique(arr) {
		return Array.from(new Set(arr));
	},
	getParams(args) {
		const kMap = {
			'-p': 'port',
			'-d': 'root',
			'-o': 'output',
			'--escape': 'escape',
			'--debug': 'debug',
			'--clean': 'clean',
			'--dry': 'dry',
			'--art': 'art'
		};
		return this.params(args, kMap);
	},
	params(args, kMap) {
		const ret = {};
		const keys = Object.keys(kMap);
		let key;
		args.forEach(item => {
			if (keys.includes(item)) {
				if (item.substr(0, 2) == '--') {
					ret[kMap[item]] = true;
				} else {
					key = kMap[item];
				}
			} else if (key && item.toString().charAt(0) != '-') {
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
		const key = matches[0].replace('.css', '');
		const dirs = key.split('/');
		const segment = dirs.pop();
		const files = utiljs.unique(
			segment
				.split('-')
				.filter(item => item)
				.map(item => {
					return path.join(cwd, ...dirs, item) + '.less';
				})
		);
		const options = { urlArgs: query.ver ? `ver=${query.ver}` : null, env: 'development', useFileCache: false };

		return new Promise((resolve, reject) => {
			(async () => {
				try {
					const maxtime = await utilnode.getUpdateTime(files);
					try {
						const { css, hit } = await this.compressLessCache(maxtime, key, files, options);
						response.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'public,max-age=5', 'X-Cache': hit ? 'hit' : 'miss' });
						response.end(css);
						resolve(true);
					} catch (e) {
						reject(e);
					}
				} catch (e) {
					if (e.syscall !== 'stat') {
						return reject(e);
					}
					const k = matches[0].replace(/\/static\//, '');
					if (!config.static) {
						return resolve(false);
					}
					const { css } = config.static;
					if (css) {
						const entry = Object.keys(css);
						if (entry.includes(k)) {
							const hotfiles = css[k].map(item => path.join(config.path, item));
							try {
								const mtime = await utilnode.getUpdateTime(hotfiles);
								const { css, hit } = await this.compressLessCache(mtime, k, hotfiles, options);
								response.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'public,max-age=5', 'X-Cache': hit ? 'hit' : 'miss' });
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
		const cache = log.get(key);
		if (cache && cache.maxTime == mtime && options.urlArgs == cache.urlArgs) {
			return { css: cache.css, hit: true };
		}
		const ret = await this.compressLess(files, options);
		log.set(key, { css: ret.css, urlArgs: options.urlArgs, maxTime: mtime });
		return { css: ret.css, hit: false };
	},

	compressLess(files, options) {
		let { paths, urlArgs, compress, useFileCache, env } = options || {};
		const lessfiles = utiljs.unique(files);
		var lessInput = lessfiles
			.map(function(item) {
				return '@import "' + item + '";';
			})
			.join('\r\n');
		const less = require('less');
		const autoprefix = require('less-plugin-autoprefix');
		const option = { plugins: [new autoprefix({ browsers: ['last 5 versions', 'ie > 8', 'Firefox ESR'] })], paths, urlArgs, compress, useFileCache, env };
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

	compressJsReg(response, matches, query, cwd, config) {
		const key = matches[0].replace('.js', '');
		const dirs = key.split('/');
		const segment = dirs.pop();
		const files = utiljs.unique(
			segment
				.split('-')
				.filter(item => item)
				.map(item => {
					return path.join(cwd, ...dirs, item) + '.js';
				})
		);
		const options = { debug: true };

		return new Promise((resolve, reject) => {
			(async () => {
				try {
					const maxtime = await utilnode.getUpdateTime(files);
					if (files.length === 1) {
						// 直接请求一个js文件并且存在,让他直接使用静态文件
						return resolve(false);
					}
					const { js, hit } = await this.compressJsCache(maxtime, key, files, options);
					response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'public,max-age=5', 'X-Cache': hit ? 'hit' : 'miss' });
					response.end(js);
					resolve(true);
				} catch (e) {
					const k = matches[0].replace(/\/static\//, '');
					if (!config.static) {
						return resolve(false);
					}
					const { js } = config.static;
					if (js) {
						const entry = Object.keys(js);
						if (entry.includes(k)) {
							const hotfiles = js[k].map(item => path.join(config.path, item));
							try {
								const mtime = await utilnode.getUpdateTime(hotfiles);
								const { js, hit } = await this.compressJsCache(mtime, k, hotfiles, options);
								response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'public,max-age=5', 'X-Cache': hit ? 'hit' : 'miss' });
								response.end(js);
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

	async compressJsCache(mtime, key, files, options) {
		const cache = log.get(key);
		if (cache && cache.maxTime == mtime) {
			return { js: cache.js, hit: true };
		}
		const ret = await this.compressJs(files, options);
		log.set(key, { js: ret.code, maxTime: mtime });
		return { js: ret.code, hit: false };
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

		const UglifyJS = require('uglify-js');
		return new Promise((resolve, reject) => {
			this.getContent(f)
				.then(res => {
					const result = UglifyJS.minify(res, options);
					const er = result.error;
					if (er) {
						const s = er.toString();
						const { filename, line, col, pos } = er;
						er.toString = () => {
							return `${filename}: ${s} on line ${line}, ${col}:${pos}`;
						};
						return reject(er);
					}
					resolve(result);
				})
				.catch(reject);
		});
	},

	compressByConfig(config, params) {
		if (config && config.static) {
			const { css, js } = config.static;
			if (css) {
				Object.keys(css).forEach(async item => {
					const files = css[item].map(item => path.join(config.path, item));
					const dst = path.join(config.path, item);
					const lessOps = Object.assign({ compress: params.debug ? false : true }, params);
					const res = await this.compressLess(files, lessOps);
					await fsWriteFile(dst, res.css);
				});
			}
			if (js) {
				Object.keys(js).forEach(async item => {
					const files = js[item].map(item => path.join(config.path, item));
					const dst = path.join(config.path, item);
					const res = await this.compressJs(files, params);
					await fsWriteFile(dst, res.code);
				});
			}
		}
	},

	getContent(files) {
		const arr = files.map(file => {
			return new Promise((resolve, reject) => {
				fs.readFile(file, 'utf-8', function(err, data) {
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

const readFile = util.promisify(fs.readFile);

const includefile = /<!--#\s{1,5}include\s{1,5}file="([\w+/.]{3,50})"\s{1,5}-->/g;

var ssi = {
	load(response, matches, query, cwd, config, params) {
		const file = matches[0];
		return this.loadHtml(response, file, query, cwd, config, params);
	},
	loadHtml(response, file, query, cwd, config, params) {
		if (params.art) {
			return this.artHtml(response, file, query, cwd, config, params);
		}
		return new Promise((resolve, reject) => {
			(async () => {
				try {
					const main = path.join(cwd, file);
					const res = await this.parseHtml(main, query, cwd);
					if (res) {
						response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'public,max-age=5' });
						response.end(res);
						resolve(true);
					} else {
						resolve(false);
					}
				} catch (e) {
					reject(e);
				}
			})();
		});
	},
	artHtml(response, file, query, cwd, config, params) {
		if (file.charAt(0) == '/') {
			file = file.substr(1);
		}
		const template = require('art-template');
		const debug = !!params.debug;
		const escape = !!params.escape;
		const options = {
			debug: debug,
			minimize: !debug,
			compileDebug: debug,
			escape: escape,
			root: cwd,
			cache: false
		};
		Object.assign(template.defaults, options);
		const dstfile = path.join(cwd, file);
		return new Promise((resolve, reject) => {
			try {
				let data = query;
				if (config.template && config.template[file]) {
					const v = config.template[file];
					let r = {};
					if (utiljs.isObject(v)) {
						r = v;
					} else {
						const datafile = path.join(cwd, config.template[file]);
						r = require(datafile);
					}
					data = Object.assign({}, data, r);
				}
				const html = template(dstfile, data);
				response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'public,max-age=5' });
				response.end(html);
				resolve(true);
			} catch (e) {
				console.error(e);
				reject(e);
			}
		});
	},
	async parseHtml(file, query, cwd) {
		let html;
		try {
			const res = await readFile(file);
			html = res.toString();
		} catch (e) {
			return false;
		}

		let res,
			i = 0,
			filesMap = {},
			matches = {};

		while (i < 6) {
			while ((res = includefile.exec(html))) {
				const [holder, file] = res;
				matches[holder] = file;
				if (!filesMap[file]) {
					filesMap[file] = '';
				}
			}
			if (i == 0 && Object.keys(filesMap).length == 0) {
				return false;
			}
			i++;
			if (Object.keys(matches).length === 0) {
				// 已找到最后
				return html;
			}
			if (i > 5) {
				throw new Error('include file too deep');
			}
			await this.fillContents(query, cwd, filesMap);
			Object.keys(matches).forEach(item => {
				const file = matches[item];
				const content = filesMap[file];
				html = html.replace(item, content);
			});
			matches = {};
		}
	},
	async fillContents(query, cwd, filesMap) {
		let res;
		let fileList = Object.keys(filesMap).filter(item => {
			return !filesMap[item];
		});
		try {
			res = await Promise.all(
				fileList.map(item => {
					return readFile(path.join(cwd, item));
				})
			);
		} catch (e) {
			throw e;
		}
		res.forEach((item, i) => {
			filesMap[fileList[i]] = item.toString();
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
		reg: /[\w\-/]+\.css$/,
		handler: compress.compressLessReq.bind(compress)
	},
	{
		reg: /[\w\-/]+\.js$/,
		handler: compress.compressJsReg.bind(compress)
	},
	{
		reg: /[\w\-/]+\.html$/,
		handler: ssi.load.bind(ssi)
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
	'application/andrew-inset': ['ez'],
	'application/applixware': ['aw'],
	'application/atom+xml': ['atom'],
	'application/atomcat+xml': ['atomcat'],
	'application/atomsvc+xml': ['atomsvc'],
	'application/bdoc': ['bdoc'],
	'application/ccxml+xml': ['ccxml'],
	'application/cdmi-capability': ['cdmia'],
	'application/cdmi-container': ['cdmic'],
	'application/cdmi-domain': ['cdmid'],
	'application/cdmi-object': ['cdmio'],
	'application/cdmi-queue': ['cdmiq'],
	'application/cu-seeme': ['cu'],
	'application/dash+xml': ['mpd'],
	'application/davmount+xml': ['davmount'],
	'application/docbook+xml': ['dbk'],
	'application/dssc+der': ['dssc'],
	'application/dssc+xml': ['xdssc'],
	'application/ecmascript': ['ecma'],
	'application/emma+xml': ['emma'],
	'application/epub+zip': ['epub'],
	'application/exi': ['exi'],
	'application/font-tdpfr': ['pfr'],
	'application/font-woff': ['woff'],
	'application/geo+json': ['geojson'],
	'application/gml+xml': ['gml'],
	'application/gpx+xml': ['gpx'],
	'application/gxf': ['gxf'],
	'application/gzip': ['gz'],
	'application/hjson': ['hjson'],
	'application/hyperstudio': ['stk'],
	'application/inkml+xml': ['ink', 'inkml'],
	'application/ipfix': ['ipfix'],
	'application/java-archive': ['jar', 'war', 'ear'],
	'application/java-serialized-object': ['ser'],
	'application/java-vm': ['class'],
	'application/javascript': ['js', 'mjs'],
	'application/json': ['json', 'map'],
	'application/json5': ['json5'],
	'application/jsonml+json': ['jsonml'],
	'application/ld+json': ['jsonld'],
	'application/lost+xml': ['lostxml'],
	'application/mac-binhex40': ['hqx'],
	'application/mac-compactpro': ['cpt'],
	'application/mads+xml': ['mads'],
	'application/manifest+json': ['webmanifest'],
	'application/marc': ['mrc'],
	'application/marcxml+xml': ['mrcx'],
	'application/mathematica': ['ma', 'nb', 'mb'],
	'application/mathml+xml': ['mathml'],
	'application/mbox': ['mbox'],
	'application/mediaservercontrol+xml': ['mscml'],
	'application/metalink+xml': ['metalink'],
	'application/metalink4+xml': ['meta4'],
	'application/mets+xml': ['mets'],
	'application/mods+xml': ['mods'],
	'application/mp21': ['m21', 'mp21'],
	'application/mp4': ['mp4s', 'm4p'],
	'application/msword': ['doc', 'dot'],
	'application/mxf': ['mxf'],
	'application/octet-stream': [
		'bin',
		'dms',
		'lrf',
		'mar',
		'so',
		'dist',
		'distz',
		'pkg',
		'bpk',
		'dump',
		'elc',
		'deploy',
		'exe',
		'dll',
		'deb',
		'dmg',
		'iso',
		'img',
		'msi',
		'msp',
		'msm',
		'buffer'
	],
	'application/oda': ['oda'],
	'application/oebps-package+xml': ['opf'],
	'application/ogg': ['ogx'],
	'application/omdoc+xml': ['omdoc'],
	'application/onenote': ['onetoc', 'onetoc2', 'onetmp', 'onepkg'],
	'application/oxps': ['oxps'],
	'application/patch-ops-error+xml': ['xer'],
	'application/pdf': ['pdf'],
	'application/pgp-encrypted': ['pgp'],
	'application/pgp-signature': ['asc', 'sig'],
	'application/pics-rules': ['prf'],
	'application/pkcs10': ['p10'],
	'application/pkcs7-mime': ['p7m', 'p7c'],
	'application/pkcs7-signature': ['p7s'],
	'application/pkcs8': ['p8'],
	'application/pkix-attr-cert': ['ac'],
	'application/pkix-cert': ['cer'],
	'application/pkix-crl': ['crl'],
	'application/pkix-pkipath': ['pkipath'],
	'application/pkixcmp': ['pki'],
	'application/pls+xml': ['pls'],
	'application/postscript': ['ai', 'eps', 'ps'],
	'application/pskc+xml': ['pskcxml'],
	'application/raml+yaml': ['raml'],
	'application/rdf+xml': ['rdf'],
	'application/reginfo+xml': ['rif'],
	'application/relax-ng-compact-syntax': ['rnc'],
	'application/resource-lists+xml': ['rl'],
	'application/resource-lists-diff+xml': ['rld'],
	'application/rls-services+xml': ['rs'],
	'application/rpki-ghostbusters': ['gbr'],
	'application/rpki-manifest': ['mft'],
	'application/rpki-roa': ['roa'],
	'application/rsd+xml': ['rsd'],
	'application/rss+xml': ['rss'],
	'application/rtf': ['rtf'],
	'application/sbml+xml': ['sbml'],
	'application/scvp-cv-request': ['scq'],
	'application/scvp-cv-response': ['scs'],
	'application/scvp-vp-request': ['spq'],
	'application/scvp-vp-response': ['spp'],
	'application/sdp': ['sdp'],
	'application/set-payment-initiation': ['setpay'],
	'application/set-registration-initiation': ['setreg'],
	'application/shf+xml': ['shf'],
	'application/smil+xml': ['smi', 'smil'],
	'application/sparql-query': ['rq'],
	'application/sparql-results+xml': ['srx'],
	'application/srgs': ['gram'],
	'application/srgs+xml': ['grxml'],
	'application/sru+xml': ['sru'],
	'application/ssdl+xml': ['ssdl'],
	'application/ssml+xml': ['ssml'],
	'application/tei+xml': ['tei', 'teicorpus'],
	'application/thraud+xml': ['tfi'],
	'application/timestamped-data': ['tsd'],
	'application/voicexml+xml': ['vxml'],
	'application/wasm': ['wasm'],
	'application/widget': ['wgt'],
	'application/winhlp': ['hlp'],
	'application/wsdl+xml': ['wsdl'],
	'application/wspolicy+xml': ['wspolicy'],
	'application/xaml+xml': ['xaml'],
	'application/xcap-diff+xml': ['xdf'],
	'application/xenc+xml': ['xenc'],
	'application/xhtml+xml': ['xhtml', 'xht'],
	'application/xml': ['xml', 'xsl', 'xsd', 'rng'],
	'application/xml-dtd': ['dtd'],
	'application/xop+xml': ['xop'],
	'application/xproc+xml': ['xpl'],
	'application/xslt+xml': ['xslt'],
	'application/xspf+xml': ['xspf'],
	'application/xv+xml': ['mxml', 'xhvml', 'xvml', 'xvm'],
	'application/yang': ['yang'],
	'application/yin+xml': ['yin'],
	'application/zip': ['zip'],
	'audio/3gpp': ['*3gpp'],
	'audio/adpcm': ['adp'],
	'audio/basic': ['au', 'snd'],
	'audio/midi': ['mid', 'midi', 'kar', 'rmi'],
	'audio/mp3': ['*mp3'],
	'audio/mp4': ['m4a', 'mp4a'],
	'audio/mpeg': ['mpga', 'mp2', 'mp2a', 'mp3', 'm2a', 'm3a'],
	'audio/ogg': ['oga', 'ogg', 'spx'],
	'audio/s3m': ['s3m'],
	'audio/silk': ['sil'],
	'audio/wav': ['wav'],
	'audio/wave': ['*wav'],
	'audio/webm': ['weba'],
	'audio/xm': ['xm'],
	'font/collection': ['ttc'],
	'font/otf': ['otf'],
	'font/ttf': ['ttf'],
	'font/woff': ['*woff'],
	'font/woff2': ['woff2'],
	'image/apng': ['apng'],
	'image/bmp': ['bmp'],
	'image/cgm': ['cgm'],
	'image/g3fax': ['g3'],
	'image/gif': ['gif'],
	'image/ief': ['ief'],
	'image/jp2': ['jp2', 'jpg2'],
	'image/jpeg': ['jpeg', 'jpg', 'jpe'],
	'image/jpm': ['jpm'],
	'image/jpx': ['jpx', 'jpf'],
	'image/ktx': ['ktx'],
	'image/png': ['png'],
	'image/sgi': ['sgi'],
	'image/svg+xml': ['svg', 'svgz'],
	'image/tiff': ['tiff', 'tif'],
	'image/webp': ['webp'],
	'message/disposition-notification': ['disposition-notification'],
	'message/global': ['u8msg'],
	'message/global-delivery-status': ['u8dsn'],
	'message/global-disposition-notification': ['u8mdn'],
	'message/global-headers': ['u8hdr'],
	'message/rfc822': ['eml', 'mime'],
	'model/gltf+json': ['gltf'],
	'model/gltf-binary': ['glb'],
	'model/iges': ['igs', 'iges'],
	'model/mesh': ['msh', 'mesh', 'silo'],
	'model/vrml': ['wrl', 'vrml'],
	'model/x3d+binary': ['x3db', 'x3dbz'],
	'model/x3d+vrml': ['x3dv', 'x3dvz'],
	'model/x3d+xml': ['x3d', 'x3dz'],
	'text/cache-manifest': ['appcache', 'manifest'],
	'text/calendar': ['ics', 'ifb'],
	'text/coffeescript': ['coffee', 'litcoffee'],
	'text/css': ['css'],
	'text/csv': ['csv'],
	'text/html': ['html', 'htm', 'shtml'],
	'text/jade': ['jade'],
	'text/jsx': ['jsx'],
	'text/less': ['less'],
	'text/markdown': ['markdown', 'md'],
	'text/mathml': ['mml'],
	'text/n3': ['n3'],
	'text/plain': ['txt', 'text', 'conf', 'def', 'list', 'log', 'in', 'ini'],
	'text/richtext': ['rtx'],
	'text/rtf': ['*rtf'],
	'text/sgml': ['sgml', 'sgm'],
	'text/shex': ['shex'],
	'text/slim': ['slim', 'slm'],
	'text/stylus': ['stylus', 'styl'],
	'text/tab-separated-values': ['tsv'],
	'text/troff': ['t', 'tr', 'roff', 'man', 'me', 'ms'],
	'text/turtle': ['ttl'],
	'text/uri-list': ['uri', 'uris', 'urls'],
	'text/vcard': ['vcard'],
	'text/vtt': ['vtt'],
	'text/xml': ['*xml'],
	'text/yaml': ['yaml', 'yml'],
	'video/3gpp': ['3gp', '3gpp'],
	'video/3gpp2': ['3g2'],
	'video/h261': ['h261'],
	'video/h263': ['h263'],
	'video/h264': ['h264'],
	'video/jpeg': ['jpgv'],
	'video/jpm': ['*jpm', 'jpgm'],
	'video/mj2': ['mj2', 'mjp2'],
	'video/mp2t': ['ts'],
	'video/mp4': ['mp4', 'mp4v', 'mpg4'],
	'video/mpeg': ['mpeg', 'mpg', 'mpe', 'm1v', 'm2v'],
	'video/ogg': ['ogv'],
	'video/quicktime': ['qt', 'mov'],
	'video/webm': ['webm']
};

const typesMap = {};

Object.keys(types).forEach(k => {
	const item = types[k];
	item.forEach(i => {
		typesMap[i] = k;
	});
});

const defaultMime = 'application/octet-stream';

var mime = {
	lookup(filePath) {
		const t = filePath.split('.').pop();
		const type = typesMap[t];
		return type ? type : defaultMime;
	}
};

var sendFile = (response, stat, filePath) => {
	const type = mime.lookup(filePath);
	response.writeHead(200, {
		'Content-Type': type,
		'Content-Length': stat.size
	});
	const readStream = fs.createReadStream(filePath);
	readStream.pipe(response);
};

const defaultPort = 8088;
const defaultRoot = process.cwd();
const index = 'index.html';

class httpserver {
	constructor(params) {
		const { port, root } = params;
		this.port = port || process.env.PORT || defaultPort;
		this.root = root || defaultRoot;
		this.params = params;
		if (!(this.port > 1 && this.port < 65535)) {
			console.error('port %s error,should be 1-65535', this.port);
			process.exit(1);
		}
	}
	start(config) {
		http.createServer((request, response) => {
			try {
				const [pathinfo, qs] = decodeURI(request.url).split('?');
				const query = querystring.parse(qs);
				if (this.params.dry) {
					return this.tryfile(response, pathinfo);
				}
				const [fn, ...args] = pathinfo.split('/').filter(item => item);
				if (!fn) {
					return this.noIndex(request, response, pathinfo, query, config);
				}
				const router = route.getRouter(request.method);
				if (router) {
					const m = router[fn];
					if (utiljs.isFunction(m)) {
						// 优先级1 预定义函数
						return m(request, response, args, query);
					} else {
						// 优先级2 预处理文件 , 优先级3 静态文件
						const regRouter = route.getRegxpRouter(request.method, pathinfo);
						if (regRouter) {
							return regRouter
								.handler(response, regRouter.matches, query, this.root, config, this.params)
								.then(res => {
									if (!res) {
										this.tryfile(response, pathinfo);
									}
								})
								.catch(e => {
									const err = e.toString();
									log.log(err);
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
				log.log(err);
				this.err500(response, err);
			}
		})
			.listen(this.port)
			.on('error', err => {
				console.info(err.toString());
			});
		console.log('Server running at http://127.0.0.1:%s', this.port);
	}

	noIndex(request, response, pathinfo, query, config) {
		const file = path.join(this.root, index);
		fs.stat(file, (err, stat) => {
			if (err) {
				const info = utilnode.getStatus();
				response.writeHead(200, { 'Content-Type': 'application/json' });
				return response.end(JSON.stringify(info));
			}
			(async () => {
				try {
					await ssi.loadHtml(response, index, query, this.root, config, this.params).then(res => {
						if (!res) {
							return sendFile(response, stat, file);
						}
					});
				} catch (e) {
					this.err500(response, e.toString());
				}
			})();
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
		response.writeHead(404, { 'Content-Type': 'text/plain' });
		response.end('Not Found\n');
	}

	err500(response, err) {
		response.writeHead(500, { 'Content-Type': 'text/plain' });
		response.end(err + '\n');
	}
}

const spawn = util.promisify(child_process.spawn);
const spawnSync = child_process.spawnSync;

const prettyTypes = ['js', 'vue', 'jsx', 'json', 'css', 'less', 'ts', 'md'];
const esTypes = ['js', 'jsx', 'vue'];

const options = {
	dir: 'config',
	git: '.git',
	hooks: 'hooks',
	precommit: 'pre-commit',
	postcommit: 'post-commit',
	prettierrc: '.prettierrc',
	eslintrc: '.eslintrc.js'
};
const stat = fs.constants.R_OK | fs.constants.W_OK;

const spawnOps = { stdio: 'inherit', shell: true };

const exit = code => process.exit(code);

class lint {
	constructor(cwd, files) {
		this.cwd = cwd;
		this.args = [...files];
		if (Array.isArray(files) && files.length > 0) {
			const opts = utiljs.params(this.args, { '-dir': 'dir' });
			const { dir, prettierrc, eslintrc } = Object.assign({}, options, opts);
			const cwd = path.isAbsolute(dir) ? '' : this.cwd;
			this.prettierrc = path.join(cwd, dir, prettierrc);
			this.eslintrc = path.join(cwd, dir, eslintrc);
			const index = files.findIndex(item => item == '-dir');
			if (index >= 0) {
				const len = opts.dir ? 2 : 1;
				files.splice(index, len);
			}
			this.files = this.parse(files);
		}
	}
	parse(files) {
		return files.map(item => {
			const name = item.trim();
			const type = item.split('.').pop();
			let p = name;
			if (!path.isAbsolute(name)) {
				p = path.join(this.cwd, name);
			}
			return { name, path: p, type };
		});
	}
	async lint() {
		if (!(this.prettierrc && this.eslintrc)) {
			return;
		}

		try {
			let esfiles = [],
				prefiles = [];
			await Promise.all([fsAccess(this.prettierrc, stat), fsAccess(this.eslintrc, stat)]);
			await Promise.all(
				this.files.map(item => {
					const { path: path$$1, type, name } = item;
					if (prettyTypes.includes(type)) {
						prefiles.push(path$$1);
					}
					if (esTypes.includes(type)) {
						esfiles.push(path$$1);
					}
					return fsAccess(path$$1, stat);
				})
			);
			this.dolint(esfiles, prefiles);
		} catch (err) {
			const str = err.toString();
			if (str.length > 5) {
				console.error(str);
			}
			exit(1);
		}
	}

	dolint(esfiles, prefiles) {
		const r1 = this.prettier(prefiles);
		if (r1.status !== 0) {
			throw new Error();
		}
		const r2 = this.eslint(esfiles);
		if (r2.status !== 0) {
			throw new Error();
		}
	}

	eslint(f) {
		return spawnSync('eslint', ['-c', this.eslintrc, '--fix', f.join(' ')], spawnOps);
	}
	prettier(f) {
		return spawnSync('prettier', ['-c', this.prettierrc, '--write', f.join(' ')], { stdio: 'inherit', shell: true });
	}
	async install() {
		const opts = utiljs.params(this.args, { '-dir': 'dir' });
		const { dir, git, hooks, precommit, postcommit } = Object.assign({}, options, opts);
		const cwd = path.isAbsolute(dir) ? '' : this.cwd;

		const prehook = path.join(cwd, dir, precommit);
		const posthook = path.join(cwd, dir, postcommit);

		const predst = path.join(this.cwd, git, hooks, precommit);
		const postdst = path.join(this.cwd, git, hooks, postcommit);

		const mode = 0o755;
		try {
			await Promise.all([fsAccess(prehook, stat), fsAccess(posthook, stat)]);
			await Promise.all([fsCopyFile(prehook, predst), fsCopyFile(posthook, postdst)]);
			await Promise.all([fsChmod(predst, mode), fsChmod(postdst, mode)]);
		} catch (err) {
			console.error(err.toString());
			exit(1);
		}
	}
}

var template = {
	template(filename, data, options) {
		const template = require('art-template');
		Object.assign(template.defaults, options);
		return template(filename, data);
	}
};

const configName = 'static.json';

class server {
	constructor(cwd) {
		this.cwd = cwd;
	}

	async serve(args) {
		try {
			const params = utiljs.getParams(args);
			const cwd = params.root ? params.root : this.cwd;
			const config = await utilnode.getConfig(cwd, configName);
			new httpserver(params).start(config);
		} catch (e) {
			utilnode.exit(e, 1);
		}
	}

	template(args) {
		const params = utiljs.getParams(args);
		const [file, datafile] = args;
		if (file && datafile) {
			try {
				const data = require(path.join(this.cwd, datafile));
				let options = {
					debug: params.debug,
					minimize: !params.debug,
					compileDebug: !!params.debug,
					escape: !!params.escape,
					root: this.cwd
				};
				const res = template.template(path.join(this.cwd, file), data, options);
				if (params.output) {
					(async () => {
						try {
							let dstfile;
							if (path.isAbsolute(params.output)) {
								dstfile = params.output;
							} else {
								dstfile = path.join(this.cwd, params.output);
							}
							await fsWriteFile(dstfile, res);
						} catch (e) {
							utilnode.exit(e, 1);
						}
					})();
				} else {
					process.stdout.write(res + os.EOL);
				}
			} catch (e) {
				utilnode.exit(e, 1);
			}
		} else {
			utilnode.exit('file and filedata must be set', 1);
		}
	}

	run(args) {}

	lint(args) {
		new lint(this.cwd, args).lint();
	}

	gitlint(args) {
		new lint(this.cwd, args).lint();
	}

	install(args) {
		new lint(this.cwd, args).install();
	}

	async compress(args) {
		try {
			const config = await utilnode.getConfig(this.cwd, configName);
			const params = utiljs.getParams(args);
			const filed = args.filter(item => item.charAt(0) !== '-').length;
			if (args && args.length > 0 && filed) {
				const less = args
					.filter(item => {
						return item.split('.').pop() == 'less';
					})
					.map(item => {
						return path.join(this.cwd, item);
					});
				const js = args
					.filter(item => {
						return item.split('.').pop() == 'js';
					})
					.map(item => {
						return path.join(this.cwd, item);
					});
				if (less.length) {
					const lessOps = Object.assign({ compress: params.debug ? false : true }, params);
					const res = await compress.compressLess(less, lessOps);
					const file = utilnode.getName(this.cwd, less, '.less');
					await fsWriteFile(`${file}.min.css`, res.css);
				}
				if (js.length) {
					const res = await compress.compressJs(js, params);
					const file = utilnode.getName(this.cwd, js, '.js');
					await fsWriteFile(`${file}.min.js`, res.code);
				}
			} else {
				compress.compressByConfig(config, params);
			}
		} catch (e) {
			utilnode.exit(e, 1);
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
	template 		use art-template render html
    
Flags:
	-v     			show air version
	-h      		show this help information
	-p     			set server listen port
	-d     			set server document root
	--debug			compress with debug mode
	--clean			compress with clean mode,remove console debugger
	--escape		escape when use template
	--dry  			just run as a static server
	--art  			use art-template not ssi
`;

const version = '0.6.21';

class cli {
	constructor(server) {
		this.server = server;
	}
	run(argv) {
		const [, , ...args] = argv;
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
		if (m == '-v') {
			this.showVersion();
		} else if (m == '-h') {
			this.showHelp();
		} else {
			this.server.serve([m, ...args]);
		}
	}

	showHelp() {
		console.info(help);
	}

	showVersion() {
		console.log('air version: air/' + version);
	}
}

new cli(new server(process.cwd())).run(process.argv);

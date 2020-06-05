'use strict';

var process$1 = require('process');
var fs = require('fs');
var path = require('path');
var util$1 = require('util');
var querystring = require('querystring');
var http = require('http');
var child_process = require('child_process');

const fsStat = util$1.promisify(fs.stat);
const fsAccess = util$1.promisify(fs.access);
const fsWriteFile = util$1.promisify(fs.writeFile);
const fsReadFile = util$1.promisify(fs.readFile);
const fsCopyFile = util$1.promisify(fs.copyFile);
const fsChmod = util$1.promisify(fs.chmod);
class util {
	static resolveLookupPaths(pathstr, file) {
		const arr = [];
		const tmp = [];
		pathstr.split(path.sep).forEach((item) => {
			if (/^[a-zA-Z]:$/.test(item)) {
				// for windows
				return;
			}
			tmp.push(item);
			arr.push(path.resolve(path.join(path.sep, ...tmp, file)));
		});
		return arr.reverse();
	}
	static async tryFiles(paths) {
		for (let i = 0, j = paths.length; i < j; i++) {
			const file = paths[i];
			try {
				await fsAccess(file, fs.constants.R_OK);
				return file;
			} catch (e) {
				// not exist try next
			}
		}
	}
	static async getConfig(cwd, name = 'static.json') {
		if (!/static\/?$/.test(cwd)) {
			cwd = path.join(cwd, 'static');
		}
		const paths = this.resolveLookupPaths(cwd, name);
		let f = '',
			json = {},
			fpath = '',
			dirname = '';
		f = await this.tryFiles(paths);
		if (f) {
			json = require(f);
			fpath = f;
			dirname = path.dirname(f);
		}
		return { json, fpath, dirname };
	}
	static async getUpdateTime(files) {
		const mtimes = [];
		for (let i = 0, j = files.length; i < j; i++) {
			const v = files[i];
			const stat = await fsStat(v);
			mtimes.push(stat.mtime.getTime());
		}
		const updateTime = Math.max.apply(this, mtimes);
		return updateTime;
	}
	static async getContent(files) {
		const arr = files.map((file) => fsReadFile(file, 'utf-8'));
		const res = await Promise.all(arr);
		const objs = {};
		files.forEach((file, index) => {
			objs[file] = res[index];
		});
		return objs;
	}
}

const fsStat$1 = util$1.promisify(fs.stat);

const types = {
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
		'buffer',
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
	'audio/3gpp': ['3gpp'],
	'audio/adpcm': ['adp'],
	'audio/basic': ['au', 'snd'],
	'audio/midi': ['mid', 'midi', 'kar', 'rmi'],
	'audio/mp3': ['mp3'],
	'audio/mp4': ['m4a', 'mp4a'],
	'audio/mpeg': ['mpga', 'mp2', 'mp2a', 'mp3', 'm2a', 'm3a'],
	'audio/ogg': ['oga', 'ogg', 'spx'],
	'audio/s3m': ['s3m'],
	'audio/silk': ['sil'],
	'audio/wav': ['wav'],
	'audio/wave': ['wav'],
	'audio/webm': ['weba'],
	'audio/xm': ['xm'],
	'font/collection': ['ttc'],
	'font/otf': ['otf'],
	'font/ttf': ['ttf'],
	'font/woff': ['woff'],
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
	'text/rtf': ['rtf'],
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
	'text/xml': ['xml'],
	'text/yaml': ['yaml', 'yml'],
	'video/3gpp': ['3gp', '3gpp'],
	'video/3gpp2': ['3g2'],
	'video/h261': ['h261'],
	'video/h263': ['h263'],
	'video/h264': ['h264'],
	'video/jpeg': ['jpgv'],
	'video/jpm': ['jpm', 'jpgm'],
	'video/mj2': ['mj2', 'mjp2'],
	'video/mp2t': ['ts'],
	'video/mp4': ['mp4', 'mp4v', 'mpg4'],
	'video/mpeg': ['mpeg', 'mpg', 'mpe', 'm1v', 'm2v'],
	'video/ogg': ['ogv'],
	'video/quicktime': ['qt', 'mov'],
	'video/webm': ['webm'],
};
const typesMap = {};
const defaultMime = 'application/octet-stream';
Object.keys(types).forEach((mimestr) => {
	const item = types[mimestr];
	item.forEach((ext) => {
		typesMap[ext] = mimestr;
	});
});
const resolveMime = (filePath) => {
	const t = filePath.split('.').pop();
	const type = typesMap[t];
	return type ? type : defaultMime;
};
class file {
	static async serve(req, res, pathname, cwd = '.', index = 'index.html') {
		const { text, code, stats, file } = await this.target(pathname, cwd, index);
		if (code !== 200) {
			res.writeHead(code, {
				'Content-Type': 'text/plain',
				'Content-Length': text.length,
			});
			return res.end(text);
		}
		const info = this.info(req.headers, stats, file);
		return this.pipe(res, info, file);
	}
	static async target(pathname, cwd = '.', index = 'index.html') {
		let file = path.join(cwd, pathname);
		if (file.endsWith('/')) {
			file = path.join(file, index);
		}
		if (file.endsWith('/')) {
			return { text: '403 forbidden', code: 403 };
		}
		let stats;
		try {
			stats = await fsStat$1(file);
		} catch (e) {
			// not exist
			return { text: '404 page not found', code: 404 };
		}
		if (!stats || !stats.isFile()) {
			return { text: '403 forbidden', code: 403 };
		}
		return { code: 200, stats, file };
	}
	static info(headers, stats, file) {
		const mime = resolveMime(file);
		const lastModify = new Date(stats.mtimeMs).toUTCString();
		if (headers['last-modified'] == lastModify) {
			return {
				code: 304,
				meta: {
					'Last-Modified': lastModify,
					'Content-Type': mime,
					'Content-Length': 0,
				},
			};
		}
		let matches = headers.range ? headers.range.trim().match(/^bytes=(\d+)-(\d+)?$/) : false;
		if (matches) {
			const start = parseInt(matches[1]);
			const end = matches[2] ? parseInt(matches[2]) : stats.size - 1;
			const len = end - start + 1;
			return {
				code: 206,
				meta: {
					'Content-Range': `bytes ${start}-${end}/${stats.size}`,
					'Accept-Ranges': 'bytes',
					'Content-Type': mime,
					'Content-Length': len,
				},
				start,
				end,
			};
		}
		return {
			code: 200,
			meta: {
				'Last-Modified': lastModify,
				'Accept-Ranges': 'bytes',
				'Content-Type': mime,
				'Content-Length': stats.size,
			},
		};
	}
	static pipe(res, info, file) {
		const { code, meta, start, end } = info;
		res.writeHead(code, meta);
		if (code == 304) {
			return res.end();
		} else if (code == 206) {
			return fs.createReadStream(file, { start, end }).pipe(res);
		}
		return fs.createReadStream(file).pipe(res);
	}
}

class route {
	constructor() {
		this.routes = [];
		this.middlewares = [];
	}
	get(path, fn) {
		return this.add(path, fn, ['GET']);
	}
	post(path, fn) {
		return this.add(path, fn, ['POST']);
	}
	put(path, fn) {
		return this.add(path, fn, ['PUT']);
	}
	delete(path, fn) {
		return this.add(path, fn, ['DELETE']);
	}
	head(path, fn) {
		return this.add(path, fn, ['HEAD']);
	}
	patch(path, fn) {
		return this.add(path, fn, ['PATCH']);
	}
	options(path, fn) {
		return this.add(path, fn, ['OPTIONS']);
	}
	add(path, fn, method = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH', 'OPTIONS'], timeout = 5000) {
		this.routes.push({ method, path, fn, timeout });
		return this;
	}
	use(
		prefix = '',
		middleware = null,
		timeout = 5000,
		method = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH', 'OPTIONS']
	) {
		let path = prefix;
		let handler = middleware;
		if (!handler) {
			path = false;
			handler = prefix;
		}
		this.middlewares.push({ path, handler, timeout, method });
		return this;
	}
	match(m, uri) {
		for (let i = 0, j = this.routes.length; i < j; i++) {
			const { method, path, fn, timeout } = this.routes[i];
			if (method.includes(m) && (!path || path.test(uri))) {
				return { fn, params: uri.match(path), timeout };
			}
		}
		return false;
	}
	async runRoute(req, res, pathname, query) {
		const m = this.match(req.method, pathname);
		if (!m) {
			return true;
		}
		const { fn, params, timeout } = m;
		req.ctx.params = params;
		return await new Promise(async (resolve, reject) => {
			const t = setTimeout(() => {
				resolve(false);
			}, timeout);
			try {
				await fn(req, res, pathname, query);
			} catch (e) {
				reject(e);
			} finally {
				resolve(false);
				clearTimeout(t);
			}
		});
	}
	middlewareMatch(m, uri) {
		const middlewares = [];
		for (let i = 0, j = this.middlewares.length; i < j; i++) {
			const { method, handler, path, timeout } = this.middlewares[i];
			if (method.includes(m) && (!path || path.test(uri))) {
				middlewares.push({ timeout, handler, params: uri.match(path) });
			}
		}
		return middlewares;
	}
	async runMiddleWare(req, res, pathname, query) {
		const m = this.middlewareMatch(req.method, pathname);
		req.ctx = {
			params: [],
			run: true,
			middlewares: [],
			routes: [],
		};
		for (let i = 0, j = m.length; i < j; i++) {
			const { handler, params, timeout } = m[i];
			const ret = await new Promise(async (resolve, reject) => {
				req.ctx.params = params;
				const t = setTimeout(() => {
					resolve(false);
				}, timeout);
				const next = () => {
					clearTimeout(t);
					resolve(true);
				};
				const stop = () => {
					clearTimeout(t);
					resolve(false);
				};
				try {
					await handler(req, res, next, stop);
				} catch (e) {
					reject(e);
				}
			});
			if (ret === false) {
				return false;
			}
		}
		return true;
	}
}

class servefns extends route {
	constructor() {
		super();
	}
	buildctx(req, res, pathname, query) {
		req.path = pathname;
		req.query = query;
		req.body = this.body(req);
		req.json = this.parseJson(req);
		req.after = (
			prefix,
			middleware,
			timeout = 5000,
			method = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH', 'OPTIONS']
		) => {
			let path = prefix;
			let handler = middleware;
			if (!handler) {
				path = /^\//;
				handler = prefix;
			}
			req.ctx.middlewares.push({ path, handler, timeout, method });
			return req;
		};
		res.json = this.sendJson(res);
		res.send = this.sendData(res);
		res.file = this.sendFile(req, res);
	}
	body(request) {
		return async (max = 8192) => {
			return await new Promise((resolve, reject) => {
				let buf = [],
					count = 0;
				request
					.on('error', reject)
					.on('aborted', reject)
					.on('data', (data) => {
						buf.push(data);
						count += data.length;
						if (count > max) {
							reject('body too large');
						}
					})
					.on('end', () => {
						resolve(Buffer.concat(buf));
					});
			});
		};
	}
	parseJson(request) {
		return async (max = 8192) => {
			const bodyParser = this.body(request);
			const buf = await bodyParser(max);
			return JSON.parse(buf.toString() || '{}');
		};
	}
	sendJson(response) {
		return (data, status = 200) => {
			const str = JSON.stringify(data);
			response.writeHead(status, {
				'Content-Type': 'application/json',
				'Content-Length': str.length,
			});
			return response.end(str);
		};
	}
	sendData(response) {
		return (data, type = 'text/html', status = 200) => {
			response.writeHead(status, {
				'Content-Type': type,
				'Content-Length': data.length,
			});
			return response.end(data);
		};
	}
	sendFile(request, response) {
		return (filepath) => {
			return file.serve(request, response, filepath, '.', '');
		};
	}
	static static(dir) {
		return async (request, response, next, stop) => {
			return file.serve(request, response, request.path, dir) && stop();
		};
	}
}

class nodeserve extends servefns {
	constructor() {
		super();
		this.httpser = this.init();
	}
	init() {
		return http.createServer(async (request, response) => {
			const errhandler = (e) => {
				console.error(e);
				if (!response.headersSent) {
					response.writeHead(500);
				}
				if (!response.finished) {
					response.end(e.message || e.toString());
				}
			};
			try {
				request.once('error', errhandler);
				response.once('error', errhandler);
				const [pathname, qs] = decodeURI(request.url).split('?');
				const query = querystring.parse(qs);
				this.buildctx(request, response, pathname, query);
				let ret;
				ret = await this.middleware(request, response, pathname, query);
				if (ret) {
					ret = await this.route(request, response, pathname, query);
					if (ret) {
						ret = await this.servestatic(request, response, pathname, query);
					}
				}
				await this.runAfter(request, response, pathname, query);
			} catch (e) {
				errhandler(e);
			}
		});
	}
	listen(...args) {
		return this.httpser.listen(...args);
	}
	async middleware(req, res, pathname, query) {
		const ret = await this.runMiddleWare(req, res, pathname, query);
		return ret && req.ctx.run;
	}
	async route(req, res, pathname, query) {
		const ret = await this.runRoute(req, res, pathname, query);
		return ret && req.ctx.run;
	}
	async servestatic(req, res, pathname, query) {
		return file.serve(req, res, pathname);
	}
	getAfter(middlewareList, m, uri) {
		const middlewares = [];
		for (let i = 0, j = middlewareList.length; i < j; i++) {
			const { method, handler, path, timeout } = middlewareList[i];
			if (method.includes(m) && path.test(uri)) {
				middlewares.push({ timeout, handler, params: uri.match(path) });
			}
		}
		return middlewares;
	}
	async runAfter(req, res, pathname, query) {
		const m = this.getAfter(req.ctx.middlewares, req.method, pathname);
		for (let i = 0, j = m.length; i < j; i++) {
			const { handler, timeout } = m[i];
			const ret = await new Promise(async (resolve, reject) => {
				const t = setTimeout(() => {
					resolve(false);
				}, timeout);
				const next = () => {
					clearTimeout(t);
					resolve(true);
				};
				const stop = () => {
					clearTimeout(t);
					resolve(false);
				};
				try {
					await handler(req, res, next, stop);
				} catch (e) {
					reject(e);
				}
			});
			if (ret === false) {
				return false;
			}
		}
		return true;
	}
}

const maxItem = 1e3;
const caches = new Map();
class default_1 {
	static log(msg) {
		msg = msg.toString();
		if (this.errorlog.length > maxItem) {
			this.errorlog = [];
		}
		var nowDate = new Date();
		msg = nowDate.toLocaleDateString() + ' ' + nowDate.toLocaleTimeString() + ' ' + msg;
		this.errorlog.push(msg);
		console.log(msg);
	}
	static get(k) {
		return caches.get(k);
	}
	static set(k, v) {
		return caches.set(k, v);
	}
}
default_1.errorlog = [];

class compress {
	constructor(opts, pathname, query) {
		this.opts = opts;
		this.pathname = pathname;
		this.query = query;
		this.options = { ver: '', compress: false, env: 'development' };
		this.jopts = { debug: true, clean: false };
	}
	// 解析优先级, 配置文件>连字符>less文件查找>静态文件
	async resolveLess() {
		const pathname = this.pathname.replace('.css', '');
		const css = Object.keys(this.opts.opts.static.css) || [];
		const curr = pathname.replace(/.*\/static\//, '');
		if (css.includes(curr)) {
			return css[curr].map((item) => path.join(this.opts.dirname, item));
		}
		if (/-/.test(curr)) {
			const dirs = pathname.split('/');
			const segment = dirs.pop();
			return segment
				.split('-')
				.filter((item) => item)
				.map((item) => {
					return path.join(this.opts.dirname, ...dirs, item) + '.less';
				});
		}
		return [path.join(this.opts.dirname, curr) + '.less'];
	}
	async resolveJs() {
		const pathname = this.pathname.replace('.js', '');
		const js = Object.keys(this.opts.opts.static.js) || [];
		const curr = pathname.replace(/.*\/static\//, '');
		if (js.includes(curr)) {
			return js[curr].map((item) => path.join(this.opts.dirname, item));
		}
		if (/-/.test(curr)) {
			const dirs = curr.split('/');
			const segment = dirs.pop();
			return segment
				.split('-')
				.filter((item) => item)
				.map((item) => {
					return path.join(this.opts.dirname, ...dirs, item) + '.js';
				});
		}
		return [path.join(this.opts.dirname, curr) + '.js'];
	}
	async less() {
		const files = await this.resolveLess();
		const time = await util.getUpdateTime(files);
		const ret = default_1.get(this.pathname);
		if (ret && ret.time == time && ret.ver == this.options.ver) {
			return { ret, hit: true };
		}
		const r = await this.compileLess(files);
		const res = { css: r, time, ver: this.options.ver };
		default_1.set(this.pathname, res);
		return { ret: res, hit: false };
	}
	async compileLess(files) {
		const lessInput = files
			.map((item) => {
				return '@import "' + item + '";';
			})
			.join('\r\n');
		let { urlArgs, compress, env } = this.options;
		const less = require('less');
		const autoprefix = require('less-plugin-autoprefix');
		const option = {
			plugins: [new autoprefix({ browsers: ['last 5 versions', 'ie > 9', 'Firefox ESR'] })],
			paths: this.opts.dirname,
			urlArgs,
			compress,
			env,
		};
		const ret = await less.render(lessInput, option);
		return ret.css;
	}
	async Js() {
		const files = await this.resolveJs();
		const time = await util.getUpdateTime(files);
		const ret = default_1.get(this.pathname);
		if (ret && ret.time == time && ret.ver == this.options.ver) {
			return { ret, hit: true };
		}
		const r = await this.compileJs(files);
		const res = { js: r, time, ver: this.options.ver };
		default_1.set(this.pathname, res);
		return { ret: res, hit: false };
	}
	async compileJs(files) {
		let options;
		if (this.jopts.debug) {
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
					loops: false,
				},
			};
		} else {
			options = {
				mangle: true,
				compress: {
					sequences: true,
					properties: true,
					dead_code: true,
					unused: true,
					booleans: true,
					join_vars: true,
					if_return: true,
					conditionals: true,
				},
			};
			if (this.jopts.clean) {
				options.compress.drop_console = true;
				options.compress.drop_debugger = true;
				options.compress.evaluate = true;
				options.compress.loops = true;
			}
		}
		const filesMap = await util.getContent(files);
		const terser = require('terser');
		const ret = await new Promise((resolve, reject) => {
			const result = terser.minify(filesMap, options);
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
		});
		return ret.code;
	}
	async compress(cliargs) {
		this.options.env = 'production';
		this.options.compress = !cliargs.debug;
		this.jopts.debug = cliargs.debug;
		this.jopts.clean = cliargs.clean;
		const { css, js } = this.opts.opts.static;
		for (let item in css) {
			const source = css[item];
			const ret = await this.compileLess(source);
			await fsWriteFile(path.join(this.opts.dirname, item), ret);
		}
		for (let item in js) {
			const source = js[item].map((item) => path.join(this.opts.dirname, item));
			const ret = await this.compileJs(source);
			await fsWriteFile(path.join(this.opts.dirname, item), ret);
		}
	}
}

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
			'-v': 'version',
			'-p': 'port',
			'-d': 'root',
			'-o': 'output',
			'-dir': 'dir',
			'--escape': 'escape',
			'--debug': 'debug',
			'--clean': 'clean',
			'--dry': 'dry',
			'--art': 'art',
			'--lint': 'lintonly',
		};
		return this.params(args, kMap);
	},
	params(args, kMap) {
		const ret = {};
		const keys = Object.keys(kMap);
		let key;
		args.forEach((item) => {
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
	},
};

const readFile = util$1.promisify(fs.readFile);
const includefile = /<!--#\s{1,5}include\s{1,5}file="([\w+/.]{3,50})"\s{1,5}-->/g;
class ssi {
	constructor(cwd, pathname, query) {
		this.cwd = cwd;
		this.pathname = pathname;
		this.query = query;
	}
	async html() {
		const main = path.join(this.cwd, this.pathname);
		return await this.parseHtml(main, this.query, this.cwd);
	}
	async parseHtml(file, query, cwd) {
		const resfile = await readFile(file);
		let html = resfile.toString();
		let res,
			i = 0,
			filesMap = {};
		const fillContents = async () => {
			let res;
			let fileList = Object.keys(filesMap).filter((item) => {
				return !filesMap[item];
			});
			res = await Promise.all(
				fileList.map((item) => {
					return readFile(path.join(cwd, item));
				})
			);
			res.forEach((item, i) => {
				filesMap[fileList[i]] = item.toString();
			});
		};
		while (i < 6) {
			let matches = {};
			while ((res = includefile.exec(html))) {
				const [holder, file] = res;
				matches[holder] = file;
				if (!filesMap[file]) {
					filesMap[file] = '';
				}
			}
			if (Object.keys(matches).length === 0) {
				// // 主html文件内,没有include语法,模板引擎不用处理了,直接返回
				return html;
			}
			i++;
			if (i > 5) {
				throw new Error('include file too deep');
			}
			await fillContents();
			Object.keys(matches).forEach((item) => {
				const file = matches[item];
				const content = filesMap[file];
				html = html.replace(item, content);
			});
		}
	}
}

class template {
	constructor(opts, cwd, pathname, query) {
		this.opts = opts;
		this.cwd = cwd;
		this.pathname = pathname;
		this.query = query;
	}
	async art() {
		let file = this.pathname;
		if (file.charAt(0) == '/') {
			file = file.substr(1);
		}
		const template = require('art-template');
		const { minimize, escape } = this.query;
		const options = {
			debug: !minimize,
			minimize,
			compileDebug: !minimize,
			escape: escape,
			root: this.cwd,
			cache: false,
		};
		Object.assign(template.defaults, options);
		const dstfile = path.join(this.cwd, file);
		let data = this.query || {};
		const config = this.opts.opts;
		if (config.template && config.template[file]) {
			const v = config.template[file];
			let r = {};
			if (utiljs.isObject(v)) {
				r = v;
			} else {
				const datafile = path.join(this.cwd, config.template[file]);
				r = require(datafile);
			}
			data = Object.assign({}, data, r);
		}
		return template(dstfile, Object.keys(data).length > 0 ? data : {});
	}
	async ssi() {
		const s = new ssi(this.cwd, this.pathname, this.query);
		const html = await s.html();
		return html;
	}
}

class server {
	constructor(args, cliargs, cwd) {
		this.args = args;
		this.cliargs = cliargs;
		this.cwd = cwd;
		this.app = new nodeserve();
	}
	async serve() {
		try {
			this.route();
			this.app
				.listen(this.args.port, this.args.host, () => {
					console.info('Server listening on port %d', this.args.port);
				})
				.on('error', (err) => {
					console.error(err.toString());
				});
			this.watch();
		} catch (e) {
			console.error(e);
		}
	}
	route() {
		if (this.cliargs.dry) {
			return;
		}
		this.app.get(/^[\w\-/.]+\.css$/, async (req, res, pathname, query) => {
			const ret = await new compress(this.args.staticCfg, pathname, query).less();
			res.setHeader('x-hit', ret.hit ? 1 : 0);
			res.send(ret.ret.css, 'text/css');
		});
		this.app.get(/^[\w\-/.]+\.js$/, async (req, res, pathname, query) => {
			const ret = await new compress(this.args.staticCfg, pathname, query).Js();
			res.setHeader('x-hit', ret.hit ? 1 : 0);
			res.send(ret.ret.js, 'text/javascript');
		});
		this.app.get(/^[\w\-/.]+\.html$/, async (req, res, pathname, query) => {
			const tpl = new template(this.args.staticCfg, this.cwd, pathname, query);
			let ret;
			if (this.cliargs.art) {
				ret = await tpl.art();
			} else {
				ret = await tpl.ssi();
			}
			res.send(ret);
		});
	}
	watch() {
		const f = this.args.staticCfg.fpath;
		if (!f) {
			return;
		}
		console.info('load config file ' + f);
		fs.watchFile(f, async () => {
			try {
				delete require.cache[f];
				const c = require(f);
				const newcfg = Object.assign({}, c);
				this.args.staticCfg.opts = newcfg;
				console.info('config reload success ', f);
			} catch (e) {
				console.error('config relaod error ', f, e);
			}
		});
	}
}

const spawn = util$1.promisify(child_process.spawn);
const spawnSync = child_process.spawnSync;
const prettyTypes = ['js', 'vue', 'jsx', 'ts', 'css', 'less', 'html', 'json', 'scss', 'md'];
const extParser = {
	js: 'babel',
	jsx: 'babel',
	ts: 'typescript',
	vue: 'vue',
	html: 'html',
	css: 'css',
	less: 'less',
	scss: 'scss',
	json: 'json',
	md: 'mdx',
	yaml: 'yaml',
};
const config = {
	eslintConfig: {
		env: {
			browser: true,
			es6: true,
			node: true,
		},
		parserOptions: {
			ecmaVersion: 7,
		},
		rules: {
			indent: ['error', 'tab'],
			'linebreak-style': ['error', 'unix'],
			quotes: ['error', 'single'],
			semi: ['error', 'always'],
		},
	},
	prettierOptions: {
		printWidth: 120,
		tabWidth: 4,
		singleQuote: true,
		useTabs: true,
		semi: true,
		trailingComma: 'es5',
		bracketSpacing: true,
		arrowParens: 'always',
		endOfLine: 'lf',
		parser: 'babel',
		jsxBracketSameLine: false,
	},
	fallbackPrettierOptions: {
		printWidth: 120,
		tabWidth: 4,
		singleQuote: true,
		useTabs: true,
		semi: true,
		trailingComma: 'es5',
		bracketSpacing: true,
		arrowParens: 'always',
		endOfLine: 'lf',
		parser: 'babel',
		jsxBracketSameLine: false,
	},
	prettierLast: true,
};
const options = {
	dir: 'config',
	git: '.git',
	hooks: 'hooks',
	precommit: 'pre-commit',
	postcommit: 'post-commit',
	commitmsg: 'commit-msg',
	prettierrc: '.prettierrc',
	eslintrc: '.eslintrc.js',
};
const stat = fs.constants.R_OK | fs.constants.W_OK;
const spawnOps = { stdio: 'inherit', shell: true };
class lint {
	constructor(cwd, files, opts) {
		this.cwd = cwd;
		this.opts = opts;
		this.files = [];
		this.files = files.filter((item) => item.charAt(0) != '-');
	}
	async gitlint() {
		const res = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACM']);
		const arrs = res.stdout
			.toString()
			.split('\n')
			.filter((v) => v);
		if (!arrs.length) {
			return;
		}
		const { prefiles, gitfiles } = this.parse(arrs);
		await this.dolint(prefiles, gitfiles);
	}
	parse(files) {
		const prefiles = [];
		const gitfiles = [];
		const filetypes = files.map((item) => {
			const name = item.trim();
			const type = item.split('.').pop();
			let p = name;
			if (!path.isAbsolute(name)) {
				p = path.join(this.cwd, name);
			}
			if (prettyTypes.includes(type)) {
				prefiles.push(p);
			}
			gitfiles.push(p);
			return { name, path: p, type };
		});
		return { prefiles, gitfiles, filetypes };
	}
	async lint() {
		if (this.files.length < 1) {
			return this.gitlint();
		}
		const { prefiles, gitfiles } = this.parse(this.files);
		await this.dolint(prefiles, gitfiles);
		if (!this.opts.lintonly) {
			await this.gitadd(gitfiles);
		}
	}
	async dolint(prefiles, gitfiles) {
		await this.checkfiles(gitfiles);
		await Promise.all(this.lintConfig(prefiles));
	}
	lintConfig(prefiles) {
		const format = require('prettier-eslint');
		return prefiles.map((item) => {
			return new Promise(async (resolve, reject) => {
				try {
					const r = await fsReadFile(item, 'utf-8');
					if (!r || r.trim().length < 1) {
						return resolve(true);
					}
					const options = {
						...config,
						...{
							filePath: item,
						},
						...{
							text: r,
						},
					};
					options.prettierOptions.parser = this.getParser(item);
					const res = format(options);
					if (r !== res && res) {
						if (item.toLowerCase().includes('package.json')) {
							fs.writeFileSync(item, res);
						} else {
							await fsWriteFile(item, res);
						}
					}
					console.log(item.replace(this.cwd + '/', ''));
					resolve(true);
				} catch (e) {
					reject(e);
				}
			});
		});
	}
	getParser(file) {
		const ext = file
			.split('.')
			.pop()
			.toLowerCase();
		return extParser[ext] ? extParser[ext] : 'babel';
	}
	gitadd(f) {
		if (f && f.length) {
			return spawn('git', ['add', '-u', f.join(' ')], spawnOps);
		}
		return Promise.resolve();
	}
	async install() {
		const { git, cwd, hooks, precommit, postcommit, commitmsg } = Object.assign({}, options, this.opts);
		const dir = this.opts.dir ? '' : options.dir;
		const prehook = path.join(this.cwd, dir, precommit);
		const posthook = path.join(this.cwd, dir, postcommit);
		const msghook = path.join(this.cwd, dir, commitmsg);
		const predst = path.join(cwd, git, hooks, precommit);
		const postdst = path.join(cwd, git, hooks, postcommit);
		const msgdst = path.join(cwd, git, hooks, commitmsg);
		const mode = 0o755;
		await Promise.all([fsAccess(prehook, stat), fsAccess(posthook, stat), fsAccess(msghook, stat)]);
		await Promise.all([fsCopyFile(prehook, predst), fsCopyFile(posthook, postdst), fsCopyFile(msghook, msgdst)]);
		await Promise.all([fsChmod(predst, mode), fsChmod(postdst, mode), fsChmod(msgdst, mode)]);
	}
	async checkfiles(files) {
		const maxsize = 1048576;
		// 检查文件大小,超过1MB禁止提交
		const stats = await Promise.all(files.map((item) => fsStat(item)));
		return stats.every((item, index) => {
			if (item.size > maxsize) {
				throw new Error(`${files[index]} too large,${item.size} exceed ${maxsize}`);
			}
			return true;
		});
	}
	static async commitlint(commitfile) {
		const str = await fsReadFile(commitfile);
		const msg = str.toString();
		if (/Merge\s+branch/i.test(msg)) {
			return;
		}
		if (
			!/(build|ci|docs|feat|fix|perf|refactor|style|test|revert|chore).{0,2}(\(.{1,100}\))?.{0,2}:.{1,200}/.test(
				msg
			)
		) {
			console.info('commit message should be format like <type>(optional scope): <description>');
			process$1.exit(1);
		}
	}
}

var help = `
Usage:
    air [command] [flag]
Commands:
    serve           start air http server
    lint            eslint js
    gitlint         lint used for git hook
    compress        compress less or javascript files
    install         install git hooks
    template        use art-template render html
    
Flags:
    -v              show air version
    -h              show this help information
    -p              set server listen port
    -d              set server document root
    -o              set output file path for air template
    -dir            set lint or install config path
    --debug         compress with debug mode
    --clean         compress with clean mode,remove console debugger
    --escape        escape when use template
    --dry           just run as a static server
    --art           use art-template not ssi
`;
const version = '0.7.0';
const templatetips = `
Usage:
    air template filename.html [flag]

Flags:
    -o              set output file path for air template
    -dir            set lint or install config path
    --debug         compress with debug mode
    --escape        escape when use template
    --art           use art-template not ssi

`;

class command {
	static async lint(args, cwd, opts, staticCfg) {
		await new lint(cwd, args, opts).lint();
	}
	static async gitlint(args, cwd, opts, staticCfg) {
		await new lint(cwd, args, opts).gitlint();
	}
	static async commitlint(args, cwd, opts, staticCfg) {
		await lint.commitlint(args[0]);
	}
	/**
	 * air install -dir path/to/dir
	 * @param args
	 * @param cwd
	 * @param opts
	 */
	static async install(args, cwd, opts, staticCfg) {
		await new lint(cwd, args, opts).install();
	}
	/**
	 * air compress --clean
	 * air compress --debug
	 * @param args
	 * @param cwd
	 * @param opts
	 */
	static async compress(args, cwd, opts, staticCfg) {
		if (!staticCfg.fpath) {
			console.log('no config found');
			return;
		}
		await new compress(staticCfg, '', {}).compress(opts);
	}
	/**
	 *
	 * air template --escape
	 * air template --debug
	 * @param filename
	 * @param data
	 * @param options
	 */
	static async template(args, cwd, opts, staticCfg) {
		const file = args.filter((item) => item.charAt(0) !== '-')[0];
		if (!file) {
			throw new Error(templatetips);
		}
		const query = { minimize: true, escape: false };
		if (opts.debug) {
			query.minimize = false;
		}
		if (opts.escape) {
			query.escape = true;
		}
		const tpl = new template(staticCfg, cwd, file, query);
		let res;
		if (opts.art) {
			res = await tpl.art();
		} else {
			res = await tpl.ssi();
		}
		if (opts.output) {
			return await fsWriteFile(opts.output, res);
		}
		process.stdout.write(res);
	}
}

class cli {
	constructor(cwd) {
		this.cwd = cwd;
		this.opts = {
			host: '0.0.0.0',
			port: 8088,
			staticCfg: {
				fpath: '',
				dirname: '',
				opts: {
					static: {
						css: null,
						js: null,
					},
					template: {},
				},
			},
		};
	}
	async run(argv) {
		try {
			await this.loadConfig();
			const [, , ...args] = argv;
			this.argv = args;
			this.args = utiljs.getParams(args);
			this.args.cwd = process.cwd();
			this.opts.port = this.args.port || 8088;
			if (this.args.dir) {
				process.chdir(this.args.dir);
			}
			this.cwd = process.cwd();
			if (args.length > 0) {
				await this.runArgs();
			} else {
				await this.runInit();
			}
		} catch (e) {
			console.error(e.message || e.stack || e);
			process.exit(1);
		}
	}
	async loadConfig() {
		const { json, fpath, dirname } = await util.getConfig(this.cwd);
		this.opts.staticCfg.opts = json;
		this.opts.staticCfg.fpath = fpath;
		this.opts.staticCfg.dirname = dirname;
	}
	/**
    
     * air compress
     * air lint
     * air template
     *
     * air install
     * air gitlint
     * air commitlint
     */
	async runArgs() {
		const [m, ...args] = this.argv;
		const f = command[m];
		if (utiljs.isFunction(f)) {
			return await f.call(command, args, this.cwd, this.args, this.opts.staticCfg);
		}
		return await this.fallback(m, args);
	}
	/**
	 * air -p
	 * air -d
	 * air --dry
	 * air --art
	 *
	 */
	async runInit() {
		return new server(this.opts, this.args, this.cwd).serve();
	}
	/**
	 *
	 * parse flag
	 *
	 * air -v
	 * air -h
	 * air serve
	 *
	 */
	async fallback(m, args) {
		if (['-v'].includes(m) || args.includes('-v')) {
			this.version();
		} else if (['serve', '-p', '-d', '--dry', '--art'].includes(m)) {
			await this.runInit();
		} else if (this.args.help) {
			this.help();
		} else {
			this.help();
		}
	}
	version() {
		console.log('air version: air/' + version);
	}
	help() {
		console.info(help);
	}
}

new cli(process$1.cwd()).run(process$1.argv);

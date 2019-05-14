import http from 'http';
import path from 'path';
import fs from 'fs';
import process from 'process';
import querystring from 'querystring';

import log from './tool';
import route from './route';
import utilnode from './util';
import utiljs from './utiljs';
import sendFile from './sendfile';
import ssi from './ssi';

const defaultPort = 8088;
const defaultRoot = process.cwd();
const index = 'index.html';

export default class {
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
	start(globalConfig) {
		http.createServer((request, response) => {
			try {
				const [pathinfo, qs] = decodeURI(request.url).split('?');
				const query = querystring.parse(qs);
				if (this.params.dry) {
					return this.tryfile(response, pathinfo);
				}
				const [fn, ...args] = pathinfo.split('/').filter(item => item);
				if (!fn) {
					return this.noIndex(request, response, pathinfo, query, globalConfig.config);
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
								.handler(
									response,
									regRouter.matches,
									query,
									this.root,
									globalConfig.config,
									this.params
								)
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
				process.exit(1);
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
			if (stat.isFile()) {
				return sendFile(response, stat, file);
			} else if (stat.isDirectory()) {
				const dstfile = path.join(file, 'index.html');
				fs.stat(dstfile, (err, stat) => {
					if (err) {
						return this.err404(response);
					}
					if (stat.isFile()) {
						return sendFile(response, stat, dstfile);
					} else {
						return this.err403(response);
					}
				});
			} else {
				return this.err403(response);
			}
		});
	}

	err404(response) {
		response.writeHead(404, { 'Content-Type': 'text/plain' });
		response.end('Not Found\n');
	}

	err403(response) {
		response.writeHead(403, { 'Content-Type': 'text/plain' });
		response.end('Forbidden\n');
	}

	err500(response, err) {
		response.writeHead(500, { 'Content-Type': 'text/plain' });
		response.end(err + '\n');
	}
}

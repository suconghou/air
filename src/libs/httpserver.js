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

const defaultPort = 8088;
const defaultRoot = process.cwd();
const index = 'index.html';

export default class {
	constructor(cfg) {
		const { port, root } = cfg;
		this.port = port || process.env.PORT || defaultPort;
		this.root = root || defaultRoot;
		if (!(this.port > 1 && this.port < 65535)) {
			console.error('port %s error,should be 1-65535', this.port);
			process.exit(1);
		}
	}
	start(config) {
		http.createServer((request, response) => {
			try {
				const router = route.getRouter(request.method);
				if (router) {
					const [pathinfo, qs] = request.url.split('?');
					const query = querystring.parse(qs);
					const [fn, ...args] = pathinfo.split('/').filter(item => item);
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

	noIndex(request, response, pathinfo, query) {
		const file = path.join(this.root, index);
		fs.stat(file, (err, stat) => {
			if (err) {
				const info = utilnode.getStatus();
				response.writeHead(200, { 'Content-Type': 'application/json' });
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
		response.writeHead(404, { 'Content-Type': 'text/plain' });
		response.end('Not Found\n');
	}

	err500(response, err) {
		response.writeHead(500, { 'Content-Type': 'text/plain' });
		response.end(err + '\n');
	}
}

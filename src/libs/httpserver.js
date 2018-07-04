import http from "http";
import fs from "fs";
import process from "process";
import querystring from "querystring";

import log from "./tool";
import route from "./route.js";
import utiljs from "./utiljs";
import sendFile from "./sendfile.js";

const defaultPort = 8088;
const defaultRoot = process.cwd();

export default class {
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

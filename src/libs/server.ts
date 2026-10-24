import * as net from 'net';
import * as fs from 'fs';
import nodeserve, { cors } from '../nodeserve/index';
import file from '../nodeserve/lib/file';
import compress from './compress';
import ssi from './ssi';
import util from './util';
import { parseProxy, matchProxy, forward, proxyUpgrade, localPath, proxyRule } from './proxy';
import { serverArgs, cliArgs } from '../types';
import { requestctx, responsectx } from '../nodeserve/types';

export default class server {
	private app: nodeserve;
	private proxies: Array<proxyRule>;

	constructor(
		private args: serverArgs,
		private cliargs: cliArgs,
		private cwd: string
	) {
		this.app = new nodeserve();
		this.proxies = parseProxy(cliargs.proxy);
	}

	serve() {
		this.route();
		const httpser = this.app
			.listen(this.args.port, this.args.host, () => {
				console.info('服务已启动, 监听端口 %d', this.args.port);
				this.proxies.forEach((rule) => {
					console.info('反向代理 %s -> %s', rule.prefix, rule.href);
					if (rule.kind == 'file' && !fs.existsSync(rule.root)) {
						console.warn('警告: 本地代理目录不存在', rule.root);
					}
				});
				this.watch();
			})
			.on('error', (err) => {
				console.error('服务启动失败', err.toString());
				process.exit(1);
			});
		if (this.proxies.length > 0) {
			httpser.on('upgrade', (req, socket, head) => {
				proxyUpgrade(this.proxies, req, socket as net.Socket, head);
			});
		}
	}

	private route() {
		// 动态编译与 SSI 都按请求路径拼文件名, 必须在最前面拒绝穿越写法
		// (静态文件层另有校验, 但它排在动态路由之后, 拦不住 css/js/html)
		this.app.use(
			(req: requestctx, res: responsectx, next: Function, stop: Function) => {
				const pathname = req.path || '/';
				if (/(^|\/)\.\.(\/|$)/.test(pathname) || pathname.includes('\\') || pathname.includes('\0')) {
					res.send('403 forbidden', 'text/plain', 403);
					return stop();
				}
				next();
			},
			null,
			2147483647
		);
		if (this.cliargs.cors) {
			this.app.use(cors);
		}
		if (this.proxies.length > 0) {
			// 代理/本地挂载排在所有路由之前, 避免被 less/js/html 路由截胡
			// 超大 timeout: 代理请求耗时不受中间件 5s 超时限制
			this.app.use(
				(req: requestctx, res: responsectx, next: Function, stop: Function) => {
					const rule = matchProxy(this.proxies, req.path || '/');
					if (!rule) {
						return next();
					}
					if (rule.kind == 'file') {
						// 本地目录: 按前缀剥离映射文件, mime/304/range/穿越防护由 nodeserve file 处理
						// 目录请求补 index.html(path.join 会吞掉尾部斜杠, 需在此显式补)
						let rel = localPath(rule, req.path || '/');
						if (rel.endsWith('/')) {
							rel += 'index.html';
						}
						file.serve(req, res, rel, rule.root);
					} else {
						forward(req, res, rule);
					}
					stop();
				},
				null,
				2147483647
			);
		}
		if (this.cliargs.dry) {
			return;
		}
		this.app.add(
			/^[\w\-/.]+\.css$/,
			async (req: requestctx, res: responsectx, pathname: string, query: URLSearchParams) => {
				const ret = await new compress(this.args.staticCfg, pathname, query).less();
				res.setHeader('Cache-Control', ret.hit ? 'max-age=5' : 'max-age=1');
				res.send(ret.ret.css, 'text/css');
			},
			['GET', 'HEAD']
		);
		this.app.add(
			/^[\w\-/.]+\.js$/,
			async (req: requestctx, res: responsectx, pathname: string, query: URLSearchParams) => {
				const ret = await new compress(this.args.staticCfg, pathname, query).Js();
				res.setHeader('Cache-Control', ret.hit ? 'max-age=5' : 'max-age=1');
				res.send(ret.ret.js, 'text/javascript');
			},
			['GET', 'HEAD']
		);
		const tpl = async (req: requestctx, res: responsectx, pathname: string, query: URLSearchParams) => {
			res.send(await new ssi(this.cwd, pathname).html());
		};
		this.app.add(/^[\w\-/.]+\.html$/, tpl, ['GET', 'HEAD']);
		this.app.add(
			/^\/$/,
			(req: requestctx, res: responsectx, pathname: string, query: URLSearchParams) => {
				return tpl(req, res, '/index.html', query);
			},
			['GET', 'HEAD']
		);
	}

	private watch() {
		const f = this.args.staticCfg.fpath;
		if (!f) {
			return;
		}
		console.info('已加载配置文件 %s', f);
		fs.watchFile(f, () => {
			try {
				this.args.staticCfg.opts = util.normalize(JSON.parse(fs.readFileSync(f, 'utf-8')));
				console.info('配置已热更新 %s', f);
			} catch (e) {
				console.error('配置热更新失败 %s', f, e);
			}
		});
	}
}

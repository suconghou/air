import * as net from 'net';
import * as querystring from 'querystring';
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
			});
		if (this.proxies.length > 0) {
			httpser.on('upgrade', (req, socket, head) => {
				proxyUpgrade(this.proxies, req, socket as net.Socket, head);
			});
		}
	}

	private route() {
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
		this.app.get(
			/^[\w\-/.]+\.css$/,
			async (req: requestctx, res: responsectx, pathname: string, query: querystring.ParsedUrlQuery) => {
				const ret = await new compress(this.args.staticCfg, pathname, query).less();
				res.setHeader('Cache-Control', ret.hit ? 5 : 1);
				res.send(ret.ret.css, 'text/css');
			}
		);
		this.app.get(
			/^[\w\-/.]+\.js$/,
			async (req: requestctx, res: responsectx, pathname: string, query: querystring.ParsedUrlQuery) => {
				const ret = await new compress(this.args.staticCfg, pathname, query).Js();
				res.setHeader('Cache-Control', ret.hit ? 5 : 1);
				res.send(ret.ret.js, 'text/javascript');
			}
		);
		const tpl = async (req: requestctx, res: responsectx, pathname: string, query: querystring.ParsedUrlQuery) => {
			res.send(await new ssi(this.cwd, pathname).html());
		};
		this.app.get(/^[\w\-/.]+\.html$/, tpl);
		this.app.get(
			/^\/$/,
			(req: requestctx, res: responsectx, pathname: string, query: querystring.ParsedUrlQuery) => {
				return tpl(req, res, '/index.html', query);
			}
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

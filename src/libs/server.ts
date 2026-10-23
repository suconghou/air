import * as querystring from 'querystring';
import * as fs from 'fs';
import nodeserve, { cors } from '../nodeserve/index';
import compress from './compress';
import ssi from './ssi';
import { serverArgs, cliArgs } from '../types';
import { requestctx, responsectx } from '../nodeserve/types';

export default class server {
	private app: nodeserve;

	constructor(
		private args: serverArgs,
		private cliargs: cliArgs,
		private cwd: string
	) {
		this.app = new nodeserve();
	}

	serve() {
		this.route();
		this.app
			.listen(this.args.port, this.args.host, () => {
				console.info('Server listening on port %d', this.args.port);
				this.watch();
			})
			.on('error', (err) => {
				console.error(err.toString());
			});
	}

	private route() {
		if (this.cliargs.cors) {
			this.app.use(cors);
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
		console.info('load config file ' + f);
		fs.watchFile(f, () => {
			try {
				this.args.staticCfg.opts = JSON.parse(fs.readFileSync(f, 'utf-8'));
				console.info('config reload success ', f);
			} catch (e) {
				console.error('config reload error ', f, e);
			}
		});
	}
}

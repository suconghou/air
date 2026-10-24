import util from './util';
import server from './server';
import command from './command';
import help, { version } from '../config';
import { cliArgs, serverArgs } from '../types';

// 解析命令行参数; -- 布尔旗标立即生效, 取值旗标等待下一个非 '-' 参数
function getParams(args: Array<string>): cliArgs {
	const kMap: Record<string, string> = {
		'-p': 'port',
		'-d': 'dir',
		'-q': 'query',
		'-m': 'modifyVars',
		'--proxy': 'proxy',
		'--debug': 'debug',
		'--clean': 'clean',
		'--dry': 'dry',
		'--cors': 'cors',
		'--help': 'help',
	};
	// 这些旗标需要取值且可重复出现, 收集为数组
	const multi: Record<string, boolean> = { proxy: true };
	const ret: Record<string, any> = {};
	const keys = Object.keys(kMap);
	let key: string | null;
	args.forEach((item) => {
		if (keys.includes(item)) {
			if (item.charAt(0) == '-' && item.charAt(1) == '-' && !multi[kMap[item]]) {
				ret[kMap[item]] = true;
			} else {
				key = kMap[item];
			}
		} else if (key && item.charAt(0) != '-') {
			if (multi[key]) {
				if (!Array.isArray(ret[key])) {
					ret[key] = [];
				}
				ret[key].push(item);
			} else {
				ret[key] = item;
			}
			key = null;
		} else {
			key = null;
		}
	});
	return ret;
}

export default class {
	private args: cliArgs = {};
	private opts: serverArgs = {
		host: '0.0.0.0',
		port: 8088,
		staticCfg: {
			fpath: '',
			dirname: '',
			opts: {
				lessOptions: {},
				static: {
					css: {},
					js: {},
				},
			},
		},
	};

	constructor(private cwd: string) {}

	async run(argv: string[]) {
		try {
			const [, , ...args] = argv;
			this.args = getParams(args);
			this.opts.port = this.args.port || 8088;
			if (this.args.dir) {
				process.chdir(this.args.dir);
			}
			this.cwd = process.cwd();
			if (args.length > 0) {
				await this.runArgs(args);
			} else {
				await this.runInit();
			}
		} catch (e: any) {
			console.error('执行出错:', e.stack || e.message || e);
			process.exit(1);
		}
	}

	// 配置按需加载: 仅 serve 与按配置批量压缩需要, -v/-h/指定文件压缩不受坏配置影响
	private async loadConfig() {
		const { json, fpath, dirname } = await util.getConfig(this.cwd);
		this.opts.staticCfg.opts = json;
		this.opts.staticCfg.fpath = fpath;
		this.opts.staticCfg.dirname = dirname;
	}

	private async runArgs(args: Array<string>) {
		const [m, ...rest] = args;
		const f = (command as Record<string, any>)[m];
		if (typeof f === 'function') {
			return await f.call(command, rest, this.cwd, this.args);
		}
		return await this.fallback(m, rest);
	}

	private async runInit() {
		await this.loadConfig();
		new server(this.opts, this.args, this.cwd).serve();
	}

	private async fallback(m: string, args: Array<string>) {
		if (m == '-v' || args.includes('-v')) {
			console.log('air version: air/' + version);
		} else if (['serve', '-p', '-d', '--dry'].includes(m)) {
			await this.runInit();
		} else {
			console.info(help);
		}
	}
}

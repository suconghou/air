import util from './util';
import server from './server';
import command from './command';
import utiljs from './utiljs';
import help, { version } from '../config';
import { cliArgs, serverArgs } from '../types';
export default class {
	private argv: Array<string>;
	private args: cliArgs;
	private opts: serverArgs = {
		host: '0.0.0.0',
		port: 8088,
		staticCfg: {
			fpath: '',
			dirname: '',
			opts: {
				static: {
					css: null,
					js: null
				},
				template: {}
			}
		}
	};

	constructor(private cwd: string) {}

	async run(argv: string[]) {
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

	private async loadConfig() {
		const { json, fpath, dirname } = await util.getConfig(this.cwd);
		this.opts.staticCfg.opts = json as any;
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
	private async runArgs() {
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
	private async runInit() {
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
	private async fallback(m: string, args: Array<string>) {
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

	private version() {
		console.log('air version: air/' + version);
	}

	private help() {
		console.info(help);
	}
}

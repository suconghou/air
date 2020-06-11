import lint from './lint';
import compress from './compress';
import template from './template';
import { cliArgs, staticOpts } from '../types';
import { templatetips } from '../config';
import { fsWriteFile } from './util';
export default class {
	/**
	 * air lint --pretty
	 * air lint --lintlast
	 * @param args
	 * @param cwd
	 * @param opts
	 * @param staticCfg
	 */
	static async lint(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
		try {
			await new lint(cwd, args, opts).lint();
		} catch (e) {
			console.info(e.message || e.stack || e);
			process.exit(1);
		}
	}

	/**
	 * air gitlint --pretty
	 * air gitlint --lintlast
	 * air gitlint --nogit
	 * @param args
	 * @param cwd
	 * @param opts
	 * @param staticCfg
	 */
	static async gitlint(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
		try {
			await new lint(cwd, args, opts).gitlint();
		} catch (e) {
			console.info(e.message || e.stack || e);
			process.exit(1);
		}
	}

	static async commitlint(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
		await lint.commitlint(args[0]);
	}

	/**
	 * air install -dir path/to/dir
	 * @param args
	 * @param cwd
	 * @param opts
	 */
	static async install(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
		await new lint(cwd, args, opts).install();
	}

	/**
	 * air compress --clean
	 * air compress --debug
	 * air compress style.less other.less -q urlargs
	 * air compress style.less other.less some.js --clean/debug
	 * @param args
	 * @param cwd
	 * @param opts
	 */
	static async compress(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
		let less: Array<string> = [];
		let js: Array<string> = [];
		args.forEach((item) => {
			if (item.charAt(0) !== '-') {
				const ext = item.split('.').pop();
				if (ext == 'js') {
					js.push(item);
				} else if (ext == 'less') {
					less.push(item);
				}
			}
		});
		if (less.length > 0 || js.length > 0) {
			return await new compress(staticCfg, '', {}).compressLessOrJs(opts, less, js);
		}
		if (!staticCfg.fpath) {
			console.log('no config found');
			return;
		}
		await new compress(staticCfg, '', { urlArgs: opts.query }).compress(opts);
	}

	/**
	 *
	 * air template --escape
	 * air template --debug
	 * @param filename
	 * @param data
	 * @param options
	 */
	static async template(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
		const file = args.filter((item) => item.charAt(0) !== '-')[0];
		if (!file) {
			throw new Error(templatetips);
		}
		const query: any = { minimize: true, escape: false };
		if (opts.debug) {
			query.minimize = false;
		}
		if (opts.escape) {
			query.escape = true;
		}
		const tpl = new template(staticCfg, cwd, file, query);
		let res: string;
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

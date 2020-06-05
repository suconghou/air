import lint from './lint';
import compress from './compress';
import { cliArgs, staticOpts } from '../types';

export default class {
	static async lint(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
		await new lint(cwd, args, opts).lint();
	}

	static async gitlint(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
		await new lint(cwd, args, opts).gitlint();
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
	 * @param args
	 * @param cwd
	 * @param opts
	 */
	static async compress(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
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
	static template(filename: string, data: object, options: object, staticCfg: staticOpts) {
		const template = require('art-template');
		Object.assign(template.defaults, options);
		return template(filename, data);
	}
}

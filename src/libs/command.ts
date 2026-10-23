import compress from './compress';
import { cliArgs, staticOpts } from '../types';

export default class {
	/**
	 * air compress --clean
	 * air compress --debug
	 * air compress style.less other.less some.js --clean
	 * air compress -m env=beta
	 */
	static async compress(args: Array<string>, opts: cliArgs, staticCfg: staticOpts) {
		const fakequery = { urlArgs: opts.query, modifyVars: opts.modifyVars };
		const less: Array<string> = [];
		const js: Array<string> = [];
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
			return await new compress(staticCfg, '', fakequery).compressLessOrJs(opts, less, js);
		}
		if (!staticCfg.fpath) {
			console.log('no config found');
			return;
		}
		await new compress(staticCfg, '', fakequery).compress(opts);
	}
}

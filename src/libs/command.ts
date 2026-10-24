import compress from './compress';
import util from './util';
import { cliArgs, staticOpts } from '../types';

// 按文件压缩时不读取 static.json, 使用空配置
function emptyCfg(): staticOpts {
	return { dirname: '', fpath: '', opts: util.normalize({}) };
}

export default class {
	/**
	 * air compress a.less b.js --clean   按文件压缩
	 * air compress -d path/to/static     按 static.json 批量产出
	 */
	static async compress(args: Array<string>, cwd: string, opts: cliArgs) {
		const render = { urlArgs: opts.query, modifyVars: opts.modifyVars };
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
			return await new compress(emptyCfg(), '', render).compressLessOrJs(opts, less, js);
		}
		const { json, fpath, dirname } = await util.getConfig(cwd);
		if (!fpath) {
			console.log('未找到配置文件 static.json');
			return;
		}
		await new compress({ dirname, fpath, opts: json }, '', render).compress(opts);
	}
}

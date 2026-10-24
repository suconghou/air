import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import util, { fsAccess } from './util';

const readFile = promisify(fs.readFile);

export default class {
	constructor(
		private cwd: string,
		private pathname: string
	) {}

	async html(): Promise<string> {
		// 页面文件本身也必须落在根目录内
		return await this.parseHtml(util.resolveIn(this.cwd, this.pathname), this.cwd);
	}

	// SSI 语法: <!--# include file="foo/bar.html" --> 嵌套层级上限 6
	private async parseHtml(mainfile: string, root: string): Promise<string> {
		const contents = new Map<string, string>();
		const read = async (file: string) => {
			if (!contents.has(file)) {
				contents.set(file, (await readFile(file)).toString());
			}
			return contents.get(file) as string;
		};
		// 递归展开: include 相对所在文件目录解析, 这样多层子目录也能正确引用
		const render = async (file: string, depth: number): Promise<string> => {
			if (depth > 6) {
				throw new Error('include 嵌套层级超过 6 层');
			}
			let html = await read(file);
			// 全局正则的 lastIndex 会被并发请求互相干扰, 必须每次调用新建
			const includefile = /<!--#\s{1,5}include\s{1,5}file="([\w+/.-]{3,50})"\s{1,5}-->/g;
			const matches: Record<string, string> = {};
			let res: RegExpExecArray | null;
			while ((res = includefile.exec(html))) {
				matches[res[0]] = res[1];
			}
			for (const holder of Object.keys(matches)) {
				const target = await this.resolveInclude(root, path.dirname(file), matches[holder]);
				// split/join 替换全部同名 include, 且不受内容中 $& 等替换模式影响
				html = html.split(holder).join(await render(target, depth + 1));
			}
			return html;
		};
		return await render(mainfile, 0);
	}

	// 相对路径优先按所在文件目录找, 找不到再回退到站点根, 兼容原先根相对写法
	private async resolveInclude(root: string, dir: string, target: string): Promise<string> {
		if (/^[/\\]/.test(target)) {
			return util.resolveIn(root, target);
		}
		// 相对路径按所在文件目录解析; 只要结果仍在站点根内即合法(允许 ../ 引用根下其他目录)
		const direct = path.resolve(dir, target);
		const local =
			direct === root || direct.startsWith(root + path.sep) ? direct : util.resolveIn(root, target);
		try {
			await fsAccess(local, fs.constants.R_OK);
			return local;
		} catch (_e) {
			// 所在目录下不存在时回退站点根, 兼容根相对写法
			return util.resolveIn(root, target);
		}
	}
}

import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

export default class {
	constructor(
		private cwd: string,
		private pathname: string
	) {}

	async html(): Promise<string> {
		return await this.parseHtml(path.join(this.cwd, this.pathname), this.cwd);
	}

	// SSI 语法: <!--# include file="foo/bar.html" --> 嵌套层级上限 6
	private async parseHtml(mainfile: string, cwd: string): Promise<string> {
		// 全局正则的 lastIndex 会被并发请求互相干扰, 必须每次调用新建
		const includefile = /<!--#\s{1,5}include\s{1,5}file="([\w+/.-]{3,50})"\s{1,5}-->/g;
		const filedir = path.dirname(mainfile);
		let html = (await readFile(mainfile)).toString();
		const filesMap: Record<string, string> = {};

		const fillContents = async (fileList: Array<string>) => {
			const res = await Promise.all(
				fileList.map((item) => readFile(path.join(path.isAbsolute(item) ? cwd : filedir, item)))
			);
			res.forEach((item: Buffer, i: number) => {
				filesMap[fileList[i]] = item.toString();
			});
		};

		for (let depth = 0; depth < 6; depth++) {
			const matches: Record<string, string> = {};
			let res: RegExpExecArray | null;
			while ((res = includefile.exec(html))) {
				matches[res[0]] = res[1];
			}
			if (Object.keys(matches).length === 0) {
				// 无 include 语法,直接返回
				return html;
			}
			await fillContents(Array.from(new Set(Object.values(matches))).filter((file) => !filesMap[file]));
			// split/join 替换全部同名 include, 且不受内容中 $& 等替换模式影响
			Object.keys(matches).forEach((holder) => {
				html = html.split(holder).join(filesMap[matches[holder]]);
			});
		}
		throw new Error('include 嵌套层级超过 6 层');
	}
}

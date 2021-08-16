import * as path from 'path';
import * as querystring from 'querystring';
import { promisify } from 'util';
import * as fs from 'fs';

const readFile = promisify(fs.readFile);

const includefile = /<!--#\s{1,5}include\s{1,5}file="([\w+/.-]{3,50})"\s{1,5}-->/g;

export default class {
	constructor(private cwd: string, private pathname: string, private query: querystring.ParsedUrlQuery) {}

	async html() {
		const main = path.join(this.cwd, this.pathname);
		return await this.parseHtml(main, this.query, this.cwd);
	}

	private async parseHtml(file: string, query: querystring.ParsedUrlQuery, cwd: string): Promise<string> {
		const filedir = path.dirname(file);
		const resfile = await readFile(file);
		let html = resfile.toString();
		let res: any,
			i = 0,
			filesMap = {};

		const fillContents = async () => {
			// 主要目的是将filesMap中的文件都读取缓存起来
			let res: any;
			const fileList = Object.keys(filesMap).filter((item) => {
				// 如果文件的内容之前已读取过,则复用,不再readFile
				return !filesMap[item];
			});
			res = await Promise.all(
				fileList.map((item) => {
					const f = path.join(path.isAbsolute(item) ? cwd : filedir, item);
					return readFile(f);
				})
			);
			res.forEach((item: Buffer, i: number) => {
				filesMap[fileList[i]] = item.toString();
			});
		};

		while (i < 6) {
			const matches = {};
			while ((res = includefile.exec(html))) {
				const [holder, file] = res;
				matches[holder] = file;
				if (!filesMap[file]) {
					filesMap[file] = '';
				}
			}
			if (Object.keys(matches).length === 0) {
				// // 主html文件内,没有include语法,模板引擎不用处理了,直接返回
				return html;
			}
			i++;
			if (i > 5) {
				throw new Error('include file too deep');
			}
			await fillContents();
			Object.keys(matches).forEach((item) => {
				const file = matches[item];
				const content = filesMap[file];
				html = html.replace(item, content);
			});
		}
	}
}

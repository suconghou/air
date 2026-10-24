import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const fsStat = promisify(fs.stat);
const fsAccess = promisify(fs.access);
const fsWriteFile = promisify(fs.writeFile);
const fsReadFile = promisify(fs.readFile);

export { fsAccess, fsWriteFile, fsReadFile };

export default class {
	private static resolveLookupPaths(dir: string, file: string): Array<string> {
		const arr: Array<string> = [];
		const tmp: Array<string> = [];
		dir.split(path.sep).forEach((item) => {
			if (/^[a-zA-Z]:$/.test(item)) {
				// for windows
				return;
			}
			tmp.push(item);
			arr.push(path.resolve(path.join(path.sep, ...tmp, file)));
		});
		return arr.reverse();
	}

	private static async tryFiles(paths: Array<string>) {
		for (const file of paths) {
			try {
				await fsAccess(file, fs.constants.R_OK);
				return file;
			} catch (_e) {
				// not exist try next
			}
		}
		return '';
	}

	// 把相对路径限制在 root 内; 越界(../ 或指向外部的绝对路径)直接拒绝
	public static resolveIn(root: string, rel: string): string {
		const base = path.resolve(root);
		const target = path.resolve(base, rel.replace(/^[/\\]+/, ''));
		if (target !== base && !target.startsWith(base + path.sep)) {
			throw new Error('403 forbidden');
		}
		return target;
	}

	// 文件清单的 mtime 是否仍与记录一致; 文件缺失视为已变更
	public static async sameTime(files: Array<string>, time: number) {
		try {
			return (await this.getUpdateTime(files)) === time;
		} catch (_e) {
			return false;
		}
	}

	// 补齐配置缺省字段, 防止畸形配置(如热更新写入)导致运行期取值崩溃
	public static normalize(json: any) {
		json = json && typeof json == 'object' ? json : {};
		json.lessOptions = json.lessOptions || {};
		json.static = json.static || {};
		json.static.css = json.static.css || {};
		json.static.js = json.static.js || {};
		return json;
	}

	public static async getConfig(cwd: string, name = 'static.json') {
		// 已位于 static 目录时直接查找, 否则拼上 static; 用 basename 避免 mystatic 这类目录误判
		if (path.basename(cwd) != 'static') {
			cwd = path.join(cwd, 'static');
		}
		const paths = this.resolveLookupPaths(cwd, name);
		let f = '',
			// 无配置文件时也要返回带缺省字段的配置, 否则调用方取 static.css 会崩
			json: any = this.normalize({}),
			fpath = '',
			dirname = '';
		f = await this.tryFiles(paths);
		if (f) {
			try {
				json = this.normalize(JSON.parse(fs.readFileSync(f, 'utf-8')));
			} catch (e: any) {
				throw new Error('配置文件解析失败 ' + f + ' ' + (e.message || e));
			}
			fpath = f;
			dirname = path.dirname(f);
		}
		return { json, fpath, dirname };
	}

	public static async getUpdateTime(files: Array<string>) {
		const stats = await Promise.all(files.map((file) => fsStat(file)));
		return Math.max(...stats.map((s) => s.mtime.getTime()));
	}

	public static async getContent(files: Array<string>) {
		const res = await Promise.all(files.map((file) => fsReadFile(file, 'utf-8')));
		const objs: Record<string, string> = {};
		files.forEach((file, index) => {
			objs[file] = res[index];
		});
		return objs;
	}
}

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const fsStat = promisify(fs.stat);
const fsAccess = promisify(fs.access);
const fsWriteFile = promisify(fs.writeFile);
const fsReadFile = promisify(fs.readFile);
const fsCopyFile = promisify(fs.copyFile);
const fsChmod = promisify(fs.chmod);

export { fsStat, fsAccess, fsChmod, fsWriteFile, fsCopyFile, fsReadFile };

export default class {
	public static resolveLookupPaths(pathstr: string, file: string): Array<string> {
		const arr: Array<string> = [];
		const tmp: Array<string> = [];
		pathstr.split(path.sep).forEach((item) => {
			if (/^[a-zA-Z]:$/.test(item)) {
				// for windows
				return;
			}
			tmp.push(item);
			arr.push(path.resolve(path.join(path.sep, ...tmp, file)));
		});
		return arr.reverse();
	}

	public static async tryFiles(paths: Array<string>) {
		for (let i = 0, j = paths.length; i < j; i++) {
			const file = paths[i];
			try {
				await fsAccess(file, fs.constants.R_OK);
				return file;
			} catch (_e) {
				// not exist try next
			}
		}
		return '';
	}

	public static async getConfig(cwd: string, name = 'static.json') {
		if (!/static\/?$/.test(cwd)) {
			cwd = path.join(cwd, 'static');
		}
		const paths = this.resolveLookupPaths(cwd, name);
		let f = '',
			json = {},
			fpath = '',
			dirname = '';
		f = await this.tryFiles(paths);
		if (f) {
			json = require(f);
			fpath = f;
			dirname = path.dirname(f);
		}
		return { json, fpath, dirname };
	}

	public static async getUpdateTime(files: Array<string>) {
		const mtimes: Array<number> = [];
		for (let i = 0, j = files.length; i < j; i++) {
			const v = files[i];
			const stat = await fsStat(v);
			mtimes.push(stat.mtime.getTime());
		}
		const updateTime = Math.max.apply(this, mtimes);
		return updateTime;
	}

	public static async getContent(files: Array<string>) {
		const arr = files.map((file) => fsReadFile(file, 'utf-8'));
		const res = await Promise.all(arr);
		const objs = {};
		files.forEach((file, index) => {
			objs[file] = res[index];
		});
		return objs;
	}
}

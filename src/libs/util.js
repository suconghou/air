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
	static resolveLookupPaths(pathstr, file) {
		const arr = [];
		const tmp = [];
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
	static async tryFiles(paths) {
		for (let i = 0, j = paths.length; i < j; i++) {
			const file = paths[i];
			try {
				await fsAccess(file, fs.constants.R_OK);
				return file;
			} catch (e) {
				// not exist try next
			}
		}
	}
	static async getConfig(cwd, name = 'static.json') {
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
	static async getUpdateTime(files) {
		const mtimes = [];
		for (let i = 0, j = files.length; i < j; i++) {
			const v = files[i];
			const stat = await fsStat(v);
			mtimes.push(stat.mtime.getTime());
		}
		const updateTime = Math.max.apply(this, mtimes);
		return updateTime;
	}
	static async getContent(files) {
		const arr = files.map((file) => fsReadFile(file, 'utf-8'));
		const res = await Promise.all(arr);
		const objs = {};
		files.forEach((file, index) => {
			objs[file] = res[index];
		});
		return objs;
	}
}

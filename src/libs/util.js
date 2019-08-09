import process from 'process';
import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const fsStat = promisify(fs.stat);
const fsAccess = promisify(fs.access);

const fsWriteFile = promisify(fs.writeFile);

const fsReadFile = promisify(fs.readFile);

const fsCopyFile = promisify(fs.copyFile);

const fsChmod = promisify(fs.chmod);

export { fsStat, fsAccess, fsChmod, fsWriteFile, fsCopyFile, fsReadFile };

export default {
	resolveLookupPaths(pathstr, file) {
		const arr = [];
		const tmp = [];
		pathstr.split(path.sep).forEach(item => {
			if (/^[a-zA-Z]:$/.test(item)) {
				// for windows
				return;
			}
			tmp.push(item);
			arr.push(path.resolve(path.join(path.sep, ...tmp, file)));
		});
		return arr.reverse();
	},
	async getConfig(cwd, name) {
		if (!/static$/.test(cwd)) {
			cwd = path.join(cwd, 'static');
		}
		const paths = this.resolveLookupPaths(cwd, name);
		let f,
			json = {};
		try {
			f = await this.tryFiles(paths);
		} catch (e) {
			// no config found
		}
		if (f) {
			json = require(f);
			json.configfile = f;
			json.path = path.dirname(f);
		}
		return json;
	},
	async tryFiles(paths) {
		for (let i = 0, j = paths.length; i < j; i++) {
			const file = paths[i];
			try {
				await fsAccess(file, fs.constants.R_OK);
				return file;
			} catch (e) {
				// not exist try next
			}
		}
		throw new Error('not exist');
	},
	async getUpdateTime(files) {
		const mtimes = [];
		for (let i = 0, j = files.length; i < j; i++) {
			const v = files[i];
			const stat = await fsStat(v);
			mtimes.push(stat.mtime.getTime());
		}
		const updateTime = Math.max.apply(this, mtimes);
		return updateTime;
	},
	getName(cwd, files, ext) {
		const name = files
			.map(item => {
				return path.basename(item, ext);
			})
			.join('-');
		return path.join(cwd, name);
	},

	getStatus() {
		const data = {
			pid: process.pid,
			node: process.version,
			os: process.platform + process.arch,
			uptime: process.uptime()
		};
		return data;
	},

	exit(e, code) {
		const str = e.toString() + os.EOL;
		process.stderr.write(str);
		process.exit(code);
	}
};

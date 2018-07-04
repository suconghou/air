import fs from "fs";
import util from "util";
import path from "path";

export default {
	resolveLookupPaths(pathstr, file) {
		const arr = [];
		const tmp = [];
		pathstr.split(path.sep).forEach(item => {
			tmp.push(item);
			arr.push(path.resolve(path.join(path.sep, ...tmp, file)));
		});
		return arr.reverse();
	},
	getConfig(cwd, name) {
		const paths = this.resolveLookupPaths(cwd, name);
		const f = this.findExist(paths);
		if (f) {
			try {
				const json = require(f);
				return json;
			} catch (e) {
				console.error(e.toString());
			}
		}
		return {};
	},
	findExist(paths) {
		for (let i = 0, j = paths.length; i < j; i++) {
			const file = paths[i];
			try {
				fs.accessSync(file, fs.constants.R_OK);
				return file;
			} catch (e) {}
		}
	},
	getMaxUpdateTime: function(files) {
		const mtimes = [];
		for (let i = 0, j = files.length; i < j; i++) {
			const v = files[i];
			const stat = fs.statSync(v);
			mtimes.push(stat.mtime.getTime());
		}
		const updateTime = Math.max.apply(this, mtimes);
		return updateTime;
	}
};

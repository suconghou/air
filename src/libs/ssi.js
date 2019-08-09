import path from 'path';
import util from 'util';
import fs from 'fs';
import utiljs from './utiljs.js';

const readFile = util.promisify(fs.readFile);

const includefile = /<!--#\s{1,5}include\s{1,5}file="([\w+/.]{3,50})"\s{1,5}-->/g;

export default {
	load(response, matches, query, cwd, config, params) {
		const file = matches[0];
		return this.loadHtml(response, file, query, cwd, config, params);
	},
	async loadHtml(response, file, query, cwd, config, params) {
		if (params.art) {
			return this.artHtml(response, file, query, cwd, config, params);
		}
		const main = path.join(cwd, file);
		const res = await this.parseHtml(main, query, cwd);
		if (res) {
			response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'public,max-age=5' });
			response.end(res);
			return true;
		} else {
			return false;
		}
	},
	async artHtml(response, file, query, cwd, config, params) {
		if (file.charAt(0) == '/') {
			file = file.substr(1);
		}
		const template = require('art-template');
		const debug = !!params.debug;
		const escape = !!params.escape;
		const options = {
			debug: debug,
			minimize: !debug,
			compileDebug: debug,
			escape: escape,
			root: cwd,
			cache: false
		};
		Object.assign(template.defaults, options);
		const dstfile = path.join(cwd, file);
		let data = query;
		if (config.template && config.template[file]) {
			const v = config.template[file];
			let r = {};
			if (utiljs.isObject(v)) {
				r = v;
			} else {
				const datafile = path.join(cwd, config.template[file]);
				r = require(datafile);
			}
			data = Object.assign({}, data, r);
		}
		const html = template(dstfile, data);
		response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'public,max-age=5' });
		response.end(html);
		return true;
	},
	async parseHtml(file, query, cwd) {
		let html;
		try {
			const res = await readFile(file);
			html = res.toString();
		} catch (e) {
			return false;
		}

		let res,
			i = 0,
			filesMap = {};

		const fillContents = async () => {
			let res;
			let fileList = Object.keys(filesMap).filter(item => {
				return !filesMap[item];
			});
			res = await Promise.all(
				fileList.map(item => {
					return readFile(path.join(cwd, item));
				})
			);
			res.forEach((item, i) => {
				filesMap[fileList[i]] = item.toString();
			});
		};

		while (i < 6) {
			let matches = {};
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
			Object.keys(matches).forEach(item => {
				const file = matches[item];
				const content = filesMap[file];
				html = html.replace(item, content);
			});
		}
	}
};

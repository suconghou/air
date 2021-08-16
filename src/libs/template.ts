import * as querystring from 'querystring';
import * as path from 'path';
import { staticOpts } from '../types';
import utiljs from './utiljs';
import ssi from './ssi';

export default class {
	constructor(
		private opts: staticOpts,
		private cwd: string,
		private pathname: string,
		private query: querystring.ParsedUrlQuery
	) {}

	art() {
		let file = this.pathname;
		if (file.charAt(0) == '/') {
			file = file.substr(1);
		}
		const template = require('art-template');
		const { minimize, escape } = this.query;
		const options = {
			debug: !minimize,
			minimize,
			compileDebug: !minimize,
			escape: escape,
			root: this.cwd,
			cache: false,
		};
		Object.assign(template.defaults, options);
		const dstfile = path.join(this.cwd, file);
		let data = this.query ? { ...this.query } : {};
		const config = this.opts.opts;
		if (config.template && config.template[file]) {
			const v = config.template[file];
			let r = {};
			if (utiljs.isObject(v)) {
				r = v;
			} else {
				const datafile = path.join(this.cwd, config.template[file]);
				r = require(datafile);
			}
			data = Object.assign({}, r, data);
		}
		return template(dstfile, Object.keys(data).length > 0 ? data : {});
	}

	async ssi() {
		const s = new ssi(this.cwd, this.pathname, this.query);
		const html = await s.html();
		return html;
	}
}

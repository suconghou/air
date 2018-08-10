import path from 'path';
import fs from 'fs';
import util from 'util';
import process from 'process';
import os from 'os';
import compress from './compress.js';
import utiljs from './utiljs.js';
import utilnode, { fsWriteFile } from './util.js';
import httpserver from './httpserver.js';
import lint from './lint.js';
import template from './template.js';

const configName = 'static.json';

export default class server {
	constructor(cwd) {
		this.cwd = cwd;
	}

	async serve(args) {
		try {
			const params = utiljs.getParams(args);
			const cwd = params.root ? params.root : this.cwd;
			const config = await utilnode.getConfig(cwd, configName);
			new httpserver(params).start(config);
		} catch (e) {
			utilnode.exit(e, 1);
		}
	}

	template(args) {
		const params = utiljs.getParams(args);
		const [file, datafile] = args;
		if (file && datafile) {
			try {
				const data = require(path.join(this.cwd, datafile));
				let options = {
					debug: params.debug,
					minimize: !params.debug,
					compileDebug: !!params.debug,
					escape: !!params.escape,
					root: this.cwd
				};
				const res = template.template(path.join(this.cwd, file), data, options);
				if (params.output) {
					(async () => {
						try {
							let dstfile;
							if (path.isAbsolute(params.output)) {
								dstfile = params.output;
							} else {
								dstfile = path.join(this.cwd, params.output);
							}
							await fsWriteFile(dstfile, res);
						} catch (e) {
							utilnode.exit(e, 1);
						}
					})();
				} else {
					process.stdout.write(res + os.EOL);
				}
			} catch (e) {
				utilnode.exit(e, 1);
			}
		} else {
			utilnode.exit('file and filedata must be set', 1);
		}
	}

	run(args) {}

	lint(args) {
		new lint(this.cwd, args).lint();
	}

	gitlint(args) {
		new lint(this.cwd, args).lint();
	}

	install(args) {
		new lint(this.cwd, args).install();
	}

	async compress(args) {
		try {
			const config = await utilnode.getConfig(this.cwd, configName);
			const params = utiljs.getParams(args);
			const filed = args.filter(item => item.charAt(0) !== '-').length;
			if (args && args.length > 0 && filed) {
				const less = args
					.filter(item => {
						return item.split('.').pop() == 'less';
					})
					.map(item => {
						return path.join(this.cwd, item);
					});
				const js = args
					.filter(item => {
						return item.split('.').pop() == 'js';
					})
					.map(item => {
						return path.join(this.cwd, item);
					});
				if (less.length) {
					const lessOps = Object.assign({ compress: params.debug ? false : true }, params);
					const res = await compress.compressLess(less, lessOps);
					const file = utilnode.getName(this.cwd, less, '.less');
					await fsWriteFile(`${file}.min.css`, res.css);
				}
				if (js.length) {
					const res = await compress.compressJs(js, params);
					const file = utilnode.getName(this.cwd, js, '.js');
					await fsWriteFile(`${file}.min.js`, res.code);
				}
			} else {
				compress.compressByConfig(config, params);
			}
		} catch (e) {
			utilnode.exit(e, 1);
		}
	}
}

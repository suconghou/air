import path from 'path';
import fs from 'fs';
import util from 'util';
import process from 'process';
import os from 'os';
import compress from './compress.js';
import utiljs from './utiljs.js';
import utilnode from './util.js';
import httpserver from './httpserver.js';
import lint from './lint.js';
import template from './template.js';

const configName = 'static.json';

export default class server {
	constructor(cwd) {
		this.cwd = cwd;
	}

	serve(args) {
		const params = utiljs.getParams(args);
		const cwd = params.root ? params.root : this.cwd;
		const config = utilnode.getConfig(cwd, configName);
		new httpserver(params).start(config);
	}

	template(args) {
		const params = utiljs.getParams(args);
		const [file, datafile] = args;
		const writeFile = util.promisify(fs.writeFile);
		if (file && datafile) {
			try {
				const data = require(path.join(this.cwd, datafile));
				let options = {
					debug: params.debug,
					minimize: !params.debug,
					escape: params.escape
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
							await writeFile(dstfile, res);
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

	compress(args) {
		const config = utilnode.getConfig(this.cwd, configName);
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
				compress
					.compressLess(less, Object.assign({ compress: params.debug ? false : true }, params))
					.then(res => {
						const file = utilnode.getName(this.cwd, less, '.less');
						fs.writeFileSync(`${file}.min.css`, res.css);
					})
					.catch(err => {
						console.error(err.toString());
					});
			}
			if (js.length) {
				compress
					.compressJs(js, params)
					.then(res => {
						const file = utilnode.getName(this.cwd, js, '.js');
						fs.writeFileSync(`${file}.min.js`, res.code);
					})
					.catch(err => {
						console.error(err.toString());
					});
			}
		} else {
			compress.compressByConfig(config, params);
		}
	}
}

import * as fs from 'fs';
import * as querystring from 'querystring';
import util, { fsWriteFile, fsReadFile, fsAccess } from './util';
import * as path from 'path';
import { staticOpts, cliArgs, lessopts, jsopts } from '../types';
import tool from './tool';

export default class {
	private options: lessopts = { urlArgs: '', compress: false, env: 'development' };
	private jopts: jsopts = { debug: true, clean: false };

	constructor(private opts: staticOpts, private pathname: string, private query: querystring.ParsedUrlQuery) {
		this.options.urlArgs = query.urlArgs ? query.urlArgs.toString() : '';
	}

	// 解析优先级, 配置文件>连字符>less文件查找>静态文件
	private async resolveLess(): Promise<Array<string>> {
		const pathname = this.pathname.replace('.css', '').replace(/^\//, '');
		const css = this.opts.opts.static ? Object.keys(this.opts.opts.static.css) || [] : [];
		const curr = pathname.replace(/.*static\//, '');
		if (css.includes(curr + '.css')) {
			return this.opts.opts.static.css[curr + '.css'].map((item: string) => path.join(this.opts.dirname, item));
		}

		if (/-/.test(curr)) {
			const dirs = pathname.split('/');
			const segment = dirs.pop();
			return segment
				.split('-')
				.filter((item) => item)
				.map((item) => {
					return path.join(this.opts.dirname, ...dirs, item) + '.less';
				});
		}
		// 先尝试less文件,无less文件fallback到css
		let target = path.join(this.opts.dirname, curr) + '.less';
		try {
			await fsAccess(target, fs.constants.R_OK);
		} catch (e) {
			target = path.join(this.opts.dirname, curr) + '.css';
		}
		return [target];
	}

	async resolveJs(): Promise<Array<string>> {
		const pathname = this.pathname.replace('.js', '').replace(/^\//, '');
		const js = this.opts.opts.static ? Object.keys(this.opts.opts.static.js) || [] : [];
		const curr = pathname.replace(/.*static\//, '');
		if (js.includes(curr + '.js')) {
			return this.opts.opts.static.js[curr + '.js'].map((item: string) => path.join(this.opts.dirname, item));
		}
		if (/-/.test(curr)) {
			const dirs = curr.split('/');
			const segment = dirs.pop();
			return segment
				.split('-')
				.filter((item) => item)
				.map((item) => {
					return path.join(this.opts.dirname, ...dirs, item) + '.js';
				});
		}

		return [path.join(this.opts.dirname, curr) + '.js'];
	}

	async less() {
		const files = await this.resolveLess();
		if (files.length == 1 && files[0].match(/\.css$/)) {
			const text = await fsReadFile(files[0]);
			return {
				ret: {
					css: text,
				},
				hit: false,
			};
		}

		const time = await util.getUpdateTime(files);

		const ret = tool.get(this.pathname);
		if (ret && ret.time == time && ret.urlArgs == this.options.urlArgs) {
			return { ret, hit: true };
		}

		const r = await this.compileLess(files);
		const res = { css: r, time, urlArgs: this.options.urlArgs };
		tool.set(this.pathname, res);

		return { ret: res, hit: false };
	}

	private async compileLess(files: Array<string>) {
		const lessInput = files
			.map((item) => {
				return '@import "' + item + '";';
			})
			.join('\r\n');

		let { urlArgs, compress, env } = this.options;

		const less = require('less');
		const autoprefix = require('less-plugin-autoprefix');
		const option = {
			plugins: [new autoprefix({ browsers: ['last 5 versions', 'ie > 9', 'Firefox ESR'] })],
			paths: this.opts.dirname,
			urlArgs,
			compress,
			env,
		};
		const ret: any = await less.render(lessInput, option);
		return ret.css;
	}

	async Js() {
		const files = await this.resolveJs();
		const time = await util.getUpdateTime(files);
		const ret = tool.get(this.pathname);
		if (ret && ret.time == time) {
			return { ret, hit: true };
		}
		const r = await this.compileJs(files);
		const res = { js: r, time };
		tool.set(this.pathname, res);
		return { ret: res, hit: false };
	}

	private async compileJs(files: Array<string>) {
		let options: any;
		if (this.jopts.debug) {
			options = {
				mangle: false,
				compress: false,
				ecma: 2016,
				keep_classnames: true,
				keep_fnames: true,
				output: {
					comments: true,
					beautify: true,
					ecma: 2016,
				},
			};
		} else {
			options = {
				ecma: 5,
				mangle: true,
				compress: {
					drop_debugger: false,
					drop_console: false,
				},
				output: {
					comments: false,
					beautify: false,
					ecma: 5,
				},
			};
			if (this.jopts.clean) {
				options.compress.drop_console = true;
				options.compress.drop_debugger = true;
			}
		}
		const filesMap = await util.getContent(files);
		const terser = require('terser');
		const ret: any = await new Promise((resolve, reject) => {
			const result = terser.minify(filesMap, options);
			const er = result.error;
			if (er) {
				const s = er.toString();
				const { filename, line, col, pos } = er;
				er.toString = () => {
					return `${filename}: ${s} on line ${line}, ${col}:${pos}`;
				};
				return reject(er);
			}
			resolve(result);
		});
		return ret.code;
	}

	async compress(cliargs: cliArgs) {
		this.options.env = 'production';
		this.options.compress = !cliargs.debug;
		this.jopts.debug = cliargs.debug;
		this.jopts.clean = cliargs.clean;
		const { css, js } = this.opts.opts.static;
		for (let item in css) {
			const source = css[item];
			const ret = await this.compileLess(source);
			await fsWriteFile(path.join(this.opts.dirname, item), ret);
		}
		for (let item in js) {
			const source = js[item].map((item: string) => path.join(this.opts.dirname, item));
			const ret = await this.compileJs(source);
			await fsWriteFile(path.join(this.opts.dirname, item), ret);
		}
	}

	async compressLessOrJs(cliargs: cliArgs, less: Array<string>, js: Array<string>) {
		this.options.env = 'production';
		this.options.compress = !cliargs.debug;
		this.jopts.debug = cliargs.debug;
		this.jopts.clean = cliargs.clean;
		if (less.length > 0) {
			const dst = less[0].replace(/\.less$/, '.min.css');
			const ret = await this.compileLess(less);
			await fsWriteFile(dst, ret);
		}
		if (js.length > 0) {
			const dst = js[0].replace(/\.js$/, '.min.js');
			const ret = await this.compileJs(js);
			await fsWriteFile(dst, ret);
		}
	}
}

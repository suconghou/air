import * as querystring from 'querystring';
import util, { fsWriteFile } from './util';
import * as path from 'path';
import { staticOpts, cliArgs, lessopts, jsopts } from '../types';
import tool from './tool';

export default class {
	private options: lessopts = { ver: '', compress: false, env: 'development' };
	private jopts: jsopts = { debug: true, clean: false };

	constructor(private opts: staticOpts, private pathname: string, private query: querystring.ParsedUrlQuery) {}

	// 解析优先级, 配置文件>连字符>less文件查找>静态文件
	private async resolveLess(): Promise<Array<string>> {
		const pathname = this.pathname.replace('.css', '').replace(/^\//, '');
		const css = this.opts.opts.static ? Object.keys(this.opts.opts.static.css) || [] : [];
		const curr = pathname.replace(/.*\/static\//, '');
		if (css.includes(curr)) {
			return css[curr].map((item: string) => path.join(this.opts.dirname, item));
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
		return [path.join(this.opts.dirname, curr) + '.less'];
	}

	async resolveJs(): Promise<Array<string>> {
		const pathname = this.pathname.replace('.js', '').replace(/^\//, '');
		const js = this.opts.opts.static ? Object.keys(this.opts.opts.static.js) || [] : [];
		const curr = pathname.replace(/.*\/static\//, '');
		if (js.includes(curr)) {
			return js[curr].map((item: string) => path.join(this.opts.dirname, item));
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

		const time = await util.getUpdateTime(files);

		const ret = tool.get(this.pathname);
		if (ret && ret.time == time && ret.ver == this.options.ver) {
			return { ret, hit: true };
		}

		const r = await this.compileLess(files);
		const res = { css: r, time, ver: this.options.ver };
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
		if (ret && ret.time == time && ret.ver == this.options.ver) {
			return { ret, hit: true };
		}
		const r = await this.compileJs(files);
		const res = { js: r, time, ver: this.options.ver };
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
			};
		} else {
			options = {
				ecma: 5,
				mangle: true,
				compress: {
					arguments: true,
					booleans_as_integers: true,
					drop_debugger: false,
					drop_console: false,
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
}

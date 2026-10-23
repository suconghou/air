import * as fs from 'fs';
import * as querystring from 'querystring';
import util, { fsWriteFile, fsReadFile, fsAccess } from './util';
import * as path from 'path';
import { staticOpts, cliArgs, lessopts, jsopts } from '../types';

// 编译结果缓存: 键为请求路径, 值含源文件清单与 mtime; 超上限整体清空, 避免常驻进程内存无限增长
const cache = new Map<string, any>();
const cacheMax = 1000;
const cacheSet = (k: string, v: any) => {
	if (cache.size >= cacheMax) {
		cache.clear();
	}
	cache.set(k, v);
};

export default class {
	private options: lessopts = {
		urlArgs: '',
		globalVars: {},
		modifyVars: {},
		compress: false,
		env: 'development',
	};
	private jopts: jsopts = { debug: true, clean: false };

	constructor(
		private opts: staticOpts,
		private pathname: string,
		private query: querystring.ParsedUrlQuery
	) {
		const lessOptions = opts.opts.lessOptions || {};
		this.options.urlArgs = query.urlArgs
			? query.urlArgs.toString()
			: process.env.URLARGS || lessOptions.urlArgs || '';
		this.options.globalVars = process.env.GLOBALVARS
			? (querystring.parse(process.env.GLOBALVARS) as Record<string, string>)
			: lessOptions.globalVars || {};
		this.options.modifyVars = query.modifyVars
			? (querystring.parse(query.modifyVars.toString()) as Record<string, string>)
			: process.env.MODIFYVARS
			? (querystring.parse(process.env.MODIFYVARS) as Record<string, string>)
			: lessOptions.modifyVars || {};
		this.options.math = lessOptions.math;
	}

	// 解析优先级, 配置文件>连字符>less文件查找>静态文件
	private async resolveLess(): Promise<Array<string>> {
		const pathname = this.pathname.replace(/\.css$/, '').replace(/^\//, '');
		const css = Object.keys(this.opts.opts.static.css || {});
		// dirname存在说明有配置文件,无配置文件时按照原始地址
		const curr = this.opts.dirname ? pathname.replace(/.*static\//, '') : pathname;
		if (this.opts.dirname && css.includes(curr + '.css')) {
			return this.opts.opts.static.css[curr + '.css'].map((item: string) => path.join(this.opts.dirname, item));
		}
		if (/-/.test(curr)) {
			return await this.hyphenSplit(curr, '.css', '.less');
		}
		// 先尝试less文件,无less文件fallback到css
		let target = path.join(this.opts.dirname, curr) + '.less';
		try {
			await fsAccess(target, fs.constants.R_OK);
		} catch (_e) {
			target = path.join(this.opts.dirname, curr) + '.css';
		}
		return [target];
	}

	// 解析优先级, 配置文件>连字符>静态文件
	async resolveJs(): Promise<Array<string>> {
		const pathname = this.pathname.replace(/\.js$/, '').replace(/^\//, '');
		const js = Object.keys(this.opts.opts.static.js || {});
		const curr = this.opts.dirname ? pathname.replace(/.*static\//, '') : pathname;
		if (this.opts.dirname && js.includes(curr + '.js')) {
			return this.opts.opts.static.js[curr + '.js'].map((item: string) => path.join(this.opts.dirname, item));
		}
		if (/-/.test(curr)) {
			return await this.hyphenSplit(curr, '.js', '.js');
		}
		return [path.join(this.opts.dirname, curr) + '.js'];
	}

	// 连字符拆分: a-b.css -> a.less + b.less; 若带连字符的文件确实存在则整体返回
	private async hyphenSplit(curr: string, ext: string, outExt: string): Promise<Array<string>> {
		const f = path.join(this.opts.dirname, curr) + ext;
		try {
			await fsAccess(f, fs.constants.R_OK);
			return [f];
		} catch (_e) {
			const dirs = curr.split('/');
			const segment = dirs.pop() || '';
			return segment
				.split('-')
				.filter((item) => item)
				.map((item) => path.join(this.opts.dirname, ...dirs, item) + outExt);
		}
	}

	async less() {
		const files = await this.resolveLess();
		if (files.length == 1 && /\.css$/.test(files[0])) {
			// 单个css静态文件,直接输出
			const text = await fsReadFile(files[0]);
			return {
				ret: {
					css: text,
				},
				hit: false,
			};
		}

		const time = await util.getUpdateTime(files);
		const filesKey = files.join();
		const ret = cache.get(this.pathname);
		if (ret && ret.time == time && ret.urlArgs == this.options.urlArgs && ret.files == filesKey) {
			return { ret, hit: true };
		}

		const r = await this.compileLess(files);
		const res = { css: r, time, urlArgs: this.options.urlArgs, files: filesKey };
		cacheSet(this.pathname, res);

		return { ret: res, hit: false };
	}

	async Js() {
		const files = await this.resolveJs();
		if (files.length == 1) {
			// 单个js静态文件,直接输出(这里是http响应)
			const text = await fsReadFile(files[0]);
			return {
				ret: {
					js: text,
				},
				hit: false,
			};
		}

		const time = await util.getUpdateTime(files);
		const filesKey = files.join();
		const ret = cache.get(this.pathname);
		if (ret && ret.time == time && ret.files == filesKey) {
			return { ret, hit: true };
		}
		const r = await this.compileJs(files);
		const res = { js: r, time, files: filesKey };
		cacheSet(this.pathname, res);
		return { ret: res, hit: false };
	}

	private async compileLess(files: Array<string>) {
		const lessInput = files
			.map((item) => {
				return '@import "' + item + '";';
			})
			.join('\r\n');

		const { urlArgs, globalVars, modifyVars, compress, env, math } = this.options;

		const less = require('less');
		const autoprefix = require('less-plugin-autoprefix');
		const option = {
			plugins: [new autoprefix({ browsers: ['last 5 versions', 'ie > 9', 'Firefox ESR'] })],
			paths: this.opts.dirname,
			urlArgs,
			globalVars,
			modifyVars,
			compress,
			env,
			math,
		};
		try {
			const ret: any = await less.render(lessInput, option);
			return ret.css;
		} catch (e: any) {
			throw new Error('less 编译失败 ' + (e.message || e));
		}
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
		try {
			const ret: any = await terser.minify(filesMap, options);
			if (ret.error) {
				throw ret.error;
			}
			return ret.code;
		} catch (e: any) {
			const loc = e.filename ? ` ${e.filename}:${e.line},${e.col}` : '';
			throw new Error('js 压缩失败' + loc + ' ' + (e.message || e));
		}
	}

	async compress(cliargs: cliArgs) {
		this.options.env = 'production';
		this.options.compress = !cliargs.debug;
		this.jopts.debug = !!cliargs.debug;
		this.jopts.clean = !!cliargs.clean;
		const { css, js } = this.opts.opts.static;
		for (const item in css) {
			const files = css[item].map((file: string) => path.join(this.opts.dirname, file));
			const ret = await this.compileLess(files);
			await fsWriteFile(path.join(this.opts.dirname, item), ret);
		}
		for (const item in js) {
			const files = js[item].map((file: string) => path.join(this.opts.dirname, file));
			const ret = await this.compileJs(files);
			await fsWriteFile(path.join(this.opts.dirname, item), ret);
		}
	}

	async compressLessOrJs(cliargs: cliArgs, less: Array<string>, js: Array<string>) {
		this.options.env = 'production';
		this.options.compress = !cliargs.debug;
		this.jopts.debug = !!cliargs.debug;
		this.jopts.clean = !!cliargs.clean;
		if (less.length > 0) {
			const cssdst = less[0].replace(/\.less$/, '.min.css');
			const cssret = await this.compileLess(less);
			await fsWriteFile(cssdst, cssret);
		}
		if (js.length > 0) {
			const jsdst = js[0].replace(/\.js$/, '.min.js');
			const jsret = await this.compileJs(js);
			await fsWriteFile(jsdst, jsret);
		}
	}
}

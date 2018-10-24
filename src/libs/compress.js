import fs from 'fs';
import os from 'os';
import util, { fsWriteFile } from './util.js';
import path from 'path';
import tool from './tool.js';
import utiljs from './utiljs.js';

export default {
	compressLessReq(response, matches, query, cwd, config) {
		const key = matches[0].replace('.css', '');
		const dirs = key.split('/');
		const segment = dirs.pop();
		const files = utiljs.unique(
			segment
				.split('-')
				.filter(item => item)
				.map(item => {
					return path.join(cwd, ...dirs, item) + '.less';
				})
		);
		const options = { urlArgs: query.ver ? `ver=${query.ver}` : null, env: 'development', useFileCache: false };

		return new Promise(async (resolve, reject) => {
			try {
				const maxtime = await util.getUpdateTime(files);
				try {
					const { css, hit } = await this.compressLessCache(maxtime, key, files, options);
					response.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'public,max-age=5', 'X-Cache': hit ? 'hit' : 'miss' });
					response.end(css);
					resolve(true);
				} catch (e) {
					reject(e);
				}
			} catch (e) {
				if (e.syscall !== 'stat') {
					return reject(e);
				}
				const k = matches[0].replace(/\/static\//, '');
				if (!config.static) {
					return resolve(false);
				}
				const { css } = config.static;
				if (css) {
					const entry = Object.keys(css);
					if (entry.includes(k)) {
						const hotfiles = css[k].map(item => path.join(config.path, item));
						try {
							const mtime = await util.getUpdateTime(hotfiles);
							const { css, hit } = await this.compressLessCache(mtime, k, hotfiles, options);
							response.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'public,max-age=5', 'X-Cache': hit ? 'hit' : 'miss' });
							response.end(css);
							resolve(true);
						} catch (e) {
							reject(e);
						}
					} else {
						resolve(false);
					}
				}
			}
		});
	},

	async compressLessCache(mtime, key, files, options) {
		const cache = tool.get(key);
		if (cache && cache.maxTime == mtime && options.urlArgs == cache.urlArgs) {
			return { css: cache.css, hit: true };
		}
		const ret = await this.compressLess(files, options);
		tool.set(key, { css: ret.css, urlArgs: options.urlArgs, maxTime: mtime });
		return { css: ret.css, hit: false };
	},

	compressLess(files, options) {
		let { paths, urlArgs, compress, useFileCache, env } = options || {};
		const lessfiles = utiljs.unique(files);
		var lessInput = lessfiles
			.map(function(item) {
				return '@import "' + item + '";';
			})
			.join('\r\n');
		const less = require('less');
		const autoprefix = require('less-plugin-autoprefix');
		const option = { plugins: [new autoprefix({ browsers: ['last 5 versions', 'ie > 8', 'Firefox ESR'] })], paths, urlArgs, compress, useFileCache, env };
		this.cleanLessCache(less, lessfiles);
		return new Promise((resolve, reject) => {
			less.render(lessInput, option)
				.then(resolve, reject)
				.catch(reject);
		});
	},

	cleanLessCache(less, files) {
		const fileManagers = (less.environment && less.environment.fileManagers) || [];
		fileManagers.forEach(fileManager => {
			if (fileManager.contents) {
				Object.keys(fileManager.contents).forEach(k => {
					if (files.includes(k)) {
						delete fileManager.contents[k];
					}
				});
			}
		});
	},

	compressJsReg(response, matches, query, cwd, config) {
		const key = matches[0].replace('.js', '');
		const dirs = key.split('/');
		const segment = dirs.pop();
		const files = utiljs.unique(
			segment
				.split('-')
				.filter(item => item)
				.map(item => {
					return path.join(cwd, ...dirs, item) + '.js';
				})
		);
		const options = { debug: true };
		// 优先级 连字符>配置文件>静态文件
		return new Promise(async (resolve, reject) => {
			try {
				const maxtime = await util.getUpdateTime(files);
				if (files.length === 1) {
					// 请求的不包含连字符,且文件真实存在,先不加载,先尝试配置文件
					throw new Error('先尝试配置文件');
				}
				const { js, hit } = await this.compressJsCache(maxtime, key, files, options);
				response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'public,max-age=5', 'X-Cache': hit ? 'hit' : 'miss' });
				response.end(js);
				resolve(true);
			} catch (e) {
				const k = matches[0].replace(/\/static\//, '');
				if (!config.static) {
					return resolve(false);
				}
				const { js } = config.static;
				if (js) {
					const entry = Object.keys(js);
					if (entry.includes(k)) {
						const hotfiles = js[k].map(item => path.join(config.path, item));
						try {
							const mtime = await util.getUpdateTime(hotfiles);
							const { js, hit } = await this.compressJsCache(mtime, k, hotfiles, options);
							response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'public,max-age=5', 'X-Cache': hit ? 'hit' : 'miss' });
							response.end(js);
							resolve(true);
						} catch (e) {
							reject(e);
						}
					} else {
						resolve(false);
					}
				}
			}
		});
	},

	async compressJsCache(mtime, key, files, options) {
		const cache = tool.get(key);
		if (cache && cache.maxTime == mtime) {
			return { js: cache.js, hit: true };
		}
		const ret = await this.compressJs(files, options);
		tool.set(key, { js: ret.code, maxTime: mtime });
		return { js: ret.code, hit: false };
	},

	compressJs(files, ops) {
		const f = utiljs.unique(files);
		let options;
		if (ops.debug) {
			options = {
				mangle: false,
				compress: {
					sequences: false,
					properties: false,
					dead_code: false,
					unused: false,
					booleans: false,
					join_vars: false,
					if_return: false,
					conditionals: false,
					hoist_funs: false,
					drop_debugger: false,
					evaluate: false,
					loops: false
				}
			};
		} else {
			options = {
				mangle: true,
				compress: { sequences: true, properties: true, dead_code: true, unused: true, booleans: true, join_vars: true, if_return: true, conditionals: true }
			};
			if (ops.clean) {
				options.compress.drop_console = true;
				options.compress.drop_debugger = true;
				options.compress.evaluate = true;
				options.compress.loops = true;
			}
		}

		const UglifyJS = require('uglify-js');
		return new Promise((resolve, reject) => {
			this.getContent(f)
				.then(res => {
					const result = UglifyJS.minify(res, options);
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
				})
				.catch(reject);
		});
	},

	compressByConfig(config, params) {
		if (config && config.static) {
			const { css, js } = config.static;
			if (css) {
				Object.keys(css).forEach(async item => {
					try {
						const files = css[item].map(item => path.join(config.path, item));
						const dst = path.join(config.path, item);
						const lessOps = Object.assign({ compress: params.debug ? false : true }, params);
						const res = await this.compressLess(files, lessOps);
						await fsWriteFile(dst, res.css);
					} catch (e) {
						console.error(e.toString());
					}
				});
			}
			if (js) {
				Object.keys(js).forEach(async item => {
					try {
						const files = js[item].map(item => path.join(config.path, item));
						const dst = path.join(config.path, item);
						const res = await this.compressJs(files, params);
						await fsWriteFile(dst, res.code);
					} catch (e) {
						console.info(e.toString());
					}
				});
			}
		}
	},

	getContent(files) {
		const arr = files.map(file => {
			return new Promise((resolve, reject) => {
				fs.readFile(file, 'utf-8', function(err, data) {
					if (err) {
						reject(err);
					} else {
						resolve(data);
					}
				});
			});
		});
		return new Promise((resolve, reject) => {
			Promise.all(arr)
				.then(res => {
					const objs = {};
					files.forEach((file, index) => {
						objs[file] = res[index];
					});
					resolve(objs);
				})
				.catch(reject);
		});
	}
};

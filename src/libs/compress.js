import fs from "fs";
import util from "./util.js";
import path from "path";
import tool from "./tool.js";
import utiljs from "./utiljs.js";

export default {
	compressLessReq(response, matches, query, cwd) {
		const key = matches[0].replace(".css", "");
		const files = key
			.split("-")
			.filter(item => item)
			.map(item => {
				return path.join(cwd, item) + ".less";
			});
		let maxTime;
		try {
			maxTime = util.getMaxUpdateTime(files);
		} catch (e) {}
		const options = { urlArgs: query.ver ? `ver=${query.ver}` : null, env: "development", useFileCache: false };
		const cache = tool.get(key);
		if (cache && cache.maxTime == maxTime && maxTime && options.urlArgs == cache.urlArgs) {
			response.writeHead(200, { "Content-Type": "text/css" });
			return response.end(cache.css);
		}
		this.compressLess(files, options)
			.then(res => {
				response.writeHead(200, { "Content-Type": "text/css" });
				response.end(res.css);
				tool.set(key, { css: res.css, urlArgs: options.urlArgs, maxTime });
			})
			.catch(err => {
				response.writeHead(500, { "Content-Type": "text/plain" });
				response.end(err.toString() + "\n");
			});
	},

	compressLess(files, options) {
		let { paths, urlArgs, compress, useFileCache, env } = options || {};
		const lessfiles = utiljs.unique(files);
		var lessInput = lessfiles
			.map(function(item) {
				return '@import "' + item + '";';
			})
			.join("\r\n");
		const less = require("less");
		const autoprefix = require("less-plugin-autoprefix");
		const option = { plugins: [new autoprefix({ browsers: ["last 5 versions", "ie > 8", "Firefox ESR"] })], paths, urlArgs, compress, useFileCache, env };
		return new Promise((resolve, reject) => {
			less.render(lessInput, option)
				.then(resolve, reject)
				.catch(reject);
		});
	},

	compressJs(files) {
		const f = utiljs.unique(files);
		let options;
		if (1) {
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
			if (1) {
				options.compress.drop_console = true;
				options.compress.drop_debugger = true;
				options.compress.evaluate = true;
				options.compress.loops = true;
			}
		}

		const UglifyJS = require("uglify-js");
		return new Promise((resolve, reject) => {
			this.getContent(files)
				.then(res => {
					const result = UglifyJS.minify(res, options);
					resolve(result);
				})
				.catch(reject);
		});
	},

	compressByConfig() {},

	getContent(files) {
		const arr = files.map(file => {
			return new Promise((resolve, reject) => {
				fs.readFile(file, "utf-8", function(err, data) {
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

import path from "path";
import fs from "fs";
import compress from "./compress.js";
import utiljs from "./utiljs.js";
import util from "./util.js";
import httpserver from "./httpserver.js";
import lint from "./lint.js";
const configName = "static.json";

export default class server {
	constructor(cwd) {
		this.cwd = cwd;
	}

	serve(args) {
		const params = utiljs.getParams(args);
		const config = util.getConfig(this.cwd, configName);
		new httpserver(params).start(config);
	}

	run(args) {}

	lint(args) {}

	gitlint(args) {
		new lint(this.cwd, args).lint();
	}

	install(args) {
		new lint(this.cwd, args).install();
	}

	compress(args) {
		const config = util.getConfig(this.cwd, configName);
		const params = utiljs.getParams(args);
		const filed = args.filter(item => item.charAt(0) !== "-").length;
		if (args && args.length > 0 && filed) {
			const less = args
				.filter(item => {
					return item.split(".").pop() == "less";
				})
				.map(item => {
					return path.join(this.cwd, item);
				});
			const js = args
				.filter(item => {
					return item.split(".").pop() == "js";
				})
				.map(item => {
					return path.join(this.cwd, item);
				});

			compress
				.compressLess(less, params)
				.then(res => {
					const file = util.getName(this.cwd, less, ".less");
					fs.writeFileSync(`${file}.min.css`, res.css);
				})
				.catch(err => {
					console.error(err.toString());
				});
			compress
				.compressJs(js, params)
				.then(res => {
					const file = util.getName(this.cwd, js, ".js");
					fs.writeFileSync(`${file}.min.js`, res.code);
				})
				.catch(err => {
					console.error(err.toString());
				});
		} else {
			compress.compressByConfig(config, params);
		}
	}
}

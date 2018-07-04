import path from "path";
import compress from "./compress.js";
import utiljs from "./utiljs.js";
import util from "./util.js";
import httpserver from "./httpserver";

const configName = "static.json";

export default class server {
	constructor(cwd) {
		this.cwd = cwd;
	}

	serve() {
		const cfg = {};
		new httpserver(cfg).start();
	}

	run(args) {}

	lint(args) {}

	install(args) {}

	compress(args) {
		const config = util.getConfig(this.cwd, configName);
		const c = new compress(config);
		if (args) {
			console.info(args);
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

			c.compressLess(less)
				.then(res => {
					console.info(res);
				})
				.catch(err => {
					console.error(err.toString());
				});
			c.compressJs(js)
				.then(res => {
					console.info(res);
				})
				.catch(err => {
					console.error(err.toString());
				});
		} else {
			c.compressByConfig();
		}
		console.info(args);
	}
}

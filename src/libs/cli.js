import utiljs from "./utiljs.js";
import help, { version } from "../config.js";
export default class {
	constructor(server) {
		this.server = server;
	}
	run(argv) {
		const [node, cfile, ...args] = argv;
		this.node = node;
		this.cfile = cfile;
		this.args = args;
		if (args.length > 0) {
			this.runArgs();
		} else {
			this.runInit();
		}
	}
	runArgs() {
		const [m, ...args] = this.args;
		const f = this.server[m];
		if (utiljs.isFunction(f)) {
			return f.call(this.server, args);
		}
		return this.fallback(m, args);
	}
	runInit() {
		this.server.serve([]);
	}

	fallback(m, args) {
		if (m == "-v") {
			this.showVersion();
		} else if (m == "-h") {
			this.showHelp();
		} else {
			this.server.serve([m, ...args]);
		}
	}

	showHelp() {
		console.info(help);
	}

	showVersion() {
		console.log("air version: air/" + version);
	}
}

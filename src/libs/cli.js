import utiljs from "./utiljs.js";

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
		console.info(node, cfile, args);
	}
	runArgs() {
		const [m, ...args] = this.args;
		console.info(args);
		const f = this.server[m];
		if (utiljs.isFunction(f)) {
			return f.call(this.server, args);
		}
		return this.fallback(m, args);
	}
	runInit() {
		console.info("init");
	}

	fallback(m, args) {
		this.server.serve();
	}
}

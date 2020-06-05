export interface staticOpts {
	dirname: string;
	fpath: string;
	opts: {
		static: {
			css: Map<string, Array<string>>;
			js: Map<string, Array<string>>;
		};
		template: {};
	};
}

export interface serverArgs {
	host: string;
	port: number;
	staticCfg: staticOpts;
}

export interface lessopts {
	ver?: string;
	urlArgs?: string;
	compress?: boolean;
	env?: string;
}

export interface jsopts {
	debug: boolean;
	clean: boolean;
}

export interface cliArgs {
	version: boolean;
	help: boolean;
	port: number;
	root: string;
	dir: string;
	output: string;
	cwd: string;
	clean: boolean;
	escape: boolean;
	art: boolean;
	dry: boolean;
	lintonly: boolean;
	debug: boolean;
}

export interface staticOpts {
	dirname: string;
	fpath: string;
	opts: {
		lessOptions: Record<string, any>;
		static: {
			css: Map<string, Array<string>> | null;
			js: Map<string, Array<string>> | null;
		};
		template: Record<string, any>;
	};
}

interface Dict<T> {
	[key: string]: T;
}

export interface serverArgs {
	host: string;
	port: number;
	staticCfg: staticOpts;
}

export interface lessopts {
	urlArgs?: string;
	modifyVars?: Dict<string>;
	globalVars?: Dict<string>;
	compress?: boolean;
	env?: string;
	math?: string;
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
	query: string;
	modifyVars: string;
	clean: boolean;
	escape: boolean;
	art: boolean;
	dry: boolean;
	cors: boolean;
	nogit: boolean;
	debug: boolean;
	lintlast: boolean;
}

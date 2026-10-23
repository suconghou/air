export interface staticOpts {
	dirname: string;
	fpath: string;
	opts: {
		lessOptions: {
			urlArgs?: string;
			globalVars?: Record<string, string>;
			modifyVars?: Record<string, string>;
			math?: string;
		};
		static: {
			css: Record<string, Array<string>>;
			js: Record<string, Array<string>>;
		};
	};
}

export interface serverArgs {
	host: string;
	port: number;
	staticCfg: staticOpts;
}

export interface lessopts {
	urlArgs?: string;
	globalVars?: Record<string, string>;
	modifyVars?: Record<string, string>;
	compress?: boolean;
	env?: string;
	math?: string;
}

export interface jsopts {
	debug: boolean;
	clean: boolean;
}

export interface cliArgs {
	port?: number;
	dir?: string;
	query?: string;
	modifyVars?: string;
	debug?: boolean;
	clean?: boolean;
	dry?: boolean;
	cors?: boolean;
	help?: boolean;
}

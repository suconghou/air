import * as process from 'process';
import * as path from 'path';
import { promisify } from 'util';
import * as child_process from 'child_process';
import * as fs from 'fs';
import { fsAccess, fsCopyFile, fsChmod, fsStat, fsReadFile, fsWriteFile } from './util';
import { cliArgs } from '../types';

const spawn = promisify(child_process.spawn);
const spawnSync = child_process.spawnSync;

const prettyTypes = ['js', 'vue', 'jsx', 'ts', 'css', 'less', 'html', 'json', 'scss', 'md'];

const extParser = {
	js: 'babel',
	mjs: 'babel',
	jsx: 'babel',
	ts: 'typescript',
	vue: 'vue',
	html: 'html',
	css: 'css',
	less: 'less',
	scss: 'scss',
	json: 'json',
	md: 'mdx',
	yaml: 'yaml',
};

const lintParser = {
    js: 'babel-eslint',
    mjs: 'babel-eslint',
    vue:'vue-eslint-parser',
    ts:'@typescript-eslint/parser' ,
    tsx:'@typescript-eslint/parser'
};

// see https://github.com/eslint/eslint/blob/master/conf/eslint-recommended.js
const rules = {
	'constructor-super': 'error',
	'for-direction': 'error',
	'getter-return': 'error',
	'no-async-promise-executor': 'error',
	'no-case-declarations': 'error',
	'no-class-assign': 'error',
	'no-compare-neg-zero': 'error',
	'no-cond-assign': 'error',
	'no-const-assign': 'error',
	'no-constant-condition': 'error',
	'no-control-regex': 'error',
	'no-debugger': 'error',
	'no-delete-var': 'error',
	'no-dupe-args': 'error',
	'no-dupe-class-members': 'error',
	'no-dupe-else-if': 'error',
	'no-dupe-keys': 'error',
	'no-duplicate-case': 'error',
	'no-empty': 'error',
	'no-empty-character-class': 'error',
	'no-empty-pattern': 'error',
	'no-ex-assign': 'error',
	'no-extra-boolean-cast': 'error',
	'no-extra-semi': 'error',
	'no-fallthrough': 'error',
	'no-func-assign': 'error',
	'no-global-assign': 'error',
	'no-import-assign': 'error',
	'no-inner-declarations': 'error',
	'no-invalid-regexp': 'error',
	'no-irregular-whitespace': 'error',
	'no-misleading-character-class': 'error',
	'no-mixed-spaces-and-tabs': 'error',
	'no-new-symbol': 'error',
	'no-obj-calls': 'error',
	'no-octal': 'error',
	'no-prototype-builtins': 'error',
	'no-redeclare': 'error',
	'no-regex-spaces': 'error',
	'no-self-assign': 'error',
	'no-setter-return': 'error',
	'no-shadow-restricted-names': 'error',
	'no-sparse-arrays': 'error',
	'no-this-before-super': 'error',
	'no-undef': 'error',
	'no-unexpected-multiline': 'error',
	'no-unreachable': 'error',
	'no-unsafe-finally': 'error',
	'no-unsafe-negation': 'error',
	'no-unused-labels': 'error',
	'no-unused-vars': 'warn',
	'no-useless-catch': 'error',
	'no-useless-escape': 'error',
	'no-with': 'error',
	'require-yield': 'error',
	'use-isnan': 'error',
	'valid-typeof': 'error',
};

const config = {
	eslintConfig: {
		env: {
			browser: true,
			es6: true,
			node: true,
		},
		parserOptions: {
			ecmaVersion: 7,
			sourceType: 'module',
        },
        extends: ['plugin:vue/recommended','eslint:recommended'],
        plugins:['vue'],
		parser: '', // this will be auto babel-eslint / vue-eslint-parser / @typescript-eslint/parser
		rules,
		useEslintrc: true,
		reportUnusedDisableDirectives: true,
	},
	prettierOptions: {
		printWidth: 120,
		tabWidth: 4,
		singleQuote: true,
		useTabs: true,
		semi: true,
		trailingComma: 'es5',
		bracketSpacing: true,
		arrowParens: 'always',
		endOfLine: 'lf',
		parser: 'babel',
		jsxBracketSameLine: false,
	},
	fallbackPrettierOptions: {
		printWidth: 120,
		tabWidth: 4,
		singleQuote: true,
		useTabs: true,
		semi: true,
		trailingComma: 'es5',
		bracketSpacing: true,
		arrowParens: 'always',
		endOfLine: 'lf',
		parser: 'babel',
		jsxBracketSameLine: false,
	},
	prettierLast: true,
	exitOnLintErr: true,
};

const options = {
	dir: 'config',
	git: '.git',
	hooks: 'hooks',
	precommit: 'pre-commit',
	postcommit: 'post-commit',
	commitmsg: 'commit-msg',
};
const stat = fs.constants.R_OK | fs.constants.W_OK;

const spawnOps = { stdio: 'inherit', shell: true };

import format from '../../../prettier-eslint/src/index';

export default class lint {
	private files = [];

	constructor(private cwd: string, files: Array<string>, private opts: cliArgs) {
		this.files = files.filter((item) => item.charAt(0) != '-');
		if (this.opts.pretty) {
			config.exitOnLintErr = false;
		}
		if (this.opts.lintlast) {
			config.prettierLast = false;
		}
	}

	async gitlint() {
		const res = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACM']);
		const arrs = res.stdout
			.toString()
			.split('\n')
			.filter((v) => v);

		if (!arrs.length) {
			return;
		}
		const { prefiles, gitfiles } = this.parse(arrs);
		await this.dolint(prefiles, gitfiles);
		if (!this.opts.nogit) {
			await this.gitadd(gitfiles);
		}
	}

	private parse(files: Array<string>) {
		const prefiles = [];
		const gitfiles = [];
		const filetypes = files.map((item) => {
			const name = item.trim();
			const type = item.split('.').pop();
			let p = name;
			if (!path.isAbsolute(name)) {
				p = path.join(this.cwd, name);
			}
			if (prettyTypes.includes(type)) {
				prefiles.push(p);
			}
			gitfiles.push(p);
			return { name, path: p, type };
		});
		return { prefiles, gitfiles, filetypes };
	}

	public async lint() {
		if (this.files.length < 1) {
			this.opts.nogit = true;
			return this.gitlint();
		}
		const { prefiles, gitfiles } = this.parse(this.files);
		await this.dolint(prefiles, gitfiles);
	}

	private async dolint(prefiles: Array<string>, gitfiles: Array<string>) {
		await this.checkfiles(gitfiles);
		await Promise.all(this.lintConfig(prefiles));
	}

	private lintConfig(prefiles: Array<string>) {
		return prefiles.map((item) => {
			return new Promise(async (resolve, reject) => {
				try {
					const r = await fsReadFile(item, 'utf-8');
					if (!r || r.trim().length < 1) {
						return resolve(true);
					}
					const options = {
						...config,
						...{
							filePath: item,
						},
						...{
							text: r,
						},
					};
					const [esparser, preparser,ext] = this.getParser(item);
					options.eslintConfig.parser = esparser;
					options.prettierOptions.parser = preparser;
                    options.fallbackPrettierOptions.parser = preparser;
                    if(['ts','tsx'].includes(ext)){
                        options.eslintConfig.extends = options.eslintConfig.extends.filter(item=>!item.includes('vue') )
						options.eslintConfig.plugins = options.eslintConfig.plugins.filter(item=>!item.includes('vue'))
                    }
					const res = await format(options);
					if (r !== res && res) {
						// 异步写文件,其他异步终止进程,容易写出空文件
						fs.writeFileSync(item, res);
					}
					console.log(item.replace(this.cwd + '/', ''));
					resolve(true);
				} catch (e) {
					reject(e);
				}
			});
		});
	}

	private getParser(file: string) {
		const ext = file
			.split('.')
			.pop()
			.toLowerCase();
		return [lintParser[ext] ? lintParser[ext] : '', extParser[ext] ? extParser[ext] : 'babel',ext];
	}

	private gitadd(f: Array<string>) {
		if (f && f.length) {
			return spawn('git', ['add', '-u', f.join(' ')], spawnOps as any);
		}
		return Promise.resolve();
	}

	public async install() {
		const { git, cwd, hooks, precommit, postcommit, commitmsg } = Object.assign({}, options, this.opts);
		const dir = this.opts.dir ? '' : options.dir;
		const prehook = path.join(this.cwd, dir, precommit);
		const posthook = path.join(this.cwd, dir, postcommit);
		const msghook = path.join(this.cwd, dir, commitmsg);

		const predst = path.join(cwd, git, hooks, precommit);
		const postdst = path.join(cwd, git, hooks, postcommit);
		const msgdst = path.join(cwd, git, hooks, commitmsg);

		const mode = 0o755;
		await Promise.all([fsAccess(prehook, stat), fsAccess(posthook, stat), fsAccess(msghook, stat)]);
		await Promise.all([fsCopyFile(prehook, predst), fsCopyFile(posthook, postdst), fsCopyFile(msghook, msgdst)]);
		await Promise.all([fsChmod(predst, mode), fsChmod(postdst, mode), fsChmod(msgdst, mode)]);
	}

	private async checkfiles(files: Array<string>) {
		const maxsize = 1048576;
		// 检查文件大小,超过1MB禁止提交
		const stats = await Promise.all(files.map((item) => fsStat(item)));
		return stats.every((item, index) => {
			if (item.size > maxsize) {
				throw new Error(`${files[index]} too large,${item.size} exceed ${maxsize}`);
			}
			return true;
		});
	}

	static async commitlint(commitfile: string) {
		const str = await fsReadFile(commitfile);
		const msg = str.toString();
		if (/Merge\s+branch/i.test(msg)) {
			return;
		}
		if (
			!/(build|ci|docs|feat|fix|perf|refactor|style|test|revert|chore).{0,2}(\(.{1,100}\))?.{0,2}:.{1,200}/.test(
				msg
			)
		) {
			console.info('commit message should be format like <type>(optional scope): <description>');
			process.exit(1);
		}
	}
}

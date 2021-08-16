import * as path from 'path';
import { promisify } from 'util';
import * as child_process from 'child_process';
import * as fs from 'fs';
import { fsAccess, fsCopyFile, fsChmod, fsStat, fsReadFile, fsWriteFile } from './util';
import { cliArgs } from '../types';

const spawn = promisify(child_process.spawn);
const spawnSync = child_process.spawnSync;

const prettyTypes = ['js', 'mjs', 'yml', 'yaml', 'vue', 'jsx', 'ts', 'css', 'less', 'html', 'json', 'scss', 'md'];

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
	yml: 'yaml',
	yaml: 'yaml',
};

// 修改一些eslint规则来适应prettier
const fixrules = {
	// https://github.com/prettier/eslint-plugin-prettier#arrow-body-style-and-prefer-arrow-callback-issue
	'arrow-body-style': 0,
	'prefer-arrow-callback': 0,

	// https://github.com/prettier/eslint-config-prettier/blob/main/index.js

	curly: ['error', 'all'],
	'lines-around-comment': 0,
	'max-len': 0,
	'no-confusing-arrow': 0,
	'no-mixed-operators': 0,
	'no-tabs': 0,
	'no-unexpected-multiline': 0,
	quotes: 0,
	'@typescript-eslint/quotes': 0,
	'babel/quotes': 0,
	'vue/html-self-closing': 0,
	'vue/max-len': 0,

	// The rest are rules that you never need to enable when using Prettier.
	'array-bracket-newline': 'off',
	'array-bracket-spacing': 'off',
	'array-element-newline': 'off',
	'arrow-parens': 'off',
	'arrow-spacing': 'off',
	'block-spacing': 'off',
	'brace-style': 'off',
	'comma-dangle': 'off',
	'comma-spacing': 'off',
	'comma-style': 'off',
	'computed-property-spacing': 'off',
	'dot-location': 'off',
	'eol-last': 'off',
	'func-call-spacing': 'off',
	'function-call-argument-newline': 'off',
	'function-paren-newline': 'off',
	'generator-star': 'off',
	'generator-star-spacing': 'off',
	'implicit-arrow-linebreak': 'off',
	indent: 'off',
	'jsx-quotes': 'off',
	'key-spacing': 'off',
	'keyword-spacing': 'off',
	'linebreak-style': 'off',
	'multiline-ternary': 'off',
	'newline-per-chained-call': 'off',
	'new-parens': 'off',
	'no-arrow-condition': 'off',
	'no-comma-dangle': 'off',
	'no-extra-parens': 'off',
	'no-extra-semi': 'off',
	'no-floating-decimal': 'off',
	'no-mixed-spaces-and-tabs': 'off',
	'no-multi-spaces': 'off',
	'no-multiple-empty-lines': 'off',
	'no-reserved-keys': 'off',
	'no-space-before-semi': 'off',
	'no-trailing-spaces': 'off',
	'no-whitespace-before-property': 'off',
	'no-wrap-func': 'off',
	'nonblock-statement-body-position': 'off',
	'object-curly-newline': 'off',
	'object-curly-spacing': 'off',
	'object-property-newline': 'off',
	'one-var-declaration-per-line': 'off',
	'operator-linebreak': 'off',
	'padded-blocks': 'off',
	'quote-props': 'off',
	'rest-spread-spacing': 'off',
	semi: 'off',
	'semi-spacing': 'off',
	'semi-style': 'off',
	'space-after-function-name': 'off',
	'space-after-keywords': 'off',
	'space-before-blocks': 'off',
	'space-before-function-paren': 'off',
	'space-before-function-parentheses': 'off',
	'space-before-keywords': 'off',
	'space-in-brackets': 'off',
	'space-in-parens': 'off',
	'space-infix-ops': 'off',
	'space-return-throw-case': 'off',
	'space-unary-ops': 'off',
	'space-unary-word-ops': 'off',
	'switch-colon-spacing': 'off',
	'template-curly-spacing': 'off',
	'template-tag-spacing': 'off',
	'unicode-bom': 'off',
	'wrap-iife': 'off',
	'wrap-regex': 'off',
	'yield-star-spacing': 'off',
	'@babel/object-curly-spacing': 'off',
	'@babel/semi': 'off',
	'@typescript-eslint/brace-style': 'off',
	'@typescript-eslint/comma-dangle': 'off',
	'@typescript-eslint/comma-spacing': 'off',
	'@typescript-eslint/func-call-spacing': 'off',
	'@typescript-eslint/indent': 'off',
	'@typescript-eslint/keyword-spacing': 'off',
	'@typescript-eslint/member-delimiter-style': 'off',
	'@typescript-eslint/no-extra-parens': 'off',
	'@typescript-eslint/no-extra-semi': 'off',
	'@typescript-eslint/object-curly-spacing': 'off',
	'@typescript-eslint/semi': 'off',
	'@typescript-eslint/space-before-function-paren': 'off',
	'@typescript-eslint/space-infix-ops': 'off',
	'@typescript-eslint/type-annotation-spacing': 'off',
	'babel/object-curly-spacing': 'off',
	'babel/semi': 'off',
	'flowtype/boolean-style': 'off',
	'flowtype/delimiter-dangle': 'off',
	'flowtype/generic-spacing': 'off',
	'flowtype/object-type-curly-spacing': 'off',
	'flowtype/object-type-delimiter': 'off',
	'flowtype/quotes': 'off',
	'flowtype/semi': 'off',
	'flowtype/space-after-type-colon': 'off',
	'flowtype/space-before-generic-bracket': 'off',
	'flowtype/space-before-type-colon': 'off',
	'flowtype/union-intersection-spacing': 'off',
	'react/jsx-child-element-spacing': 'off',
	'react/jsx-closing-bracket-location': 'off',
	'react/jsx-closing-tag-location': 'off',
	'react/jsx-curly-newline': 'off',
	'react/jsx-curly-spacing': 'off',
	'react/jsx-equals-spacing': 'off',
	'react/jsx-first-prop-new-line': 'off',
	'react/jsx-indent': 'off',
	'react/jsx-indent-props': 'off',
	'react/jsx-max-props-per-line': 'off',
	'react/jsx-newline': 'off',
	'react/jsx-one-expression-per-line': 'off',
	'react/jsx-props-no-multi-spaces': 'off',
	'react/jsx-tag-spacing': 'off',
	'react/jsx-wrap-multilines': 'off',
	'standard/array-bracket-even-spacing': 'off',
	'standard/computed-property-even-spacing': 'off',
	'standard/object-curly-even-spacing': 'off',
	'unicorn/empty-brace-spaces': 'off',
	'unicorn/no-nested-ternary': 'off',
	'unicorn/number-literal-case': 'off',
	'vue/array-bracket-newline': 'off',
	'vue/array-bracket-spacing': 'off',
	'vue/arrow-spacing': 'off',
	'vue/block-spacing': 'off',
	'vue/block-tag-newline': 'off',
	'vue/brace-style': 'off',
	'vue/comma-dangle': 'off',
	'vue/comma-spacing': 'off',
	'vue/comma-style': 'off',
	'vue/dot-location': 'off',
	'vue/func-call-spacing': 'off',
	'vue/html-closing-bracket-newline': 'off',
	'vue/html-closing-bracket-spacing': 'off',
	'vue/html-end-tags': 'off',
	'vue/html-indent': 'off',
	'vue/html-quotes': 'off',
	'vue/key-spacing': 'off',
	'vue/keyword-spacing': 'off',
	'vue/max-attributes-per-line': 'off',
	'vue/multiline-html-element-content-newline': 'off',
	'vue/mustache-interpolation-spacing': 'off',
	'vue/no-extra-parens': 'off',
	'vue/no-multi-spaces': 'off',
	'vue/no-spaces-around-equal-signs-in-attribute': 'off',
	'vue/object-curly-newline': 'off',
	'vue/object-curly-spacing': 'off',
	'vue/object-property-newline': 'off',
	'vue/operator-linebreak': 'off',
	'vue/script-indent': 'off',
	'vue/singleline-html-element-content-newline': 'off',
	'vue/space-in-parens': 'off',
	'vue/space-infix-ops': 'off',
	'vue/space-unary-ops': 'off',
	'vue/template-curly-spacing': 'off',
};

// no-unused-vars 我们从error修改到了warn
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
	'no-loss-of-precision': 'error',
	'no-misleading-character-class': 'error',
	'no-mixed-spaces-and-tabs': 'error',
	'no-new-symbol': 'error',
	'no-nonoctal-decimal-escape': 'error',
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
	'no-unsafe-optional-chaining': 'error',
	'no-unused-labels': 'error',
	'no-unused-vars': 'warn',
	'no-useless-backreference': 'error',
	'no-useless-catch': 'error',
	'no-useless-escape': 'error',
	'no-with': 'error',
	'require-yield': 'error',
	'use-isnan': 'error',
	'valid-typeof': 'error',
};

const config = {
	eslintConfig: {
		baseConfig: {
			extends: ['plugin:vue/recommended', 'eslint:recommended'],
			rules,
			env: {
				node: true,
				browser: true,
				es2021: true, // 将会自动设置ecmaVersion为12 https://eslint.org/docs/user-guide/configuring/language-options#specifying-parser-options
				commonjs: true,
				worker: true,
				amd: true,
			},
			parserOptions: {
				ecmaVersion: 12,
				sourceType: 'module',
				requireConfigFile: false,
				allowImportExportEverywhere: true,
				ecmaFeatures: {
					experimentalObjectRestSpread: true,
					jsx: true,
				},
			},
			plugins: ['vue'],
			parser: '', // this will be auto @babel/eslint-parser / vue-eslint-parser / @typescript-eslint/parser
			reportUnusedDisableDirectives: true,
		},
		extends: ['plugin:vue/recommended', 'eslint:recommended'],
		envs: ['node', 'browser', 'es6', 'commonjs', 'worker', 'amd'],
		parserOptions: {
			ecmaVersion: 12,
			sourceType: 'module',
			requireConfigFile: false,
			allowImportExportEverywhere: true,
			ecmaFeatures: {
				experimentalObjectRestSpread: true,
				jsx: true,
			},
		},
		rules,
		globals: ['window', 'console', 'process', 'require', 'Promise', 'Map', 'Set'],
		useEslintrc: true,
		fix: true,
		reportUnusedDisableDirectives: true,
	},
	prettierOptions: {
		printWidth: 120,
		tabWidth: 4,
		singleQuote: true,
		useTabs: true,
		semi: true,
		trailingComma: 'es5',
		quoteProps: 'as-needed',
		bracketSpacing: true,
		arrowParens: 'always',
		endOfLine: 'lf',
		parser: 'babel',
		jsxBracketSameLine: false,
		editorconfig: false,
	},
	fixrules,
	prettierLast: true,
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

import format from './lintformat';

export default class lint {
	private files = [];

	constructor(private cwd: string, files: Array<string>, private opts: cliArgs) {
		this.files = files.filter((item) => item.charAt(0) != '-');
		if (this.opts.lintlast) {
			config.prettierLast = false;
		}
	}

	async gitlint() {
		if (this.files.length < 1) {
			return;
		}
		const { prefiles, gitfiles } = this.parse(this.files);
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

	private autofiles() {
		const res = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACM']);
		const arrs = res.stdout
			.toString()
			.split('\n')
			.filter((v) => v);
		return arrs;
	}

	public async lint() {
		if (this.files.length < 1) {
			this.files = this.autofiles();
		}
		if (this.files.length < 1) {
			return;
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
			return (async () => {
				const r = await fsReadFile(item, 'utf-8');
				if (!r || r.trim().length < 1) {
					return true;
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
				const baseConfig = options.eslintConfig.baseConfig;
				const [preparser, ext] = this.getParser(item);
				options.prettierOptions.parser = preparser;
				if (['mjs', 'js', 'ts', 'tsx'].includes(ext)) {
					baseConfig.extends = baseConfig.extends.filter((item) => !item.includes('vue'));
					baseConfig.plugins = baseConfig.plugins.filter((item) => !item.includes('vue'));
				} else if (['yml', 'yaml'].includes(ext)) {
					options.prettierOptions.useTabs = false;
					options.prettierOptions.tabWidth = 2;
				}
				const res = await format(options);
				if (r !== res && res) {
					// 异步写文件,其他异步终止进程,容易写出空文件
					fs.writeFileSync(item, res);
				}
				console.log(item.replace(this.cwd + '/', ''));
				true;
			})();
		});
	}

	private getParser(file: string) {
		const ext = file.split('.').pop().toLowerCase();
		return [extParser[ext] ? extParser[ext] : 'babel', ext];
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

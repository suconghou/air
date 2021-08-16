import * as path from 'path';

const version = { eslint: 0, prettier: 0, tsparser: 0, jsparser: 0, vueparser: 0 };

const eslintExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.vue'];

const getESLintCLIEngine = (eslintConfig: any) => {
	const { CLIEngine } = require('eslint');
	if (!version.eslint) {
		console.info('eslint version ' + CLIEngine.version);
		version.eslint = CLIEngine.version;
	}
	return new CLIEngine(eslintConfig);
};

const createPrettify = (formatOptions: any) => {
	return (text: string) => {
		const prettier = require('prettier');
		if (!version.prettier) {
			console.info('prettier version ' + prettier.version);
			version.prettier = prettier.version;
		}
		const output = prettier.format(text, formatOptions);
		return output;
	};
};

const createEslintFix = (eslintConfig: Record<string, any>, fixrules: Record<string, any>, filePath: string) => {
	// 此处加载CLIEngine只是为了获取可能存在的配置文件,options.parser必然已设置为空,否则此处直接加载插件,查找目录不正确导致无法加载
	// 下面的require.resolve在安装air目录下的node_modules查找
	const config = getESLintCLIEngine(eslintConfig).getConfigForFile(filePath);
	return async (text: string, filePath: string) => {
		const options = {
			...eslintConfig,
			...config,
			...fixrules,
			...{
				useEslintrc: false,
				fix: true,
			},
		};
		if (typeof options.globals === 'object') {
			options.globals = Object.entries(options.globals).map(([key, value]) => `${key}:${value}`);
		}
		const fileExtension = path.extname(filePath || '');
		if (['.ts', '.tsx'].includes(fileExtension)) {
			options.parser = require.resolve('@typescript-eslint/parser');
			if (!version.tsparser) {
				console.info('@typescript-eslint/parser ', options.parser);
				version.tsparser = options.parser;
			}
			for (const k in options.rules) {
				if (k.includes('vue/')) {
					options.rules[k] = ['off'];
				}
			}
		}
		if (['.js', '.mjs'].includes(fileExtension)) {
			options.parser = require.resolve('@babel/eslint-parser');
			if (!version.jsparser) {
				console.info('@babel/eslint-parser ', options.parser);
				version.jsparser = options.parser;
			}
			for (const k in options.rules) {
				if (k.includes('vue/')) {
					options.rules[k] = ['off'];
				}
			}
		}
		if (['.vue'].includes(fileExtension)) {
			options.parser = require.resolve('vue-eslint-parser');
			if (!version.vueparser) {
				console.info('vue-eslint-parser ', options.parser);
				version.vueparser = options.parser;
			}
		}

		const cliEngine = getESLintCLIEngine(options);

		const report = cliEngine.executeOnText(text, filePath, true);
		const [{ output = text, errorCount }] = report.results;
		const formatter = await cliEngine.getFormatter('stylish');
		const logoutput = await formatter(report.results);
		if (logoutput) {
			console.info(logoutput);
			if (errorCount > 0) {
				process.exit(1);
			}
		}
		return output;
	};
};

export default async (options: any) => {
	const { filePath, text, eslintConfig, prettierOptions, fixrules, prettierLast } = options;
	const fileExtension = path.extname(filePath || '');
	const onlyPrettier = !eslintExtensions.includes(fileExtension);
	const prettify = createPrettify(prettierOptions);
	if (onlyPrettier) {
		return prettify(text);
	}
	eslintConfig.cwd = path.dirname(filePath);
	const eslintFix = createEslintFix(eslintConfig, fixrules, filePath);
	if (prettierLast) {
		return await prettify(await eslintFix(text, filePath));
	}
	return await eslintFix(await prettify(text), filePath);
};

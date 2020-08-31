import * as path from 'path';
import * as process from 'process';

let debug = process.env.debug ? {} : { eslint: 1, prettier: 1 };

const eslintExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.vue'];

const getESLintCLIEngine = (eslintConfig: any) => {
	const { CLIEngine } = require('eslint');
	if (!debug.eslint) {
		console.info('eslint version ' + CLIEngine.version);
		debug.eslint = 1;
	}
	return new CLIEngine(eslintConfig);
};

const createPrettify = (formatOptions: any) => {
	return async (text: string) => {
		const prettier = require('prettier');
		if (!debug.prettier) {
			console.info('prettier version ' + prettier.version);
			debug.prettier = 1;
		}
		const output = prettier.format(text, formatOptions);
		return output;
	};
};

const createEslintFix = (eslintConfig: any, filePath: string) => {
	const config = getESLintCLIEngine(eslintConfig).getConfigForFile(filePath);
	return async (text: string, filePath: string) => {
		const options = {
			...eslintConfig,
			...config,
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
			for (const k in options.rules) {
				if (k.includes('vue/')) {
					options.rules[k] = ['off'];
				}
			}
		}
		if (['.js', '.mjs'].includes(fileExtension)) {
			options.parser = require.resolve('babel-eslint');
			for (const k in options.rules) {
				if (k.includes('vue/')) {
					options.rules[k] = ['off'];
				}
			}
		}
		if (['.vue'].includes(fileExtension)) {
			options.parser = require.resolve('vue-eslint-parser');
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
	const { filePath, text, eslintConfig, prettierOptions, prettierLast } = options;
	const fileExtension = path.extname(filePath || '');
	const onlyPrettier = !eslintExtensions.includes(fileExtension);
	const prettify = createPrettify(prettierOptions);
	if (onlyPrettier) {
		return prettify(text);
	}
	eslintConfig.cwd = path.dirname(filePath);
	const eslintFix = createEslintFix(eslintConfig, filePath);
	if (prettierLast) {
		return await prettify(await eslintFix(text, filePath));
	}
	return await eslintFix(await prettify(text), filePath);
};

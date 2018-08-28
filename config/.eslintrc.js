module.exports = {
	root: true,
	env: {
		browser: true,
		es6: true
	},
	extends: 'eslint:recommended',
	parserOptions: {
		ecmaVersion: 2018,
		sourceType: 'module'
	},
	globals: {
		require: false,
		module: false
	},
	rules: {
		'no-unused-vars': 0,
		'no-console': 'off',
		indent: ['error', 'tab'],
		'linebreak-style': ['error', 'unix'],
		quotes: ['error', 'single'],
		semi: ['error', 'always']
	}
};

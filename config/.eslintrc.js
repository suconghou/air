module.exports = {
	root: true,
	env: {
		browser: true,
		es6: true
	},
	extends: ['plugin:vue/recommended'],
	parser: 'vue-eslint-parser',
	parserOptions: {
		parser: 'babel-eslint',
		ecmaVersion: 2018,
		sourceType: 'module'
	},
	plugins: ['vue'],
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

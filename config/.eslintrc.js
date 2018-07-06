module.exports = {
	env: {
		browser: true,
		es6: true
	},
	parserOptions: {
		sourceType: "module"
	},
	globals: {
		require: false,
		module: false
	},
	rules: {
		"no-console": "off",
		indent: ["error", "tab"],
		"linebreak-style": ["error", "unix"],
		quotes: ["error", "single"],
		semi: ["error", "always"]
	}
};

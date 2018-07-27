export default {
	template(filename, data, options) {
		const template = require('art-template');
		Object.assign(template.defaults, options);
		return template(filename, data);
	}
};

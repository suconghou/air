import typesMap from './mtypes.js';

const defaultMime = 'application/octet-stream';

export default {
	lookup(filePath) {
		const t = filePath.split('.').pop();
		const type = typesMap[t];
		return type ? type : defaultMime;
	}
};

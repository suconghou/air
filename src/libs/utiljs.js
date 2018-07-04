export default {
	isFunction(value) {
		return typeof value === "function";
	},
	unique(arr) {
		return Array.from(new Set(arr));
	}
};

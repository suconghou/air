const maxItem = 1e3;
const caches = new Map();
export default {
	errorlog: [],
	log(msg) {
		msg = msg.toString();
		if (this.errorlog.length > maxItem) {
			this.errorlog = [];
		}
		var nowDate = new Date();
		msg = nowDate.toLocaleDateString() + " " + nowDate.toLocaleTimeString() + " " + msg;
		this.errorlog.push(msg);
		console.log(msg);
	},
	get(k) {
		return caches.get(k);
	},
	set(k, v) {
		return caches.set(k, v);
	}
};

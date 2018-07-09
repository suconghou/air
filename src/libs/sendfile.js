import fs from 'fs';
import mime from './mime.js';

export default (response, stat, filePath) => {
	const type = mime.lookup(filePath);
	response.writeHead(200, {
		'Content-Type': type,
		'Content-Length': stat.size
	});
	const readStream = fs.createReadStream(filePath);
	readStream.pipe(response);
};

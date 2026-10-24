import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as tls from 'tls';
import { requestctx, responsectx } from '../nodeserve/types';

export interface proxyRule {
	prefix: string;
	href: string;
	protocol: string;
	hostname: string;
	port: number;
	host: string;
	base: string;
}

// 解析 --proxy /前缀=http(s)://目标地址 参数, 可重复指定
export function parseProxy(list: Array<string> = []): Array<proxyRule> {
	return list.map((item) => {
		const i = item.indexOf('=');
		if (i <= 0) {
			throw new Error('代理参数格式错误: ' + item + ' , 应为 /前缀=http(s)://目标地址');
		}
		let target: URL;
		try {
			target = new URL(item.slice(i + 1));
		} catch (_e) {
			throw new Error('代理目标地址无效: ' + item.slice(i + 1));
		}
		if (target.protocol != 'http:' && target.protocol != 'https:') {
			throw new Error('代理目标地址无效: ' + item.slice(i + 1) + ' , 仅支持 http/https');
		}
		return {
			prefix: item.slice(0, i).startsWith('/') ? item.slice(0, i) : '/' + item.slice(0, i),
			href: target.href,
			protocol: target.protocol,
			hostname: target.hostname,
			port: target.port ? Number(target.port) : target.protocol == 'https:' ? 443 : 80,
			host: target.host,
			base: target.pathname.replace(/\/$/, ''),
		};
	});
}

export function matchProxy(rules: Array<proxyRule>, path: string): proxyRule | undefined {
	return rules.find(
		(rule) => rule.prefix == '/' || path == rule.prefix || path.startsWith(rule.prefix + '/')
	);
}

// 转发 http 请求: 路径原样透传, body 流式转发, Host 指向目标
export function forward(req: requestctx, res: responsectx, rule: proxyRule) {
	const headers: http.OutgoingHttpHeaders = { ...req.headers, host: rule.host };
	// 逐跳首部由本端与上游各自协商, 不透传
	delete headers.connection;
	delete headers['keep-alive'];
	delete headers['transfer-encoding'];
	const upstream = (rule.protocol == 'https:' ? https : http).request(
		{
			protocol: rule.protocol as 'http:' | 'https:',
			hostname: rule.hostname,
			port: rule.port,
			method: req.method,
			path: rule.base.length > 1 ? rule.base + req.url : req.url,
			headers,
		},
		(upres: http.IncomingMessage) => {
			res.writeHead(upres.statusCode || 502, upres.headers);
			upres.pipe(res);
		}
	);
	upstream.on('error', (e) => {
		if (!res.headersSent) {
			res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
		}
		res.end('代理请求失败 ' + rule.href + ' ' + (e.message || e));
	});
	req.pipe(upstream);
}

// websocket upgrade 透传: 与上游建立原始 tcp/tls 连接, 双向转发
export function proxyUpgrade(
	rules: Array<proxyRule>,
	req: http.IncomingMessage,
	socket: net.Socket,
	head: Buffer
) {
	const rule = matchProxy(rules, (req.url || '/').split('?')[0]);
	if (!rule) {
		socket.destroy();
		return;
	}
	const upstream =
		rule.protocol == 'https:'
			? tls.connect({ host: rule.hostname, port: rule.port, servername: rule.hostname })
			: net.connect({ host: rule.hostname, port: rule.port });
	const destroy = () => {
		upstream.destroy();
		socket.destroy();
	};
	upstream.on('error', destroy);
	socket.on('error', destroy);
	upstream.on('connect', () => {
		const lines = [req.method + ' ' + req.url + ' HTTP/1.1'];
		for (let i = 0; i < req.rawHeaders.length; i += 2) {
			lines.push(req.rawHeaders[i] + ': ' + req.rawHeaders[i + 1]);
		}
		upstream.write(lines.join('\r\n') + '\r\n\r\n');
		if (head.length > 0) {
			upstream.write(head);
		}
		socket.pipe(upstream);
		upstream.pipe(socket);
	});
}

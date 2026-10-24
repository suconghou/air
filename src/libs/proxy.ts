import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as tls from 'tls';
import * as path from 'path';
import { requestctx, responsectx } from '../nodeserve/types';

export interface httpRule {
	prefix: string;
	kind: 'http';
	href: string;
	protocol: string;
	hostname: string;
	port: number;
	host: string;
	base: string;
}

export interface fileRule {
	prefix: string;
	kind: 'file';
	href: string;
	root: string;
}

export type proxyRule = httpRule | fileRule;

// 解析 --proxy /前缀=目标 参数, 可重复指定; 目标为 http(s) 地址则转发, 否则视为本地目录挂载
export function parseProxy(list: Array<string> = []): Array<proxyRule> {
	return list.map((item) => {
		const i = item.indexOf('=');
		if (i <= 0) {
			throw new Error('代理参数格式错误: ' + item + ' , 应为 /前缀=http(s)://目标地址或本地目录');
		}
		// 前缀统一成 /a/b 形式: 补前导斜杠, 去掉尾斜杠, 否则 matchProxy 永远匹配不上
		const prefix = (item.slice(0, i).startsWith('/') ? item.slice(0, i) : '/' + item.slice(0, i)).replace(
			/\/+$/,
			''
		) || '/';
		const target = item.slice(i + 1);
		if (!target) {
			throw new Error('代理目标地址无效: ' + item);
		}
		if (/^https?:\/\//i.test(target)) {
			let u: URL;
			try {
				u = new URL(target);
			} catch (_e) {
				throw new Error('代理目标地址无效: ' + target);
			}
			if (u.protocol != 'http:' && u.protocol != 'https:') {
				throw new Error('代理目标地址无效: ' + target + ' , 仅支持 http/https');
			}
			return {
				prefix,
				kind: 'http',
				href: u.href,
				protocol: u.protocol,
				hostname: u.hostname,
				port: u.port ? Number(u.port) : u.protocol == 'https:' ? 443 : 80,
				host: u.host,
				base: u.pathname.replace(/\/$/, ''),
			};
		}
		// 本地目录: 相对工作目录或绝对路径
		return { prefix, kind: 'file', href: target, root: path.resolve(target) };
	});
}

export function matchProxy(rules: Array<proxyRule>, path: string): proxyRule | undefined {
	return rules.find(
		(rule) => rule.prefix == '/' || path == rule.prefix || path.startsWith(rule.prefix + '/')
	);
}

// 本地挂载: 剥离前缀后的请求路径
export function localPath(rule: fileRule, path: string): string {
	return rule.prefix == '/' ? path : path.slice(rule.prefix.length) || '/';
}

// 转发 http 请求: 路径原样透传, body 流式转发, Host 指向目标
export function forward(req: requestctx, res: responsectx, rule: httpRule) {
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
	if (!rule || rule.kind != 'http') {
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
		// 与 http 转发保持一致: 拼接目标 base 路径, 并把 Host 改写为目标
		const url = req.url || '/';
		const target = rule.base.length > 1 ? rule.base + url : url;
		const lines = [req.method + ' ' + target + ' HTTP/1.1'];
		for (let i = 0; i < req.rawHeaders.length; i += 2) {
			if (req.rawHeaders[i].toLowerCase() == 'host') {
				continue;
			}
			lines.push(req.rawHeaders[i] + ': ' + req.rawHeaders[i + 1]);
		}
		lines.push('Host: ' + rule.host);
		upstream.write(lines.join('\r\n') + '\r\n\r\n');
		if (head.length > 0) {
			upstream.write(head);
		}
		socket.pipe(upstream);
		upstream.pipe(socket);
	});
}

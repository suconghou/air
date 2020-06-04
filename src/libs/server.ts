import * as querystring from 'querystring';
import * as fs from 'fs';
import nodeserve from '../nodeserve/index'
import compress from './compress';

import { serverArgs, cliArgs } from '../types'
import { requestctx, responsectx } from '../nodeserve/types'
import template from './template';


export default class server {

    private app: nodeserve

    constructor(private args: serverArgs, private cliargs: cliArgs, private cwd: string) {
        this.app = new nodeserve()
    }

    async serve() {
        try {
            this.route();
            this.app.listen(this.args.port, this.args.host, () => {
                console.info('Server listening on port %d', this.args.port)
            }).on('error', err => {
                console.error(err.toString())
            });
            this.watch();
        } catch (e) {
            console.error(e)
        }
    }

    private route() {
        this.app.get(/^[\w\-/.]+\.css$/, async (req: requestctx, res: responsectx, pathname: string, query: querystring.ParsedUrlQuery) => {
            const ret = await new compress(this.args.staticCfg, pathname, query).less()
            res.setHeader("x-hit", ret.hit ? 1 : 0);
            res.send(ret.ret.css, "text/css")
        });
        this.app.get(/^[\w\-/.]+\.js$/, async (req: requestctx, res: responsectx, pathname: string, query: querystring.ParsedUrlQuery) => {
            const ret = await new compress(this.args.staticCfg, pathname, query).Js()
            res.setHeader("x-hit", ret.hit ? 1 : 0)
            res.send(ret.ret.js, "text/javascript")
        });
        this.app.get(/^[\w\-/.]+\.html$/, async (req: requestctx, res: responsectx, pathname: string, query: querystring.ParsedUrlQuery) => {
            const tpl = new template(this.args.staticCfg, this.cwd, pathname, query);
            let ret: string;
            if (this.cliargs.art) {
                ret = await tpl.art()
            } else {
                ret = await tpl.ssi()
            }
            res.send(ret)
        });
    }

    private watch() {
        const f = this.args.staticCfg.fpath
        if (!f) {
            return
        }
        console.info("load config file ", f)
        fs.watchFile(f, async () => {
            try {
                delete require.cache[f];
                const c = require(f);
                const newcfg = Object.assign({}, c)
                this.args.staticCfg.opts = newcfg
                console.info('config reload success ', f);
            } catch (e) {
                console.error('config relaod error ', f, e)
            }
        });
    }

}
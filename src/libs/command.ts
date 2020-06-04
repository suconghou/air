import lint from './lint'
import compress from './compress'
import { cliArgs, staticOpts } from '../types';

export default class {

    static lint(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
        new lint(cwd, args, opts).lint();
    }

    static gitlint(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
        new lint(cwd, args, opts).lint();
    }

    static commitlint(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
        lint.commitlint(args[0])
    }

    /**
     * air install -dir path/to/dir
     * @param args 
     * @param cwd 
     * @param opts 
     */
    static install(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
        new lint(cwd, args, opts).install();
    }

    /**
     * air compress --clean
     * air compress --debug
     * @param args 
     * @param cwd 
     * @param opts 
     */
    static async compress(args: Array<string>, cwd: string, opts: cliArgs, staticCfg: staticOpts) {
        if (!staticCfg.fpath) {
            console.log("no config found")
            return
        }
        try {
            await new compress(staticCfg, "", {}).compress(opts)
        } catch (e) {
            throw e
        }
    }


    /**
     * 
     * air template --escape
     * air template --debug
     * @param filename 
     * @param data 
     * @param options 
     */
    static template(filename: string, data: object, options: object, staticCfg: staticOpts) {
        const template = require('art-template');
        Object.assign(template.defaults, options);
        return template(filename, data);
    }


}
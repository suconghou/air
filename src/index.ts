import * as process from 'process';
import cli from './libs/cli';

new cli(process.cwd()).run(process.argv);

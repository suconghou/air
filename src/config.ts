export default `
Usage:
    air [command] [flag]
Commands:
    serve           start air http server
    compress        compress less or javascript files

Flags:
    -v              show air version
    -h              show this help information
    -p              set server listen port
    -d              document root , work dir
    -q              urlArgs params in less render
    -m              modifyVars params in less render, eg: env=beta
    --debug         compress with debug mode
    --clean         compress with clean mode,remove console debugger
    --dry           just run as a static server
    --cors          send Access-Control-Allow-Origin
`;

export const version = '0.8.0';

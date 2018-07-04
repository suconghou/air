import server from "./libs/server.js";
import cli from "./libs/cli.js";
import process from "process";

new cli(new server(process.cwd())).run(process.argv);

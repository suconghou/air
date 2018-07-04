
import lint from "./lint";
import process from "process";
function main() {
  const [node, ...args] = process.argv;
  new lint(node, args);
}

main();

import { log as _log, exec as _exec, io as _io } from "@shevky/base";

import _cli from "./cli.js";
import _build from "./build.js";
import _init from "./init.js";

const VERSION = "0.0.1";

const __filename = _io.url.toPath(import.meta.url);
const __dirname = _io.path.name(__filename);
const ROOT_DIR = _io.path.combine(__dirname, "..");
const SHEVKY_ENTRY = "shevky.js";
const WATCH_PATH = "src";
const DIST_DIR = "dist/";

function printHelp() {
  console.log(_cli.help());
}

async function runWatch() {
  _log.info("Watching src for changes and rebuilding...");

  const args = ["--watch", "--watch-path", WATCH_PATH, SHEVKY_ENTRY, "--build"];
  await _exec.execute(process.execPath, args, ROOT_DIR);
}

async function runDev() {
  await _build.execute();
  _log.info("Serving dist on http://localhost:3000");

  await _exec.executeNpx(["-y", "serve@14", DIST_DIR]);
}

(async function main() {
  if (_cli.options.help) {
    printHelp();
  } else if (_cli.options.version) {
    console.log(_cli.version(VERSION));
  } else if (_cli.options.init) {
    await _init.execute();
  } else if (_cli.options.dev) {
    await runDev();
  } else if (_cli.options.build) {
    await _build.execute();
  } else {
    printHelp();
  }
})();

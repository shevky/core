import degit from "degit";
import { io as _io, exec as _exec, log as _log } from "@shevky/base";

import _prj from "../lib/project.js";

const TEMPLATE_REPO = "fatihtatoglu/shevky-simple-blog";

const ROOT_DIR = _prj.rootDir;
const SRC_DIR = _prj.srcDir;
const TEMP_DIR = _prj.tmpDir;

/** @type {string[]} */
const packages = [
  "gray-matter",
  "highlight.js",
  "html-minifier-terser",
  "marked",
  "marked-highlight",
  "mustache",
  "tailwindcss",
  "postcss",
  "@tailwindcss/cli",
  "@tailwindcss/typography",
  "autoprefixer",
  "esbuild",
];

/**
 * @param {unknown} error
 * @returns {string}
 */
function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// ========== Initialization Functions ========== //
async function _ensurePackages() {
  try {
    // install required package
    await _exec.installPackage(packages, true);
    _log.info("Initial dependencies installed.");
  } catch (error) {
    _log.err(getErrorMessage(error));
    process.exitCode = 1;
  }
}

async function _cloneRepo() {
  try {
    const emitter = degit(TEMPLATE_REPO, {
      cache: false,
      force: true,
      verbose: true,
    });

    await emitter.clone(TEMP_DIR);

    await _io.directory.create(SRC_DIR);
    await _io.directory.copy(_io.path.combine(TEMP_DIR, "src"), SRC_DIR);

    await _io.file.copy(
      _io.path.combine(TEMP_DIR, "tailwind.config.js"),
      _io.path.combine(ROOT_DIR, "tailwind.config.js"),
    );

    await _io.directory.remove(TEMP_DIR);

    _log.info("simpe blog code is cloned.");
  } catch (error) {
    console.log(getErrorMessage(error));
    process.exit(1);
  }
}

async function _addRequiredFiles() {
  const gitignore = ["node_modules/", "dist/", ""];
  await _io.file.write(
    _io.path.combine(ROOT_DIR, ".gitignore"),
    gitignore.join("\r\n"),
  );

  _log.info("required files are added.");
}

async function _updatePackageJSON() {
  const filePath = _io.path.combine(ROOT_DIR, "package.json");
  if (!(await _io.file.exists(filePath))) {
    _log.err("package.json not found.");
    process.exit(1);
  }

  const pkgRaw = await _io.file.read(filePath);
  /** @type {{ scripts?: Record<string, string> } & Record<string, unknown>} */
  let pkg = {};

  try {
    pkg = JSON.parse(pkgRaw);
  } catch {
    _log.err("Invalid package.json");
    process.exit(1);
  }

  pkg.scripts = pkg.scripts || {};

  pkg.scripts.build = "npx shevky --build";
  pkg.scripts.dev = "npx shevky --dev";

  await _io.file.write(filePath, JSON.stringify(pkg, null, 2) + "\n");

  _log.info("package.json scripts updated.");
}

// ========== Initialization Functions ========== //
async function init() {
  await _cloneRepo();
  await _ensurePackages();
  await _addRequiredFiles();
  await _updatePackageJSON();
}

/** @type {{ execute: () => Promise<void> }} */
const initializeApi = {
  execute: init,
};

export default initializeApi;

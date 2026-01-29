import { exec as _exec, log as _log, config as _cfg } from "@shevky/base";
import { Project } from "../lib/project.js";

/** @typedef {import("../types/index.d.ts").PluginInstance} PluginInstance */
/** @typedef {import("../types/index.d.ts").PluginLoadContext} PluginLoadContext */

export class PluginRegistry {
  /**
   * @type {Map<string, PluginInstance>}
   */
  #_cache = new Map();

  /**
   * @type {Project}
   */
  #_project = new Project(process.cwd());

  /**
   * @param {string[]|null|undefined} names
   * @returns {Promise<void>}
   */
  async load(names) {
    const pluginNames = Array.isArray(names) ? names.filter(Boolean) : [];
    if (!pluginNames.length) {
      return;
    }

    const resolveBase = this.#_project.rootDir;
    for (const pluginName of pluginNames) {
      try {
        const fromCwd = _exec.resolve(pluginName, resolveBase);
        const loaded = fromCwd
          ? await import(fromCwd)
          : await import(pluginName);

        /**
         * @type {PluginInstance}
         */
        const instance = loaded?.default ?? loaded;

        if (!instance || typeof instance !== "object") {
          _log.warn(`Plugin cannot load correctly. Plugin name: ${pluginName}`);
          continue;
        }

        /**
         * @type {string}
         */
        const name =
          typeof instance.name === "string" ? instance.name.trim() : "";
        if (!name) {
          _log.warn(
            `Plugin cannot load correctly. Missing name: ${pluginName}`,
          );
          continue;
        }

        if (this.#_cache.has(name)) {
          _log.warn(`Duplicate plugin name detected: ${name}`);
          continue;
        }

        this.#_cache.set(name, instance);

        if (instance.load) {
          const loadContext = this.#_createContext();
          await instance.load(loadContext);
        }

        _log.debug(`The plugin '${pluginName}' has been loaded.`);
      } catch (error) {
        _log.err(`Failed to load plugin '${pluginName}':`, error);
      }
    }
  }

  get count() {
    return this.#_cache.size;
  }

  get plugins() {
    return this.#_cache;
  }

  /**
   * @returns {PluginLoadContext}
   */
  #_createContext() {
    return {
      config: _cfg,
      paths: this.#_project.toObject(),
    };
  }
}

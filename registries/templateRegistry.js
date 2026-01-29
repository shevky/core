import { io as _io } from "@shevky/base";

import { Template } from "../lib/template.js";

export const TYPE_PARTIAL = "partial";
export const TYPE_COMPONENT = "component";
export const TYPE_LAYOUT = "layout";
export const TYPE_TEMPLATE = "template";

const MUSTACHE_EXT = ".mustache";

export class TemplateRegistry {
  /**
   * @type {Map<string, Map<string, Template>>}
   */
  #_cache = new Map();

  /**
   * @param {string} directoryPath
   */
  async loadPartials(directoryPath) {
    await this.#_loadDirectory(directoryPath, {
      type: TYPE_PARTIAL,
      keyPrefix: "partials/",
      accept: (entry) => entry.startsWith("_") && entry.endsWith(MUSTACHE_EXT),
    });
  }

  /**
   * @param {string} directoryPath
   */
  async loadComponents(directoryPath) {
    await this.#_loadDirectory(directoryPath, {
      type: TYPE_COMPONENT,
      keyPrefix: "components/",
      accept: (entry) => entry.endsWith(MUSTACHE_EXT),
    });
  }

  /**
   * @param {string} directoryPath
   */
  async loadLayouts(directoryPath) {
    await this.#_loadDirectory(directoryPath, {
      type: TYPE_LAYOUT,
      accept: (entry) => !entry.startsWith("_") && entry.endsWith(MUSTACHE_EXT),
    });
  }

  /**
   * @param {string} directoryPath
   */
  async loadTemplates(directoryPath) {
    await this.#_loadDirectory(directoryPath, {
      type: TYPE_TEMPLATE,
      accept: (entry) => entry.endsWith(MUSTACHE_EXT),
    });
  }

  /**
   * @param {string} type
   */
  list(type) {
    return Array.from(this.#_ensure(type).keys());
  }

  /**
   * @param {string} type
   * @param {string} key
   */
  get(type, key) {
    const template = this.#_ensure(type).get(key);
    if (!template) {
      throw new Error(`Template not found: ${key}`);
    }

    return template.content;
  }

  /**
   * @param {string} type
   * @param {string} key
   */
  getTemplate(type, key) {
    const template = this.#_ensure(type).get(key);
    if (!template) {
      throw new Error(`Template not found: ${key}`);
    }

    return template;
  }

  /**
   * @param {string} type
   */
  getFiles(type) {
    /** @type {Record<string, string>} */
    const result = {};
    for (const [key, template] of this.#_ensure(type).entries()) {
      result[key] = template.content;
    }

    return result;
  }

  /**
   * @param {string} type
   */
  getCount(type) {
    return this.#_ensure(type).size;
  }

  /**
   * @param {string} directoryPath
   * @param {{ type: string, keyPrefix?: string, accept: (entry: string) => boolean }} options
   */
  async #_loadDirectory(directoryPath, options) {
    const isExists = await _io.directory.exists(directoryPath);
    if (!isExists) {
      return;
    }

    const { type, keyPrefix = "", accept } = options;
    const entries = await _io.directory.read(directoryPath);
    for (const entry of entries) {
      if (!accept(entry)) {
        continue;
      }

      const key = `${keyPrefix}${entry.replace(`${MUSTACHE_EXT}`, "")}`;
      const path = _io.path.combine(directoryPath, entry);
      const raw = await _io.file.read(path);
      
      const template = new Template(key, type, path, raw);
      this.#_ensure(type).set(key, template);
    }
  }

  /**
   * @param {string} type
   * @returns {Map<string, Template>}
   */
  #_ensure(type) {
    let bucket = this.#_cache.get(type);
    if (!bucket) {
      bucket = new Map();
      this.#_cache.set(type, bucket);
    }

    return bucket;
  }
}

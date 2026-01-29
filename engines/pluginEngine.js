import { log as _log, plugin as _plugin } from "@shevky/base";
import { PluginRegistry } from "../registries/pluginRegistry.js";
import { ContentRegistry } from "../registries/contentRegistry.js";
import { Project } from "../lib/project.js";
import { MetaEngine } from "./metaEngine.js";

/** @typedef {import("../types/index.d.ts").PluginExecutionContext} PluginExecutionContext */

export class PluginEngine {
  /**
   * @type {Project}
   */
  #_project = new Project(process.cwd());

  /**
   * @type {PluginRegistry}
   */
  #_pluginRegistry;

  /**
   * @type {ContentRegistry}
   */
  #_contentRegistry;

  /**
   * @type {MetaEngine}
   */
  #_metaEngine;

  /**
   * @param {PluginRegistry} pluginRegistry
   * @param {ContentRegistry} contentRegistry
   * @param {MetaEngine} metaEngine
   */
  constructor(pluginRegistry, contentRegistry, metaEngine) {
    this.#_pluginRegistry = pluginRegistry;
    this.#_contentRegistry = contentRegistry;
    this.#_metaEngine = metaEngine;
  }

  /**
   * @param {string} hook
   * @returns {Promise<void>}
   */
  async execute(hook) {
    for (const [name, plugin] of this.#_pluginRegistry.plugins) {
      /** @type {Record<string, Function | undefined>} */
      const hooks = plugin.hooks ?? {};
      if (!Object.keys(hooks).length) {
        _log.warn(`The '${name}' plugin is invalid. Does not contains hook.`);
        continue;
      }

      const handler = hooks[hook];
      if (!handler) {
        continue;
      }

      try {
        const ctx = this.#_createContext(hook);

        _log.debug(
          `The '${name}' plugin has been triggered with '${hook}' hook.`,
        );

        await handler(ctx);
      } catch (error) {
        _log.err(
          `The '${name}' plugin has been failed with '${hook}' hook. Error: `,
          error,
        );
      }
    }
  }

  /**
   * @param {string} hook
   * @returns {PluginExecutionContext}
   */
  #_createContext(hook) {
    const baseContext = _plugin.createBaseContext();
    return {
      ...baseContext,
      paths: this.#_project.toObject(),

      // content:load
      ...(hook === _plugin.hooks.CONTENT_LOAD
        ? {
            contentFiles: this.#_contentRegistry.files,
          }
        : {}),
      ...(hook === _plugin.hooks.CONTENT_READY && this.#_metaEngine
        ? {
            contentFiles: this.#_contentRegistry.files,
            pages: this.#_contentRegistry.buildCategoryTagCollections(),
            footerPolicies: this.#_contentRegistry.buildFooterPolicies(),
            contentIndex: this.#_contentRegistry.buildContentIndex(),
          }
        : {}),
    };
  }
}

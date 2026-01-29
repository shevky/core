import { i18n } from "@shevky/base";
import { ContentRegistry } from "../registries/contentRegistry.js";
import { MenuItem } from "../lib/menuItem.js";

/**
 * @typedef {{ key: string, label: string, url: string, order: number }} MenuEntry
 */

export class MenuEngine {
  /**
   * @type {ContentRegistry}
   */
  #_contentRegistry;

  /**
   * @type {{ buildContentUrl: (canonical: string | null | undefined, lang: string, slug: string) => string }}
   */
  #_metaEngine;

  /**
   * @type {Record<string, MenuEntry[]>}
   */
  #_cache = {};

  /**
   * @param {ContentRegistry} contentRegistry
   * @param {{ buildContentUrl: (canonical: string | null | undefined, lang: string, slug: string) => string }} metaEngine
   */
  constructor(contentRegistry, metaEngine) {
    this.#_contentRegistry = contentRegistry;
    this.#_metaEngine = metaEngine;
  }

  async build() {
    if (this.#_contentRegistry.count === 0) {
      return;
    }

    for (const file of this.#_contentRegistry.files) {
      const item = new MenuItem(file);
      if (!item.isEligable) {
        continue;
      }

      if (!Array.isArray(this.#_cache[item.lang])) {
        this.#_cache[item.lang] = [];
      }

      const url = this.#_metaEngine.buildContentUrl(
        item.url,
        item.lang,
        item.slug,
      );
      this.#_cache[item.lang].push({ ...item.toObject(), url });
    }

    Object.keys(this.#_cache).forEach((lang) => {
      this.#_cache[lang].sort((a, b) => {
        if (a.order === b.order) {
          return a.label.localeCompare(b.label, lang);
        }

        return a.order - b.order;
      });
    });
  }

  /**
   * @param {string} lang
   * @param {string | null} activeKey
   */
  getMenuData(lang, activeKey) {
    const baseItems = this.#_cache[lang] ?? [];
    const normalizedActiveKey =
      typeof activeKey === "string" && activeKey.trim().length > 0
        ? activeKey.trim()
        : "";
    const hasExplicitMatch = normalizedActiveKey
      ? baseItems.some((item) => item.key === normalizedActiveKey)
      : false;
    const resolvedActiveKey = hasExplicitMatch
      ? normalizedActiveKey
      : (baseItems[0]?.key ?? "");
    const items = baseItems.map((item) => ({
      ...item,
      label: i18n.t(lang, `menu.${item.key}`, item.label ?? item.key),
      isActive: item.key === resolvedActiveKey,
    }));

    return { items, activeKey: resolvedActiveKey };
  }

  /**
   * @param {{id?: unknown, slug?:unknown} | null | undefined} frontMatter
   */
  resolveActiveMenuKey(frontMatter) {
    if (!frontMatter) {
      return null;
    }

    if (
      typeof frontMatter.id === "string" &&
      frontMatter.id.trim().length > 0
    ) {
      return frontMatter.id.trim();
    }

    if (
      typeof frontMatter.slug === "string" &&
      frontMatter.slug.trim().length > 0
    ) {
      return frontMatter.slug.trim();
    }

    return null;
  }
}

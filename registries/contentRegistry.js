import { io as _io } from "@shevky/base";
import matter from "gray-matter";

import { ContentFile } from "../lib/contentFile.js";
import { ContentSummary } from "../lib/contentSummary.js";
import { MetaEngine } from "../engines/metaEngine.js";

export class ContentRegistry {
  /**
   * @type {ContentFile[]}
   */
  #_cache = [];
  /** @type {import("../types/index.d.ts").CollectionsByLang | null} */
  #_collectionsCache = null;
  /** @type {ReturnType<ContentRegistry["buildFooterPolicies"]> | null} */
  #_footerPoliciesCache = null;
  /** @type {ReturnType<ContentRegistry["buildContentIndex"]> | null} */
  #_contentIndexCache = null;
  /** @type {MetaEngine} */
  #_metaEngine;

  /**
   * @param {MetaEngine} metaEngine
   */
  constructor(metaEngine) {
    this.#_metaEngine = metaEngine;
  }

  /**
   * @param {string} path
   * @returns
   */
  async load(path) {
    const isExists = await _io.directory.exists(path);
    if (!isExists) {
      return;
    }

    const files = await _io.directory.read(path);
    for (const entry of files) {
      if (!entry.endsWith(".md")) {
        continue;
      }

      const filePath = _io.path.combine(path, entry);
      const isFileExists = await _io.file.exists(filePath);
      if (!isFileExists) {
        throw new Error(`Failed to read content file at ${filePath}`);
      }

      const contentFile = await this.#_loadFromFile(filePath);
      this.#_cache.push(contentFile);
    }

    this.#_collectionsCache = null;
    this.#_footerPoliciesCache = null;
    this.#_contentIndexCache = null;
  }

  get count() {
    return this.#_cache.length;
  }

  get files() {
    return this.#_cache;
  }

  /**
   * @returns {Record<string, Array<{ key: string, label: string, url: string, lang: string }>>}
   */
  buildFooterPolicies() {
    if (this.#_footerPoliciesCache) {
      return this.#_footerPoliciesCache;
    }

    if (this.count === 0) {
      this.#_footerPoliciesCache = {};
      return this.#_footerPoliciesCache;
    }

    /** @type {Record<string, Array<{ key: string, label: string, url: string, lang: string }>>} */
    const policiesByLang = {};
    const contentFiles = this.files;
    for (const file of contentFiles) {
      if (
        !file.isValid ||
        file.isDraft ||
        !file.isPublished ||
        file.category !== "policy"
      ) {
        continue;
      }

      const policy = {
        lang: file.lang,
        key: file.id,
        label: file.menuLabel,
        url: this.#_metaEngine.buildContentUrl(
          file.canonical,
          file.lang,
          file.slug,
        ),
      };

      if (!Array.isArray(policiesByLang[file.lang])) {
        policiesByLang[file.lang] = [];
      }

      policiesByLang[file.lang].push(policy);
    }

    Object.keys(policiesByLang).forEach((lang) => {
      policiesByLang[lang].sort((a, b) => a.label.localeCompare(b.label, lang));
    });

    this.#_footerPoliciesCache = policiesByLang;
    return this.#_footerPoliciesCache;
  }

  /**
   * @returns {Record<string, Record<string, { id: string, lang: string, title: string, canonical: string }>>}
   */
  buildContentIndex() {
    if (this.#_contentIndexCache) {
      return this.#_contentIndexCache;
    }

    if (this.count === 0) {
      this.#_contentIndexCache = {};
      return this.#_contentIndexCache;
    }

    /** @type {Record<string, Record<string, { id: string, lang: string, title: string, canonical: string }>>} */
    const index = {};
    const contentFiles = this.files;
    for (const file of contentFiles) {
      if (!file.isValid || file.isDraft || !file.isPublished || !file.id) {
        continue;
      }

      if (!index[file.id]) {
        index[file.id] = {};
      }

      index[file.id][file.lang] = {
        id: file.id,
        lang: file.lang,
        title: file.title,
        canonical: this.#_metaEngine.buildContentUrl(
          file.canonical,
          file.lang,
          file.slug,
        ),
      };
    }

    this.#_contentIndexCache = index;
    return this.#_contentIndexCache;
  }

  /**
   * @returns {import("../types/index.d.ts").CollectionsByLang}
   */
  buildCategoryTagCollections() {
    if (this.#_collectionsCache) {
      return this.#_collectionsCache;
    }

    if (this.count === 0) {
      this.#_collectionsCache = {};
      return this.#_collectionsCache;
    }

    /** @type {import("../types/index.d.ts").CollectionsByLang} */
    const pagesByLang = {};
    const contentFiles = this.files;
    for (const file of contentFiles) {
      if (!file.isValid || file.isDraft || !file.isPublished) {
        continue;
      }

      const contentSummary = new ContentSummary(file);
      const summary = /** @type {import("../types/index.d.ts").CollectionEntry} */ ({
        ...contentSummary.toObject(),
        canonical: this.#_metaEngine.buildContentUrl(
          file.canonical,
          file.lang,
          file.slug,
        ),
      });
      const langStore = pagesByLang[file.lang] ?? (pagesByLang[file.lang] = {});

      if (file.isPostTemplate && file.isFeatured) {
        this.#_addCollectionEntry(langStore, "home", summary, "home");
      }

      if (file.category) {
        this.#_addCollectionEntry(
          langStore,
          file.category,
          summary,
          "category",
        );
      }

      for (const tag of file.tags) {
        this.#_addCollectionEntry(langStore, tag, summary, "tag");
      }

      if (file.series) {
        this.#_addCollectionEntry(
          langStore,
          file.series,
          {
            ...contentSummary.toObject(),
            seriesTitle: file.seriesTitle,
          },
          "series",
        );
      }
    }

    this.#_collectionsCache = this.#_sortCollectionEntries(pagesByLang);
    return this.#_collectionsCache;
  }

  /**
   * @param {string} filePath
   * @returns {Promise<ContentFile>}
   */
  async #_loadFromFile(filePath) {
    const raw = await _io.file.read(filePath);
    let isValid = false;

    /**
     * @type {{data: Record<string, unknown>, content: string}}
     */
    let matterResponse = { data: {}, content: "" };

    try {
      matterResponse = matter(raw);
      isValid = true;
    } catch {}

    const { data, content } = matterResponse;
    return new ContentFile(data, content, filePath, isValid);
  }

  /**
   * @param {Record<string, import("../types/index.d.ts").CollectionEntry[]>} store
   * @param {string} key
   * @param {import("../types/index.d.ts").CollectionEntry} entry
   * @param {string} type
   */
  #_addCollectionEntry(store, key, entry, type) {
    if (!store[key]) {
      store[key] = [];
    }
    store[key].push({
      ...entry,
      type,
    });
  }

  /**
   * @param {import("../types/index.d.ts").CollectionsByLang} collections
   */
  #_sortCollectionEntries(collections) {
    /** @type {import("../types/index.d.ts").CollectionsByLang} */
    const sorted = {};
    Object.keys(collections).forEach((lang) => {
      sorted[lang] = {};
      Object.keys(collections[lang]).forEach((key) => {
        sorted[lang][key] = collections[lang][key].slice().sort((a, b) => {
          const aDate = Date.parse(String(a.date ?? "")) || 0;
          const bDate = Date.parse(String(b.date ?? "")) || 0;
          if (aDate === bDate) {
            return (a.title ?? "").localeCompare(b.title ?? "", lang);
          }
          return bDate - aDate;
        });
      });
    });
    return sorted;
  }
}

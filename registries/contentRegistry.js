import crypto from "node:crypto";
import { io as _io, config as _cfg, log as _log } from "@shevky/base";
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
    let hasChanges = false;
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
      if (this.#_addUniqueContent(contentFile)) {
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.#_resetCaches();
    }
  }

  get count() {
    return this.#_cache.length;
  }

  get files() {
    return this.#_cache;
  }

  /**
   * @param {import("../types/index.d.ts").ContentFileLike | ContentFile} input
   */
  addContent(input) {
    if (!input) {
      return;
    }

    if (input instanceof ContentFile) {
      if (this.#_addUniqueContent(input)) {
        this.#_resetCaches();
      }
      return;
    }

    const header =
      input.header && typeof input.header === "object" ? input.header : {};
    const content =
      typeof input.content === "string"
        ? input.content
        : typeof input.body?.content === "string"
          ? input.body.content
          : "";
    const sourcePath =
      typeof input.sourcePath === "string"
        ? input.sourcePath
        : "plugin://content/unknown.md";
    const isValid = typeof input.isValid === "boolean" ? input.isValid : true;

    const contentFile = new ContentFile(header, content, sourcePath, isValid);
    if (this.#_addUniqueContent(contentFile)) {
      this.#_resetCaches();
    }
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
        file.schemaType !== "policy"
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

    const includeContentFile = Boolean(
      _cfg?.content?.collections?.includeContentFile,
    );
    /** @type {import("../types/index.d.ts").CollectionsByLang} */
    const pagesByLang = {};
    const contentFiles = this.files;
    for (const file of contentFiles) {
      if (!file.isValid || file.isDraft || !file.isPublished) {
        continue;
      }

      const contentSummary = new ContentSummary(file);
      const summaryBase = contentSummary.toObject();
      const summary = /** @type {import("../types/index.d.ts").CollectionEntry} */ ({
        ...summaryBase,
        ...(includeContentFile ? file.toObject() : {}),
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

  #_resetCaches() {
    this.#_collectionsCache = null;
    this.#_footerPoliciesCache = null;
    this.#_contentIndexCache = null;
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

  /**
   * Adds or replaces content by id+lang.
   * If duplicate payload is same -> ignore, if different -> replace with latest.
   * @param {ContentFile} contentFile
   */
  #_addUniqueContent(contentFile) {
    if (!(contentFile instanceof ContentFile)) {
      return false;
    }

    const id = typeof contentFile.id === "string" ? contentFile.id.trim() : "";
    const lang =
      typeof contentFile.lang === "string" ? contentFile.lang.trim() : "";
    const sourcePath =
      typeof contentFile.sourcePath === "string" &&
      contentFile.sourcePath.trim().length > 0
        ? contentFile.sourcePath
        : "unknown source";

    /** @type {string[]} */
    const missingFields = [];
    if (!id) missingFields.push("id");
    if (!lang) missingFields.push("lang");
    if (missingFields.length > 0) {
      _log.warn(
        `[content] Skipped content: missing required field(s): ${missingFields.join(", ")} (${sourcePath})`,
      );
      return false;
    }

    const existingIndex = this.#_cache.findIndex((entry) => {
      const existingId = typeof entry.id === "string" ? entry.id.trim() : "";
      const existingLang =
        typeof entry.lang === "string" ? entry.lang.trim() : "";
      return existingId === id && existingLang === lang;
    });

    if (existingIndex !== -1) {
      const currentEntry = this.#_cache[existingIndex];
      const currentHash = this.#_buildContentHash(currentEntry);
      const incomingHash = this.#_buildContentHash(contentFile);
      if (currentHash === incomingHash) {
        return false;
      }

      this.#_cache[existingIndex] = contentFile;
      return true;
    }

    this.#_cache.push(contentFile);
    return true;
  }

  /**
   * @param {ContentFile} contentFile
   */
  #_buildContentHash(contentFile) {
    const payload = {
      header: contentFile.header?.raw ?? {},
      content: typeof contentFile.content === "string" ? contentFile.content : "",
      isValid: Boolean(contentFile.isValid),
    };

    return crypto
      .createHash("sha1")
      .update(this.#_stableStringify(payload))
      .digest("hex");
  }

  /**
   * Stable stringify to avoid key-order differences in hash computation.
   * @param {unknown} value
   * @returns {string}
   */
  #_stableStringify(value) {
    if (value === undefined) {
      return '"__undefined__"';
    }

    if (value === null) {
      return "null";
    }

    if (value instanceof Date) {
      return JSON.stringify(value.toISOString());
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.#_stableStringify(item)).join(",")}]`;
    }

    if (typeof value !== "object") {
      if (typeof value === "number" && !Number.isFinite(value)) {
        return JSON.stringify(String(value));
      }
      return JSON.stringify(value);
    }

    const entries = Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${this.#_stableStringify(
            /** @type {Record<string, unknown>} */ (value)[key],
          )}`,
      );

    return `{${entries.join(",")}}`;
  }
}

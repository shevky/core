import crypto from "node:crypto";
import Mustache from "mustache";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import { config as _cfg, format as _fmt } from "@shevky/base";

import {
  TemplateRegistry,
  TYPE_COMPONENT,
  TYPE_LAYOUT,
  TYPE_PARTIAL,
} from "../registries/templateRegistry.js";
import { Page } from "../lib/page.js";
import { PageRegistry } from "../registries/pageRegistry.js";

/** @typedef {import("../types/index.d.ts").Placeholder} Placeholder */

export class RenderEngine {
  /**
   * @type {TemplateRegistry}
   */
  #_templateRegistry;

  /**
   * @type {{ buildContentUrl: (canonical: string | null | undefined, lang: string, slug: string) => string }}
   */
  #_metaEngine;

  /**
   * @type {PageRegistry | null}
   */
  #_pageRegistry;

  /**
   * @type {typeof _cfg}
   */
  #_config;

  /**
   * @type {typeof _fmt}
   */
  #_format;

  /**
   * @type {import("marked").Renderer}
   */
  #_markdownRenderer;

  /**
   * @param {{ templateRegistry: TemplateRegistry, metaEngine: { buildContentUrl: (canonical: string | null | undefined, lang: string, slug: string) => string }, pageRegistry?: PageRegistry | null, config?: typeof _cfg, format?: typeof _fmt }} options
   */
  constructor(options) {
    this.#_templateRegistry = options.templateRegistry;
    this.#_metaEngine = options.metaEngine;
    this.#_pageRegistry = options.pageRegistry ?? null;
    this.#_config = options.config ?? _cfg;
    this.#_format = options.format ?? _fmt;
    
    this.#_markdownRenderer = new marked.Renderer();
    this.#_markdownRenderer.code = (token) => this.#_renderMarkdownCode(token);
  }

  /**
   *
   * @param {string} layoutName
   * @param {Record<string, any>} view
   */
  renderLayout(layoutName, view) {
    const layout = this.#_templateRegistry.getTemplate(TYPE_LAYOUT, layoutName);
    return Mustache.render(layout.content, view, {
      ...this.#_templateRegistry.getFiles(TYPE_PARTIAL),
      ...this.#_templateRegistry.getFiles(TYPE_COMPONENT),
    });
  }

  /**
   * @param {string} html
   * @param {{ versionToken: string, minifyHtml: (html: string, options: Record<string, any>) => Promise<string> }} options
   */
  async transformHtml(html, options) {
    let output = html
      .replace(/\/output\.css(\?v=[^"']+)?/g, `/output.css?v=${options.versionToken}`)
      .replace(/\/output\.js(\?v=[^"']+)?/g, `/output.js?v=${options.versionToken}`)
      .replace(/\b(src|href)="~\//g, '$1="/');

    if (!this.#_config.build.minify) {
      return output;
    }

    try {
      output = await options.minifyHtml(output, {
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        decodeEntities: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        removeEmptyAttributes: false,
        sortAttributes: true,
        sortClassName: true,
        minifyCSS: true,
        minifyJS: true,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn("[build] Failed to minify HTML:", msg);
    }

    return output;
  }

  /**
   * @param {Record<string, any>} frontMatter
   * @param {string} lang
   * @param {Record<string, any>} dictionary
   * @param {{ i18n: { default: string, flags: (lang: string) => any }, pages: Record<string, any> }} deps
   */
  buildContentComponentContext(frontMatter, lang, dictionary, deps) {
    const normalizedLang = lang ?? deps.i18n.default;
    const languageFlags = deps.i18n.flags(normalizedLang);
    return {
      front: frontMatter ?? {},
      lang: normalizedLang,
      i18n: dictionary ?? {},
      pages: deps.pages[normalizedLang] ?? {},
      allPages: deps.pages,
      locale: languageFlags.locale,
      isEnglish: languageFlags.isEnglish,
      isTurkish: languageFlags.isTurkish,
    };
  }

  /**
   * @param {{ lang: string, activeMenuKey: string | null, pageMeta: any, content: string, dictionary: Record<string, any> }} input
   * @param {{
   *  pages: Record<string, any>,
   *  i18n: { flags: (lang: string) => any, serialize: () => string },
   *  metaEngine: { buildSiteData: (lang: string) => any },
   *  menuEngine: { getMenuData: (lang: string, activeMenuKey: string | null) => any },
   *  getFooterData: (lang: string) => any,
   *  analyticsSnippets: any,
   *  buildEasterEggPayload: (view: Record<string, any>) => any,
   * }} deps
   */
  buildViewPayload(input, deps) {
    const { lang, activeMenuKey, pageMeta, content, dictionary } = input;
    const languageFlags = deps.i18n.flags(lang);
    const view = {
      lang,
      locale: languageFlags.locale,
      isEnglish: languageFlags.isEnglish,
      isTurkish: languageFlags.isTurkish,
      theme: "light",
      site: deps.metaEngine.buildSiteData(lang),
      menu: deps.menuEngine.getMenuData(lang, activeMenuKey),
      footer: deps.getFooterData(lang),
      pages: deps.pages,
      i18n: dictionary,
      i18nInline: deps.i18n.serialize(),
      page: pageMeta,
      content,
      scripts: {
        analytics: deps.analyticsSnippets,
        body: [],
      },
      easterEgg: "",
    };
    view.easterEgg = deps.buildEasterEggPayload(view);
    return view;
  }

  /**
   * @param {{
   *  kind?: string,
   *  type?: string,
   *  lang: string,
   *  slug: string,
   *  canonical?: string,
   *  layout: string,
   *  template?: string,
   *  front: Record<string, unknown>,
   *  view: Record<string, unknown>,
   *  html: string,
   *  sourcePath?: string,
   *  outputPath?: string,
   *  writeMeta?: Record<string, unknown>,
   * }} input
   */
  createPage(input) {
    const isDynamic =
      typeof input.writeMeta?.action === "string" &&
      input.writeMeta.action.includes("DYNAMIC");
    const isCollection =
      typeof input.front?.collectionType === "string" &&
      input.front.collectionType.length > 0;
    const page = new Page({
      ...input,
      isDynamic,
      isCollection,
      isStatic: !isDynamic,
    });

    if (this.#_pageRegistry) {
      this.#_pageRegistry.add(page);
    }

    return page;
  }

  /**
   * @param {string} markdown
   * @param {Record<string, any>} [context]
   * @returns {{ markdown: string, placeholders: Placeholder[] }}
   */
  renderMarkdownComponents(markdown, context = {}) {
    if (!markdown || typeof markdown !== "string") {
      return { markdown: markdown ?? "", placeholders: [] };
    }

    /** @type {Placeholder[]} */
    const placeholders = [];
    const baseContext = context ?? {};
    const writer = new Mustache.Writer();
    const writerAny = /** @type {any} */ (writer);
    const originalRenderPartial = writer.renderPartial;

    const that = this;
    /**
     * @this {any}
     * @param {any} token
     * @param {any} tokenContext
     * @param {any} partials
     * @param {any} config
     */
    writer.renderPartial = function renderPartial(
      token,
      tokenContext,
      partials,
      config,
    ) {
      const name = token?.[1];
      if (name?.startsWith("components/")) {
        const template = that.#_templateRegistry.getTemplate(
          TYPE_COMPONENT,
          name,
        ).content;
        if (!template) return "";
        const tokenId = `COMPONENT_SLOT_${placeholders.length}_${name.replace(/[^A-Za-z0-9_-]/g, "_")}_${crypto
          .randomBytes(4)
          .toString("hex")}`;
        const comment = `<!--${tokenId}-->`;
        const marker = `\n${comment}\n`;
        const tags =
          typeof writerAny.getConfigTags === "function"
            ? writerAny.getConfigTags(config)
            : undefined;
        const tokens = writerAny.parse(template, tags);
        const html = writerAny.renderTokens(
          tokens,
          tokenContext,
          partials,
          template,
          /** @type {any} */ (config),
        );
        placeholders.push({ token: tokenId, marker, html });
        return marker;
      }

      return originalRenderPartial.call(
        this,
        token,
        tokenContext,
        partials,
        /** @type {any} */ (config),
      );
    };

    let renderedMarkdown = writer.render(markdown, baseContext, {
      ...this.#_templateRegistry.getFiles(TYPE_PARTIAL),
      ...this.#_templateRegistry.getFiles(TYPE_COMPONENT),
    });

    placeholders.forEach(({ token }) => {
      const marker = `<!--${token}-->`;
      const pattern = new RegExp(
        `^[ \\t]*${this.#_escapeRegExp(marker)}[ \\t]*$`,
        "gm",
      );
      renderedMarkdown = renderedMarkdown.replace(pattern, marker);
    });

    return { markdown: renderedMarkdown, placeholders };
  }

  /**
   * @param {{
   *  frontMatter: Record<string, any>,
   *  lang: string,
   *  baseSlug: string,
   *  layoutName: string,
   *  templateName: string,
   *  contentHtml: string,
   *  dictionary: Record<string, any>,
   *  sourcePath: string,
   *  pages: Record<string, Record<string, any[]>>,
   *  renderContentTemplate: (templateName: string, contentHtml: string, front: Record<string, any>, lang: string, dictionary: Record<string, any>, listing?: Record<string, any>) => Promise<string>,
   *  buildViewPayload: (input: { lang: string, activeMenuKey: string | null, pageMeta: any, content: string, dictionary: Record<string, any> }) => Record<string, any>,
   *  renderPage: (input: { layoutName: string, view: Record<string, any>, front: Record<string, any>, lang: string, slug: string, writeMeta?: Record<string, any> }) => Promise<any>,
   *  metaEngine: { buildPageMeta: (front: Record<string, any>, lang: string, slug: string) => any },
   *  menuEngine: { resolveActiveMenuKey: (front: Record<string, any>) => string | null },
   *  resolveListingKey: (front: Record<string, any>) => string | null,
   *  resolveListingEmpty: (front: Record<string, any>, lang: string) => any,
   *  resolveCollectionType: (front: Record<string, any>, items?: any[], fallback?: string) => string,
   *  buildCollectionTypeFlags: (type: string) => Record<string, any>,
   *  resolvePaginationSegment: (lang: string) => string,
   *  dedupeCollectionItems: (items: any[]) => any[],
   *  byteLength: (input: unknown) => number,
   * }} options
   */
  async buildPaginatedCollectionPages(options) {
    const {
      frontMatter,
      lang,
      baseSlug,
      layoutName,
      templateName,
      contentHtml,
      dictionary,
      sourcePath,
      pages,
      renderContentTemplate,
      buildViewPayload,
      renderPage,
      metaEngine,
      menuEngine,
      resolveListingKey,
      resolveListingEmpty,
      resolveCollectionType,
      buildCollectionTypeFlags,
      resolvePaginationSegment,
      dedupeCollectionItems,
      byteLength,
    } = options;

    const normalizedFrontMatter = normalizeFrontMatter(frontMatter);
    const langCollections = pages[lang] ?? {};
    const key = resolveListingKey(normalizedFrontMatter);
    const sourceItems =
      key && Array.isArray(langCollections[key]) ? langCollections[key] : [];
    const allItems = dedupeCollectionItems(sourceItems);
    const pageSizeSetting = this.#_config.content.pagination.pageSize;
    const pageSize = pageSizeSetting > 0 ? pageSizeSetting : 5;
    const totalPages = Math.max(
      1,
      pageSize > 0 ? Math.ceil(allItems.length / pageSize) : 1,
    );
    const emptyMessage = resolveListingEmpty(normalizedFrontMatter, lang);
    const collectionType = resolveCollectionType(normalizedFrontMatter, allItems);
    const collectionFlags = buildCollectionTypeFlags(collectionType);

    for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
      const startIndex = (pageIndex - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const items = allItems.slice(startIndex, endIndex);
      const hasItems = items.length > 0;
      const hasPrev = pageIndex > 1;
      const hasNext = pageIndex < totalPages;

      const segment = resolvePaginationSegment(lang);

      const base = baseSlug.replace(/\/+$/, "");

      const pageSlug =
        pageIndex === 1
          ? baseSlug
          : base
            ? `${base}/${segment}-${pageIndex}`
            : `${segment}-${pageIndex}`;

      const prevSlug =
        pageIndex > 2
          ? base
            ? `${base}/${segment}-${pageIndex - 1}`
            : `${segment}-${pageIndex - 1}`
          : baseSlug;

      const nextSlug = base
        ? `${base}/${segment}-${pageIndex + 1}`
        : `${segment}-${pageIndex + 1}`;

      const listing = {
        key,
        lang,
        items,
        hasItems,
        emptyMessage,
        page: pageIndex,
        totalPages,
        hasPrev,
        hasNext,
        hasPagination: totalPages > 1,
        prevUrl: hasPrev
          ? this.#_metaEngine.buildContentUrl(null, lang, prevSlug)
          : "",
        nextUrl: hasNext
          ? this.#_metaEngine.buildContentUrl(null, lang, nextSlug)
          : "",
        type: collectionType,
        ...collectionFlags,
      };

      let canonical = normalizedFrontMatter.canonical;
      if (pageIndex > 1) {
        if (
          typeof normalizedFrontMatter.canonical === "string" &&
          normalizedFrontMatter.canonical.trim().length > 0
        ) {
          const trimmed = normalizedFrontMatter.canonical
            .trim()
            .replace(/\/+$/, "");
          canonical = `${trimmed}/${segment}-${pageIndex}/`;
        } else {
          canonical = undefined;
        }
      }

      const frontForPage = /** @type {Record<string, any>} */ ({
        ...normalizedFrontMatter,
        slug: pageSlug,
        canonical,
      });

      if (collectionType) {
        frontForPage.collectionType = collectionType;
      }

      const renderedContent = await renderContentTemplate(
        templateName,
        contentHtml,
        frontForPage,
        lang,
        dictionary,
        listing,
      );

      const pageMeta = metaEngine.buildPageMeta(frontForPage, lang, pageSlug);
      const activeMenuKey = menuEngine.resolveActiveMenuKey(frontForPage);
      const view = buildViewPayload({
        lang,
        activeMenuKey,
        pageMeta,
        content: renderedContent,
        dictionary,
      });

      await renderPage({
        layoutName,
        view,
        front: frontForPage,
        lang,
        slug: pageSlug,
        writeMeta: {
          action: "BUILD_COLLECTION",
          type: templateName,
          source: sourcePath,
          lang,
          template: layoutName,
          items: items.length,
          page: `${pageIndex}/${totalPages}`,
          inputBytes: byteLength(renderedContent),
        },
      });
    }
  }

  /**
   * @param {{
   *  collectionsConfig: Record<string, any> | null | undefined,
   *  pages: Record<string, Record<string, any[]>>,
   *  i18n: { supported: string[], get: (lang: string) => Record<string, any>, t: (lang: string, key: string, fallback?: string) => any },
   *  renderContentTemplate: (templateName: string, contentHtml: string, front: Record<string, any>, lang: string, dictionary: Record<string, any>) => Promise<string>,
   *  buildViewPayload: (input: { lang: string, activeMenuKey: string | null, pageMeta: any, content: string, dictionary: Record<string, any> }) => Record<string, any>,
   *  renderPage: (input: { layoutName: string, view: Record<string, any>, front: Record<string, any>, lang: string, slug: string, writeMeta?: Record<string, any> }) => Promise<any>,
   *  metaEngine: { buildPageMeta: (front: Record<string, any>, lang: string, slug: string) => any },
   *  menuEngine: { resolveActiveMenuKey: (front: Record<string, any>) => string | null },
   *  resolveCollectionType: (front: Record<string, any>, items?: any[], fallback?: string) => string,
   *  normalizeCollectionTypeValue: (value: unknown) => string,
   *  resolveCollectionDisplayKey: (configKey: string, defaultKey: string, items: any[]) => string,
   *  dedupeCollectionItems: (items: any[]) => any[],
   *  normalizeLogPath: (pathValue?: string | null) => string,
   *  io: { path: { combine: (...segments: string[]) => string } },
   *  byteLength: (input: unknown) => number,
   * }} options
   */
  async buildDynamicCollectionPages(options) {
    const {
      collectionsConfig,
      pages,
      i18n,
      renderContentTemplate,
      buildViewPayload,
      renderPage,
      metaEngine,
      menuEngine,
      resolveCollectionType,
      normalizeCollectionTypeValue,
      resolveCollectionDisplayKey,
      dedupeCollectionItems,
      normalizeLogPath,
      io,
      byteLength,
    } = options;

    if (!collectionsConfig || typeof collectionsConfig !== "object") {
      return;
    }

    const configKeys = Object.keys(collectionsConfig);
    for (const configKey of configKeys) {
      const config = collectionsConfig[configKey];
      if (!config || typeof config !== "object") {
        continue;
      }

      const templateName =
        typeof config.template === "string" && config.template.trim().length > 0
          ? config.template.trim()
          : "category";

      const slugPattern =
        config.slugPattern && typeof config.slugPattern === "object"
          ? /** @type {Record<string, string>} */ (config.slugPattern)
          : {};
      const pairs =
        config.pairs && typeof config.pairs === "object"
          ? /** @type {Record<string, Record<string, string>>} */ (config.pairs)
          : null;

      const rawTypes =
        Array.isArray(config.types) && config.types.length > 0
          ? /** @type {unknown[]} */ (config.types)
          : null;
      const types = rawTypes
        ? rawTypes
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value.length > 0)
        : null;

      if (!types || types.length === 0) {
        continue;
      }

      const languages = Object.keys(pages);
      for (const lang of languages) {
        const langCollections = pages[lang] ?? {};
        const dictionary = i18n.get(lang);
        const langSlugPattern =
          typeof slugPattern[lang] === "string" ? slugPattern[lang] : null;
        const titleSuffix = i18n.t(
          lang,
          `seo.collections.${configKey}.titleSuffix`,
          "",
        );

        const collectionKeys = Object.keys(langCollections);
        for (const key of collectionKeys) {
          /** @type {any[]} */
          const items = langCollections[key] ?? [];
          if (!Array.isArray(items) || items.length === 0) {
            continue;
          }

          const typedItems = items.filter((entry) => {
            if (!entry) {
              return false;
            }
            const entryType =
              typeof entry.type === "string" ? entry.type.trim() : "";
            if (!entryType) {
              return false;
            }
            return types.includes(entryType);
          });
          if (!typedItems.length) {
            continue;
          }

          const dedupedItems = dedupeCollectionItems(typedItems);
          if (!dedupedItems.length) {
            continue;
          }

          const slug =
            langSlugPattern && langSlugPattern.includes("{{key}}")
              ? langSlugPattern.replace("{{key}}", key)
              : (langSlugPattern ?? key);

          let alternate;
          if (pairs) {
            const pairEntry = pairs[key];
            if (pairEntry && typeof pairEntry === "object") {
              /** @type {Record<string, string>} */
              const altMap = {};
              i18n.supported.forEach((altLang) => {
                if (altLang === lang) {
                  return;
                }

                const altKey =
                  typeof pairEntry[altLang] === "string"
                    ? pairEntry[altLang].trim()
                    : "";
                if (!altKey) {
                  return;
                }

                const altSlugPattern =
                  typeof slugPattern[altLang] === "string"
                    ? slugPattern[altLang]
                    : null;
                const altSlug =
                  altSlugPattern && altSlugPattern.includes("{{key}}")
                    ? altSlugPattern.replace("{{key}}", altKey)
                    : (altSlugPattern ?? altKey);
                altMap[altLang] = this.#_metaEngine.buildContentUrl(
                  null,
                  altLang,
                  altSlug,
                );
              });

              if (Object.keys(altMap).length > 0) {
                alternate = altMap;
              }
            }
          }

          const displayKey = resolveCollectionDisplayKey(
            configKey,
            key,
            dedupedItems,
          );
          const baseTitle = displayKey;
          const normalizedTitleSuffix =
            typeof titleSuffix === "string" && titleSuffix.trim().length > 0
              ? titleSuffix.trim()
              : "";
          const effectiveTitle = normalizedTitleSuffix
            ? `${baseTitle} | ${normalizedTitleSuffix}`
            : baseTitle;
          const frontTitle = configKey === "series" ? displayKey : effectiveTitle;
          const front = /** @type {Record<string, any>} */ ({
            title: frontTitle,
            metaTitle: effectiveTitle,
            slug,
            template: templateName,
            listKey: key,
            ...(alternate ? { alternate } : {}),
          });

          front.listHeading = effectiveTitle;
          if (configKey === "series") {
            front.series = key;
            front.seriesTitle = displayKey;
          }

          const fallbackType = normalizeCollectionTypeValue(
            types.length === 1 ? types[0] : "",
          );
          const resolvedCollectionType = resolveCollectionType(
            front,
            dedupedItems,
            fallbackType,
          );
          if (resolvedCollectionType) {
            front.collectionType = resolvedCollectionType;
          }

          const contentHtml = await renderContentTemplate(
            templateName,
            "",
            front,
            lang,
            dictionary,
          );
          const pageMeta = metaEngine.buildPageMeta(front, lang, slug);
          const layoutName = "default";
          const activeMenuKey = menuEngine.resolveActiveMenuKey(front);
          const view = buildViewPayload({
            lang,
            activeMenuKey,
            pageMeta,
            content: contentHtml,
            dictionary,
          });

          await renderPage({
            layoutName,
            view,
            front,
            lang,
            slug,
            writeMeta: {
              action: "BUILD_DYNAMIC_COLLECTION",
              type: templateName,
              source: normalizeLogPath(io.path.combine("collections", configKey)),
              lang,
              template: layoutName,
              items: dedupedItems.length,
              inputBytes: byteLength(contentHtml),
            },
          });
        }
      }
    }
  }

  /**
   * @param {string} html
   * @param {Placeholder[]} placeholders
   */
  injectMarkdownComponents(html, placeholders) {
    if (!html || !placeholders || !placeholders.length) {
      return html;
    }
    let output = html;
    for (let i = placeholders.length - 1; i >= 0; i -= 1) {
      const { token, marker, html: snippet } = placeholders[i];
      const safeSnippet = snippet ?? "";
      let nextOutput = output;

      if (token) {
        const pattern = new RegExp(
          `(?:<p>)?\\s*<!--${this.#_escapeRegExp(token)}-->\\s*(?:</p>)?`,
          "g",
        );
        const replaced = nextOutput.replace(pattern, safeSnippet);
        nextOutput = replaced;
      }

      if (nextOutput === output && marker) {
        nextOutput = nextOutput.split(marker).join(safeSnippet);
      }

      output = nextOutput;
    }
    return output;
  }

  /**
   * @param {string} markdown
   */
  parseMarkdown(markdown) {
    return /** @type {string} */ (marked.parse(markdown ?? ""));
  }

  setupMarkdown() {
    marked.setOptions(
      /** @type {any} */ ({ mangle: false, headerIds: false, gfm: true }),
    );
    if (this.#_config.markdown.highlight) {
      /**
       * @param {string} code
       * @param {string} lang
       * @returns {string}
       */
      function highlightCode(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : "plaintext";
        return hljs.highlight(code, { language }).value;
      }

      marked.use(
        markedHighlight({
          langPrefix: "hljs language-",
          highlight: highlightCode,
        }),
      );
    }

    marked.use({ renderer: this.#_markdownRenderer });
  }

  /**
   * @param {any} token
   * @returns {string}
   */
  #_renderMarkdownCode(token) {
    const isTokenObject = token && typeof token === "object";
    const languageSource =
      isTokenObject && typeof token.lang === "string" ? token.lang : "";
    const language =
      (languageSource || "").trim().split(/\\s+/)[0]?.toLowerCase() || "text";
    const langClass = language ? ` class="language-${language}"` : "";
    const value =
      isTokenObject && typeof token.text === "string"
        ? token.text
        : (token ?? "");
    const alreadyEscaped = Boolean(isTokenObject && token.escaped);
    const content = alreadyEscaped ? value : this.#_format.escape(value);
    return `<pre class="code-block" data-code-language="${language}"><code${langClass}>${content}</code></pre>`;
  }

  /** @param {string} [value] */
  #_escapeRegExp(value = "") {
    return value.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
  }
}

/** @param {Record<string, any> | { raw?: unknown } | null | undefined} front */
function normalizeFrontMatter(front) {
  if (!front || typeof front !== "object") {
    return {};
  }

  const raw =
    "raw" in front && front.raw && typeof front.raw === "object"
      ? front.raw
      : front;

  return typeof raw === "object" && raw !== null ? { ...raw } : {};
}

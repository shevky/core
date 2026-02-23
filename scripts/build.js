#!/usr/bin/env node

import crypto from "node:crypto";
import Mustache from "mustache";
import { minify as minifyHtml } from "html-minifier-terser";
import {
  io as _io,
  i18n as _i18n,
  config as _cfg,
  log as _log,
  format as _fmt,
  plugin as _plugin,
} from "@shevky/base";

import _prj from "../lib/project.js";
import _analytics from "./analytics.js";
import _social from "./social.js";

import { MetaEngine } from "../engines/metaEngine.js";
import { RenderEngine } from "../engines/renderEngine.js";

import { PluginRegistry } from "../registries/pluginRegistry.js";
import {
  TemplateRegistry,
  TYPE_COMPONENT,
  TYPE_LAYOUT,
  TYPE_PARTIAL,
  TYPE_TEMPLATE,
} from "../registries/templateRegistry.js";
import { ContentRegistry } from "../registries/contentRegistry.js";
import { PageRegistry } from "../registries/pageRegistry.js";

import { PluginEngine } from "../engines/pluginEngine.js";
import { MenuEngine } from "../engines/menuEngine.js";

/** @typedef {import("../lib/contentFile.js").ContentFile} ContentFile */
/** @typedef {import("../types/index.d.ts").FrontMatter} FrontMatter */
/** @typedef {import("../types/index.d.ts").CollectionEntry} CollectionEntry */
/** @typedef {import("../types/index.d.ts").CollectionsByLang} CollectionsByLang */
/** @typedef {import("../types/index.d.ts").FooterPolicy} FooterPolicy */

const SRC_DIR = _prj.srcDir;
const DIST_DIR = _prj.distDir;
const CONTENT_DIR = _prj.contentDir;
const LAYOUTS_DIR = _prj.layoutsDir;
const COMPONENTS_DIR = _prj.componentsDir;
const TEMPLATES_DIR = _prj.templatesDir;
const ASSETS_DIR = _prj.assetsDir;
const SITE_CONFIG_PATH = _prj.siteConfig;
const I18N_CONFIG_PATH = _prj.i18nConfig;
const FRAGMENTS_DIR = "fragments";

const pluginRegistry = new PluginRegistry();
const templateRegistry = new TemplateRegistry();
const pageRegistry = new PageRegistry();

const metaEngine = new MetaEngine();
const contentRegistry = new ContentRegistry(metaEngine);
const pluginEngine = new PluginEngine(
  pluginRegistry,
  contentRegistry,
  metaEngine,
);
const menuEngine = new MenuEngine(contentRegistry, metaEngine);
const renderEngine = new RenderEngine({
  templateRegistry,
  metaEngine,
  pageRegistry,
  config: _cfg,
  format: _fmt,
});

await _i18n.load(I18N_CONFIG_PATH);
await _cfg.load(SITE_CONFIG_PATH);

await templateRegistry.loadPartials(LAYOUTS_DIR);
await templateRegistry.loadComponents(COMPONENTS_DIR);
await templateRegistry.loadLayouts(LAYOUTS_DIR);
await templateRegistry.loadTemplates(TEMPLATES_DIR);

await pluginRegistry.load(_cfg.plugins);

const versionToken = crypto.randomBytes(6).toString("hex");
const DEFAULT_IMAGE = _cfg.seo.defaultImage;
/** @type {Record<string, string>} */
const FALLBACK_TAGLINES = { tr: "-", en: "-" };
/** @type {Record<string, any>} */
const COLLECTION_CONFIG = _cfg.content.collections;
const PAGE_BUFFER_LIMIT = resolvePageBufferLimit();

const GENERATED_PAGES = new Set();

/** @type {CollectionsByLang} */
let PAGES = {};
/** @type {Record<string, FooterPolicy[]>} */
let FOOTER_POLICIES = {};
/** @type {Record<string, Record<string, { id: string, lang: string, title: string, canonical: string }>>} */
let CONTENT_INDEX = {};
renderEngine.setupMarkdown();

/** @param {unknown} input */
function byteLength(input) {
  if (input === undefined || input === null) {
    return 0;
  }

  if (typeof input !== "string") {
    return Buffer.byteLength(String(input));
  }

  return Buffer.byteLength(input);
}

/** @param {number} bytes */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : 2;
  return `${value.toFixed(precision)}${units[unitIndex]}`;
}

/** @param {string | null | undefined} pathValue */
function normalizeLogPath(pathValue) {
  if (!pathValue) {
    return "";
  }

  const normalized = toPosixPath(pathValue);
  if (normalized.startsWith("./")) {
    return normalized.slice(2);
  }

  return normalized;
}

/** @param {FrontMatter | { raw?: unknown } | null | undefined} front */
function normalizeFrontMatter(front) {
  const frontRecord = _fmt.toRecord(front);
  const rawRecord = _fmt.pickFirstRecord(frontRecord?.raw, frontRecord);
  return rawRecord ? { ...rawRecord } : {};
}

async function ensureDist() {
  await _io.directory.remove(DIST_DIR);
  await _io.directory.create(DIST_DIR);
}

/** @param {string} html @param {string[]} locales */
function injectAlternateLocaleMeta(html, locales) {
  const cleanupPattern =
    /[^\S\r\n]*<meta property="og:locale:alternate" content=".*?" data-og-locale-alt\s*\/?>\s*/g;
  const indentMatch = html.match(
    /([^\S\r\n]*)<meta property="og:locale:alternate" content=".*?" data-og-locale-alt\s*\/?>/,
  );
  const indent = indentMatch?.[1] ?? "  ";
  let output = html.replace(cleanupPattern, "");

  if (!locales.length) {
    return output;
  }

  const tags = locales
    .map(
      (locale) =>
        `${indent}<meta property="og:locale:alternate" content="${locale}" data-og-locale-alt />`,
    )
    .join("\n");
  const anchorPattern =
    /(<meta property="og:locale" content=".*?" data-og-locale\s*\/?>)/;

  if (anchorPattern.test(output)) {
    return output.replace(anchorPattern, `$1\n${tags}`);
  }

  return `${tags}\n${output}`;
}

/** @param {string} lang */
function resolvePaginationSegment(lang) {
  /** @type {Record<string, string>} */
  const segmentConfig = _cfg?.content?.pagination?.segment ?? {};
  const langSegment = _fmt.text(segmentConfig[lang]);
  if (langSegment) {
    return langSegment;
  }

  const defaultSegment = _fmt.text(segmentConfig[_i18n.default]);
  if (defaultSegment) {
    return defaultSegment;
  }

  return "page";
}

/** @param {unknown} view */
function buildEasterEggPayload(view) {
  if (!_cfg.build.debug) {
    return "{}";
  }

  if (!view || typeof view !== "object") {
    return "{}";
  }

  try {
    return metaEngine.serializeForInlineScript(view);
  } catch {
    return "{}";
  }
}

/** @param {string} relativePath @param {string} html @param {{action?: string, source?: string, type?: string, lang?: string, template?: string, items?: number, page?: string | number, inputBytes?: number}} [meta] */
async function writeHtmlFile(relativePath, html, meta = {}) {
  const destPath = _io.path.combine(DIST_DIR, relativePath);
  await _io.directory.create(_io.path.name(destPath));
  const payload = typeof html === "string" ? html : String(html ?? "");
  await _io.file.write(destPath, payload);
  const outputBytes = byteLength(payload);

  _log.step(meta.action ?? "WRITE_HTML", {
    target: normalizeLogPath(destPath),
    source: normalizeLogPath(meta.source),
    type: meta.type ?? "html",
    lang: meta.lang,
    template: meta.template,
    items: meta.items,
    page: meta.page,
    input:
      typeof meta.inputBytes === "number"
        ? formatBytes(meta.inputBytes)
        : undefined,
    output: formatBytes(outputBytes),
  });
}

/** @param {{ force?: boolean }} [options] */
async function flushPages(options = {}) {
  const force = _fmt.boolean(options.force);
  if (pageRegistry.count === 0) {
    return;
  }

  if (!force && pageRegistry.count < PAGE_BUFFER_LIMIT) {
    return;
  }

  const pages = pageRegistry
    .list()
    .sort((a, b) => (a.outputPath || "").localeCompare(b.outputPath || ""));
  for (const page of pages) {
    if (!page.outputPath) {
      continue;
    }
    await writeHtmlFile(page.outputPath, page.html, page.writeMeta ?? {});
  }
  pageRegistry.clear();
}

/** @param {string} html @param {string} langKey */
function applyLanguageMetadata(html, langKey) {
  const config = _i18n.build[langKey];
  if (!config) {
    return html;
  }

  const altLocales = metaEngine.normalizeAlternateLocales(config.altLocale);

  let output = html
    .replace(/(<html\b[^>]*\slang=")(.*?)"/, `$1${config.langAttr}"`)
    .replace(
      /(<meta name="language" content=")(.*?)"/,
      `$1${config.metaLanguage}"`,
    )
    .replace(
      /(<link rel="canonical" href=")(.*?)" data-canonical/,
      `$1${config.canonical}" data-canonical`,
    )
    .replace(
      /(<meta property="og:url" content=")(.*?)" data-og-url/,
      `$1${config.canonical}" data-og-url`,
    )
    .replace(
      /(<meta name="twitter:url" content=")(.*?)" data-twitter-url/,
      `$1${config.canonical}" data-twitter-url`,
    )
    .replace(
      /(<meta property="og:locale" content=")(.*?)" data-og-locale/,
      `$1${config.ogLocale}" data-og-locale`,
    );

  output = injectAlternateLocaleMeta(output, altLocales);
  return output;
}

/** @param {string} key @param {string} lang */
function buildTagSlug(key, lang) {
  if (!key) {
    return null;
  }

  /** @type {any} */
  const tagsConfig = _cfg.content.collections.tags;
  const slugPattern =
    tagsConfig && typeof tagsConfig.slugPattern === "object"
      ? /** @type {Record<string, string>} */ (tagsConfig.slugPattern)
      : {};

  const langPattern =
    typeof slugPattern[lang] === "string" ? slugPattern[lang] : null;
  if (langPattern) {
    return langPattern.includes("{{key}}")
      ? langPattern.replace("{{key}}", key)
      : langPattern;
  }

  if (lang === "en") {
    return `tag/${key}`;
  }

  if (lang === "tr") {
    return `etiket/${key}`;
  }

  return key;
}

/** @param {string} key @param {string} lang */
function buildTagUrlFromKey(key, lang) {
  const slug = buildTagSlug(key, lang);
  if (!slug) {
    return null;
  }

  return metaEngine.buildContentUrl(null, lang, slug);
}

/** @param {string} label @param {string} lang */
function buildTagUrlFromLabel(label, lang) {
  const key = _fmt.slugify(label);
  if (!key) {
    return null;
  }

  return buildTagUrlFromKey(key, lang);
}

/** @param {string} lang */
function buildFooterTags(lang) {
  const langCollections = PAGES[lang] ?? {};
  const limit = _cfg.seo.footerTagCount;
  /** @type {Array<{ key: string, count: number, url: string }>} */
  const results = [];
  Object.keys(langCollections).forEach((key) => {
    const items = langCollections[key] ?? [];
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    const count = items.filter((entry) => entry.type === "tag").length;
    if (count === 0) {
      return;
    }

    const url = buildTagUrlFromKey(key, lang);
    if (!url) {
      return;
    }

    results.push({ key, count, url });
  });

  results.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return a.key.localeCompare(b.key, lang);
  });

  if (limit && Number.isFinite(limit) && limit > 0) {
    return results.slice(0, limit);
  }

  return results;
}

/** @param {string} lang */
function getFooterData(lang) {
  const policiesSource =
    FOOTER_POLICIES[lang] ?? FOOTER_POLICIES[_i18n.default] ?? [];
  const tagsSource = buildFooterTags(lang);
  const socialSource =
    /** @type {Array<{ key: string, url: string, icon?: string }>} */ (
      Array.isArray(_social.get()) ? _social.get() : []
    );
  const social = socialSource.filter(Boolean).map((item) => {
    let url = item.url;
    if (item.key === "rss") {
      url = lang === _i18n.default ? "/feed.xml" : `/${lang}/feed.xml`;
    }

    return {
      ...item,
      url,
      icon: item.icon,
      label: _i18n.t(lang, `footer.social.${item.key}`, item.key.toUpperCase()),
    };
  });

  const tags = tagsSource.map((tag) => ({
    ...tag,
    label: _i18n.t(lang, `footer.tags.${tag.key}`, tag.key),
  }));

  const policies = policiesSource.map((policy) => ({
    ...policy,
    label: _i18n.t(
      lang,
      `footer.policies.${policy.key}`,
      policy.label ?? policy.key,
    ),
  }));

  const tagline = _i18n.t(
    lang,
    "footer.tagline",
    FALLBACK_TAGLINES[lang] ??
      FALLBACK_TAGLINES[_i18n.default] ??
      FALLBACK_TAGLINES.en,
  );

  return {
    tags,
    policies,
    social,
    tagline,
  };
}

/**
 * @param {string} templateName
 * @param {string} contentHtml
 * @param {FrontMatter} front
 * @param {string} lang
 * @param {Record<string, any>} dictionary
 * @param {any} [listingOverride]
 */
async function renderContentTemplate(
  templateName,
  contentHtml,
  front,
  lang,
  dictionary,
  listingOverride,
) {
  const template = templateRegistry.getTemplate(TYPE_TEMPLATE, templateName);
  const {
    normalizedFront,
    listing,
    collectionFlags,
    site,
    languageFlags,
    resolvedDictionary,
  } = buildContentRenderContext(front, lang, dictionary, listingOverride);

  return Mustache.render(
    template.content,
    {
      content: { html: decorateHtml(contentHtml, templateName) },
      front: normalizedFront,
      lang,
      listing,
      site,
      locale: languageFlags.locale,
      isEnglish: languageFlags.isEnglish,
      isTurkish: languageFlags.isTurkish,
      i18n: resolvedDictionary,
      ...collectionFlags,
    },
    {
      ...templateRegistry.getFiles(TYPE_PARTIAL),
      ...templateRegistry.getFiles(TYPE_COMPONENT),
    },
  );
}

/**
 * @param {string} contentHtml
 * @param {FrontMatter} front
 * @param {string} lang
 * @param {Record<string, any>} dictionary
 * @param {string} [templateName]
 * @param {any} [listingOverride]
 */
async function renderFragmentTemplate(
  contentHtml,
  front,
  lang,
  dictionary,
  templateName,
  listingOverride,
) {
  const resolvedTemplateName = _fmt.text(templateName);
  const template = resolvedTemplateName
    ? templateRegistry.getTemplate(TYPE_TEMPLATE, resolvedTemplateName)
    : null;
  if (resolvedTemplateName && !template) {
    _log.warn(`[build] Fragment template not found: ${resolvedTemplateName}`);
  }
  const {
    normalizedFront,
    listing,
    collectionFlags,
    site,
    languageFlags,
    resolvedDictionary,
  } = buildContentRenderContext(front, lang, dictionary, listingOverride);
  const decorated = decorateHtml(contentHtml, resolvedTemplateName);
  const templateContent = template?.content ?? "{{{content.html}}}";

  return Mustache.render(
    templateContent,
    {
      content: { html: decorated },
      contentHtml: decorated,
      contentObject: { html: decorated },
      front: normalizedFront,
      lang,
      listing,
      site,
      locale: languageFlags.locale,
      isEnglish: languageFlags.isEnglish,
      isTurkish: languageFlags.isTurkish,
      i18n: resolvedDictionary,
      ...collectionFlags,
    },
    {
      ...templateRegistry.getFiles(TYPE_PARTIAL),
      ...templateRegistry.getFiles(TYPE_COMPONENT),
    },
  );
}

/**
 * @param {FrontMatter} front
 * @param {string} lang
 * @param {Record<string, any>} dictionary
 * @param {any} [listingOverride]
 */
function buildContentRenderContext(front, lang, dictionary, listingOverride) {
  const baseFront = normalizeFrontMatter(front);
  /** @type {string[]} */
  const normalizedTags = Array.isArray(front.tags)
    ? front.tags.filter((/** @type {string} */ tag) => _fmt.hasText(tag))
    : [];
  const tagLinks = normalizedTags
    .map((/** @type {string} */ tag) => {
      const url = buildTagUrlFromLabel(tag, lang);
      return url ? { label: tag, url } : null;
    })
    .filter(Boolean);
  const categoryLabel = _fmt.text(front.category);
  const categorySlug = categoryLabel ? _fmt.slugify(categoryLabel) : "";
  const categoryUrl = categorySlug
    ? metaEngine.buildContentUrl(null, lang, categorySlug)
    : null;
  const resolvedDictionary = dictionary ?? _i18n.get(lang);
  const normalizedFront = /** @type {FrontMatter} */ ({
    ...baseFront,
    tags: normalizedTags,
    tagLinks,
    hasTags: normalizedTags.length > 0,
    categoryUrl,
    categoryLabel,
    dateDisplay: _fmt.date(front.date, lang),
    updatedDisplay: _fmt.date(front.updated, lang),
    cover: front.cover ?? DEFAULT_IMAGE,
    coverAlt: front.coverAlt ?? "",
    lang,
  });
  if (front?.collectionType) {
    normalizedFront.collectionType = normalizeCollectionTypeValue(
      front.collectionType,
    );
  }
  normalizedFront.seriesListing = buildSeriesListing(normalizedFront, lang);
  const listing =
    listingOverride ?? buildCollectionListing(normalizedFront, lang);
  const collectionFlags = buildCollectionTypeFlags(
    listing?.type ?? resolveCollectionType(normalizedFront, listing?.items),
  );
  const site = metaEngine.buildSiteData(lang);
  const languageFlags = _i18n.flags(lang);

  return {
    normalizedFront,
    listing,
    collectionFlags,
    site,
    languageFlags,
    resolvedDictionary,
  };
}

/**
 * @param {FrontMatter} frontMatter
 * @param {string} lang
 * @param {Record<string, any>} dictionary
 */
/**
 * @param {{ layoutName: string, view: Record<string, any>, front: FrontMatter, lang: string, slug: string, writeMeta?: { action?: string, source?: string, type?: string, lang?: string, template?: string, items?: number, page?: string | number, inputBytes?: number } }} input
 */
async function renderPage({ layoutName, view, front, lang, slug, writeMeta }) {
  const rendered = renderEngine.renderLayout(layoutName, view);
  const finalHtml = await renderEngine.transformHtml(rendered, {
    versionToken,
    minifyHtml,
  });
  const relativePath = buildOutputPath(front, lang, slug);
  const templateName = _fmt.text(front?.template);
  const pageType = _fmt.text(writeMeta?.type) || templateName;
  const collectionType = normalizeCollectionTypeValue(front?.collectionType);
  const slimFront = collectionType
    ? /** @type {FrontMatter} */ ({ collectionType })
    : /** @type {FrontMatter} */ ({});
  const page = renderEngine.createPage({
    kind: "page",
    type: pageType,
    lang,
    slug,
    canonical: metaEngine.buildContentUrl(front?.canonical, lang, slug),
    layout: layoutName,
    template: templateName,
    front: slimFront,
    html: finalHtml,
    sourcePath: _fmt.text(writeMeta?.source),
    outputPath: relativePath,
    writeMeta,
  });
  GENERATED_PAGES.add(toPosixPath(relativePath));
  registerLegacyPaths(lang, slug);
  await flushPages();
  return page;
}

/** @param {string} html @param {string} templateName */
function decorateHtml(html, templateName) {
  return html;
}

/** @param {FrontMatter} front @param {string} lang @param {string} slug */
function buildOutputPath(front, lang, slug) {
  const canonicalRelative = metaEngine.canonicalToRelativePath(front.canonical);
  if (canonicalRelative) {
    return _io.path.combine(canonicalRelative, "index.html");
  }
  const cleaned = (slug ?? "").replace(/^\/+/, "");
  /** @type {string[]} */
  const segments = [];
  if (lang && lang !== _i18n.default) {
    segments.push(lang);
  }
  if (cleaned) {
    segments.push(cleaned);
  }
  return _io.path.combine(...segments.filter(Boolean), "index.html");
}

/** @param {unknown} value */
function resolveFragmentId(value) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/[\\/]/g, "-");
}

/** @param {string} value */
function toPosixPath(value) {
  return value.split(_io.path.separator).join("/");
}

/** @param {FrontMatter | { header?: FrontMatter } | null | undefined} input */
function resolveFrontMatterInput(input) {
  const inputRecord = _fmt.toRecord(input);
  const resolved = _fmt.pickFirstRecord(
    inputRecord?.raw,
    inputRecord?.header,
    inputRecord,
  );
  return /** @type {FrontMatter} */ (resolved ?? {});
}

/** @param {unknown} value */
function normalizeSchemaTypeValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

/**
 * @param {Record<string, any> | null | undefined} front
 * @param {Record<string, any> | null | undefined} [derived]
 */
function resolveSchemaTypeForGeneration(front, derived) {
  const frontSchemaType = normalizeSchemaTypeValue(front?.schemaType);
  if (_plugin.isSchemaType(frontSchemaType)) {
    return frontSchemaType;
  }

  const derivedSchemaType = normalizeSchemaTypeValue(derived?.schemaType);
  if (_plugin.isSchemaType(derivedSchemaType)) {
    return derivedSchemaType;
  }

  const collectionType = normalizeCollectionTypeValue(
    front?.collectionType ?? derived?.collectionType,
  );
  if (collectionType) {
    return "collection";
  }

  return "page";
}

/**
 * @param {Record<string, any> | null | undefined} front
 * @param {Record<string, any> | null | undefined} [derived]
 */
function injectSchemaTypeForGeneration(front, derived) {
  if (!front || typeof front !== "object") {
    return;
  }

  const resolvedType = resolveSchemaTypeForGeneration(front, derived);
  const currentFrontType = normalizeSchemaTypeValue(front.schemaType);

  if (!_plugin.isSchemaType(currentFrontType)) {
    try {
      front.schemaType = resolvedType;
    } catch {
      // Ignore read-only objects.
    }
  }

  if (derived && typeof derived === "object") {
    const currentDerivedType = normalizeSchemaTypeValue(derived.schemaType);
    if (!_plugin.isSchemaType(currentDerivedType)) {
      try {
        derived.schemaType = resolvedType;
      } catch {
        // Ignore read-only objects.
      }
    }
  }
}

/** @param {FrontMatter} front @param {string} lang @param {string} slug */
function buildMinimalPageMeta(front, lang, slug) {
  const canonical = metaEngine.resolveUrl(
    _fmt.text(front?.canonical) || metaEngine.buildContentUrl(null, lang, slug),
  );
  const alternates = metaEngine.buildAlternateUrlMap(front, lang, canonical);
  const alternateLinks = metaEngine.buildAlternateLinkList(alternates);

  return {
    title: _fmt.text(front?.metaTitle) || _fmt.text(front?.title),
    description: _fmt.text(front?.description),
    robots: _fmt.text(front?.robots) || "index,follow",
    canonical,
    alternates,
    alternateLinks,
    og: _fmt.toRecord(front?.og, {}),
    twitter: _fmt.toRecord(front?.twitter, {}),
    structuredData: front?.structuredData ?? "",
  };
}

/** @param {FrontMatter | { header?: FrontMatter } | null | undefined} input @param {string} lang @param {string} slug @param {Record<string, any> | null | undefined} [derived] */
async function buildPageMetaWithPlugins(input, lang, slug, derived) {
  const front = resolveFrontMatterInput(input);
  const derivedFront =
    derived && typeof derived === "object"
      ? /** @type {Record<string, any>} */ (derived)
      : front;
  injectSchemaTypeForGeneration(front, derivedFront);
  let pluginPageMeta = null;

  pluginEngine.setRuntimeContext({
    frontMatter: front,
    derivedFrontMatter: derivedFront,
    lang,
    slug,
    setPageMeta: (/** @type {Record<string, any>} */ meta) => {
      pluginPageMeta = meta;
    },
  });

  try {
    await pluginEngine.execute(_plugin.hooks.PAGE_META);
  } finally {
    pluginEngine.clearRuntimeContext();
  }

  if (
    pluginPageMeta &&
    typeof pluginPageMeta === "object" &&
    !Array.isArray(pluginPageMeta)
  ) {
    return /** @type {Record<string, any>} */ (pluginPageMeta);
  }

  const existingPageMeta = _fmt.toRecord(front?.pageMeta);
  if (existingPageMeta) {
    return existingPageMeta;
  }

  _log.debug(
    `[build] Missing page meta from '${_plugin.hooks.PAGE_META}' hook for lang='${lang}' slug='${slug}'. Using front matter as page meta.`,
  );

  return buildMinimalPageMeta(front, lang, slug);
}

/** @param {FrontMatter} front @param {string} lang */
function buildCollectionListing(front, lang) {
  const normalizedLang = lang ?? _i18n.default;
  const langCollections = PAGES[normalizedLang] ?? {};
  const key = resolveListingKey(front);
  const sourceItems =
    key && Array.isArray(langCollections[key]) ? langCollections[key] : [];
  const items = dedupeCollectionItems(sourceItems);
  const collectionType = resolveCollectionType(front, items);
  const typeFlags = buildCollectionTypeFlags(collectionType);
  return {
    key,
    lang: normalizedLang,
    items,
    hasItems: items.length > 0,
    emptyMessage: resolveListingEmpty(front, normalizedLang),
    heading: resolveListingHeading(front),
    type: collectionType,
    ...typeFlags,
  };
}

/** @param {FrontMatter} front @param {string} lang */
function buildSeriesListing(front, lang) {
  /** @type {string[]} */
  const relatedSource = Array.isArray(front?.related) ? front.related : [];
  const seriesName = _fmt.text(front?.seriesTitle) || _fmt.text(front?.series);
  const currentId = _fmt.text(front?.id);
  /** @type {Array<{ id: string, label: string, url: string, hasUrl?: boolean, isCurrent: boolean, isPlaceholder: boolean }>} */
  const items = [];

  relatedSource.forEach((/** @type {string} */ entry) => {
    const value = _fmt.text(entry);
    if (!value) {
      items.push({
        id: "",
        label: "...",
        url: "",
        isCurrent: false,
        isPlaceholder: true,
      });
      return;
    }

    const isCurrent = value === currentId;
    const summaryLookup = CONTENT_INDEX[value];
    const summaryLang = lang || front?.lang;
    let summary = null;
    if (summaryLookup) {
      const summaryFallback =
        /** @type {{ title?: string, canonical?: string }} */ (
          Object.values(summaryLookup)[0]
        );
      summary =
        summaryLookup[summaryLang] ??
        summaryLookup[front?.lang] ??
        summaryFallback;
    }
    const label =
      summary?.title ?? (isCurrent ? (front?.title ?? value) : value);
    const url = summary?.canonical ?? "";

    const hasUrl = typeof url === "string" && url.length > 0;
    items.push({
      id: value,
      label,
      url,
      hasUrl,
      isCurrent,
      isPlaceholder: false,
    });
  });

  return {
    label: seriesName,
    hasLabel: Boolean(seriesName),
    hasItems: items.length > 0,
    items,
  };
}

/** @param {unknown} value */
function normalizeCollectionTypeValue(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

/** @param {FrontMatter} front @param {CollectionEntry[] | undefined} items @param {string} [fallback] */
function resolveCollectionType(front, items, fallback) {
  const explicitCandidate =
    normalizeCollectionTypeValue(front?.collectionType) ||
    normalizeCollectionTypeValue(front?.listType) ||
    normalizeCollectionTypeValue(front?.type);
  if (explicitCandidate) {
    return explicitCandidate;
  }

  if (Array.isArray(items)) {
    const entryWithType = items.find((entry) => _fmt.hasText(entry?.type));
    const entryType = _fmt.text(entryWithType?.type);
    if (entryType) {
      return entryType.toLowerCase();
    }
  }

  const normalizedFallback = _fmt.text(fallback);
  if (normalizedFallback) {
    return normalizedFallback.toLowerCase();
  }

  return "";
}

/** @param {string} type */
function buildCollectionTypeFlags(type) {
  const normalized = normalizeCollectionTypeValue(type);
  return {
    collectionType: normalized,
    isTag: normalized === "tag",
    isCategory: normalized === "category",
    isAuthor: normalized === "author",
    isSeries: normalized === "series",
    isHome: normalized === "home",
  };
}

/** @param {FrontMatter} front */
function resolveListingKey(front) {
  if (!front) return "";
  const candidates = [
    typeof front.listKey === "string" ? front.listKey : null,
    typeof front.slug === "string" ? front.slug : null,
    typeof front.category === "string" ? front.category : null,
    typeof front.id === "string" ? front.id : null,
  ];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const normalized = _fmt.slugify(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

/** @param {FrontMatter} front @param {string} lang */
function resolveListingEmpty(front, lang) {
  if (!front) return "";
  const { listingEmpty } = front;
  const direct = _fmt.text(listingEmpty);
  if (direct) {
    return direct;
  }
  if (listingEmpty && typeof listingEmpty === "object") {
    const listingEmptyMap = /** @type {Record<string, string>} */ (
      listingEmpty
    );
    const localized = listingEmptyMap[lang];
    const localizedValue = _fmt.text(localized);
    if (localizedValue) {
      return localizedValue;
    }
    const fallback = listingEmptyMap[_i18n.default];
    const fallbackValue = _fmt.text(fallback);
    if (fallbackValue) {
      return fallbackValue;
    }
  }
  return "";
}

/** @param {FrontMatter} front */
function resolveListingHeading(front) {
  if (!front) return "";
  return _fmt.text(front.listHeading) || _fmt.text(front.title);
}

function resolvePageBufferLimit() {
  const envValue = Number.parseInt(
    process.env.SHEVKY_PAGE_BUFFER_LIMIT ?? "",
    10,
  );

  if (Number.isFinite(envValue) && envValue > 0) {
    return envValue;
  }

  const configValue = Number.parseInt(
    String(_cfg?.build?.pageBufferLimit ?? ""),
    10,
  );

  if (Number.isFinite(configValue) && configValue > 0) {
    return configValue;
  }

  return 20;
}

/** @param {unknown} value */
function resolveAliasOutputPath(value) {
  const raw = _fmt.text(value);
  if (!raw) {
    return null;
  }

  const relative = metaEngine.canonicalToRelativePath(raw);
  if (relative) {
    const lastSegment = relative.split("/").pop()?.trim() ?? "";
    if (lastSegment.includes(".")) {
      return relative;
    }
    return _io.path.combine(relative, "index.html");
  }

  const normalizedRaw = raw.trim();
  if (
    normalizedRaw === "/" ||
    normalizedRaw === "~/" ||
    /^https?:\/\/[^/]+\/?$/i.test(normalizedRaw)
  ) {
    return "index.html";
  }

  return null;
}

async function applyOutputAliases() {
  const aliases = Array.isArray(_cfg?.build?.outputAliases)
    ? _cfg.build.outputAliases
    : [];

  for (const entry of aliases) {
    const alias = _fmt.toRecord(entry);
    if (!alias) {
      continue;
    }

    const sourceRelative = resolveAliasOutputPath(alias.from);
    const targetRelative = resolveAliasOutputPath(alias.to);
    if (!sourceRelative || !targetRelative || sourceRelative === targetRelative) {
      continue;
    }

    const sourcePath = _io.path.combine(DIST_DIR, sourceRelative);
    if (!(await _io.file.exists(sourcePath))) {
      _log.warn(
        `[build] Output alias source not found: ${normalizeLogPath(sourcePath)}`,
      );
      continue;
    }

    const targetPath = _io.path.combine(DIST_DIR, targetRelative);
    await _io.directory.create(_io.path.name(targetPath));
    await _io.file.copy(sourcePath, targetPath);
    GENERATED_PAGES.add(toPosixPath(targetRelative));

    _log.step("COPY_ALIAS", {
      source: normalizeLogPath(sourcePath),
      target: normalizeLogPath(targetPath),
      type: "alias",
    });
  }
}

async function buildContentPages() {
  if (contentRegistry.count === 0) {
    return;
  }

  const contentFiles = /** @type {ContentFile[]} */ (
    /** @type {unknown} */ (contentRegistry.files)
  );
  for (const file of contentFiles) {
    _log.step("PROCESS_CONTENT", {
      file: normalizeLogPath(file.sourcePath),
      lang: file.lang,
      template: file.template,
      size: formatBytes(byteLength(file.content)),
    });

    const dictionary = _i18n.get(file.lang);
    const componentContext = renderEngine.buildContentComponentContext(
      file.header,
      file.lang,
      dictionary,
      { i18n: _i18n, pages: PAGES },
    );
    const { markdown: markdownSource, placeholders } =
      renderEngine.renderMarkdownComponents(file.content, componentContext);
    if (placeholders.length > 0) {
      _log.step("COMPONENT_SLOTS", {
        file: normalizeLogPath(file.sourcePath),
        count: placeholders.length,
      });
    }

    const markdownHtml = renderEngine.parseMarkdown(markdownSource ?? "");
    const hydratedHtml = renderEngine.injectMarkdownComponents(
      markdownHtml ?? "",
      placeholders,
    );
    const rawFront = normalizeFrontMatter(file.header);
    const shouldBuildFragment = _fmt.boolean(rawFront.fragment);
    const fragmentTemplateName =
      _fmt.text(rawFront.fragmentTemplate) || file.template;

    if (file.template === "collection" || file.template === "home") {
      await renderEngine.buildPaginatedCollectionPages({
        frontMatter: file.header,
        lang: file.lang,
        baseSlug: file.slug,
        layoutName: file.layout,
        templateName: file.template,
        contentHtml: hydratedHtml,
        dictionary,
        sourcePath: file.sourcePath,
        pages: PAGES,
        renderContentTemplate,
        buildViewPayload: (input) =>
          renderEngine.buildViewPayload(input, {
            pages: PAGES,
            i18n: _i18n,
            metaEngine,
            menuEngine,
            getFooterData,
            analyticsSnippets: _analytics.snippets,
            buildEasterEggPayload,
          }),
        renderPage,
        metaEngine: {
          buildPageMeta: async (frontForPage, pageLang, pageSlug) =>
            buildPageMetaWithPlugins(
              frontForPage,
              pageLang,
              pageSlug,
              frontForPage,
            ),
        },
        menuEngine,
        resolveListingKey,
        resolveListingEmpty,
        resolveCollectionType,
        buildCollectionTypeFlags,
        resolvePaginationSegment,
        dedupeCollectionItems,
        byteLength,
      });

      continue;
    }

    const contentHtml = await renderContentTemplate(
      file.template,
      hydratedHtml,
      file.header,
      file.lang,
      dictionary,
    );
    const pageMeta = await buildPageMetaWithPlugins(
      file.header,
      file.lang,
      file.slug,
      file,
    );
    const activeMenuKey = menuEngine.resolveActiveMenuKey(file.header);
    const view = renderEngine.buildViewPayload(
      {
        lang: file.lang,
        activeMenuKey,
        pageMeta,
        content: contentHtml,
        dictionary,
      },
      {
        pages: PAGES,
        i18n: _i18n,
        metaEngine,
        menuEngine,
        getFooterData,
        analyticsSnippets: _analytics.snippets,
        buildEasterEggPayload,
      },
    );

    await renderPage({
      layoutName: file.layout,
      view,
      front: file.header,
      lang: file.lang,
      slug: file.slug,
      writeMeta: {
        action: "BUILD_PAGE",
        type: file.template,
        source: file.sourcePath,
        lang: file.lang,
        template: file.layout,
        inputBytes: byteLength(file.content),
      },
    });

    if (shouldBuildFragment) {
      const fragmentId = resolveFragmentId(rawFront.id ?? file.id);
      if (!fragmentId) {
        _log.warn(
          `[build] Fragment skipped for ${normalizeLogPath(file.sourcePath)} (missing id).`,
        );
      } else {
        const fragmentHtml = await renderFragmentTemplate(
          hydratedHtml,
          file.header,
          file.lang,
          dictionary,
          fragmentTemplateName,
        );
        const transformedFragment = await renderEngine.transformHtml(
          fragmentHtml,
          {
            versionToken,
            minifyHtml,
          },
        );
        const fragmentLang = _fmt.text(file.lang) || _i18n.default;
        const fragmentPath = _io.path.combine(
          FRAGMENTS_DIR,
          fragmentLang,
          `frag_${fragmentId}.html`,
        );
        GENERATED_PAGES.add(toPosixPath(fragmentPath));
        await writeHtmlFile(fragmentPath, transformedFragment, {
          action: "BUILD_FRAGMENT",
          type: "fragment",
          source: file.sourcePath,
          lang: file.lang,
          template: fragmentTemplateName,
          inputBytes: byteLength(file.content),
        });
      }
    }
  }

  await renderEngine.buildDynamicCollectionPages({
    collectionsConfig: COLLECTION_CONFIG,
    pages: PAGES,
    i18n: _i18n,
    renderContentTemplate,
    buildViewPayload: (input) =>
      renderEngine.buildViewPayload(input, {
        pages: PAGES,
        i18n: _i18n,
        metaEngine,
        menuEngine,
        getFooterData,
        analyticsSnippets: _analytics.snippets,
        buildEasterEggPayload,
      }),
    renderPage,
    metaEngine: {
      buildPageMeta: async (frontForPage, pageLang, pageSlug) =>
        buildPageMetaWithPlugins(
          frontForPage,
          pageLang,
          pageSlug,
          frontForPage,
        ),
    },
    menuEngine,
    resolveCollectionType,
    normalizeCollectionTypeValue,
    resolveCollectionDisplayKey,
    dedupeCollectionItems,
    normalizeLogPath,
    io: _io,
    byteLength,
  });
}

/** @param {string} configKey @param {string} defaultKey @param {CollectionEntry[]} items */
function resolveCollectionDisplayKey(configKey, defaultKey, items) {
  if (configKey === "series" && Array.isArray(items)) {
    const entryWithTitle = items.find(
      (entry) => entry && _fmt.hasText(entry.seriesTitle),
    );
    const seriesTitle = _fmt.text(entryWithTitle?.seriesTitle);
    if (seriesTitle) {
      return seriesTitle;
    }
  }
  return defaultKey;
}

/** @param {CollectionEntry[]} items */
function dedupeCollectionItems(items) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const seen = new Map();
  /** @type {CollectionEntry[]} */
  const order = [];
  items.forEach((item) => {
    const id = item?.id;
    if (!id) {
      order.push(item);
      return;
    }
    const existingIndex = seen.get(id);
    const hasSeriesTitle = Boolean(item?.seriesTitle);
    if (existingIndex == null) {
      seen.set(id, order.length);
      order.push(item);
      return;
    }
    const existing = order[existingIndex];
    const existingHasSeries = Boolean(existing?.seriesTitle);
    if (hasSeriesTitle && !existingHasSeries) {
      order[existingIndex] = item;
    }
  });
  return order;
}

/** @param {string} lang @param {string} slug */
function registerLegacyPaths(lang, slug) {
  const cleaned = (slug ?? "").replace(/^\/+/, "");
  if (!cleaned) return;
  const legacyFile = cleaned.endsWith(".html") ? cleaned : `${cleaned}.html`;
  GENERATED_PAGES.add(toPosixPath(legacyFile));
  if (lang && lang !== _i18n.default) {
    GENERATED_PAGES.add(toPosixPath(_io.path.combine(lang, legacyFile)));
  }
}

/** @param {string} currentDir @param {string} relative */
async function copyHtmlRecursive(currentDir = SRC_DIR, relative = "") {
  if (!(await _io.directory.exists(currentDir))) {
    return;
  }

  const entries = await _io.directory.read(currentDir);
  for (const entry of entries) {
    const fullPath = _io.path.combine(currentDir, entry);
    const relPath = relative ? _io.path.combine(relative, entry) : entry;
    const normalizedRelPath = toPosixPath(relPath);

    if (
      normalizedRelPath === "content" ||
      normalizedRelPath.startsWith("content/")
    ) {
      continue;
    }

    if (!entry.endsWith(".html")) {
      continue;
    }

    if (GENERATED_PAGES.has(toPosixPath(relPath))) {
      continue;
    }

    const raw = await _io.file.read(fullPath);
    const transformed = await renderEngine.transformHtml(raw, {
      versionToken,
      minifyHtml,
    });
    if (relPath === "index.html") {
      _i18n.supported.forEach(async (langCode) => {
        const localized = applyLanguageMetadata(transformed, langCode);
        /** @type {string[]} */
        const segments = [];

        if (langCode !== _i18n.default) {
          segments.push(langCode);
        }

        segments.push("index.html");
        await writeHtmlFile(_io.path.combine(...segments), localized, {
          action: "COPY_HTML",
          type: "static",
          source: fullPath,
          lang: langCode,
          inputBytes: byteLength(transformed),
        });
      });

      continue;
    }

    await writeHtmlFile(relPath, transformed, {
      action: "COPY_HTML",
      type: "static",
      source: fullPath,
      lang: _i18n.default,
      inputBytes: byteLength(transformed),
    });
  }
}

/** @param {string} currentDir */
async function copyContentStaticRecursive(currentDir = CONTENT_DIR) {
  if (!(await _io.directory.exists(currentDir))) {
    return;
  }

  const contentRootDirectories = resolveContentRootDirectories();
  const entries = await _io.directory.read(currentDir);
  for (const entry of entries) {
    const fullPath = _io.path.combine(currentDir, entry);
    const relPath = entry;
    const normalizedRelPath = toPosixPath(relPath);
    const isXml = entry.endsWith(".xml");

    if (
      contentRootDirectories.some(
        (directory) =>
          normalizedRelPath === directory ||
          normalizedRelPath.startsWith(`${directory}/`),
      )
    ) {
      continue;
    }

    if (!(entry.endsWith(".html") || entry.endsWith(".xml"))) {
      continue;
    }

    if (GENERATED_PAGES.has(toPosixPath(relPath))) {
      continue;
    }

    const raw = await _io.file.read(fullPath);
    const transformed = isXml
      ? raw
      : await renderEngine.transformHtml(raw, {
          versionToken,
          minifyHtml,
        });

    await writeHtmlFile(relPath, transformed, {
      action: "COPY_HTML",
      type: isXml ? "content-xml" : "content-static",
      source: fullPath,
      lang: _i18n.default,
      inputBytes: byteLength(transformed),
    });
  }
}

function resolveContentRootDirectories() {
  const configured = Array.isArray(_cfg?.build?.contentRootDirectories)
    ? _cfg.build.contentRootDirectories
    : [".well-known"];

  return [...new Set(configured.map((entry) => _fmt.text(entry)).filter(Boolean))];
}

async function copyContentRootDirectories() {
  const directories = resolveContentRootDirectories();
  for (const directory of directories) {
    const sourceDir = _io.path.combine(CONTENT_DIR, directory);
    if (!(await _io.directory.exists(sourceDir))) {
      continue;
    }

    const targetDir = _io.path.combine(DIST_DIR, directory);
    await _io.directory.copy(sourceDir, targetDir);

    _log.step("COPY_DIR", {
      source: normalizeLogPath(sourceDir),
      target: normalizeLogPath(targetDir),
      type: "content-root-directory",
    });
  }
}

async function copyStaticAssets() {
  if (!(await _io.directory.exists(ASSETS_DIR))) {
    return;
  }

  const targetDir = _io.path.combine(DIST_DIR, "assets");
  await _io.directory.copy(ASSETS_DIR, targetDir);
  _log.debug("Assets have been copied.");
}

async function main() {
  // <--- dist:clean
  await ensureDist();
  await pluginEngine.execute(_plugin.hooks.DIST_CLEAN);
  // dist:clean --->

  // <--- assets:copy
  await copyStaticAssets();
  await pluginEngine.execute(_plugin.hooks.ASSETS_COPY);
  // assets:copy --->

  // <--- content:load
  await contentRegistry.load(CONTENT_DIR);
  await pluginEngine.execute(_plugin.hooks.CONTENT_LOAD);
  // content:load --->

  await menuEngine.build();
  PAGES = contentRegistry.buildCategoryTagCollections();
  FOOTER_POLICIES = contentRegistry.buildFooterPolicies();
  CONTENT_INDEX = contentRegistry.buildContentIndex();
  await pluginEngine.execute(_plugin.hooks.CONTENT_READY);

  await buildContentPages();
  await copyHtmlRecursive();
  await copyContentStaticRecursive();
  await copyContentRootDirectories();
  await flushPages({ force: true });
  await applyOutputAliases();
}

const API = {
  execute: main,
};

export default API;

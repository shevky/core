import { i18n as _i18n, config as _cfg, format as _fmt } from "@shevky/base";

import _analytics from "../scripts/analytics.js";

/**
 * @typedef {Record<string, any>} FrontMatter
 */

/**
 * @typedef {{ base: Record<string, string>, default?: string, [key: string]: string | Record<string, string> | undefined }} AlternateUrlMap
 */

/** @type {Record<string, string>} */
const FALLBACK_ROLES = { tr: "-", en: "-" };
/** @type {Record<string, string>} */
const FALLBACK_QUOTES = { tr: "-", en: "-" };
/** @type {Record<string, string>} */
const FALLBACK_TITLES = { tr: "-", en: "-" };
/** @type {Record<string, string>} */
const FALLBACK_DESCRIPTIONS = { tr: "-", en: "-" };
const FALLBACK_OWNER = "-";
/** @type {Record<string, string>} */
const FALLBACK_TAGLINES = { tr: "-", en: "-" };

class MetaEngine {
  /** @param {unknown} value */
  serializeForInlineScript(value) {
    return JSON.stringify(value ?? {})
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  }

  /** @param {unknown} value */
  _toLocaleArray(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      return value.split(",").map((item) => item.trim());
    }

    return [];
  }

  /** @param {unknown} value @param {string[] | unknown} [fallback] */
  normalizeAlternateLocales(value, fallback = []) {
    const primary = this._toLocaleArray(value);
    const fallbackList = this._toLocaleArray(fallback);
    const source = primary.length ? primary : fallbackList;
    const seen = new Set();

    return source
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => {
        if (!item || seen.has(item)) {
          return false;
        }

        seen.add(item);
        return true;
      });
  }

  /** @param {string} input */
  ensureDirectoryTrailingSlash(input) {
    if (typeof input !== "string") {
      return input;
    }

    return _fmt.ensureDirectoryTrailingSlash(input);
  }

  /** @param {string} value */
  resolveUrl(value) {
    return _fmt.resolveUrl(value, _cfg.identity.url);
  }

  /** @param {string} lang */
  resolveLanguageHomePath(lang) {
    if (typeof _i18n.homePath === "function") {
      const resolved = _i18n.homePath(lang);
      if (resolved && typeof resolved === "string") {
        return resolved;
      }
    }

    if (!lang || lang === _i18n.default) {
      return "/";
    }

    return `/${lang}/`.replace(/\/+/g, "/");
  }

  /** @param {string} lang */
  buildSiteData(lang) {
    const fallbackOwner = FALLBACK_OWNER;
    const author = _cfg.identity.author;
    const owner = _i18n.t(lang, "site.owner", fallbackOwner);
    const title = _i18n.t(
      lang,
      "site.title",
      FALLBACK_TITLES[lang] ?? FALLBACK_TITLES[_i18n.default] ?? fallbackOwner,
    );

    const description = _i18n.t(
      lang,
      "site.description",
      FALLBACK_DESCRIPTIONS[lang] ?? FALLBACK_DESCRIPTIONS[_i18n.default] ?? "",
    );

    const role = _i18n.t(
      lang,
      "site.role",
      FALLBACK_ROLES[lang] ??
        FALLBACK_ROLES[_i18n.default] ??
        FALLBACK_ROLES.en,
    );

    const quote = _i18n.t(
      lang,
      "site.quote",
      FALLBACK_QUOTES[lang] ??
        FALLBACK_QUOTES[_i18n.default] ??
        FALLBACK_QUOTES.en,
    );

    return {
      title,
      description,
      author,
      owner,
      role,
      quote,
      home: this.resolveLanguageHomePath(lang),
      url: _cfg.identity.url,
      currentLanguage: lang,
      currentCulture: _i18n.culture(lang),
      currentCanonical: (() => {
        const langConfig = _i18n.build?.[lang];
        if (langConfig?.canonical) {
          return langConfig.canonical;
        }
        const fallbackPath = lang === _i18n.default ? "/" : `/${lang}/`;
        return this.resolveUrl(fallbackPath);
      })(),
      currentLangLabel:
        typeof _i18n.languageLabel === "function"
          ? _i18n.languageLabel(lang)
          : lang,
      themeColor: _cfg.identity.themeColor,
      analyticsEnabled: _analytics.enabled,
      gtmId: _analytics.google.gtm,
      year: new Date().getFullYear(),
      languages: {
        supported: _i18n.supported,
        default: _i18n.default,
        canonical:
          _cfg?.content?.languages?.canonical &&
          typeof _cfg.content.languages.canonical === "object"
            ? /** @type {Record<string, string>} */ (
                _cfg.content.languages.canonical
              )
            : {},
        canonicalUrl: _i18n.supported.reduce((acc, code) => {
          const langConfig = _i18n.build?.[code];
          if (langConfig?.canonical) {
            acc[code] = langConfig.canonical;
          }
          return acc;
        }, /** @type {Record<string, string>} */ ({})),
        cultures: _i18n.supported.reduce((acc, code) => {
          acc[code] = _i18n.culture(code);
          return acc;
        }, /** @type {Record<string, string>} */ ({})),
      },
      languagesCsv: _i18n.supported.join(","),
      defaultLanguage: _i18n.default,
      pagination: {
        pageSize: _cfg.content.pagination.pageSize,
      },
      features: {
        postOperations: _cfg.features.postOperations,
        search: _cfg.features.search,
      },
    };
  }

  /** @param {string | undefined} lang */
  _pickFallbackAlternateLang(lang) {
    const supported = _i18n.supported;
    if (!supported.length) {
      return null;
    }

    if (supported.length === 1) {
      return supported[0];
    }

    if (lang && lang !== _i18n.default) {
      return _i18n.default;
    }

    return supported.find((code) => code !== lang) ?? null;
  }

  /** @param {unknown} alternate @param {string} lang @returns {Record<string, string>} */
  _normalizeAlternateOverrides(alternate, lang) {
    if (!alternate) {
      return {};
    }

    if (typeof alternate === "string" && alternate.trim().length > 0) {
      const fallbackLang = this._pickFallbackAlternateLang(lang);
      if (!fallbackLang) {
        return {};
      }

      return { [fallbackLang]: this.resolveUrl(alternate.trim()) };
    }

    if (typeof alternate === "object" && !Array.isArray(alternate)) {
      const alternateRecord = /** @type {Record<string, unknown>} */ (
        alternate
      );
      /** @type {Record<string, string>} */
      const map = {};
      Object.keys(alternateRecord).forEach((code) => {
        if (!_i18n.supported.includes(code)) {
          return;
        }
        const value = alternateRecord[code];
        if (typeof value === "string" && value.trim().length > 0) {
          map[code] = this.resolveUrl(value.trim());
        }
      });
      return map;
    }

    return {};
  }

  /** @param {{ alternate?: unknown } | null | undefined} front @param {string} lang @param {string} canonicalUrl */
  buildAlternateUrlMap(front, lang, canonicalUrl) {
    const overrides = this._normalizeAlternateOverrides(front?.alternate, lang);
    /** @type {AlternateUrlMap} */
    const result = { base: /** @type {Record<string, string>} */ ({}) };

    _i18n.supported.forEach((code) => {
      const langConfig = _i18n.build[code];
      const fallbackPath = code === _i18n.default ? "/" : `/${code}/`;
      const baseUrl = langConfig?.canonical
        ? this.ensureDirectoryTrailingSlash(langConfig.canonical)
        : this.resolveUrl(fallbackPath);
      result.base[code] = baseUrl;

      if (code === lang) {
        result[code] = canonicalUrl;
        return;
      }

      if (overrides[code]) {
        result[code] = overrides[code];
        return;
      }

      if (langConfig?.canonical) {
        result[code] = langConfig.canonical;
        return;
      }

      result[code] = this.resolveUrl(fallbackPath);
    });

    result.default = canonicalUrl;

    return result;
  }

  /** @param {AlternateUrlMap | null | undefined} alternateMap */
  buildAlternateLinkList(alternateMap) {
    if (!alternateMap) {
      return [];
    }

    /** @type {Record<string, string>} */
    const baseMap = alternateMap.base ?? {};
    return _i18n.supported.map((code) => ({
      lang: code,
      hreflang: code,
      url: alternateMap[code] ?? alternateMap.default ?? "",
      label: _i18n.languageLabel(code),
      baseUrl: baseMap[code] ?? baseMap[_i18n.default] ?? "",
    }));
  }

  /** @param {string} lang @param {string} slug */
  defaultCanonical(lang, slug) {
    const cleanedSlug = (slug ?? "").replace(/^\/+/, "").replace(/\/+$/, "");
    const langConfig = _i18n.build[lang];
    let base = langConfig?.canonical;
    if (!base) {
      const fallbackPath = lang === _i18n.default ? "/" : `/${lang}/`;
      base = this.resolveUrl(fallbackPath);
    }

    const normalizedBase = base.replace(/\/+$/, "/");
    if (!cleanedSlug) {
      return normalizedBase;
    }

    return `${normalizedBase}${cleanedSlug}/`;
  }

  /** @param {string} value */
  canonicalToRelativePath(value) {
    if (!value) return null;
    let path = value;
    if (path.startsWith("~/")) {
      path = path.slice(2);
    } else if (/^https?:\/\//i.test(path)) {
      path = path.replace(/^https?:\/\/[^/]+/i, "");
    }
    path = path.trim();
    if (!path) return null;
    return path.replace(/^\/+/, "").replace(/\/+$/, "");
  }

  /** @param {string | null | undefined} canonical @param {string} lang @param {string} slug */
  buildContentUrl(canonical, lang, slug) {
    const normalizedLang = lang ?? _i18n.default;
    if (typeof canonical === "string" && canonical.trim().length > 0) {
      const trimmedCanonical = canonical.trim();
      const relative = this.canonicalToRelativePath(trimmedCanonical);
      if (relative) {
        const normalizedRelative = `/${relative}`.replace(/\/+/g, "/");
        return this.ensureDirectoryTrailingSlash(normalizedRelative);
      }

      return this.ensureDirectoryTrailingSlash(trimmedCanonical);
    }
    const fallback = this.canonicalToRelativePath(
      this.defaultCanonical(normalizedLang, slug),
    );
    if (fallback) {
      const normalizedFallback = `/${fallback}`.replace(/\/+/g, "/");
      return this.ensureDirectoryTrailingSlash(normalizedFallback);
    }
    const slugSegment = slug ? `/${slug}` : "/";
    if (normalizedLang !== _i18n.default) {
      const langPath = `/${normalizedLang}${slugSegment}`.replace(/\/+/g, "/");
      return this.ensureDirectoryTrailingSlash(langPath);
    }

    const normalizedSlug = slugSegment.replace(/\/+/g, "/");
    return this.ensureDirectoryTrailingSlash(normalizedSlug);
  }

  /** @param {FrontMatter} front @param {string} lang */
  _resolveArticleSection(front, lang) {
    const rawCategory =
      typeof front.category === "string"
        ? front.category.trim().toLowerCase()
        : "";
    if (!rawCategory) return "";
    if (lang === "tr") {
      if (rawCategory === "yasam-ogrenme") return "Yaşam & Öğrenme";
      if (rawCategory === "teknik-notlar") return "Teknik Notlar";
    }
    if (lang === "en") {
      if (rawCategory === "life-learning") return "Life & Learning";
      if (rawCategory === "technical-notes") return "Technical Notes";
    }
    return rawCategory;
  }

  /**
   * @param {FrontMatter | { keywords?: unknown } | null | undefined} source
   * @param {FrontMatter | null | undefined} [fallback]
   */
  _resolveKeywords(source, fallback) {
    if (source && Array.isArray(source.keywords) && source.keywords.length) {
      return source.keywords;
    }
    if (
      fallback &&
      Array.isArray(fallback.keywords) &&
      fallback.keywords.length
    ) {
      return fallback.keywords;
    }
    return [];
  }

  /** @param {FrontMatter} front */
  _resolvePageTitle(front) {
    if (typeof front.metaTitle === "string" && front.metaTitle.trim().length) {
      return front.metaTitle.trim();
    }
    if (typeof front.title === "string" && front.title.trim().length) {
      return front.title.trim();
    }
    return "Untitled";
  }

  /** @param {FrontMatter} front */
  _resolveCoverSource(front) {
    return typeof front.cover === "string" && front.cover.trim().length > 0
      ? front.cover.trim()
      : _cfg.seo.defaultImage;
  }

  /** @param {FrontMatter} front @param {string} lang */
  _resolveOgLocales(front, lang) {
    const langConfig = _i18n.build[lang] ?? {};
    const ogLocale = langConfig.ogLocale ?? _i18n.culture(lang);
    const defaultAltLocales =
      langConfig.altLocale ??
      _i18n.supported
        .filter((code) => code !== lang)
        .map((code) => _i18n.culture(code));
    const altLocales = this.normalizeAlternateLocales(
      front.ogAltLocale,
      defaultAltLocales,
    );
    return { ogLocale, altLocales };
  }

  /** @param {FrontMatter} front */
  _resolveContentType(front) {
    const typeValue =
      typeof front.type === "string" ? front.type.trim().toLowerCase() : "";
    const templateValue =
      typeof front.template === "string"
        ? front.template.trim().toLowerCase()
        : "";
    const isArticle =
      templateValue === "post" ||
      typeValue === "article" ||
      typeValue === "guide" ||
      typeValue === "post";
    return { typeValue, templateValue, isArticle };
  }

  /** @param {FrontMatter} front @param {string} lang @param {string} canonicalUrl @param {string} ogImageUrl */
  _buildArticleStructuredData(front, lang, canonicalUrl, ogImageUrl) {
    const authorName = _cfg.identity.author;
    const articleSection = this._resolveArticleSection(front, lang);
    const keywordsArray = this._resolveKeywords(front);

    const structured = /** @type {Record<string, any>} */ ({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: front.title ?? "",
      description: front.description ?? "",
      author: {
        "@type": "Person",
        name: authorName,
        url: _cfg.identity.url,
      },
      publisher: {
        "@type": "Person",
        name: authorName,
        url: _cfg.identity.url,
      },
      inLanguage: lang,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
    });

    if (front.date) {
      structured.datePublished = _fmt.lastMod(front.date);
    }

    if (front.updated) {
      structured.dateModified = _fmt.lastMod(front.updated);
    }

    if (ogImageUrl) {
      structured.image = [ogImageUrl];
    }

    if (articleSection) {
      structured.articleSection = articleSection;
    }

    if (keywordsArray.length) {
      structured.keywords = keywordsArray;
    }

    return this.serializeForInlineScript(structured);
  }

  /** @param {FrontMatter} front @param {string} lang @param {string} canonicalUrl */
  _buildHomeStructuredData(front, lang, canonicalUrl) {
    const siteData = this.buildSiteData(lang);
    const authorName = _cfg.identity.author;
    const structured = /** @type {Record<string, any>} */ ({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteData.title ?? "",
      url: canonicalUrl,
      inLanguage: lang,
      description: siteData.description ?? "",
      publisher: {
        "@type": "Person",
        name: authorName,
        url: _cfg.identity.url,
        sameAs: [
          _cfg.identity.social.devto,
          _cfg.identity.social.facebook,
          _cfg.identity.social.github,
          _cfg.identity.social.instagram,
          _cfg.identity.social.linkedin,
          _cfg.identity.social.mastodon,
          _cfg.identity.social.medium,
          _cfg.identity.social.stackoverflow,
          _cfg.identity.social.substack,
          _cfg.identity.social.tiktok,
          _cfg.identity.social.x,
          _cfg.identity.social.youtube,
        ].filter((i) => i && i.trim().length > 0),
      },
    });
    return this.serializeForInlineScript(structured);
  }

  /** @param {FrontMatter} front @param {string} lang */
  _resolveCollectionDescription(front, lang) {
    const collectionType =
      front.collectionType && front.collectionType.trim().length > 0
        ? front.collectionType.trim()
        : "";
    if (!collectionType) {
      return "";
    }

    if (collectionType === "tag") {
      return String(
        _i18n.t(lang, "seo.collections.tags.description", "") ?? "",
      ).replace("{{label}}", String(front.listKey ?? ""));
    }

    if (collectionType === "category") {
      return String(
        _i18n.t(lang, "seo.collections.category.description", "") ?? "",
      ).replace("{{label}}", String(front.listKey ?? ""));
    }

    if (collectionType === "series") {
      return String(
        _i18n.t(lang, "seo.collections.series.description", "") ?? "",
      ).replace("{{label}}", String(front.listKey ?? ""));
    }

    return "";
  }

  _resolveSocialProfiles() {
    return [
      _cfg.identity.social.devto,
      _cfg.identity.social.facebook,
      _cfg.identity.social.github,
      _cfg.identity.social.instagram,
      _cfg.identity.social.linkedin,
      _cfg.identity.social.mastodon,
      _cfg.identity.social.medium,
      _cfg.identity.social.stackoverflow,
      _cfg.identity.social.substack,
      _cfg.identity.social.tiktok,
      _cfg.identity.social.x,
      _cfg.identity.social.youtube,
    ].filter((i) => i && i.trim().length > 0);
  }

  /**
   * @param {FrontMatter} front
   * @param {string} lang
   * @param {string} canonicalUrl
   * @param {FrontMatter | { isPolicy?: boolean, isAboutPage?: boolean, isContactPage?: boolean, isCollectionPage?: boolean, collectionType?: string, keywords?: unknown } | null | undefined} [derived]
   */
  _buildWebPageStructuredData(front, lang, canonicalUrl, derived = front) {
    const authorName = _cfg.identity.author;
    const keywordsArray = this._resolveKeywords(derived, front);
    const isPolicy =
      typeof derived?.isPolicy === "boolean"
        ? derived.isPolicy
        : front.category && front.category.trim().length > 0
          ? _fmt.boolean(front.category.trim() === "policy")
          : false;
    const isAboutPage =
      typeof derived?.isAboutPage === "boolean"
        ? derived.isAboutPage
        : front.type && front.type.trim().length > 0
          ? _fmt.boolean(front.type.trim() === "about")
          : false;
    const isContactPage =
      typeof derived?.isContactPage === "boolean"
        ? derived.isContactPage
        : front.type && front.type.trim().length > 0
          ? _fmt.boolean(front.type.trim() === "contact")
          : false;
    const collectionType =
      typeof derived?.collectionType === "string" &&
      derived.collectionType.trim().length > 0
        ? derived.collectionType.trim()
        : front.collectionType && front.collectionType.trim().length > 0
          ? front.collectionType.trim()
          : "";
    const isCollectionPage =
      typeof derived?.isCollectionPage === "boolean"
        ? derived.isCollectionPage
        : collectionType === "tag" ||
          collectionType === "category" ||
          collectionType === "series";
    const collectionDescription = isCollectionPage
      ? this._resolveCollectionDescription(front, lang)
      : "";

    const structured = /** @type {Record<string, any>} */ ({
      "@context": "https://schema.org",
      "@type": isAboutPage
        ? "AboutPage"
        : isContactPage
          ? "ContactPage"
          : isCollectionPage
            ? "CollectionPage"
            : "WebPage",
      headline: front.title ?? "",
      description: front.description
        ? front.description
        : isCollectionPage
          ? collectionDescription
          : "",
      publisher: {
        "@type": "Person",
        name: authorName,
        url: _cfg.identity.url,
      },
      inLanguage: lang,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
      ...(isPolicy
        ? { about: { "@type": "Thing", name: "Website Legal Information" } }
        : {}),
      ...(isAboutPage
        ? {
            about: {
              "@type": "Person",
              name: _cfg.identity.author,
              url: _cfg.identity.url,
              sameAs: this._resolveSocialProfiles(),
            },
          }
        : {}),
      ...(isContactPage
        ? {
            about: {
              "@type": "Person",
              name: _cfg.identity.author,
              url: _cfg.identity.url,
            },
            contactPoint: {
              "@type": "ContactPoint",
              contactType: "general inquiry",
              email: _cfg.identity.email,
            },
          }
        : {}),
    });

    if (keywordsArray.filter((i) => i && i.trim().length > 0).length) {
      structured.keywords = keywordsArray.filter(
        (i) => i && i.trim().length > 0,
      );
    }

    return this.serializeForInlineScript(structured);
  }

  /**
   * @param {FrontMatter} front
   * @param {string} lang
   * @param {string} canonicalUrl
   * @param {string} ogImage
   * @param {FrontMatter | { isPolicy?: boolean, isAboutPage?: boolean, isContactPage?: boolean, isCollectionPage?: boolean, collectionType?: string, keywords?: unknown } | null | undefined} [derived]
   */
  _resolveStructuredData(front, lang, canonicalUrl, ogImage, derived = front) {
    const { templateValue, isArticle } = this._resolveContentType(front);
    let structuredData = null;
    if (isArticle) {
      structuredData = this._buildArticleStructuredData(
        front,
        lang,
        canonicalUrl,
        ogImage,
      );
    } else if (templateValue === "home") {
      structuredData = this._buildHomeStructuredData(front, lang, canonicalUrl);
    } else {
      structuredData = this._buildWebPageStructuredData(
        front,
        lang,
        canonicalUrl,
        derived,
      );
    }
    return { structuredData, isArticle };
  }

  /**
   * @param {FrontMatter | { header?: FrontMatter } | null | undefined} input
   * @param {string} lang
   * @param {string} slug
   */
  buildPageMeta(input, lang, slug) {
    const front =
      input &&
      typeof input === "object" &&
      input.header &&
      typeof input.header === "object"
        ? input.header
        : /** @type {FrontMatter} */ (input ?? {});
    const derived =
      input &&
      typeof input === "object" &&
      input.header &&
      typeof input.header === "object"
        ? input
        : front;
    const canonicalUrl = this.resolveUrl(
      front.canonical ?? this.defaultCanonical(lang, slug),
    );
    const pageTitleSource = this._resolvePageTitle(front);
    const { ogLocale, altLocales } = this._resolveOgLocales(front, lang);
    const coverSource = this._resolveCoverSource(front);
    const ogImage = this.resolveUrl(coverSource);
    const alternates = this.buildAlternateUrlMap(front, lang, canonicalUrl);
    const alternateLinks = this.buildAlternateLinkList(alternates);
    const twitterImage = this.resolveUrl(coverSource);

    const { structuredData, isArticle } = this._resolveStructuredData(
      front,
      lang,
      canonicalUrl,
      ogImage,
      derived,
    );
    const ogType = front.ogType ?? (isArticle ? "article" : "website");

    return {
      title: pageTitleSource,
      description: front.description ?? "",
      robots: front.robots ?? "index,follow",
      canonical: canonicalUrl,
      alternates,
      alternateLinks,
      og: {
        title: front.ogTitle ?? pageTitleSource,
        description: front.description ?? "",
        type: ogType,
        url: canonicalUrl,
        image: ogImage,
        locale: front.ogLocale ?? ogLocale,
        altLocale: altLocales,
      },
      twitter: {
        card: front.twitterCard ?? "summary_large_image",
        title: front.twitterTitle ?? pageTitleSource,
        description: front.description ?? "",
        image: twitterImage,
        url: canonicalUrl,
      },
      structuredData,
    };
  }
}

export { MetaEngine };

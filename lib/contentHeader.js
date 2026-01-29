import { format as _fmt, config as _cfg } from "@shevky/base";

export class ContentHeader {
  /**
   * @param {Record<string, unknown>} frontMatter
   */
  constructor(frontMatter) {
    this._frontMatter = frontMatter ?? {};
  }

  get raw() {
    return this._frontMatter;
  }

  get status() {
    return typeof this._frontMatter.status === "string"
      ? this._frontMatter.status.trim().toLowerCase()
      : "";
  }

  get id() {
    return typeof this._frontMatter.id === "string"
      ? this._frontMatter.id.trim()
      : "";
  }

  get lang() {
    return typeof this._frontMatter.lang === "string"
      ? this._frontMatter.lang
      : "";
  }

  get slug() {
    return typeof this._frontMatter.slug === "string"
      ? this._frontMatter.slug
      : "";
  }

  get canonical() {
    return typeof this._frontMatter.canonical === "string"
      ? this._frontMatter.canonical
      : "";
  }

  get alternate() {
    const value = this._frontMatter.alternate;
    if (typeof value === "string") {
      return value.trim();
    }
    if (value && typeof value === "object") {
      return value;
    }
    return "";
  }

  get pair() {
    return typeof this._frontMatter.pair === "string"
      ? this._frontMatter.pair.trim()
      : "";
  }

  get title() {
    return typeof this._frontMatter.title === "string"
      ? this._frontMatter.title
      : "";
  }

  get template() {
    return typeof this._frontMatter.template === "string"
      ? this._frontMatter.template.trim()
      : "page";
  }

  get listKey() {
    return typeof this._frontMatter.listKey === "string"
      ? this._frontMatter.listKey.trim()
      : "";
  }

  get listHeading() {
    return typeof this._frontMatter.listHeading === "string"
      ? this._frontMatter.listHeading.trim()
      : "";
  }

  get listingEmpty() {
    const value = this._frontMatter.listingEmpty;
    return value ?? "";
  }

  get listType() {
    return typeof this._frontMatter.listType === "string"
      ? this._frontMatter.listType.trim()
      : "";
  }

  get type() {
    return typeof this._frontMatter.type === "string"
      ? this._frontMatter.type.trim()
      : "";
  }

  get related() {
    return Array.isArray(this._frontMatter.related)
      ? this._frontMatter.related
      : [];
  }

  get isFeatured() {
    return _fmt.boolean(this._frontMatter.featured);
  }

  get category() {
    return _fmt.slugify(
      typeof this._frontMatter.category === "string"
        ? this._frontMatter.category
        : "",
    );
  }

  get tags() {
    const tags = _fmt.normalizeStringArray(this._frontMatter.tags);
    return tags.map((t) => {
      return _fmt.slugify(t);
    });
  }

  get keywords() {
    const keywords = _fmt.normalizeStringArray(this._frontMatter.keywords);
    return keywords.filter((item) => item && item.trim().length > 0);
  }

  get series() {
    return _fmt.slugify(
      typeof this._frontMatter.series === "string"
        ? this._frontMatter.series
        : "",
    );
  }

  get collectionType() {
    return typeof this._frontMatter.collectionType === "string"
      ? this._frontMatter.collectionType.trim()
      : "";
  }

  get isCollectionPage() {
    const type = this.collectionType;
    return type === "tag" || type === "category" || type === "series";
  }

  get isPolicy() {
    const category =
      typeof this._frontMatter.category === "string"
        ? this._frontMatter.category.trim()
        : "";
    return _fmt.boolean(category === "policy");
  }

  get isAboutPage() {
    const type =
      typeof this._frontMatter.type === "string"
        ? this._frontMatter.type.trim()
        : "";
    return _fmt.boolean(type === "about");
  }

  get isContactPage() {
    const type =
      typeof this._frontMatter.type === "string"
        ? this._frontMatter.type.trim()
        : "";
    return _fmt.boolean(type === "contact");
  }

  get date() {
    return this._frontMatter.date instanceof Date ||
      typeof this._frontMatter.date === "string" ||
      typeof this._frontMatter.date === "number"
      ? this._frontMatter.date
      : "";
  }

  get updated() {
    return this._frontMatter.updated instanceof Date ||
      typeof this._frontMatter.updated === "string" ||
      typeof this._frontMatter.updated === "number"
      ? this._frontMatter.updated
      : "";
  }

  get dateDisplay() {
    const dateValue =
      this._frontMatter.date instanceof Date
        ? this._frontMatter.date
        : typeof this._frontMatter.date === "string" ||
            typeof this._frontMatter.date === "number"
          ? this._frontMatter.date
          : null;
    const langValue =
      typeof this._frontMatter.lang === "string"
        ? this._frontMatter.lang
        : undefined;
    return dateValue ? _fmt.date(dateValue, langValue) : null;
  }

  get description() {
    return typeof this._frontMatter.description === "string"
      ? this._frontMatter.description
      : "";
  }

  get cover() {
    return typeof this._frontMatter.cover === "string" &&
      this._frontMatter.cover.trim().length > 0
      ? this._frontMatter.cover
      : _cfg.seo.defaultImage;
  }

  get coverAlt() {
    return typeof this._frontMatter.coverAlt === "string"
      ? this._frontMatter.coverAlt
      : "";
  }

  get coverCaption() {
    return typeof this._frontMatter.coverCaption === "string"
      ? this._frontMatter.coverCaption
      : "";
  }

  get readingTime() {
    const value =
      typeof this._frontMatter.readingTime === "number" ||
      typeof this._frontMatter.readingTime === "string"
        ? this._frontMatter.readingTime
        : 0;
    return _fmt.readingTime(value);
  }

  get seriesTitle() {
    if (!this._frontMatter.series) {
      return "";
    }

    const rawTitle =
      typeof this._frontMatter.seriesTitle === "string"
        ? this._frontMatter.seriesTitle.trim()
        : "";
    if (rawTitle.length > 0) {
      return rawTitle;
    }

    return typeof this._frontMatter.series === "string"
      ? this._frontMatter.series
      : "";
  }

  get menuLabel() {
    const fallbackKey =
      (typeof this._frontMatter.id === "string" &&
        this._frontMatter.id.trim()) ||
      (typeof this._frontMatter.slug === "string" &&
        this._frontMatter.slug.trim()) ||
      "";
    return (
      (typeof this._frontMatter.menu === "string" &&
      this._frontMatter.menu.trim().length > 0
        ? this._frontMatter.menu.trim()
        : typeof this._frontMatter.title === "string" &&
            this._frontMatter.title.trim().length > 0
          ? this._frontMatter.title.trim()
          : fallbackKey) ?? fallbackKey
    );
  }

  get isHiddenOnMenu() {
    return !_fmt.boolean(this._frontMatter.show);
  }

  get menuOrder() {
    const value =
      typeof this._frontMatter.order === "number" ||
      typeof this._frontMatter.order === "string"
        ? this._frontMatter.order
        : 0;
    return _fmt.order(value);
  }

  get layout() {
    return typeof this._frontMatter.layout === "string"
      ? this._frontMatter.layout.trim()
      : "default";
  }
}

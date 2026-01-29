import { ContentBody } from "./contentBody.js";
import { ContentHeader } from "./contentHeader.js";

export class ContentFile {
  /**
   *
   * @param {Record<string, unknown>} frontMatter
   * @param {string} content
   * @param {string} filePath
   * @param {boolean} isValid
   */
  constructor(frontMatter, content, filePath, isValid) {
    this._header = new ContentHeader(frontMatter);
    this._body = new ContentBody(content);
    this._filePath = filePath;
    this._isValid = isValid;
  }

  get header() {
    return this._header;
  }

  get body() {
    return this._body;
  }

  get isValid() {
    return this._isValid;
  }

  get sourcePath() {
    return this._filePath;
  }

  get content() {
    return this._body.content;
  }

  get status() {
    return this._header.status;
  }

  get id() {
    return this._header.id;
  }

  get lang() {
    return this._header.lang;
  }

  get slug() {
    return this._header.slug;
  }

  get canonical() {
    return this._header.canonical;
  }

  get title() {
    return this._header.title;
  }

  get template() {
    return this._header.template;
  }

  get isFeatured() {
    return this._header.isFeatured;
  }

  get category() {
    return this._header.category;
  }

  get tags() {
    return this._header.tags;
  }

  get keywords() {
    return this._header.keywords;
  }

  get series() {
    return this._header.series;
  }

  get collectionType() {
    return this._header.collectionType;
  }

  get isCollectionPage() {
    return this._header.isCollectionPage;
  }

  get isPolicy() {
    return this._header.isPolicy;
  }

  get isAboutPage() {
    return this._header.isAboutPage;
  }

  get isContactPage() {
    return this._header.isContactPage;
  }

  get date() {
    return this._header.date;
  }

  get updated() {
    return this._header.updated;
  }

  get dateDisplay() {
    return this._header.dateDisplay;
  }

  get description() {
    return this._header.description;
  }

  get cover() {
    return this._header.cover;
  }

  get coverAlt() {
    return this._header.coverAlt;
  }

  get coverCaption() {
    return this._header.coverCaption;
  }

  get readingTime() {
    return this._header.readingTime;
  }

  get seriesTitle() {
    return this._header.seriesTitle;
  }

  get menuLabel() {
    return this._header.menuLabel;
  }

  get isHiddenOnMenu() {
    return this._header.isHiddenOnMenu;
  }

  get menuOrder() {
    return this._header.menuOrder;
  }

  get layout() {
    return this._header.layout;
  }

  get isPublished() {
    return this.status === "published";
  }

  get isDraft() {
    return this.status === "draft";
  }

  get isPostTemplate() {
    return this.template === "post";
  }
}

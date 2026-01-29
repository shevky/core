import { ContentFile } from "./contentFile.js";

export class ContentSummary {
  /**
   * @param {ContentFile} file
   */
  constructor(file) {
    this._file = file;
  }

  get id() {
    return this._file.id;
  }

  get title() {
    return this._file.title;
  }

  get date() {
    return this._file.date;
  }

  get description() {
    return this._file.description;
  }

  get cover() {
    return this._file.cover;
  }

  get coverAlt() {
    return this._file.coverAlt;
  }

  get coverCaption() {
    return this._file.coverCaption;
  }

  get readingTime() {
    return this._file.readingTime;
  }

  get dateDisplay() {
    return this._file.dateDisplay;
  }

  get slug() {
    return this._file.slug;
  }

  get lang() {
    return this._file.lang;
  }

  get canonical() {
    return this._file.canonical;
  }

  get updated() {
    return this._file.updated;
  }

  get seriesTitle() {
    return this._file.seriesTitle;
  }

  toObject() {
    return {
      id: this.id,
      title: this.title,
      slug: this.slug,
      lang: this.lang,
      canonical: this.canonical,
      date: this.date,
      updated: this.updated,
      description: this.description,
      cover: this.cover,
      coverAlt: this.coverAlt,
      coverCaption: this.coverCaption,
      readingTime: this.readingTime,
      dateDisplay: this.dateDisplay,
      seriesTitle: this.seriesTitle,
    };
  }
}

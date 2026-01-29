import { ContentFile } from "./contentFile.js";

export class MenuItem {
  /**
   * @param {ContentFile} file
   */
  constructor(file) {
    this._file = file;
  }

  get key() {
    return this._file.id;
  }

  get label() {
    return this._file.menuLabel;
  }

  get url() {
    return this._file.canonical;
  }

  get slug() {
    return this._file.slug;
  }

  get order() {
    return typeof this._file.menuOrder === "number" ? this._file.menuOrder : 0;
  }

  get lang() {
    return this._file.lang;
  }

  get isEligable() {
    return (
      this._file.isValid &&
      !this._file.isDraft &&
      this._file.isPublished &&
      !this._file.isHiddenOnMenu
    );
  }

  toObject() {
    return {
      key: this.key,
      label: this.label,
      order: this.order,
    };
  }
}

export class ContentBody {
  /**
   * @param {string} content
   */
  constructor(content) {
    this._content = content;
  }

  get content() {
    return this._content;
  }
}

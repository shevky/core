/**
 * @typedef {{
 *  kind?: string,
 *  type?: string,
 *  lang?: string,
 *  slug?: string,
 *  canonical?: string,
 *  layout?: string,
 *  template?: string,
 *  front?: Record<string, unknown>,
 *  view?: Record<string, unknown>,
 *  html?: string,
 *  sourcePath?: string,
 *  outputPath?: string,
 *  writeMeta?: Record<string, unknown>,
 *  isDynamic?: boolean,
 *  isCollection?: boolean,
 *  isStatic?: boolean,
 * }} PageInput
 */

export class Page {
  /**
   * @param {PageInput} input
   */
  constructor(input) {
    this._input = input ?? {};
  }

  get kind() {
    return typeof this._input.kind === "string" ? this._input.kind : "";
  }

  get type() {
    return typeof this._input.type === "string" ? this._input.type : "";
  }

  get lang() {
    return typeof this._input.lang === "string" ? this._input.lang : "";
  }

  get slug() {
    return typeof this._input.slug === "string" ? this._input.slug : "";
  }

  get canonical() {
    return typeof this._input.canonical === "string"
      ? this._input.canonical
      : "";
  }

  get layout() {
    return typeof this._input.layout === "string" ? this._input.layout : "";
  }

  get template() {
    return typeof this._input.template === "string" ? this._input.template : "";
  }

  get front() {
    return this._input.front ?? {};
  }

  get view() {
    return this._input.view ?? {};
  }

  get html() {
    return typeof this._input.html === "string" ? this._input.html : "";
  }

  get sourcePath() {
    return typeof this._input.sourcePath === "string"
      ? this._input.sourcePath
      : "";
  }

  get outputPath() {
    return typeof this._input.outputPath === "string"
      ? this._input.outputPath
      : "";
  }

  get writeMeta() {
    return this._input.writeMeta ?? {};
  }

  get isDynamic() {
    return Boolean(this._input.isDynamic);
  }

  get isCollection() {
    return Boolean(this._input.isCollection);
  }

  get isStatic() {
    return Boolean(this._input.isStatic);
  }

  toObject() {
    return { ...this._input };
  }
}

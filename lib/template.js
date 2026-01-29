export class Template {
  /**
   * @type {string}
   */
  #_key;

  /**
   * @type {string}
   */
  #_path;

  /**
   * @type {string}
   */
  #_content;

  /**
   * @type {string}
   */
  #_type;

  /**
   * @param {string} key
   * @param {string} type
   * @param {string} path
   * @param {string} content
   */
  constructor(key, type, path, content) {
    this.#_key = key;
    this.#_type = type;
    this.#_path = path;
    this.#_content = content;
  }

  get key() {
    return this.#_key;
  }

  get type() {
    return this.#_type;
  }

  get path() {
    return this.#_path;
  }

  get content() {
    return this.#_content;
  }
}

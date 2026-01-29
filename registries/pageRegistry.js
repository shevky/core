import { Page } from "../lib/page.js";

export class PageRegistry {
  /**
   * @type {Page[]}
   */
  #_cache = [];

  /**
   * @param {Page} page
   */
  add(page) {
    if (page instanceof Page) {
      this.#_cache.push(page);
    }
  }

  list() {
    return [...this.#_cache];
  }

  get count() {
    return this.#_cache.length;
  }

  clear() {
    this.#_cache = [];
  }
}

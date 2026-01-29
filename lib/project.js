import { io as _io } from "@shevky/base";

/** @typedef {import("../types/index.d.ts").ProjectPaths} ProjectPaths */

export class Project {
  /**
   * @type {string}
   */
  #_baseDir;

  /**
   * @param {string} [baseDir="."]
   */
  constructor(baseDir = ".") {
    this.#_baseDir = baseDir;
  }

  get rootDir() {
    return _io.path.combine(this.#_baseDir);
  }

  get srcDir() {
    return _io.path.combine(this.rootDir, "src");
  }

  get distDir() {
    return _io.path.combine(this.rootDir, "dist");
  }

  get tmpDir() {
    return _io.path.combine(this.rootDir, "tmp");
  }

  get contentDir() {
    return _io.path.combine(this.srcDir, "content");
  }

  get layoutsDir() {
    return _io.path.combine(this.srcDir, "layouts");
  }

  get componentsDir() {
    return _io.path.combine(this.srcDir, "components");
  }

  get templatesDir() {
    return _io.path.combine(this.srcDir, "templates");
  }

  get assetsDir() {
    return _io.path.combine(this.srcDir, "assets");
  }

  get siteConfig() {
    return _io.path.combine(this.srcDir, "site.json");
  }

  get i18nConfig() {
    return _io.path.combine(this.srcDir, "i18n.json");
  }

  /**
   * @returns {ProjectPaths}
   */
  toObject() {
    return {
      root: this.rootDir,
      src: this.srcDir,
      dist: this.distDir,
      tmp: this.tmpDir,
      content: this.contentDir,
      layouts: this.layoutsDir,
      components: this.componentsDir,
      templates: this.templatesDir,
      assets: this.assetsDir,
      siteConfig: this.siteConfig,
      i18nConfig: this.i18nConfig,
    };
  }
}

export default new Project();

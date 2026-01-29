import type {
  BasePluginContext,
  PluginHooks,
  PluginLoadContext as BasePluginLoadContext,
} from "@shevky/base";

export type ProjectPaths = {
  root: string;
  src: string;
  dist: string;
  tmp: string;
  content: string;
  layouts: string;
  components: string;
  templates: string;
  assets: string;
  siteConfig: string;
  i18nConfig: string;
};

export type PluginInstance = {
  name: string;
  version: string;
  hooks: PluginHooks;
  load: (ctx: PluginLoadContext) => void;
};

export type PluginLoadContext = BasePluginLoadContext;

export interface PluginExecutionContext extends BasePluginContext {
  paths: ProjectPaths;
  contentFiles?: import("@shevky/base").ContentFileLike[];
  pages?: CollectionsByLang;
  contentIndex?: Record<
    string,
    Record<string, { id: string; lang: string; title: string; canonical: string }>
  >;
  footerPolicies?: Record<string, FooterPolicy[]>;
}

export type Placeholder = {
  token: string;
  marker: string;
  html: string;
};

export type FooterPolicy = {
  key: string;
  label: string;
  url: string;
  lang: string;
};

export type ContentSummaryLike = {
  id: string;
  title: string;
  slug: string;
  lang: string;
  canonical: string;
  date: string | number | Date;
  updated: string | number | Date;
  description: string;
  cover: string;
  coverAlt: string;
  coverCaption: string;
  readingTime: number;
  dateDisplay: string | null;
  seriesTitle: string;
};

export type CollectionEntry = ContentSummaryLike & {
  type?: string;
  seriesTitle?: string;
  canonical?: string;
};

export type CollectionsByLang = Record<string, Record<string, CollectionEntry[]>>;

export type FrontMatter = Record<string, any>;

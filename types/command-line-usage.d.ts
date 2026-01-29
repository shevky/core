declare module "command-line-usage" {
  export type Section = {
    header?: string;
    content?: string | string[];
    optionList?: unknown[];
    group?: string | string[];
  };

  function commandLineUsage(sections: readonly Section[] | Section): string;

  export default commandLineUsage;
}

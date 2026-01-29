declare module "command-line-args" {
  export type OptionDefinition = {
    name: string;
    alias?: string;
    type?: unknown;
    description?: string;
    defaultValue?: unknown;
    multiple?: boolean;
    defaultOption?: boolean;
  };

  export type CommandLineOptions = Record<string, unknown>;

  function commandLineArgs(
    options?: readonly OptionDefinition[],
    argv?: readonly string[],
  ): CommandLineOptions;

  export default commandLineArgs;
}

import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";

/**
 * @typedef {import("command-line-args").OptionDefinition} OptionDefinition
 * @typedef {import("command-line-args").CommandLineOptions} CommandLineOptions
 * @typedef {import("command-line-usage").Section} UsageSection
 */

/** @returns {OptionDefinition[]} */
function getCliOptionDefinitions() {
  const optionDefinitions = [
    {
      name: "help",
      alias: "h",
      type: Boolean,
      description: "Show command line help.",
    },
    {
      name: "version",
      alias: "v",
      type: Boolean,
      description: "Print version information.",
    },
    {
      name: "init",
      type: Boolean,
      description: "Initialize the project structure with sample content.",
    },
    {
      name: "build",
      type: Boolean,
      description: "Build the project and prepare the deployable artifact.",
    },
    {
      name: "dev",
      type: Boolean,
      description:
        "Build the project and serve dist/ at http://localhost:3000.",
    },
  ];

  return optionDefinitions;
}

/** @returns {CommandLineOptions} */
function parseArgv() {
  const optionDefinitions = getCliOptionDefinitions();
  return commandLineArgs(optionDefinitions);
}

/** @returns {string} */
function help() {
  const optionDefinitions = getCliOptionDefinitions();

  /** @type {UsageSection[]} */
  const commandSections = [
    {
      header: "Shevky",
      content: "A minimal, dependency-light static site generator.",
    },
    {
      header: "Options",
      optionList: optionDefinitions,
    },
    {
      header: "Project Details",
      content: "Project Home: {underline https://tatoglu.net/project/shevky}",
    },
    {
      content: "GitHub: {underline https://github.com/fatihtatoglu/shevky}",
    },
  ];

  return commandLineUsage(commandSections);
}

/**
 * @param {string} versionNumber
 * @returns {string}
 */
function version(versionNumber) {
  return commandLineUsage({
    header: `Shevky v${versionNumber}`,
    content: "A minimal, dependency-light static site generator.",
  });
}

const API = {
  options: parseArgv(),
  help,
  version,
};

export default API;

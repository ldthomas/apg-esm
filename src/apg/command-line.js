/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module command-line
 * @description Parses APG command-line arguments into a configuration object.
 * Supports flags for help, version, strict mode, TypeScript output, rule display,
 * and input/output file paths.
 */
import fs from 'fs';
import path from 'path';

/**
 * @function commandLine
 * @description Parses APG command-line arguments and returns a configuration object.
 * @param {string[]} args - Command-line arguments (e.g. `process.argv.slice(2)`).
 * @returns {{ src: string|null, out: string|null, strict: boolean, typescript: boolean,
 *   displayRules: boolean, displayRuleDependencies: boolean, displayAttributes: boolean,
 *   help: string, version: string, error: string }} Configuration object.
 */
export default function commandLine(args) {
  const helpScreen = (helpArgs) => {
    let help = 'Usage: apg options\n';
    let options = '';
    helpArgs.forEach((arg) => {
      options += `${arg} `;
    });
    help += `options: ${options}\n`;
    help += '-h, --help                 : print this help screen\n';
    help += '-v, --version              : display version information\n';
    help += '-s, --strict               : only ABNF grammar (RFC 5234 & 7405) allowed, no Superset features\n';
    help += '-t, --typescript           : use .ts as the output file extension\n';
    help += '-i <path>[,<path>[,...]]   : input file(s)*\n';
    help += '--in=<path>[,<path>[,...]] : input file(s)*\n';
    help += '-o <path>                  : output filename**\n';
    help += '--out=<path>               : output filename**\n';
    help += '--display-rules            : display the rule names\n';
    help += '--display-rule-dependencies: display => rules referenced by, <= rules referring to this rule\n';
    help += '--display-attributes       : display the attributes\n';
    help += '\n';
    help += 'Options are case insensitive.\n';
    help += '*  Multiple input files allowed.\n';
    help += '   Multiple file names must be comma separated.\n';
    help += '   File names from multiple input options are concatenated.\n';
    help += '   Content of all resulting input files is concatenated.\n';
    help += '** Output file name is optional.\n';
    help += '   If no output file name is given, no parser is generated.\n';
    help += '   If the output file name is specified, the existing extension,\n';
    help += '   if any, is stripped and ".js" is added (".ts if --typescript option used)\n';
    help += '\n';
    return help;
  };
  const version = () => {
    const v = 'apg-esm, version 1.0.0';
    const c = 'Copyright (c) 2026 Lowell D. Thomas';
    const l = 'MIT License';
    return `${v}\n${c}\n${l}\n`;
  };
  const STRICTL = '--strict';
  const STRICTS = '-s';
  const TYPEL = '--typescript';
  const TYPES = '-t';
  const HELPL = '--help';
  const HELPS = '-h';
  const VERSIONL = '--version';
  const VERSIONS = '-v';
  const DISPLAY_RULES = '--display-rules';
  const DISPLAY_RULE_DEPENDENCIES = '--display-rule-dependencies';
  const DISPLAY_ATTRIBUTES = '--display-attributes';
  const INL = '--in';
  const INS = '-i';
  const OUTL = '--out';
  const OUTS = '-o';
  let inFilenames = [];
  const config = {
    help: '',
    version: '',
    error: '',
    strict: false,
    typescript: false,
    noAttrs: false,
    displayRules: false,
    displayRuleDependencies: false,
    displayAttributes: false,
    src: null,
    outFilename: '',
    outfd: null,
    funcName: null,
  };
  let key;
  let value;
  let i = 0;
  try {
    while (i < args.length) {
      const kv = args[i].split('=');
      if (kv.length === 2) {
        key = kv[0].toLowerCase();
        value = kv[1];
      } else if (kv.length === 1) {
        key = kv[0].toLowerCase();
        value = i + 1 < args.length ? args[i + 1] : '';
      } else {
        throw new Error(`command line error: ill-formed option: ${args[i]}`);
      }
      switch (key) {
        case HELPL:
        case HELPS:
          config.help = helpScreen(args);
          return config;
        case VERSIONL:
        case VERSIONS:
          config.version = version();
          return config;
        case DISPLAY_RULES:
          config.displayRules = true;
          i += 1;
          break;
        case DISPLAY_RULE_DEPENDENCIES:
          config.displayRuleDependencies = true;
          i += 1;
          break;
        case DISPLAY_ATTRIBUTES:
          config.displayAttributes = true;
          i += 1;
          break;
        case STRICTL:
        case STRICTS:
          config.strict = true;
          i += 1;
          break;
        case TYPEL:
        case TYPES:
          config.typescript = true;
          i += 1;
          break;
        case INL:
        case INS:
          if (!value) {
            throw new Error(`command line error: input file name has no value: ${args[i]}`);
          }
          inFilenames = inFilenames.concat(
            value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          );
          i += key === INL ? 1 : 2;
          break;
        case OUTL:
        case OUTS:
          if (!value) {
            throw new Error(`command line error: output file name has no value: ${args[i]}`);
          }
          config.outFilename = value;
          i += key === OUTL ? 1 : 2;
          break;
        default:
          throw new Error(`command line error: unrecognized arg: ${args[i]}`);
      }
    }

    /* get the SABNF input */
    if (inFilenames.length === 0) {
      throw new Error('command line error: no input file(s)');
    }

    // Convert input Buffer to JavaScript string (assume UTF-8 encoded text)
    config.src = Buffer.concat(inFilenames.map((name) => fs.readFileSync(name))).toString('utf8');

    /* validate & open the output file, if any */
    config.outfd = null;
    if (config.outFilename) {
      const info = path.parse(config.outFilename);
      const ext = config.typescript ? 'ts' : 'js';
      if (info.dir) {
        config.outFilename = `${info.dir}/${info.name}.${ext}`;
      } else {
        config.outFilename = `${info.name}.${ext}`;
      }
      config.outfd = fs.openSync(config.outFilename, 'w');
    }
  } catch (e) {
    config.error = `CONFIG EXCEPTION: ${e.message}`;
    config.help = helpScreen(args);
  }
  return config;
}

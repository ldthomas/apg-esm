/**
 * @module generator
 * @description Entry point for the APG command-line parser generator.
 * Reads `process.argv`, passes arguments to {@link module:apg}, and exits.
 */
/**
 * @module generator
 * @description Entry point for the APG command-line parser generator.
 * Reads `process.argv`, passes arguments to the {@link module:apg} driver, and exits.
 */
import apg from './apg.js';
apg(process.argv.slice(2));

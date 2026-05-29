# APG - an **A**BNF **P**arser **G**enerator

## apg-esm

`apg-esm` updates [apg-js](https://www.npmjs.com/package/apg-js) in a number of significant ways.

- Uses the more modern ESM module system
- Has been refactored for clarity and maintainability
- Removes the `apg-exp` pattern-matching engine and its significant overhead
- Simplifies the parse tree trace with simple text output, removing HTML file presentation
- Simplifies the parsing statistics with simple text output, removing HTML file presentation
- Adds a new type of trace, tracing the parser through the SABNF grammar text
- Introduces an interactive page for SABNF grammar development
- Provides visualization of the parser's path through the parse tree and the SABNF grammar

## Overview

APG — an **A**BNF **P**arser **G**enerator — generates recursive-descent parsers from a superset of [ABNF](https://tools.ietf.org/html/rfc5234) called SABNF. An ABNF grammar implicitly defines a tree of seven node types, each representing a parsing operation. A depth-first traversal of that tree is exactly a recursive-descent parse. APG extends the original ABNF operators with three additional operators for convenience and expressiveness. For a complete description, see the [SABNF Grammar Reference](./docs/SABNF-grammar.md).

## The Generator

The generator does not produce a parser directly. Instead, the `Api` class (`./src/apg-api/api.js`)
generates a grammar object — a representation of the operator-node tree defined by the `SABNF` grammar.
It can produce either an in-memory grammar object for immediate use or a JavaScript file that exports
an equivalent grammar object.

`./src/apg/apg.js` provides command line access to the generator. To see all of the
command line options run:

```
npm run apg -- --help
```

## The Parser

The actual parser is in `./src/apg-lib/parser.js`. It requires a grammar object in its constructor
and parses an input string into the SABNF rule-named phrases. See the examples in `./examples/` for set up and execution.

### Tracing the Parse Tree

As the parser traverses the tree of operator nodes it visits each non-terminal node twice — once entering the node (going down) and once returning to its parent node (going up). Terminal nodes capture zero or more characters from the input string on success and return them to their parent node, or return failure if the match fails. A successful parse will eventually return the entire input string to the root node, the starting rule.

When the parse fails, either the SABNF grammar incorrectly describes the target language or the input string
is not a valid language phrase. Finding the error can be difficult without knowing the actual path the parser
took through the tree. APG provides a tracing facility for this in `./src/apg-lib/trace.js`; `./examples/trace.js` illustrates its use.

`apg-esm` also provides a tool to visually follow the path of the parser through the parse tree.
This is described in more detail in the **Visualization** section below.

### Tracing the SABNF Grammar

For visualization purposes, `apg-esm` provides a second form of parser tracing.
`./src/apg-lib/traceSabnf.js` will highlight the parser's position in the SABNF grammar text
rather than in the parse tree. `./examples/traceSabnf.js` illustrates how to implement it
and provides an example of what the display looks like.
This is also described in more detail in the **Visualization** section below.

## Examples

Setting up a parser to use `apg-esm` is only slightly different from using `apg-js`. A few examples,
chosen to illustrate all of the main features, demonstrate the setup. These are all in the `./examples/` directory.
Each is self-contained and displays a brief explanation of what it does in the code and output.
Scripts, named the same as each respective example, are available to run them.

## Visualization

A significant new feature of `apg-esm` is the addition of a web page for
visualizing `SABNF` grammar/parser development. The page `./docs/index.html` provides
textareas for the `SABNF` grammar and the input string. Checkboxes are available for each of the command line options.

`./docs/index.html` must be served over HTTP — opening it directly as a `file://` URL
will not work because browsers block ES module loading and `fetch()` requests in that context.
There are several ways to serve it locally:

- **`apg-esm` built-in server**: run `npm run server`, then open `http://localhost:3000` in any browser.
- **VS Code [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension**: open `./docs/index.html` in the editor and click **Go Live** in the status bar. The page will open automatically and reload on changes.
- **VS Code**, version 1.121.0 or higher: open `./docs/index.html` and click the **Open in Integrated Browser** icon
  in the upper right corner.

Or view it on [GitHub Pages](https://ldthomas.github.io/apg-esm/).

The page is mostly self-explanatory. But it does have a couple of obvious limitations.

- There is no way to supply callback functions to the parser's rules which means that if there are any UDT names in the grammar the parser will not be functional.
- Only ASCII text strings can be parsed.
- AST generation and translation are not possible.

### Parse Tree Visualization

If the `Trace Parse Tree` checkbox is checked, a successful parse will generate a parse tree trace available
in the `Trace Parse Tree` tab. Opening this tab will display the input string followed by an ASCII text version of the parse tree. For a more dynamic display, click the `Copy Trace` button, open the `Parse Tree Visualizer` link and follow the instructions. Use the `user guide` link on the Parse Tree Visualizer page for complete details.

### SABNF Grammar Visualization

If the `Trace Grammar Text` checkbox is checked, a successful parse will generate a trace of the grammar text
available in the `Trace Grammar Text` tab. Opening this tab will display the trace followed by the SABNF grammar text. For a more dynamic display, click the `Copy Trace` button, open the `Grammar Trace Visualizer` link and follow the instructions. Use the `user guide` link on the Grammar Trace Visualizer page for complete details.

## Code Documentation

The documentation is in code comments in [JSDoc](https://jsdoc.app/) format.

`npm run jsdoc` will generate the documentation at `./documentation/index.html`.

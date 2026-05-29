/**
 * @module stats
 * @description Provides statistics collection for the APG parser.
 * Accumulates operator hit counts (MATCH, EMPTY, NOMATCH) and displays them after a parse.
 * Attach to a parser instance via {@link Parser#setStats}.
 */
import id from './identifiers.js';

const THIS_FILE = 'parser.js: Stats(): ';

function emptyStat() {
  return {
    empty: 0,
    match: 0,
    nomatch: 0,
    total: 0,
  };
}

function normalize(n) {
  if (n < 10) {
    return `      ${n}`;
  }
  if (n < 100) {
    return `     ${n}`;
  }
  if (n < 1000) {
    return `    ${n}`;
  }
  if (n < 10000) {
    return `   ${n}`;
  }
  if (n < 100000) {
    return `  ${n}`;
  }
  if (n < 1000000) {
    return ` ${n}`;
  }
  return `${n}`;
}

function sortAlpha(lhs, rhs) {
  if (lhs.lower < rhs.lower) {
    return -1;
  }
  if (lhs.lower > rhs.lower) {
    return 1;
  }
  return 0;
}

function sortHits(lhs, rhs) {
  if (lhs.total < rhs.total) {
    return 1;
  }
  if (lhs.total > rhs.total) {
    return -1;
  }
  return sortAlpha(lhs, rhs);
}

function sortIndex(lhs, rhs) {
  if (lhs.index < rhs.index) {
    return -1;
  }
  if (lhs.index > rhs.index) {
    return 1;
  }
  return 0;
}

/**
 * @class Stats
 * @description Collects and displays parser statistics. Tracks operator hit counts
 * per operator type and per rule/UDT name.
 */
export default class Stats {
  constructor() {
    this.statsObject = 'statsObject';
    this._rules = null;
    this._udts = null;
    this._totals = null;
    this._stats = [];
    this._ruleStats = [];
    this._udtStats = [];
  }

  /* called by parser to initialize the stats */
  init(r, u) {
    this._rules = r;
    this._udts = u;
    this._clear();
  }

  /* This function is the main interaction with the parser. */
  /* The parser calls it after each node has been traversed. */
  collect(op, sys) {
    this._incStat(this._totals, sys.state, sys.phraseLength);
    this._incStat(this._stats[op.type], sys.state, sys.phraseLength);
    if (op.type === id.RNM) {
      this._incStat(this._ruleStats[op.index], sys.state, sys.phraseLength);
    }
    if (op.type === id.UDT) {
      this._incStat(this._udtStats[op.index], sys.state, sys.phraseLength);
    }
  }

  /**
   * @method displayStats
   * @description Returns a formatted table of hit counts for each operator type.
   * @returns {string} Multi-line ASCII table string.
   */
  displayStats() {
    let out = '';
    const totals = {
      match: 0,
      empty: 0,
      nomatch: 0,
      total: 0,
    };
    const displayRow = (op, m, e, n, t) => {
      totals.match += m;
      totals.empty += e;
      totals.nomatch += n;
      totals.total += t;
      const mm = normalize(m);
      const ee = normalize(e);
      const nn = normalize(n);
      const tt = normalize(t);
      return `${op} | ${mm} | ${ee} | ${nn} | ${tt} |\n`;
    };
    out += '          OPERATOR STATS\n';
    out += '      |   MATCH |   EMPTY | NOMATCH |   TOTAL |\n';
    out += displayRow(
      '  ALT',
      this._stats[id.ALT].match,
      this._stats[id.ALT].empty,
      this._stats[id.ALT].nomatch,
      this._stats[id.ALT].total
    );
    out += displayRow(
      '  CAT',
      this._stats[id.CAT].match,
      this._stats[id.CAT].empty,
      this._stats[id.CAT].nomatch,
      this._stats[id.CAT].total
    );
    out += displayRow(
      '  REP',
      this._stats[id.REP].match,
      this._stats[id.REP].empty,
      this._stats[id.REP].nomatch,
      this._stats[id.REP].total
    );
    out += displayRow(
      '  RNM',
      this._stats[id.RNM].match,
      this._stats[id.RNM].empty,
      this._stats[id.RNM].nomatch,
      this._stats[id.RNM].total
    );
    out += displayRow(
      '  TRG',
      this._stats[id.TRG].match,
      this._stats[id.TRG].empty,
      this._stats[id.TRG].nomatch,
      this._stats[id.TRG].total
    );
    out += displayRow(
      '  TBS',
      this._stats[id.TBS].match,
      this._stats[id.TBS].empty,
      this._stats[id.TBS].nomatch,
      this._stats[id.TBS].total
    );
    out += displayRow(
      '  TLS',
      this._stats[id.TLS].match,
      this._stats[id.TLS].empty,
      this._stats[id.TLS].nomatch,
      this._stats[id.TLS].total
    );
    out += displayRow(
      '  UDT',
      this._stats[id.UDT].match,
      this._stats[id.UDT].empty,
      this._stats[id.UDT].nomatch,
      this._stats[id.UDT].total
    );
    out += displayRow(
      '  AND',
      this._stats[id.AND].match,
      this._stats[id.AND].empty,
      this._stats[id.AND].nomatch,
      this._stats[id.AND].total
    );
    out += displayRow(
      '  NOT',
      this._stats[id.NOT].match,
      this._stats[id.NOT].empty,
      this._stats[id.NOT].nomatch,
      this._stats[id.NOT].total
    );
    out += displayRow('TOTAL', totals.match, totals.empty, totals.nomatch, totals.total);
    return out;
  }

  /*
  Display rule/udt
  */
  /**
   * @method displayHits
   * @description Returns a formatted table of hit counts for each rule and UDT name.
   * @param {string} [type] - Sort order: `'alpha'`/`'a'` for alphabetical, `'index'`/`'i'` for index order,
   *   or any other value for descending hit-count order.
   * @returns {string} Multi-line ASCII table string.
   */
  displayHits(type) {
    let out = '';
    const displayRow = (m, e, n, t, name) => {
      this._totals.match += m;
      this._totals.empty += e;
      this._totals.nomatch += n;
      this._totals.total += t;
      const mm = normalize(m);
      const ee = normalize(e);
      const nn = normalize(n);
      const tt = normalize(t);
      return `| ${mm} | ${ee} | ${nn} | ${tt} | ${name}\n`;
    };
    if (typeof type === 'string' && type.toLowerCase()[0] === 'a') {
      this._ruleStats.sort(sortAlpha);
      this._udtStats.sort(sortAlpha);
      out += '    RULES/UDTS ALPHABETICALLY\n';
    } else if (typeof type === 'string' && type.toLowerCase()[0] === 'i') {
      this._ruleStats.sort(sortIndex);
      this._udtStats.sort(sortIndex);
      out += '    RULES/UDTS BY INDEX\n';
    } else {
      this._ruleStats.sort(sortHits);
      this._udtStats.sort(sortHits);
      out += '    RULES/UDTS BY HIT COUNT\n';
    }
    out += '|   MATCH |   EMPTY | NOMATCH |   TOTAL | NAME\n';
    for (let i = 0; i < this._ruleStats.length; i += 1) {
      const r = this._ruleStats[i];
      if (r.total) {
        out += displayRow(r.match, r.empty, r.nomatch, r.total, r.name);
      }
    }
    for (let i = 0; i < this._udtStats.length; i += 1) {
      const r = this._udtStats[i];
      if (r.total) {
        out += displayRow(r.match, r.empty, r.nomatch, r.total, r.name);
      }
    }
    return out;
  }

  /* Zero out all stats */
  _clear() {
    this._stats.length = 0;
    this._totals = emptyStat();
    this._stats[id.ALT] = emptyStat();
    this._stats[id.CAT] = emptyStat();
    this._stats[id.REP] = emptyStat();
    this._stats[id.RNM] = emptyStat();
    this._stats[id.TRG] = emptyStat();
    this._stats[id.TBS] = emptyStat();
    this._stats[id.TLS] = emptyStat();
    this._stats[id.UDT] = emptyStat();
    this._stats[id.AND] = emptyStat();
    this._stats[id.NOT] = emptyStat();
    this._ruleStats.length = 0;
    for (let i = 0; i < this._rules.length; i += 1) {
      this._ruleStats.push({
        empty: 0,
        match: 0,
        nomatch: 0,
        total: 0,
        name: this._rules[i].name,
        lower: this._rules[i].lower,
        index: this._rules[i].index,
      });
    }
    if (this._udts.length > 0) {
      this._udtStats.length = 0;
      for (let i = 0; i < this._udts.length; i += 1) {
        this._udtStats.push({
          empty: 0,
          match: 0,
          nomatch: 0,
          total: 0,
          name: this._udts[i].name,
          lower: this._udts[i].lower,
          index: this._udts[i].index,
        });
      }
    }
  }

  /* increment the designated operator hit count by one */
  _incStat(stat, state) {
    stat.total += 1;
    switch (state) {
      case id.EMPTY:
        stat.empty += 1;
        break;
      case id.MATCH:
        stat.match += 1;
        break;
      case id.NOMATCH:
        stat.nomatch += 1;
        break;
      default:
        throw new Error(`${THIS_FILE}collect(): incStat(): unrecognized state: ${state}`);
    }
  }
}

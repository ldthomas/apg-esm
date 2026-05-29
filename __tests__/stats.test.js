import Stats from '../src/apg-lib/stats.js';
import id from '../src/apg-lib/identifiers.js';

// Minimal rule/udt fixtures
const rules = [
  { name: 'float', lower: 'float', index: 0 },
  { name: 'sign', lower: 'sign', index: 1 },
];
const udts = [{ name: 'u_word', lower: 'u_word', index: 0 }];

function makeStats(withUdts = false) {
  const stats = new Stats();
  stats.init(rules, withUdts ? udts : []);
  return stats;
}

describe('Stats', () => {
  test('statsObject identifier is set', () => {
    const stats = new Stats();
    expect(stats.statsObject).toBe('statsObject');
  });

  test('init does not throw with rules and no udts', () => {
    expect(() => makeStats()).not.toThrow();
  });

  test('init does not throw with rules and udts', () => {
    expect(() => makeStats(true)).not.toThrow();
  });

  describe('collect()', () => {
    test('increments total and match for a MATCH state on ALT op', () => {
      const stats = makeStats();
      stats.collect({ type: id.ALT }, { state: id.MATCH, phraseLength: 3 });
      const out = stats.displayStats();
      // ALT row should show 1 match
      expect(out).toMatch(/ALT\s*\|\s*1\s*\|\s*0\s*\|\s*0\s*\|\s*1/);
    });

    test('increments empty for EMPTY state', () => {
      const stats = makeStats();
      stats.collect({ type: id.TLS }, { state: id.EMPTY, phraseLength: 0 });
      const out = stats.displayStats();
      // TLS row should show 1 empty
      expect(out).toMatch(/TLS\s*\|\s*0\s*\|\s*1\s*\|\s*0\s*\|\s*1/);
    });

    test('increments nomatch for NOMATCH state', () => {
      const stats = makeStats();
      stats.collect({ type: id.REP }, { state: id.NOMATCH, phraseLength: 0 });
      const out = stats.displayStats();
      // REP row should show 1 nomatch
      expect(out).toMatch(/REP\s*\|\s*0\s*\|\s*0\s*\|\s*1\s*\|\s*1/);
    });

    test('increments RNM op and per-rule stat together', () => {
      const stats = makeStats();
      stats.collect({ type: id.RNM, index: 0 }, { state: id.MATCH, phraseLength: 5 });
      const out = stats.displayStats();
      // RNM operator total should be 1
      expect(out).toMatch(/RNM\s*\|\s*1\s*\|\s*0\s*\|\s*0\s*\|\s*1/);
      // displayHits should show rule 'float' with 1 hit
      const hitsOut = stats.displayHits('index');
      expect(hitsOut).toMatch(/float/);
      expect(hitsOut).toMatch(/\|\s*1\s*\|/);
    });

    test('increments UDT op and per-udt stat together', () => {
      const stats = makeStats(true);
      stats.collect({ type: id.UDT, index: 0 }, { state: id.MATCH, phraseLength: 2 });
      const out = stats.displayStats();
      expect(out).toMatch(/UDT\s*\|\s*1\s*\|\s*0\s*\|\s*0\s*\|\s*1/);
      const hitsOut = stats.displayHits('index');
      expect(hitsOut).toMatch(/u_word/);
    });

    test('throws on unrecognized state', () => {
      const stats = makeStats();
      expect(() => {
        stats.collect({ type: id.ALT }, { state: 999, phraseLength: 0 });
      }).toThrow();
    });

    test('accumulates multiple calls correctly', () => {
      const stats = makeStats();
      stats.collect({ type: id.CAT }, { state: id.MATCH, phraseLength: 1 });
      stats.collect({ type: id.CAT }, { state: id.MATCH, phraseLength: 2 });
      stats.collect({ type: id.CAT }, { state: id.NOMATCH, phraseLength: 0 });
      const out = stats.displayStats();
      // CAT: 2 match, 0 empty, 1 nomatch, 3 total
      expect(out).toMatch(/CAT\s*\|\s*2\s*\|\s*0\s*\|\s*1\s*\|\s*3/);
    });
  });

  describe('displayStats()', () => {
    test('returns a string', () => {
      const stats = makeStats();
      expect(typeof stats.displayStats()).toBe('string');
    });

    test('includes all operator labels', () => {
      const stats = makeStats();
      const out = stats.displayStats();
      for (const label of ['ALT', 'CAT', 'REP', 'RNM', 'TRG', 'TBS', 'TLS', 'UDT', 'AND', 'NOT', 'TOTAL']) {
        expect(out).toContain(label);
      }
    });

    test('shows all zeros on fresh init', () => {
      const stats = makeStats();
      const out = stats.displayStats();
      // TOTAL row should be all zeros
      expect(out).toMatch(/TOTAL\s*\|\s*0\s*\|\s*0\s*\|\s*0\s*\|\s*0/);
    });
  });

  describe('displayHits()', () => {
    test('returns a string', () => {
      const stats = makeStats();
      expect(typeof stats.displayHits()).toBe('string');
    });

    test('sorts alphabetically when type starts with "a"', () => {
      const stats = makeStats();
      stats.collect({ type: id.RNM, index: 0 }, { state: id.MATCH, phraseLength: 1 });
      stats.collect({ type: id.RNM, index: 1 }, { state: id.MATCH, phraseLength: 1 });
      const out = stats.displayHits('alpha');
      const floatPos = out.indexOf('float');
      const signPos = out.indexOf('sign');
      expect(floatPos).toBeLessThan(signPos);
    });

    test('sorts by index when type starts with "i"', () => {
      const stats = makeStats();
      stats.collect({ type: id.RNM, index: 0 }, { state: id.MATCH, phraseLength: 1 });
      stats.collect({ type: id.RNM, index: 1 }, { state: id.MATCH, phraseLength: 1 });
      const out = stats.displayHits('index');
      const floatPos = out.indexOf('float');
      const signPos = out.indexOf('sign');
      expect(floatPos).toBeLessThan(signPos);
    });

    test('sorts by hit count (descending) by default', () => {
      const stats = makeStats();
      // Give sign 2 hits, float 1 hit
      stats.collect({ type: id.RNM, index: 1 }, { state: id.MATCH, phraseLength: 1 });
      stats.collect({ type: id.RNM, index: 1 }, { state: id.MATCH, phraseLength: 1 });
      stats.collect({ type: id.RNM, index: 0 }, { state: id.MATCH, phraseLength: 1 });
      const out = stats.displayHits();
      const floatPos = out.indexOf('float');
      const signPos = out.indexOf('sign');
      // sign has more hits so it should appear first
      expect(signPos).toBeLessThan(floatPos);
    });

    test('omits rules with zero hits', () => {
      const stats = makeStats();
      stats.collect({ type: id.RNM, index: 0 }, { state: id.MATCH, phraseLength: 1 });
      const out = stats.displayHits('index');
      expect(out).toContain('float');
      expect(out).not.toContain('sign');
    });
  });
});

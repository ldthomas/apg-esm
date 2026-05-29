import Api from '../src/apg-api/api.js';
import Parser from '../src/apg-lib/parser.js';

describe('SABNF grammar scanner errors', () => {
  test('invalid characters', () => {
    const float = 'float    = \xff1*%d48-57\n';
    const api = new Api(float);
    api.scan();
    expect(api.errors.length).toBeGreaterThan(0);
    const desc = api.errorsToAscii();
    expect(/invalid character found/.test(desc)).toBe(true);
  });
  test('empty file', () => {
    const float = '';
    const api = new Api(float);
    api.scan();
    expect(api.errors.length).toBeGreaterThan(0);
    const desc = api.errorsToAscii();
    expect(/grammar file cannot be empty/.test(desc)).toBe(true);
  });
  test('strict no line end on last line', () => {
    const float = 'float = 1*%d48-57';
    const api = new Api(float);
    api.scan(true);
    expect(api.errors.length).toBeGreaterThan(0);
    const desc = api.errorsToAscii();
    const re = /no line end on last line - strict/i;
    expect(re.test(desc)).toBe(true);
  });
  test('strict with LF line end', () => {
    const float = 'float = 1*%d48-57\n';
    const api = new Api(float);
    api.scan(true);
    expect(api.errors.length).toBeGreaterThan(0);
    const desc = api.errorsToAscii();
    const re = /line end character LF[\s\S]*strict/i;
    expect(re.test(desc)).toBe(true);
  });
  test('strict with CR line end', () => {
    const float = 'float = 1*%d48-57\r';
    const api = new Api(float);
    api.scan(true);
    expect(api.errors.length).toBeGreaterThan(0);
    const desc = api.errorsToAscii();
    const re = /line end character CR[\s\S]*strict/i;
    expect(re.test(desc)).toBe(true);
  });
});
describe('api - out of sequence errors', () => {
  let float = '';
  float += 'float = ["+" / "-"] decimal\n';
  float += 'decimal = 1*%d48-57\n\n';
  test('not scanned', () => {
    try {
      const api = new Api(float);
      api.parse();
      expect(true).toBe(false);
    } catch (e) {
      const re = /grammar not scanned/i;
      expect(re.test(e.message)).toBe(true);
    }
  });
  test('api grammar not parsed', () => {
    try {
      const api = new Api(float);
      api.translate();
      expect(true).toBe(false);
    } catch (e) {
      const re = /grammar not scanned and parsed/i;
      expect(re.test(e.message)).toBe(true);
    }
  });
  test('api grammar not scanned parsed & translated', () => {
    try {
      const api = new Api(float);
      api.attributes();
      expect(true).toBe(false);
    } catch (e) {
      const re = /grammar not scanned, parsed and translated/i;
      expect(re.test(e.message)).toBe(true);
    }
  });
});
describe('grammar syntax errors', () => {
  test('empty file', () => {
    const abnf = '';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /grammar file cannot be empty/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('missing last line line end', () => {
    const abnf = 'rule = %d34';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /grammar file cannot be empty/;
    const desc = api.errorsToAscii();
    expect(/no line end on last line/.test(desc)).toBe(true);
  });
  test('strict missing last line line end', () => {
    const abnf = 'rule = %d34';
    api = new Api(abnf);
    api.generate(true);
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /no line end on last line[\s\S]*strict requires CRLF/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('missing rule name', () => {
    const abnf = '= 1*%d48-57\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /no rules defined/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('invalid line', () => {
    const abnf = 'file = A\n= 1*%d48-57\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Unrecognized SABNF line./;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('bad rule name', () => {
    const abnf = '1file = 1*%d48-57\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Rule names must be alphanum/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('no defined-as', () => {
    const abnf = 'file 1*%d48-57\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Expected '=' or '=\/'/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('AND + strict', () => {
    const abnf = 'file = &1*%d48-57\r\n';
    api = new Api(abnf);
    api.generate(true);
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /AND operator[\s\S]*strict/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('NOT + strict', () => {
    const abnf = 'file = !1*%d48-57\r\n';
    api = new Api(abnf);
    api.generate(true);
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /NOT operator[\s\S]*strict/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('UDT + strict', () => {
    const abnf = 'file = u_udt\r\n';
    api = new Api(abnf);
    api.generate(true);
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /UDT operator[\s\S]*strict/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('TAB not allowed', () => {
    const abnf = 'file = "abc\txyz"\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Tab[\s\S]*not allowed in literal string/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('literal string not closed', () => {
    const abnf = 'file = "abcxyz\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /literal string[\s\S]*not closed/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('TAB not allowed - case sensitive', () => {
    const abnf = "file = 'abc\txyz'\n";
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Tab[\s\S]*not allowed in literal string/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('case sensitive literal string not closed', () => {
    const abnf = "file = 'abcxyz\n";
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Case-sensitive literal string[\s\S]*not closed/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('case sensitive literal string - strict', () => {
    const abnf = "file = 'abcxyz'\r\n";
    api = new Api(abnf);
    api.generate(true);
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Case-sensitive string[\s\S]*strict/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('TAB not allowed in prose value', () => {
    const abnf = 'file = <abc\txyz>\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Tab[\s\S]*prose value/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('prose value not closed', () => {
    const abnf = 'file = <abcxyz\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Prose value[\s\S]*not closed/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('prose value', () => {
    const abnf = 'file = <abcxyz>\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Prose value[\s\S]*parser cannot be generated/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('group not closed', () => {
    const abnf = 'file = (a b)/(b a\na = "a"\nb = "b"\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Group[\s\S]*not closed/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('option not closed', () => {
    const abnf = 'file = [a b 1*%d48-57\na = "a"\nb = "b"\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Option[\s\S]*not closed/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('unrecognized element', () => {
    const abnf = 'file = {a b}\na = "a"\nb = "b"\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Unrecognized SABNF element/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
});
describe('grammar semantic errors', () => {
  test('rule not defined', () => {
    const abnf = 'file = a b\na = "a"\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Rule name[\s\S]*used but not defined/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('rule not defined', () => {
    const abnf = 'file = a b\na = "a"\na = "a"\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Rule name[\s\S]*previously defined/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('rule for incremental alternate not defined', () => {
    const abnf = 'file = a b\na =/ "a"\nb = "b"\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /Rule name[\s\S]*for incremental alternate not previously defined/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('REP min > max', () => {
    const abnf = 'file = a b\na = 3*2"a"\nb = "b"\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /repetition min cannot be greater than max/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('REP max = 0', () => {
    const abnf = 'file = 0"a"\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /repetition max cannot be zero/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('REP max = *0', () => {
    const abnf = 'file = *0"a"\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /repetition max cannot be zero/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('empty case-sensitive string', () => {
    const abnf = 'file = \'\' / "a"\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /case-sensitive string[\s\S]*cannot be empty/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('TRG min > max', () => {
    const abnf = 'file = a b\na = %d57-48\nb = "b"\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /TRG[\s\S]*min cannot be greater than max/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
});
describe('grammar attribute errors', () => {
  test('left recursion', () => {
    const abnf = 'S = S "y"/"x"\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /1 attribute errors/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('infinite recursion', () => {
    const abnf = 'S = "y" S\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /1 attribute errors/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
  test('cyclic', () => {
    const abnf = 'S = S\n';
    api = new Api(abnf);
    api.generate();
    expect(api.errors.length).toBeGreaterThan(0);
    const re = /1 attribute errors/;
    const desc = api.errorsToAscii();
    expect(re.test(desc)).toBe(true);
  });
});
describe('invalid objects', () => {
  let float = '';
  float += 'float = ["+" / "-"] decimal\n';
  float += 'decimal = 1*%d48-57\n';
  const api = new Api(float);
  api.generate();
  if (api.errors.length) {
    expect(true).toBe(false); // force expect error here
  }
  const grammar = api.toObject();
  const parser = new Parser(grammar);
  test('invalid trace object', () => {
    expect(() => parser.setTrace({}).toThrow('trace object not recognized'));
  });
  test('invalid traceSabnf object', () => {
    expect(() => {
      parser.setTraceSabnf({});
    }).toThrow('traceSabnf object not recognized');
  });
  test('invalid stats object', () => {
    expect(() => {
      parser.setStats({});
    }).toThrow('stats object not recognized');
  });
  test('invalid ast object', () => {
    expect(() => {
      parser.setAst({});
    }).toThrow('ast object not recognized');
  });
});

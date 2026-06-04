// Standalone verification script for the Zod parser.
// Runs 10+ example inputs and prints the resulting IR.
// Run: node scripts/verify-zod.cjs
//
// This is a self-contained CJS copy of the parseZod logic for quick
// terminal verification without needing tsc or Vite.

// ==========================================================================
// Inline copy of the parser (same logic as src/lib/parser/parseZod.ts)
// ==========================================================================

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
    if (ch === '/' && i + 1 < input.length && input[i + 1] === '/') {
      i += 2;
      while (i < input.length && input[i] !== '\n') i++;
      continue;
    }
    if ('{}[]().,:'.includes(ch)) { tokens.push({ kind: 'punct', char: ch }); i++; continue; }
    if (ch === "'" || ch === '"') {
      const quote = ch; i++;
      let value = '';
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) {
          i++;
          const esc = input[i];
          if (esc === 'n') value += '\n';
          else if (esc === 't') value += '\t';
          else if (esc === '\\') value += '\\';
          else if (esc === quote) value += quote;
          else value += esc;
        } else { value += input[i]; }
        i++;
      }
      if (i >= input.length) return { kind: 'error', message: 'Unterminated string' };
      i++;
      tokens.push({ kind: 'string', value });
      continue;
    }
    if ((ch >= '0' && ch <= '9') || (ch === '-' && i + 1 < input.length && input[i + 1] >= '0' && input[i + 1] <= '9')) {
      let numStr = '';
      if (ch === '-') { numStr += ch; i++; }
      while (i < input.length && input[i] >= '0' && input[i] <= '9') numStr += input[i++];
      if (i < input.length && input[i] === '.') { numStr += input[i++]; while (i < input.length && input[i] >= '0' && input[i] <= '9') numStr += input[i++]; }
      tokens.push({ kind: 'number', value: parseFloat(numStr) });
      continue;
    }
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
      let name = '';
      while (i < input.length && ((input[i] >= 'a' && input[i] <= 'z') || (input[i] >= 'A' && input[i] <= 'Z') || (input[i] >= '0' && input[i] <= '9') || input[i] === '_' || input[i] === '$')) name += input[i++];
      tokens.push({ kind: 'identifier', name });
      continue;
    }
    return { kind: 'error', message: `Unexpected char: "${ch}"` };
  }
  tokens.push({ kind: 'eof' });
  return { kind: 'ok', tokens };
}

class Parser {
  constructor(tokens) { this.tokens = tokens; this.pos = 0; }
  cur() { return this.tokens[this.pos] ?? { kind: 'eof' }; }
  peek(kind, value) { const t = this.cur(); if (t.kind !== kind) return false; if (value !== undefined) { if (t.kind === 'punct') return t.char === value; if (t.kind === 'identifier') return t.name === value; return false; } return true; }
  consume() { return this.tokens[this.pos++] ?? { kind: 'eof' }; }
  expect(kind, value) { if (this.peek(kind, value)) return this.consume(); return null; }
  expectPunct(char) { if (this.peek('punct', char)) { this.consume(); return true; } return false; }
  error(msg) { const t = this.cur(); const ctx = t.kind === 'eof' ? 'end of input' : t.kind === 'punct' ? `'${t.char}'` : t.kind === 'string' ? `"${t.value}"` : t.kind === 'number' ? `${t.value}` : `'${t.name}'`; throw new Error(`${msg} (near ${ctx})`); }
  peekAhead(kind, value) { if (this.pos + 1 >= this.tokens.length) return false; const t = this.tokens[this.pos + 1]; if (t.kind !== kind) return false; if (value !== undefined) { if (t.kind === 'punct') return t.char === value; return false; } return true; }

  parseSchema() { this.parseZ(); this.expectPunct('.') || this.error('Expected z.object(...)'); const m = this.expect('identifier'); if (!m || m.name !== 'object') this.error('Expected z.object(...) at top level'); return this.parseObjectContent(); }

  parseObjectContent() {
    this.expectPunct('(') || this.error('Expected "(" after z.object');
    this.expectPunct('{') || this.error('Expected "{" for object fields');
    const fields = this.parseFields();
    this.expectPunct('}') || this.error('Expected "}" after object fields');
    this.expectPunct(')') || this.error('Expected ")" to close z.object');
    while (this.expectPunct('.')) { const m = this.expect('identifier'); if (m) this.error(`Unsupported: z.object().${m.name}() in V1`); this.error('Expected method name'); }
    return { fields };
  }

  parseFields() {
    const fields = [];
    while (!this.peek('punct', '}')) {
      if (this.peek('eof')) this.error('Unexpected end of input');
      if (this.peek('punct', ',') && fields.length > 0 && this.peekAhead('punct', '}')) { this.consume(); break; }
      if (fields.length > 0 && !this.expectPunct(',')) this.error('Expected "," between fields');
      if (this.peek('punct', '}')) break;
      const kt = this.consume();
      let kn;
      if (kt.kind === 'string') kn = kt.value;
      else if (kt.kind === 'identifier') kn = kt.name;
      else this.error(`Expected field name, got ${kt.kind}`);
      this.expectPunct(':') || this.error(`Expected ":" after "${kn}"`);
      const r = this.parseFieldType();
      fields.push({ name: kn, type: r.type, optional: r.optional });
    }
    return fields;
  }

  parseFieldType() {
    let type = this.parseType();
    let optional = false;
    while (this.expectPunct('.')) {
      const mn = this.expect('identifier');
      if (!mn) this.error('Expected modifier name after "."');
      if (mn.name === 'optional') { this.expectPunct('(') || this.error('Expected "(" after .optional'); this.expectPunct(')') || this.error('Expected ")" to close .optional()'); optional = true; }
      else if (mn.name === 'nullable') { this.expectPunct('(') || this.error('Expected "(" after .nullable'); this.expectPunct(')') || this.error('Expected ")" to close .nullable()'); type = { kind: 'union', types: [type, { kind: 'null' }] }; }
      else this.error(`Unsupported modifier: .${mn.name}(). Use .optional() or .nullable().`);
    }
    return { type, optional };
  }

  parseType() {
    this.parseZ();
    this.expectPunct('.') || this.error('Expected z.methodName(...)');
    const method = this.expect('identifier');
    if (!method) this.error('Expected method name after "z."');
    switch (method.name) {
      case 'string': return this.parseCallNoArgs('string');
      case 'number': return this.parseCallNoArgs('number');
      case 'boolean': return this.parseCallNoArgs('boolean');
      case 'date': return this.parseCallNoArgs('date');
      case 'array': return this.parseArray();
      case 'enum': return this.parseEnum();
      case 'union': return this.parseUnion();
      case 'literal': return this.parseLiteral();
      case 'object': return this.parseObjectType();
      default: this.error(`Unsupported: z.${method.name}(). Supported: string, number, boolean, date, array, enum, union, literal, object`);
    }
  }

  parseZ() { const z = this.expect('identifier'); if (!z || z.name !== 'z') this.error('Expected "z" (Zod namespace)'); }
  parseCallNoArgs(kind) { this.expectPunct('(') || this.error(`Expected "(" after z.${kind}`); this.expectPunct(')') || this.error(`Expected ")" to close z.${kind}()`); return { kind }; }

  parseArray() {
    this.expectPunct('(') || this.error('Expected "(" after z.array');
    const it = this.parseType();
    this.expectPunct(')') || this.error('Expected ")" to close z.array()');
    return { kind: 'array', itemType: it };
  }

  parseEnum() {
    this.expectPunct('(') || this.error('Expected "(" after z.enum');
    this.expectPunct('[') || this.error('Expected "[" for enum values');
    const vals = [];
    while (!this.peek('punct', ']')) {
      if (this.peek('eof')) this.error('Unexpected end in enum');
      if (vals.length > 0) this.expectPunct(',') || this.error('Expected "," between enum values');
      if (this.peek('punct', ']')) break;
      const v = this.expect('string');
      if (!v) this.error('Expected string value in z.enum()');
      vals.push(v.value);
    }
    this.expectPunct(']') || this.error('Expected "]" after enum');
    this.expectPunct(')') || this.error('Expected ")" to close z.enum()');
    if (!vals.length) this.error('z.enum() needs at least 1 value');
    return { kind: 'enum', values: vals };
  }

  parseUnion() {
    this.expectPunct('(') || this.error('Expected "(" after z.union');
    this.expectPunct('[') || this.error('Expected "[" for union types');
    const types = [];
    while (!this.peek('punct', ']')) {
      if (this.peek('eof')) this.error('Unexpected end in union');
      if (types.length > 0) this.expectPunct(',') || this.error('Expected "," between union members');
      if (this.peek('punct', ']')) break;
      types.push(this.parseType());
    }
    this.expectPunct(']') || this.error('Expected "]" after union');
    this.expectPunct(')') || this.error('Expected ")" to close z.union()');
    if (!types.length) this.error('z.union() needs at least 1 type');
    const allStrLit = types.every(t => t.kind === 'literal' && typeof t.value === 'string');
    if (allStrLit) return { kind: 'enum', values: types.map(t => t.value) };
    return { kind: 'union', types };
  }

  parseLiteral() {
    this.expectPunct('(') || this.error('Expected "(" after z.literal');
    let value;
    if (this.peek('string')) value = this.consume().value;
    else if (this.peek('number')) value = this.consume().value;
    else if (this.peek('identifier')) {
      const n = this.cur().name;
      if (n === 'true') { this.consume(); value = true; }
      else if (n === 'false') { this.consume(); value = false; }
      else if (n === 'null') { this.consume(); value = 'null'; }
      else if (n === 'undefined') { this.consume(); value = 'undefined'; }
      else this.error(`Unexpected literal: "${n}"`);
    } else this.error('Expected literal value');
    this.expectPunct(')') || this.error('Expected ")" to close z.literal()');
    if (value === 'null') return { kind: 'null' };
    if (value === 'undefined') return { kind: 'undefined' };
    return { kind: 'literal', value };
  }

  parseObjectType() {
    this.expectPunct('(') || this.error('Expected "(" after z.object');
    this.expectPunct('{') || this.error('Expected "{" for nested object');
    const fields = this.parseFields();
    this.expectPunct('}') || this.error('Expected "}" after nested object');
    this.expectPunct(')') || this.error('Expected ")" to close nested z.object()');
    while (this.expectPunct('.')) { const m = this.expect('identifier'); if (m) this.error(`Unsupported: z.object().${m.name}() inside nested`); this.error('Expected method name'); }
    return { kind: 'object', fields };
  }
}

function parseZod(source) {
  if (!source.trim()) return { ok: false, error: 'No input provided.' };
  const tr = tokenize(source);
  if (tr.kind === 'error') return { ok: false, error: `Invalid input: ${tr.message}` };
  try {
    const p = new Parser(tr.tokens);
    const { fields } = p.parseSchema();
    return { ok: true, rootName: 'mockSchema', fields };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ==========================================================================
// Pretty-printing
// ==========================================================================

function fmtFlat(t) {
  if (typeof t === 'string') return t;
  switch (t.kind) {
    case 'literal': return `literal<${typeof t.value === 'string' ? `"${t.value}"` : t.value}>`;
    case 'array': return `array<${fmtFlat(t.itemType)}>`;
    case 'object': return `object{${t.fields.map(f => f.name).join(',')}}`;
    case 'union': return `union[${t.types.map(fmtFlat).join(',')}]`;
    case 'enum': return `enum<${t.values.map(v => `"${v}"`).join('|')}>`;
    default: return t.kind;
  }
}

let n = 0;
function test(label, input) {
  n++;
  const r = parseZod(input);
  const b = '─'.repeat(70);
  console.log(`\n${b}\nTest ${n}: ${label}\n${b}`);
  console.log(`Input:\n  ${input.replace(/\n/g, '\n  ')}`);
  console.log();
  if (r.ok) {
    console.log(`  rootName: "${r.rootName}"`);
    console.log(`  fields (${r.fields.length}):`);
    for (const f of r.fields) console.log(`    ${f.name}${f.optional ? '?' : ''}: ${fmtFlat(f.type)}`);
    console.log(`\n  Full IR:\n  ${JSON.stringify(r.fields, null, 4).replace(/\n/g, '\n  ')}`);
  } else {
    console.log(`  ERROR: ${r.error}`);
  }
}

// ==========================================================================
// TEST CASES
// ==========================================================================

test('01 — Flat schema', 'z.object({ name: z.string(), age: z.number(), isActive: z.boolean() })');

test('02 — Optional field', 'z.object({ title: z.string(), subtitle: z.string().optional() })');

test('03 — Nested object', 'z.object({ address: z.object({ city: z.string() }) })');

test('04 — Array of primitives', 'z.object({ tags: z.array(z.string()) })');

test('05 — Array of objects', 'z.object({ posts: z.array(z.object({ title: z.string() })) })');

test('06 — Enum', "z.object({ status: z.enum(['active', 'inactive']) })");

test('07 — Union', 'z.object({ value: z.union([z.string(), z.number()]) })');

test('08 — Literal', "z.object({ role: z.literal('admin') })");

test('09 — Date', 'z.object({ createdAt: z.date() })');

test('10 — Nullable', 'z.object({ deletedAt: z.string().nullable() })');

test("11 — Chained .optional().nullable()", 'z.object({ createdAt: z.date().optional().nullable() })');

test("12 — Unsupported: .refine()", 'z.object({ name: z.string().refine((v) => v.length > 0) })');

test("13 — Unsupported: z.object().extend()", 'z.object({ name: z.string() }).extend({ age: z.number() })');

test("14 — Empty input", '');

console.log(`\n${'─'.repeat(70)}\nAll 14 test cases complete.`);

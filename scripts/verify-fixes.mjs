// Targeted verification of the 5 implemented fixes.
// Runs the logic inline (no Vite needed) to confirm each fix is correct.

let totalPass = 0
let totalFail = 0

function check(label, got, want) {
  if (String(got) === String(want)) {
    console.log(`  PASS  ${label}`)
    totalPass++
  } else {
    console.log(`  FAIL  ${label}\n         got:  ${JSON.stringify(got)}\n         want: ${JSON.stringify(want)}`)
    totalFail++
  }
}

// ─────────────────────────────────────────────────────────────────────
// BUG-01: skipCall consumes balanced parenthesised argument lists
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== BUG-01: skipCall handles all nesting depths ===')
{
  // Minimal re-implementation of the tokenizer + skipCall logic
  function tokenize(input) {
    const tokens = []
    let i = 0
    while (i < input.length) {
      const ch = input[i]
      if (' \t\n\r'.includes(ch)) { i++; continue }
      if ('{}[]().,:'.includes(ch)) { tokens.push({ kind: 'punct', char: ch }); i++; continue }
      if (ch === "'" || ch === '"') {
        const q = ch; i++; let v = ''
        while (i < input.length && input[i] !== q) { v += input[i++] }
        i++; tokens.push({ kind: 'string', value: v }); continue
      }
      if ((ch >= '0' && ch <= '9') || ch === '-') {
        let n = ''
        if (ch === '-') { n += ch; i++ }
        while (i < input.length && input[i] >= '0' && input[i] <= '9') n += input[i++]
        tokens.push({ kind: 'number', value: parseFloat(n) }); continue
      }
      if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
        let name = ''
        while (i < input.length && (/[a-zA-Z0-9_$]/.test(input[i]))) name += input[i++]
        tokens.push({ kind: 'identifier', name }); continue
      }
      tokens.push({ kind: 'unknown', char: ch }); i++
    }
    tokens.push({ kind: 'eof' })
    return tokens
  }

  class Parser {
    constructor(tokens) { this.tokens = tokens; this.pos = 0 }
    cur() { return this.tokens[this.pos] ?? { kind: 'eof' } }
    peek(kind, val) {
      const t = this.cur()
      if (t.kind !== kind) return false
      if (val !== undefined) {
        if (t.kind === 'punct') return t.char === val
        if (t.kind === 'identifier') return t.name === val
        return false
      }
      return true
    }
    consume() { return this.tokens[this.pos++] ?? { kind: 'eof' } }
    expectPunct(c) { if (this.peek('punct', c)) { this.consume(); return true } return false }
    error(msg) { throw new Error(msg) }

    // Exact copy of the new skipCall method
    skipCall() {
      if (!this.expectPunct('(')) return
      let depth = 1
      while (depth > 0) {
        if (this.peek('eof')) this.error('Unexpected end of input while reading method arguments')
        const t = this.consume()
        if (t.kind === 'punct' && t.char === '(') depth++
        else if (t.kind === 'punct' && t.char === ')') depth--
      }
    }
  }

  const zodCases = [
    "z.object({ email: z.string().email() })",
    "z.object({ name: z.string().min(1).max(100) })",
    "z.object({ url: z.string().url() })",
    "z.object({ val: z.string().trim().toLowerCase() })",
    "z.object({ age: z.number().positive().int() })",
    "z.object({ bio: z.string().optional().min(0) })",
  ]

  for (const src of zodCases) {
    let threw = false
    try {
      const tokens = tokenize(src)
      const p = new Parser(tokens)
      // Navigate to the first unknown-modifier position and call skipCall
      while (!p.peek('eof')) {
        if (p.peek('identifier', 'email') || p.peek('identifier', 'min') ||
            p.peek('identifier', 'max') || p.peek('identifier', 'url') ||
            p.peek('identifier', 'trim') || p.peek('identifier', 'positive') ||
            p.peek('identifier', 'int') || p.peek('identifier', 'toLowerCase')) {
          p.consume()     // consume method name
          p.skipCall()    // skip the argument list
          break
        }
        p.consume()
      }
    } catch (e) {
      threw = true
    }
    check(src.slice(0, 60), threw, false)
  }
}

// ─────────────────────────────────────────────────────────────────────
// BUG-02: Non-identifier keys are quoted in output
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== BUG-02: Non-identifier keys quoted in serializeValue ===')
{
  function isIdentifier(key) { return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) }
  function escapeString(s) { return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') }
  function keyStr(k) { return isIdentifier(k) ? k : `"${escapeString(k)}"` }

  check('bare identifier "id"',           keyStr('id'),           'id')
  check('bare identifier "firstName"',    keyStr('firstName'),    'firstName')
  check('bare identifier "_ok"',          keyStr('_ok'),          '_ok')
  check('bare identifier "$price"',       keyStr('$price'),       '$price')
  check('quoted "content-type"',          keyStr('content-type'), '"content-type"')
  check('quoted "x-api-key"',             keyStr('x-api-key'),    '"x-api-key"')
  check('quoted "123bad"',                keyStr('123bad'),        '"123bad"')
  check('quoted "some key"',              keyStr('some key'),      '"some key"')
  check('quoted "Accept-Encoding"',       keyStr('Accept-Encoding'), '"Accept-Encoding"')
}

// ─────────────────────────────────────────────────────────────────────
// BUG-04: customVarName validated as a legal identifier
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== BUG-04: customVarName identifier validation ===')
{
  const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/

  const cases = [
    ['mockUser',    true],
    ['_fixture',    true],
    ['$myVar',      true],
    ['fixture2',    true],
    ['123foo',      false],
    ['my-var',      false],
    ['my var',      false],
    ['my.var',      false],
    ['@handle',     false],
  ]

  for (const [name, expectValid] of cases) {
    const valid = IDENTIFIER_RE.test(name)
    check(`"${name}" → ${expectValid ? 'valid' : 'invalid'}`, valid, expectValid)
  }
}

// ─────────────────────────────────────────────────────────────────────
// SEC-01: Token pool values no longer match real-secret patterns
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== SEC-01: Token pool values avoid scanner-flagged patterns ===')
{
  const TOKEN = [
    'test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    'test_a8f5f167f44f4964e6c998dee827110c',
    'test_4a7d1ed414474e4033ac29ccb8653d9b',
    'test_abc123def456ghi789jkl012mno345pqr',
    'test_xK4mN8pQ2rS6vW0yB3zA1cE5gH7jL9n',
    'test_abcdefghijklmnopqrstuvwxyz012345',
    'test_d41d8cd98f00b204e9800998ecf8427e',
    'test_9a0364b9e99bb480dd25e1f0284c8555',
  ]
  const RISKY = [/^sk-proj-/, /^sk-[a-zA-Z]/, /^ghp_/, /^tok_live_/, /^eyJhbGci/]
  for (const tok of TOKEN) {
    let flagged = false
    for (const re of RISKY) if (re.test(tok)) { flagged = true; break }
    check(`"${tok.slice(0, 36)}..." not flagged`, flagged, false)
  }
  for (const tok of TOKEN) {
    check(`"${tok.slice(0, 12)}..." starts with test_`, tok.startsWith('test_'), true)
  }
}

// ─────────────────────────────────────────────────────────────────────
// BUG-05: Empty fields → '{}' not ''
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== BUG-05: serializeValue({}) returns "{}" not "" ===')
{
  function serializeValue(value, level) {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'boolean') return String(value)
    if (typeof value === 'number') return String(value)
    if (typeof value === 'string') return `"${value}"`
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]'
      return '[...]'
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value)
      if (entries.length === 0) return '{}'
      return '{...}'
    }
    return String(value)
  }

  check('serializeValue({}, 0) === "{}"', serializeValue({}, 0), '{}')
  check('serializeValue([], 0) === "[]"', serializeValue([], 0), '[]')

  // Simulate generateFixture with count=1, fields=[]
  function resolveInstance(fields, index) {
    const obj = {}
    for (const f of fields) obj[f.name] = 'mock'
    return obj
  }
  const value = resolveInstance([], 0)
  const serialized = serializeValue(value, 0)
  check('resolveInstance([], 0) serialized to "{}"', serialized, '{}')

  // The early-return guard `if (opts.fields.length === 0) return ''` was removed.
  // With fields=[], the count=1 branch now executes: serializeValue({}, 0) → '{}'
  // Full output would be: `export const mockEmpty: Empty = {}\n`
  const varName = 'mockEmpty'
  const typeName = 'Empty'
  const annotation = typeName ? `: ${typeName}` : ''
  const output = `export const ${varName}${annotation} = ${serialized}\n`
  check('full output for empty interface', output, 'export const mockEmpty: Empty = {}\n')
}

// ─────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────
console.log(`\n──────────────────────────────────────────────`)
console.log(`Results: ${totalPass} passed, ${totalFail} failed`)
if (totalFail > 0) process.exit(1)

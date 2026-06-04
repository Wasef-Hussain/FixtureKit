// Standalone verification script for the generator layer.
// Runs the full pipeline: inline IR → inferValue → generateFixture.
// No bundler needed. Uses the same typescript package already installed.
//
// Run: node scripts/verify-generator.cjs

const ts = require('typescript')

// ---------------------------------------------------------------------------
// Inline inferValue logic (same as src/lib/inference/*)
// ---------------------------------------------------------------------------

// -- valueBank (subset needed for tests) --
function hashStr(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}
function pickFromPool(pool, seed) { return pool[seed % pool.length] }

const VALUE_BANK = {
  ID: ['f47ac10b-58cc-4372-a567-0e02b2c3d479','550e8400-e29b-41d4-a716-446655440000','6ba7b810-9dad-11d1-80b4-00c04fd430c8','a97c7b3e-d3f8-4a5c-9b1e-2f3c4d5e6f7a'],
  PERSON_NAME: ['Alice Johnson','Bob Smith','Carol Williams','David Brown','Eva Martinez'],
  FIRST_NAME: ['Alice','Bob','Carol','David','Eva'],
  LAST_NAME: ['Johnson','Smith','Williams','Brown','Martinez'],
  EMAIL: ['alice.johnson@example.com','bob.smith@company.com','carol.williams@test.org','david.brown@example.net'],
  PHONE: ['+1 (555) 234-5678','+1 (555) 345-6789','+1 (555) 456-7890'],
  URL: ['https://example.com','https://www.company.com','https://sample.io'],
  IMAGE_URL: ['https://example.com/images/avatar.jpg','https://example.com/images/photo-1.jpg'],
  DATE: ['2024-03-15T10:30:00.000Z','2024-06-22T14:45:00.000Z','2024-01-10T08:00:00.000Z'],
  DATE_ONLY: ['1990-06-25','1985-03-12','1992-11-08'],
  PRICE: [29.99, 14.99, 49.99, 9.99, 99.99],
  QUANTITY: [1, 3, 5, 10, 2],
  AGE: [28, 34, 22, 45, 31],
  STATUS: ['active','pending','completed','published'],
  DESCRIPTION: ['A brief description of the item.','This is a sample description.','An example description.'],
  TITLE: ['Getting Started with TypeScript','Introduction to Modern Web Development'],
  SLUG: ['alice-johnson','getting-started','my-first-post'],
  COMPANY: ['Acme Corp','TechFlow Inc','DataSync Ltd'],
  JOB_TITLE: ['Software Engineer','Product Manager','UX Designer'],
  ADDRESS: ['123 Main St','456 Oak Avenue','789 Pine Road'],
  CITY: ['New York','San Francisco','Chicago'],
  COUNTRY: ['United States','United Kingdom','Canada'],
  ZIP: ['10001','94105','60601'],
  LOCALE: ['en-US','en-GB','fr-FR'],
  CURRENCY: ['USD','EUR','GBP'],
  COLOR: ['#3B82F6','#EF4444','#10B981'],
  BOOLEAN_POSITIVE: [true],
  BOOLEAN_NEGATIVE: [false],
  VERSION: ['1.0.0','2.3.1','0.9.4'],
  TOKEN: ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9','a8f5f167f44f4964e6c998dee827110c'],
  IP: ['192.168.1.1','10.0.0.1','172.16.0.1'],
}

// -- semanticMap (minimal needed for tests) --
const EXACT_MATCH = {
  id:'ID',uuid:'ID',name:'PERSON_NAME',fullname:'PERSON_NAME',
  firstname:'FIRST_NAME',lastname:'LAST_NAME',email:'EMAIL',emailaddress:'EMAIL',
  phone:'PHONE',url:'URL',imageurl:'IMAGE_URL',avatarurl:'IMAGE_URL',
  createdat:'DATE',updatedat:'DATE',timestamp:'DATE',birthdate:'DATE_ONLY',
  price:'PRICE',cost:'PRICE',amount:'PRICE',total:'PRICE',
  count:'QUANTITY',quantity:'QUANTITY',age:'AGE',status:'STATUS',state:'STATUS',
  description:'DESCRIPTION',bio:'DESCRIPTION',summary:'DESCRIPTION',
  title:'TITLE',slug:'SLUG',username:'SLUG',company:'COMPANY',
  role:'JOB_TITLE',jobtitle:'JOB_TITLE',address:'ADDRESS',city:'CITY',
  country:'COUNTRY',zip:'ZIP',postal:'ZIP',locale:'LOCALE',currency:'CURRENCY',
  color:'COLOR',colour:'COLOR',isactive:'BOOLEAN_POSITIVE',isenabled:'BOOLEAN_POSITIVE',
  isverified:'BOOLEAN_POSITIVE',ispublished:'BOOLEAN_POSITIVE',
  isdeleted:'BOOLEAN_NEGATIVE',isdisabled:'BOOLEAN_NEGATIVE',
  version:'VERSION',token:'TOKEN',accesstoken:'TOKEN',ip:'IP',ipaddress:'IP',
}

function normalizeExact(n) { return n.replace(/[_\-. ]/g,'').toLowerCase() }

function getSemanticCategory(fieldName) {
  return EXACT_MATCH[normalizeExact(fieldName)] || null
}

const NUMERIC_CATS = new Set(['PRICE','QUANTITY','AGE'])
const BOOLEAN_CATS = new Set(['BOOLEAN_POSITIVE','BOOLEAN_NEGATIVE'])

function effectiveKind(type) {
  if (type.kind !== 'union') return type.kind
  const nonnull = type.types.find(t => t.kind !== 'null' && t.kind !== 'undefined')
  return nonnull ? nonnull.kind : type.types[0].kind
}

function isCatCompat(cat, type) {
  const k = effectiveKind(type)
  if (k === 'boolean') return BOOLEAN_CATS.has(cat)
  if (k === 'number') return NUMERIC_CATS.has(cat)
  return !NUMERIC_CATS.has(cat) && !BOOLEAN_CATS.has(cat)
}

const MAX_DEPTH = 5

function inferValue(field, index, depth = 0) {
  if (depth >= MAX_DEPTH) return typeBasedValue(field.type, field.name, index, depth)
  const cat = getSemanticCategory(field.name)
  if (cat && isCatCompat(cat, field.type)) {
    const pool = VALUE_BANK[cat]
    return pickFromPool(pool, hashStr(field.name) + index)
  }
  return typeBasedValue(field.type, field.name, index, depth)
}

function typeBasedValue(type, fieldName, index, depth) {
  switch (type.kind) {
    case 'string': return 'value'
    case 'number': return index + 1
    case 'boolean': return true
    case 'date': return '2024-03-15T10:30:00.000Z'
    case 'null': return null
    case 'undefined': return undefined
    case 'unknown': return {}
    case 'literal': return type.value
    case 'enum': return type.values[0]
    case 'union': {
      const p = type.types.find(t => t.kind !== 'null' && t.kind !== 'undefined')
      return typeBasedValue(p || type.types[0], fieldName, index, depth)
    }
    case 'array': {
      if (depth >= MAX_DEPTH) return []
      return [0,1].map(i => inferValue({ name: fieldName, type: type.itemType, optional: false }, index+i, depth+1))
    }
    case 'object': {
      if (depth >= MAX_DEPTH) return {}
      const obj = {}
      for (const f of type.fields) obj[f.name] = inferValue(f, index, depth+1)
      return obj
    }
  }
}

// ---------------------------------------------------------------------------
// Inline generator logic (same as src/lib/generator/generateFixture.ts)
// ---------------------------------------------------------------------------

function ind(level) { return '  '.repeat(level) }
function pluralize(name) { return name.endsWith('s') ? name : name + 's' }
function escapeStr(s) {
  return s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t')
}

function serializeValue(value, level) {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return `"${escapeStr(value)}"`
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    const lines = value.map(item => `${ind(level+1)}${serializeValue(item, level+1)}`)
    return `[\n${lines.join(',\n')},\n${ind(level)}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (!entries.length) return '{}'
    const lines = entries.map(([k,v]) => `${ind(level+1)}${k}: ${serializeValue(v, level+1)}`)
    return `{\n${lines.join(',\n')},\n${ind(level)}}`
  }
  return String(value)
}

function resolveInstance(fields, index) {
  const obj = {}
  for (const f of fields) obj[f.name] = inferValue(f, index)
  return obj
}

function generateFixture({ varName, typeName, fields, count }) {
  count = Math.max(1, Math.min(5, Math.round(count)))
  if (!fields.length) return ''
  if (count === 1) {
    const v = resolveInstance(fields, 0)
    const ann = typeName ? `: ${typeName}` : ''
    return `export const ${varName}${ann} = ${serializeValue(v, 0)}\n`
  }
  const vn = pluralize(varName)
  const ann = typeName ? `: ${typeName}[]` : ''
  const items = Array.from({ length: count }, (_, i) => `${ind(1)}${serializeValue(resolveInstance(fields, i), 1)}`)
  return `export const ${vn}${ann} = [\n${items.join(',\n')},\n]\n`
}

// ---------------------------------------------------------------------------
// Inline parseTypeScript (using real ts compiler API)
// ---------------------------------------------------------------------------

function deriveVarName(n) { return 'mock' + n.charAt(0).toUpperCase() + n.slice(1) }

function resolveType(node) {
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword: return { kind: 'string' }
    case ts.SyntaxKind.NumberKeyword: return { kind: 'number' }
    case ts.SyntaxKind.BooleanKeyword: return { kind: 'boolean' }
    case ts.SyntaxKind.NullKeyword: return { kind: 'null' }
    case ts.SyntaxKind.UndefinedKeyword: return { kind: 'undefined' }
    case ts.SyntaxKind.UnknownKeyword: return { kind: 'unknown' }
    case ts.SyntaxKind.ArrayType: return { kind: 'array', itemType: resolveType(node.elementType) }
    case ts.SyntaxKind.TypeReference: {
      let name = ts.isIdentifier(node.typeName) ? node.typeName.text : ''
      if (name === 'Date') return { kind: 'date' }
      if ((name === 'Array' || name === 'ReadonlyArray') && node.typeArguments?.length === 1)
        return { kind: 'array', itemType: resolveType(node.typeArguments[0]) }
      return { kind: 'unknown' }
    }
    case ts.SyntaxKind.TypeLiteral: {
      const fields = node.members.map(m => resolveProp(m)).filter(Boolean)
      return { kind: 'object', fields }
    }
    case ts.SyntaxKind.UnionType: {
      const types = node.types.map(t => resolveType(t))
      const allStrLit = types.every(t => typeof t === 'object' && t.kind === 'literal' && typeof t.value === 'string')
      if (allStrLit) return { kind: 'enum', values: types.map(t => t.value) }
      return { kind: 'union', types }
    }
    case ts.SyntaxKind.LiteralType: {
      const lit = node.literal
      if (ts.isStringLiteral(lit)) return { kind: 'literal', value: lit.text }
      if (ts.isNumericLiteral(lit)) return { kind: 'literal', value: Number(lit.text) }
      if (lit.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'literal', value: true }
      if (lit.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'literal', value: false }
      if (lit.kind === ts.SyntaxKind.NullKeyword) return { kind: 'null' }
      if (lit.kind === ts.SyntaxKind.UndefinedKeyword) return { kind: 'undefined' }
      return { kind: 'unknown' }
    }
    case ts.SyntaxKind.ParenthesizedType: return resolveType(node.type)
    default: return { kind: 'unknown' }
  }
}
function resolveProp(node) {
  if (!ts.isPropertySignature(node) || !node.type) return null
  const name = ts.isIdentifier(node.name) ? node.name.text : ts.isStringLiteral(node.name) ? node.name.text : 'unknownKey'
  return { name, type: resolveType(node.type), optional: !!node.questionToken }
}
function parseTS(source) {
  const sf = ts.createSourceFile('i.ts', source, ts.ScriptTarget.Latest, true)
  for (const stmt of sf.statements) {
    if (ts.isInterfaceDeclaration(stmt)) {
      if (stmt.typeParameters?.length) return { ok: false, error: 'Generics not supported' }
      if (stmt.heritageClauses?.length) return { ok: false, error: 'extends not supported' }
      return { ok: true, rootName: deriveVarName(stmt.name.text), origName: stmt.name.text, fields: stmt.members.map(m => resolveProp(m)).filter(Boolean) }
    }
    if (ts.isTypeAliasDeclaration(stmt)) {
      const t = ts.isParenthesizedTypeNode(stmt.type) ? stmt.type.type : stmt.type
      if (!ts.isTypeLiteralNode(t)) return { ok: false, error: 'Type alias must be object shape' }
      return { ok: true, rootName: deriveVarName(stmt.name.text), origName: stmt.name.text, fields: t.members.map(m => resolveProp(m)).filter(Boolean) }
    }
  }
  return { ok: false, error: 'No interface found' }
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let n = 0
function test(label, source, opts = {}) {
  n++
  const b = '─'.repeat(68)
  const r = parseTS(source)
  console.log(`\n${b}\nTest ${n}: ${label}\n${b}`)
  console.log(`Input: ${source.replace(/\n/g,'\\n')}`)
  if (!r.ok) { console.log(`PARSE ERROR: ${r.error}`); return }
  const { count = 1, overrideVarName } = opts
  const varName = overrideVarName || r.rootName
  const typeName = r.origName
  const result = generateFixture({ varName, typeName, fields: r.fields, count })
  console.log(`\nGenerated (count=${count}):\n`)
  console.log(result)
}

function testZod(label, fields, opts = {}) {
  n++
  const b = '─'.repeat(68)
  const { count = 1, varName = 'mockSchema' } = opts
  console.log(`\n${b}\nTest ${n}: ${label}\n${b}`)
  const result = generateFixture({ varName, fields, count })
  console.log(`Generated (count=${count}):\n`)
  console.log(result)
}

// ==========================================================================
// TEST CASES (plan Section 12 — Generator Output cases)
// ==========================================================================

test('Single fixture — User',
  'interface User { id: string; name: string; email: string; age: number; isActive: boolean; }')

test('Count = 3 — User array',
  'interface User { id: string; name: string; email: string; }',
  { count: 3 })

test('Custom var name override',
  'interface User { name: string; email: string; }',
  { count: 1, overrideVarName: 'myUser' })

test('Nested object — Order',
  'interface Order { id: string; user: { id: string; email: string }; total: number; createdAt: Date; }')

test('Array of primitives — Tag',
  'interface Tag { id: string; values: string[] }')

test('Optional fields',
  'interface Post { title: string; subtitle?: string; slug: string; publishedAt: Date; }')

test('String literal union / enum',
  "type Status = { value: 'active' | 'inactive' | 'pending' }")

test('null union — Date | null',
  'interface Item { id: string; deletedAt: Date | null }')

test('Count = 5 — small schema',
  'interface Ping { id: string; status: string }',
  { count: 5 })

// Zod IR (hand-built fields, no parser needed)
testZod('Zod schema (flat, no typeName)',
  [
    { name: 'name', type: { kind: 'string' }, optional: false },
    { name: 'email', type: { kind: 'string' }, optional: false },
    { name: 'age', type: { kind: 'number' }, optional: false },
  ],
  { varName: 'mockSchema' })

testZod('Zod nested array of objects',
  [
    { name: 'title', type: { kind: 'string' }, optional: false },
    {
      name: 'posts',
      type: {
        kind: 'array',
        itemType: {
          kind: 'object',
          fields: [
            { name: 'id', type: { kind: 'string' }, optional: false },
            { name: 'title', type: { kind: 'string' }, optional: false },
          ],
        },
      },
      optional: false,
    },
  ],
  { varName: 'mockBlog', count: 2 })

console.log(`\n${'─'.repeat(68)}\nAll ${n} tests complete.`)

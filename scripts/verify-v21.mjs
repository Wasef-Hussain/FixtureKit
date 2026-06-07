// V2.1 logic smoke test — imports real source modules via tsx.
// Run: npx tsx scripts/verify-v21.mjs

import { generateFixture } from '../src/lib/generator/generateFixture.ts'

const FIELDS = [
  { name: 'id', type: { kind: 'string' }, optional: false },
  { name: 'name', type: { kind: 'string' }, optional: false },
  { name: 'email', type: { kind: 'string' }, optional: false },
  { name: 'subtitle', type: { kind: 'string' }, optional: true },
  { name: 'age', type: { kind: 'number' }, optional: false },
]

let passed = 0
let failed = 0

function assert(label, cond, detail = '') {
  if (cond) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

// --- Happy path ---
console.log('\n── Happy path (isAdversarial: false) ──')
const happy = generateFixture({ varName: 'mockUser', typeName: 'User', fields: FIELDS, count: 1 })
assert('returns FixtureOutput object', typeof happy === 'object' && happy !== null)
assert('has ts key', typeof happy.ts === 'string' && happy.ts.includes('export const mockUser'))
assert('has json key', typeof happy.json === 'string')
assert('json is valid JSON', (() => { JSON.parse(happy.json); return true })())
assert('has msw key', happy.msw.includes("import { http, HttpResponse } from 'msw'"))
assert('msw wraps data', happy.msw.includes('HttpResponse.json'))
assert('has playwright key', happy.playwright.includes("page.route('**/api/endpoint'"))
assert('playwright wraps JSON.stringify', happy.playwright.includes('JSON.stringify'))

const happy2 = generateFixture({ varName: 'mockUser', typeName: 'User', fields: FIELDS, count: 1 })
assert('deterministic: same input → same ts', happy.ts === happy2.ts)

// --- Adversarial ---
console.log('\n── Adversarial (isAdversarial: true) ──')
const adv = generateFixture({ varName: 'mockUser', fields: FIELDS, count: 1, isAdversarial: true })
const advData = JSON.parse(adv.json)
const advValues = Object.values(advData).flatMap(v => (typeof v === 'string' || typeof v === 'number' ? [v] : []))
const XSS = ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', 'javascript:alert(1)']
const SQLI = ["' OR 1=1--", "'; DROP TABLE users;--"]
const hasAdvString = advValues.some(v => XSS.includes(v) || SQLI.includes(v) || (typeof v === 'string' && v.length >= 5000))
const hasAdvNumber = advValues.some(v => v === 0 || v === -1 || v === Number.MAX_SAFE_INTEGER)
assert('adversarial injects boundary/xss/sqli values', hasAdvString || hasAdvNumber, `values: ${JSON.stringify(advValues)}`)

assert('adversarial differs from happy path', adv.json !== happy.json)
assert('adversarial is deterministic', adv.json === generateFixture({ varName: 'mockUser', fields: FIELDS, count: 1, isAdversarial: true }).json)

// --- Multi-count array ---
console.log('\n── Multi-count (count: 3) ──')
const multi = generateFixture({ varName: 'mockUser', typeName: 'User', fields: FIELDS, count: 3 })
assert('ts uses plural var name', multi.ts.includes('export const mockUsers'))
assert('json is array of 3', (() => { const a = JSON.parse(multi.json); return Array.isArray(a) && a.length === 3 })())
assert('msw embeds array', multi.msw.includes('HttpResponse.json'))

console.log(`\n${'─'.repeat(40)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

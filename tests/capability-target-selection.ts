import assert from 'assert'
import { parseTypeScript } from '../src/lib/parser/parseTypeScript.ts'

console.log('── Testing Target Selection & Top-Level Pick/Omit ──')

const testCases = [
  {
    name: 'Top-Level Pick (Relies on last-type resolution)',
    input: `
      interface User { id: string; email: string; }
      type UserPreview = Pick<User, "id">
    `,
    expectedRootName: 'mockUserPreview',
    expectedFields: ['id']
  },
  {
    name: 'Top-Level Omit',
    input: `
      interface User { id: string; email: string; }
      type PublicUser = Omit<User, "email">
    `,
    expectedRootName: 'mockPublicUser',
    expectedFields: ['id']
  },
  {
    name: 'Export Default Interface (Priority 1)',
    input: `
      interface A { a: string }
      export default interface B { b: string }
      interface C { c: string }
    `,
    expectedRootName: 'mockB',
    expectedFields: ['b']
  },
  {
    name: 'Exported Type Alias (Priority 2)',
    input: `
      interface A { a: string }
      export type B = { b: string }
      interface C { c: string }
    `,
    expectedRootName: 'mockB',
    expectedFields: ['b']
  },
  {
    name: 'Exported Interface (Priority 3)',
    input: `
      type A = { a: string }
      export interface B { b: string }
      type C = { c: string }
    `,
    expectedRootName: 'mockB',
    expectedFields: ['b']
  },
  {
    name: 'Last Type Alias over First (Priority 4)',
    input: `
      type A = { a: string }
      type B = { b: string }
    `,
    expectedRootName: 'mockB',
    expectedFields: ['b']
  },
  {
    name: 'Last Interface over First (Priority 5)',
    input: `
      interface A { a: string }
      interface B { b: string }
    `,
    expectedRootName: 'mockB',
    expectedFields: ['b']
  }
]

let passed = 0

for (const tc of testCases) {
  const parsed = parseTypeScript(tc.input)
  
  if (!parsed.ok) {
    console.error(`❌ ${tc.name} failed parsing: ${parsed.error}`)
    continue
  }
  
  if (parsed.rootName !== tc.expectedRootName) {
    console.error(`❌ ${tc.name} chose wrong target. Expected: ${tc.expectedRootName}, Got: ${parsed.rootName}`)
    continue
  }
  
  const fieldNames = parsed.fields.map(f => f.name)
  const fieldsMatch = tc.expectedFields.every(f => fieldNames.includes(f)) && fieldNames.length === tc.expectedFields.length
  
  if (fieldsMatch) {
    console.log(`✅ ${tc.name} selected ${parsed.rootName} with exact expected fields.`)
    passed++
  } else {
    console.error(`❌ ${tc.name} extracted wrong fields. Expected: ${tc.expectedFields}, Got: ${fieldNames}`)
  }
}

if (passed === testCases.length) {
  console.log('\\nAll Target Selection tests passed!')
} else {
  process.exit(1)
}

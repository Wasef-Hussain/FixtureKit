import assert from 'assert'
import { parseTypeScript } from '../src/lib/parser/parseTypeScript.ts'
import { inferValue } from '../src/lib/inference/inferValue.ts'

console.log('── Testing String Literal Unions ──')

const testCases = [
  {
    name: 'Nested Literal Union',
    input: 'interface User { role: "admin" | "customer" }',
    expectedRootName: 'mockUser',
    verify: (parsed: any) => {
      assert.strictEqual(parsed.fields.length, 1)
      assert.strictEqual(parsed.fields[0].name, 'role')
      assert.strictEqual(parsed.fields[0].type.kind, 'enum')
      assert.deepStrictEqual(parsed.fields[0].type.values, ['admin', 'customer'])
      
      const val = inferValue(parsed.fields[0], 0)
      assert.strictEqual(val, 'admin') // Deterministically chooses first
    }
  },
  {
    name: 'Top-Level Literal Union',
    input: 'type Role = "admin" | "customer" | "guest"',
    expectedRootName: 'mockRole',
    verify: (parsed: any) => {
      assert.strictEqual(parsed.fields.length, 1)
      assert.strictEqual(parsed.fields[0].name, 'role') // lowercase type name
      assert.strictEqual(parsed.fields[0].type.kind, 'enum')
      assert.deepStrictEqual(parsed.fields[0].type.values, ['admin', 'customer', 'guest'])
      
      const val = inferValue(parsed.fields[0], 0)
      assert.strictEqual(val, 'admin')
    }
  },
  {
    name: 'Mixed Union (Should fail gracefully)',
    input: 'type Role = "admin" | 42',
    expectError: 'Could not find a TypeScript interface or object-shaped type alias.'
  }
]

let passed = 0

for (const tc of testCases) {
  const parsed = parseTypeScript(tc.input)
  
  if (tc.expectError) {
    if (!parsed.ok && parsed.error.includes(tc.expectError)) {
      console.log(`✅ ${tc.name} failed gracefully: ${parsed.error}`)
      passed++
    } else {
      console.error(`❌ ${tc.name} did not fail gracefully: ${JSON.stringify(parsed)}`)
    }
    continue
  }
  
  if (!parsed.ok) {
    console.error(`❌ ${tc.name} failed parsing: ${parsed.error}`)
    continue
  }
  
  if (parsed.rootName !== tc.expectedRootName) {
    console.error(`❌ ${tc.name} chose wrong target. Expected: ${tc.expectedRootName}, Got: ${parsed.rootName}`)
    continue
  }
  
  try {
    tc.verify(parsed)
    console.log(`✅ ${tc.name} generated successfully.`)
    passed++
  } catch (e) {
    console.error(`❌ ${tc.name} failed verification: ${e instanceof Error ? e.message : String(e)}`)
  }
}

if (passed === testCases.length) {
  console.log('\\nAll Literal Union tests passed!')
} else {
  process.exit(1)
}

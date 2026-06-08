import assert from 'assert'
import { parseTypeScript } from '../src/lib/parser/parseTypeScript.ts'
import { generateFixture } from '../src/lib/generator/generateFixture.ts'

console.log('── Testing Regression Utility Types ──')

const testCases = [
  {
    name: 'Partial<User>',
    input: `
      type MockUser = Partial<User>
      interface User { id: string; email: string }
    `,
    expectedOptionalCount: 2
  },
  {
    name: 'Readonly<User>',
    input: `
      type MockUser = Readonly<User>
      interface User { id: string; email: string }
    `,
    expectedOptionalCount: 0
  },
  {
    name: 'Required<User>',
    input: `
      type MockUser = Required<User>
      interface User { id?: string; email?: string }
    `,
    expectedOptionalCount: 0
  }
]

let passed = 0

for (const tc of testCases) {
  const parsed = parseTypeScript(tc.input)
  
  if (!parsed.ok) {
    console.error(`❌ ${tc.name} failed parsing: ${parsed.error}`)
    continue
  }
  
  const optionalCount = parsed.fields.filter(f => f.optional).length
  if (optionalCount === tc.expectedOptionalCount) {
    console.log(`✅ ${tc.name} generated successfully with correct optional fields.`)
    passed++
  } else {
    console.error(`❌ ${tc.name} failed! Expected ${tc.expectedOptionalCount} optional fields, got ${optionalCount}`)
  }
}

if (passed === testCases.length) {
  console.log('\\nAll Utility Regression tests passed!')
} else {
  process.exit(1)
}

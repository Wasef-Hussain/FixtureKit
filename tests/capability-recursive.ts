import assert from 'assert'
import { parseTypeScript } from '../src/lib/parser/parseTypeScript.ts'

console.log('── Testing Recursive Types ──')

const testCases = [
  {
    name: 'Direct Recursion',
    input: `
      type Recursive = {
        child?: Recursive
      }
    `,
    expectedError: 'Recursive types are not supported.'
  },
  {
    name: 'Indirect Recursion',
    input: `
      interface A { b: B }
      interface B { a: A }
    `,
    expectedError: 'Recursive types are not supported.'
  }
]

let passed = 0

for (const tc of testCases) {
  const parsed = parseTypeScript(tc.input)
  
  if (!parsed.ok) {
    if (parsed.error && parsed.error.includes('Recursive types are not supported')) {
      console.log(`✅ ${tc.name} correctly blocked: ${parsed.error}`)
      passed++
    } else {
      console.error(`❌ ${tc.name} failed with wrong error: ${parsed.error}`)
    }
  } else {
    console.error(`❌ ${tc.name} did not throw recursive error! It parsed as: ${JSON.stringify(parsed)}`)
  }
}

if (passed === testCases.length) {
  console.log('\\nAll Recursive tests passed!')
} else {
  process.exit(1)
}

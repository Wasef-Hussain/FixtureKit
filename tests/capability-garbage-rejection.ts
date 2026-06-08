import { parseTypeScript } from '../src/lib/parser/parseTypeScript.ts'
import assert from 'assert'

console.log('── Running Garbage Rejection Suite ──')

const testCases = [
  {
    name: 'Invalid/Malformed TS',
    input: `
      export interface User {
        id: string
        email string // missing colon
      }
    `,
    expectErrorPrefix: 'Parse error:'
  },
  {
    name: 'Unsupported Generics',
    input: `
      export interface Pagination<T> {
        data: T[]
        total: number
      }
    `,
    expectErrorPrefix: 'Unsupported: generics are not yet supported'
  },
  {
    name: 'Unsupported Conditional Types',
    input: `
      type IsString<T> = T extends string ? true : false
      export interface User {
        isString: IsString<string>
      }
    `,
    expectErrorPrefix: 'Unsupported: generics are not yet supported'
  },
  {
    name: 'Classes (Not allowed)',
    input: `
      export class User {
        id: string
        email: string
      }
    `,
    expectErrorPrefix: 'Unsupported: classes are not supported.'
  },
  {
    name: 'Functions (Not allowed)',
    input: `
      export function getUser() { return { id: 1 } }
    `,
    expectErrorPrefix: 'Unsupported: functions are not supported.'
  }
]

let passed = 0

for (const tc of testCases) {
  const result = parseTypeScript(tc.input)
  if (result.ok) {
    console.error(`❌ ${tc.name} failed! It successfully parsed garbage!`)
    continue
  }

  if (result.error.startsWith(tc.expectErrorPrefix)) {
    console.log(`✅ ${tc.name} rejected gracefully: ${result.error}`)
    passed++
  } else {
    console.error(`❌ ${tc.name} failed! Expected error starting with "${tc.expectErrorPrefix}", got: "${result.error}"`)
  }
}

if (passed === testCases.length) {
  console.log('\\nAll garbage rejection tests passed!')
} else {
  process.exit(1)
}

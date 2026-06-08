import { parseTypeScript } from '../src/lib/parser/parseTypeScript.ts'
import { generateFixture } from '../src/lib/generator/generateFixture.ts'

const TEST_CASES = [
  { name: 'Recursive', source: `type Recursive = { child?: Recursive }` },
  { name: 'Generics', source: `type A<T> = { value: T }` },
  { name: 'Union Types', source: `type User = Admin | Customer` },
  { name: 'Interface with Modifiers', source: `interface User { readonly id: string; name?: string }` },
  { name: 'Record Utility', source: `type Data = Record<string, string[]>` },
  { name: 'Partial Utility', source: `type User = Partial<{ id: string; email: string }>` },
  { name: 'Pick Utility', source: `type User = Pick<Account, "id">` },
  { name: 'Omit Utility', source: `type User = Omit<Account, "password">` },
  { name: 'Keyof Utility', source: `type User = keyof Account` },
  { name: 'Primitive Union', source: `type User = string | number | boolean` },
  { name: 'Date Object', source: `type User = Date` }
]

console.log('── TypeScript Torture Suite ──\n')

for (const tc of TEST_CASES) {
  console.log(`\nTesting: ${tc.name}`)
  console.log(`Input: ${tc.source}`)
  
  const parsed = parseTypeScript(tc.source)
  
  if (!parsed.ok) {
    console.log(`❌ Parse Failed: ${parsed.error}`)
    continue
  }
  
  console.log(`✅ Parse Succeeded: ${JSON.stringify(parsed.fields)}`)
  
  try {
    const fixture = generateFixture({
      varName: parsed.rootName,
      typeName: 'TestType',
      fields: parsed.fields,
      count: 1
    })
    console.log(`✅ Generation Succeeded:\n${fixture.ts}`)
  } catch (err) {
    console.log(`❌ Generation Failed: ${err.message}`)
  }
}

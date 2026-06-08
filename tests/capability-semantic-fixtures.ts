import { parseTypeScript } from '../src/lib/parser/parseTypeScript.ts'
import { inferValue } from '../src/lib/inference/inferValue.ts'

const input = `
export interface User {
  firstName: string
  lastName: string
  fullName: string
  email: string
  avatarUrl: string
  website: string
  slug: string
  phone: string
  city: string
  country: string
  postalCode: string
  company: string
  jobTitle: string
  createdAt: string
  updatedAt: string
}
`

const result = parseTypeScript(input)
if (!result.ok) {
  console.error("Parse failed:", result.error)
  process.exit(1)
}

console.log("── Semantic Fixture Validation ──")
const fixture: Record<string, any> = {}
for (const field of result.fields) {
  fixture[field.name] = inferValue(field, 0)
}
console.log(JSON.stringify(fixture, null, 2))

import { parseTypeScript } from '../src/lib/parser/parseTypeScript.ts'

const src = `
type User = Pick<Account, "id">
interface Account { id: string; password: string; }
`

console.log(JSON.stringify(parseTypeScript(src), null, 2))

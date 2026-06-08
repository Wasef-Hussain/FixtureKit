import { parseTypeScript } from '../src/lib/parser/parseTypeScript.ts'; 
console.log(JSON.stringify(parseTypeScript('interface User { role: "admin" | "customer" }')));

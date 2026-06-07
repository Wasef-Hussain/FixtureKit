# FixtureKit

**Paste a TypeScript interface or Zod schema. Get copy-ready fixtures in four formats.**

**Live:** https://fixture-kit.vercel.app · **GitHub:** https://github.com/Wasef-Hussain/FixtureKit

FixtureKit is a browser-based tool that generates realistic mock data from your type definitions — no libraries, no setup, no backend. Everything runs in your browser.

## What it does

1. Paste a TypeScript `interface` or `type`, or a Zod `z.object(...)` schema
2. Choose how many fixtures you want (1–5)
3. Pick an output format: **TypeScript**, **JSON**, **MSW**, or **Playwright**
4. Copy or download — drop straight into tests, mocks, or API stubs

Field names drive semantic inference: `email` gets a realistic email, `createdAt` gets an ISO date, `price` gets a plausible number. Output is deterministic — the same schema always produces the same fixtures.

### V2.1 — Multi-format output

| Format | Use for |
|--------|---------|
| **TypeScript** | `export const mockUser: User = { ... }` in test files |
| **JSON** | API response bodies, seed data, Postman |
| **MSW** | Mock Service Worker v2 handler (`http.get` + `HttpResponse.json`) |
| **Playwright** | `page.route` + `route.fulfill` snippet for E2E tests |

### V2.1 — Adversarial mode

Toggle **Adversarial mode** to inject stress-test values:

- XSS payloads (`<script>…`, `"><img onerror=…>`)
- SQLi strings (`' OR 1=1--`)
- Boundary values (5000-char strings, `0`, `-1`, `Number.MAX_SAFE_INTEGER`)
- Random `null` / `undefined` on optional fields

Useful for verifying sanitization, validation, and null-handling in your app.

## Example

**Input:**

```ts
interface User {
  id: string
  name: string
  email: string
  createdAt: Date
  isActive: boolean
}
```

**TypeScript output:**

```ts
export const mockUser: User = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  name: "Alice Johnson",
  email: "alice.johnson@example.com",
  createdAt: "2024-03-15T10:30:00.000Z",
  isActive: true,
}
```

**JSON output:**

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "Alice Johnson",
  "email": "alice.johnson@example.com",
  "createdAt": "2024-03-15T10:30:00.000Z",
  "isActive": true
}
```

**MSW output:**

```ts
import { http, HttpResponse } from 'msw'

export const mockUserHandler = http.get('/api/endpoint', () => {
  return HttpResponse.json({ /* generated data */ })
})
```

## Supported input

**TypeScript:** `interface`, `type` aliases, primitives, arrays, nested objects, optional properties, unions, string/number/boolean literals

**Zod:** `z.object`, `z.string`, `z.number`, `z.boolean`, `z.date`, `z.array`, `z.enum`, `z.union`, `z.literal`, `.optional()`, `.nullable()`

Generics, utility types, `.refine`, `.transform`, and other advanced features are out of scope and return a clear error.

## Testing

See **[docs/TESTING.md](docs/TESTING.md)** for manual use cases (UC-01 through UC-10) covering all output tabs and adversarial mode.

```bash
npm run verify:v21   # V2.1 logic smoke test (15 assertions)
npm run verify       # all parser + generator checks
```

## Tech

React 18 · TypeScript 5 · Vite · TypeScript compiler API (in-browser, no `eval`) · No backend

## Run locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## License

MIT

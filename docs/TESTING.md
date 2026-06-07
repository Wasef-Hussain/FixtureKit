# FixtureKit — Testing Guide

Manual use cases for **V2.1** (multi-format output + adversarial mode) and core V1 behavior.

**Quick start**

```bash
npm run dev          # browser testing at http://localhost:5173
npm run verify:v21   # automated logic smoke test (15 assertions)
npm run verify       # all script-based checks
```

---

## V2.1 — Output format tabs

Each tab shows a different export of the **same generated data**. Switching tabs does not re-parse or re-infer — only the presentation changes.

### UC-01 · TypeScript tab (default)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Paste a TS `interface User` with `id`, `name`, `email` | Output appears within ~500ms |
| 2 | Stay on **TypeScript** tab | `export const mockUser: User = { ... }` |
| 3 | Check field values | `id` → UUID-like string, `email` → realistic email |
| 4 | Click **Copy** | Clipboard contains TS export; button shows `✓ Copied` |
| 5 | Click **Download** | File downloads as `fixture.ts` |

**Sample input**

```ts
interface User {
  id: string
  name: string
  email: string
  age: number
  isActive: boolean
}
```

---

### UC-02 · JSON tab

| Step | Action | Expected |
|------|--------|----------|
| 1 | Same schema as UC-01 | — |
| 2 | Click **JSON** tab | Pretty-printed JSON object (2-space indent) |
| 3 | Validate | Paste into jsonlint.com or `JSON.parse` in console — no error |
| 4 | Download | File saves as `fixture.json` |

**Pass criteria:** JSON keys match interface fields; values match what TypeScript tab shows (same data, different format).

---

### UC-03 · MSW tab

| Step | Action | Expected |
|------|--------|----------|
| 1 | Same schema as UC-01 | — |
| 2 | Click **MSW** tab | Handler template appears |
| 3 | Check imports | `import { http, HttpResponse } from 'msw'` |
| 4 | Check handler name | `export const mockUserHandler = http.get('/api/endpoint', ...)` |
| 5 | Check body | `HttpResponse.json({ ... })` contains same data as JSON tab |
| 6 | Download | File saves as `fixture.handler.ts` |

**Use case:** Drop the handler into an MSW v2 `handlers` array for local API mocking.

---

### UC-04 · Playwright tab

| Step | Action | Expected |
|------|--------|----------|
| 1 | Same schema as UC-01 | — |
| 2 | Click **Playwright** tab | Route block appears |
| 3 | Check route | `await page.route('**/api/endpoint', async (route) => {` |
| 4 | Check fulfill | `status: 200`, `contentType: 'application/json'`, `body: JSON.stringify(...)` |
| 5 | Download | File saves as `fixture.spec.ts` |

**Use case:** Paste inside a Playwright test `beforeEach` to stub an API call.

---

### UC-05 · Tab persistence across options

| Step | Action | Expected |
|------|--------|----------|
| 1 | Generate output, switch to **MSW** | MSW template visible |
| 2 | Change **Fixtures** from 1 → 3 | Output updates; still on MSW tab |
| 3 | MSW output | `HttpResponse.json([ {...}, {...}, {...} ])` — array of 3 |
| 4 | Switch to **TypeScript** | `export const mockUsers: User[] = [ ... ]` |

---

### UC-06 · Zod + all four formats

| Step | Action | Expected |
|------|--------|----------|
| 1 | Switch input to **Zod** | Placeholder changes |
| 2 | Paste schema below | All 4 tabs produce output |
| 3 | TypeScript tab | `export const mockSchema = { ... }` (no `: Type` annotation) |

```ts
z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().optional(),
})
```

---

## V2.1 — Adversarial mode

Toggle **Adversarial mode** in the options bar (switch on the right). Re-runs the pipeline with stress-test values.

**What it injects (deterministic per field name):**

| Pool | Examples | Applies to |
|------|----------|------------|
| XSS | `<script>alert(1)</script>`, `"><img src=x onerror=alert(1)>` | `string` fields (60% of eligible fields) |
| SQLi | `' OR 1=1--`, `'; DROP TABLE users;--` | `string` fields |
| Boundaries | 5000-char `A` string, `0`, `-1`, `Number.MAX_SAFE_INTEGER` | `string` / `number` fields |
| Optional gaps | `null` or `undefined` | optional fields (30% chance) |

Adversarial output is **deterministic** — same schema + adversarial on always yields the same stress values (not random each click).

---

### UC-07 · Adversarial on simple user

| Step | Action | Expected |
|------|--------|----------|
| 1 | Paste UC-01 schema | Happy-path output |
| 2 | Enable **Adversarial mode** | Output changes within ~300ms |
| 3 | TypeScript tab | At least one field has XSS/SQLi/boundary value |
| 4 | Check `id` (string) | Often a 5000-char `A` string or XSS payload |
| 5 | Disable adversarial | Happy-path values return (`6ba7b810-…`, realistic email, etc.) |

**Sample input with optional field**

```ts
interface Post {
  title: string
  subtitle?: string
  body: string
}
```

| Step | Action | Expected |
|------|--------|----------|
| 6 | Adversarial ON | `subtitle` may be `null`, `undefined`, or omitted in JSON tab |

---

### UC-08 · Adversarial + JSON tab

| Step | Action | Expected |
|------|--------|----------|
| 1 | Adversarial ON, open **JSON** tab | Valid JSON (no `undefined` keys — `JSON.stringify` omits them) |
| 2 | If optional field → `undefined` | Key absent from JSON object |
| 3 | If optional field → `null` | `"subtitle": null` present |

**Use case:** Verify your UI/components handle missing keys, `null`, and malicious strings.

---

### UC-09 · Adversarial + MSW / Playwright

| Step | Action | Expected |
|------|--------|----------|
| 1 | Adversarial ON | — |
| 2 | **MSW** tab | Handler embeds adversarial strings inside `HttpResponse.json(...)` |
| 3 | **Playwright** tab | `JSON.stringify(...)` contains same adversarial payload |

**Use case:** Test that your app's XSS sanitization works when the mock API returns attack strings.

---

### UC-10 · Adversarial does not break parsing

| Step | Action | Expected |
|------|--------|----------|
| 1 | Adversarial ON | — |
| 2 | Paste unsupported input: `interface Box<T> { value: T }` | Red error banner; output cleared |
| 3 | Fix input to valid schema | Output returns; adversarial still active |

---

## Core V1 regression (quick pass)

Run these after any V2.1 change to ensure parsers and inference are untouched.

| # | Input | Expected |
|---|-------|----------|
| R1 | Nested object `Order { user: { id: string }; total: number }` | Nested fixture in all tabs |
| R2 | `tags: string[]` | Array with 2 items |
| R3 | `deletedAt: Date \| null` | ISO date string or `null` |
| R4 | `status: 'active' \| 'inactive'` | One of the enum literals |
| R5 | Fixtures = 5 | 5 distinct instances (different UUIDs/names per index) |
| R6 | Custom var name `myFixture` | `export const myFixture = ...` |
| R7 | Empty input | Placeholder empty state; Copy/Download disabled |
| R8 | Invalid var name `123bad` | Error: valid identifier required |

---

## Automated scripts

| Command | What it checks |
|---------|----------------|
| `npm run verify:v21` | `FixtureOutput` shape, JSON validity, MSW/Playwright templates, adversarial injection, multi-count |
| `npm run verify:parser` | TypeScript parser → IR (10+ cases) |
| `npm run verify:zod` | Zod parser → IR |
| `npm run verify:generator` | Full TS pipeline end-to-end (inline) |
| `npm run verify` | All of the above |

---

## Screenshot checklist (for README / launch)

Capture these for marketing docs:

1. **Happy path** — TypeScript tab with `interface User` output
2. **JSON tab** — same schema, JSON view
3. **MSW tab** — handler template visible
4. **Adversarial ON** — long string or XSS in output (proves stress mode)
5. **Mobile** — stacked layout below 768px width

---

## Known limitations (not bugs)

- MSW/Playwright templates use a placeholder URL: `/api/endpoint` — edit before use
- Adversarial "probability" is hash-based, not `Math.random()` — intentional for determinism
- `Date` fields output as ISO **strings**, not `new Date(...)` (README example may differ)
- Semantic fields (e.g. `email`) can receive adversarial strings when adversarial mode triggers for that field

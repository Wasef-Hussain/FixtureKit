# Hacker News — Show HN Post

**Title:**
Show HN: FixtureKit – TypeScript interface or Zod schema → export const mock fixture

**URL:** https://fixturekit.vercel.app

---

**Body:**

I got tired of hand-writing mock objects for tests. The first thing I reach for after defining a type is a fixture — and that's always tedious boilerplate.

FixtureKit is a free browser tool that generates `export const mock…` TypeScript fixtures from TypeScript interfaces/types or Zod schemas. You paste your schema, tune the count (1–5), and copy the output.

https://fixturekit.vercel.app

A few things I cared about while building it:

- **No eval.** Zod schemas are parsed with a custom tokenizer + recursive-descent parser — no Zod import, no `eval`, no server.
- **Semantic inference.** A field named `email` gets an email. `createdAt` gets an ISO date. `price` gets a price-looking number. It uses the TypeScript compiler API to understand types, so it won't put an email string on a `number` field.
- **Deterministic output.** Same schema → same fixtures every time. Hash-based pool selection, no `Math.random()`. Safe to commit.
- **Entirely client-side.** Nothing leaves the browser.

It handles common shapes well: nested objects, optional fields, unions, arrays, string/number/boolean literals. Advanced TS features (generics, mapped types, utility types) and advanced Zod (`.refine`, `.transform`, `z.discriminatedUnion`) are out of scope and return a clear error rather than silent nonsense.

Would love feedback, especially on the Zod parser edge cases.

**GitHub:** https://github.com/PLACEHOLDER/fixturekit

# DEV.to Launch Post

**Title:** I built a tool that generates TypeScript fixtures from interfaces and Zod schemas

**Tags:** `typescript` `testing` `webdev` `opensource`

**URL:** https://fixturekit.vercel.app

---

Every TypeScript project reaches the same point: you've defined your types, now you need mock data for tests, Storybook stories, or local dev. You end up hand-writing the same boilerplate `mockUser`, `mockProduct`, `mockOrder` objects over and over.

I built **FixtureKit** to fix that — a free developer tool, not a product pitch.

## What it does

Paste a TypeScript `interface`, `type`, or a Zod `z.object(...)` schema → get a copy-ready `export const mock…` TypeScript fixture.

**Try it:** https://fixturekit.vercel.app

**Input:**

```ts
interface Product {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
  tags: string[];
}
```

**Output:**

```ts
export const mockProduct: Product = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  name: "Wireless Keyboard",
  price: 49.99,
  inStock: true,
  tags: ["electronics", "accessories"],
};
```

## What makes it useful

**Semantic field inference** — it doesn't just fill every `string` with `"value"`. Field names like `email`, `name`, `url`, `price`, `createdAt` map to realistic value pools. Type compatibility is enforced: you won't get an email string on a `number` field.

**Deterministic output** — uses a hash of the field name + fixture index to select values. No `Math.random()`. The same schema always produces the same output. This matters if you're committing fixtures.

**No eval, no backend** — Zod schemas are parsed with a custom recursive-descent parser. TypeScript schemas use the TypeScript compiler API. Everything runs in the browser.

**Generate up to 5 fixtures at once** — useful for seeding UI components or building table/list test cases.

## Supported input

| TypeScript | Zod |
|---|---|
| `interface`, `type` | `z.object`, `z.string`, `z.number`, `z.boolean` |
| Arrays, nested objects | `z.array`, `z.enum`, `z.union`, `z.literal` |
| Optional fields, unions | `.optional()`, `.nullable()` |
| Literal types | Nested `z.object` |

Advanced features (generics, utility types, `.refine`, `.transform`) are explicitly out of scope and show a clear error.

## Tech stack

React 18 · TypeScript 5 · Vite · TypeScript compiler API (in-browser)

## Source

https://github.com/Wasef-Hussain/FixtureKit

Feedback welcome — especially on schema shapes I haven't handled well.

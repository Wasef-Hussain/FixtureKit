# FixtureKit

**Paste a TypeScript interface or Zod schema. Get copy-ready fixture code.**

**Live:** https://fixture-kit.vercel.app · **GitHub:** https://github.com/Wasef-Hussain/FixtureKit

FixtureKit is a browser-based tool that generates `export const mock…` TypeScript fixtures from your type definitions — no libraries, no setup, no backend.

## What it does

1. Paste a TypeScript `interface` or `type`, or a Zod `z.object(...)` schema
2. Choose how many fixtures you want (1–5)
3. Copy the generated code straight into your test file

Field names drive semantic inference: an `email` field gets a realistic email, `createdAt` gets an ISO date string, `price` gets a number that looks like a price. Output is deterministic — the same schema always produces the same fixtures.

## Example

Input:
```ts
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  isActive: boolean;
}
```

Output:
```ts
export const mockUser: User = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  name: "Alice Johnson",
  email: "alice.johnson@example.com",
  createdAt: new Date("2024-03-15T10:30:00.000Z"),
  isActive: true,
};
```

## Supported input

**TypeScript:** `interface`, `type` aliases, primitives, arrays, nested objects, optional properties, unions, string/number/boolean literals

**Zod:** `z.object`, `z.string`, `z.number`, `z.boolean`, `z.date`, `z.array`, `z.enum`, `z.union`, `z.literal`, `.optional()`, `.nullable()`

Generics, utility types, `.refine`, `.transform`, and other advanced features are out of scope and return a clear error.

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

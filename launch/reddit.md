# Reddit Launch Post

**Post first in:** r/typescript  
**Later (if traction):** r/nextjs · r/reactjs

---

**Title:** I built a browser tool that turns TypeScript interfaces and Zod schemas into fixture/mock code

**URL:** https://fixture-kit.vercel.app

---

**Body:**

Hey r/typescript,

I kept writing the same mock objects by hand every time I needed test data, so I built a small free tool to generate them automatically.

**FixtureKit** — paste a TypeScript interface/type or a Zod schema, get a copy-ready `export const mock…` fixture.

https://fixture-kit.vercel.app

Example: paste this

```ts
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "viewer";
  createdAt: Date;
}
```

Get this:

```ts
export const mockUser: User = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  name: "Alice Johnson",
  email: "alice.johnson@example.com",
  role: "admin",
  createdAt: new Date("2024-03-15T10:30:00.000Z"),
};
```

**A few things that make it not just "fill everything with placeholder strings":**

- Field names drive inference: `email` → realistic email, `price` → price-like number, `createdAt` → ISO date. Type-checked so it won't put an email on a `number` field.
- Deterministic: hash-based selection, no random — same input always gives the same output.
- Generate 1–5 fixtures at once for array/table test cases.
- Entirely client-side, nothing leaves the browser.

It handles nested objects, arrays, optional fields, union types, and string/number literal unions. Generics and advanced Zod features are intentionally out of scope (they return a clear error, not broken output).

Source: https://github.com/Wasef-Hussain/FixtureKit

Would love to hear what schema patterns break it — that's the most useful feedback at this stage.

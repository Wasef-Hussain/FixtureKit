import { parseZod } from './src/lib/parser/parseZod.ts';

const schemas = [
  // 1. A composed schema referencing an external variable
  `
    export const HackathonUser = z.object({
      id: z.string()
    })

    export const Team = z.object({
      name: z.string(),
      members: z.array(HackathonUser)
    })
  `,
  // 2. An imported schema with custom identifier fields
  `
    import { z } from "zod";
    import { AddressSchema } from "./address";

    export const Profile = z.object({
      address: AddressSchema,
      tags: z.array(z.string())
    })
  `,
  // 3. Just a custom type at the top
  `
    type HackathonUser = z.infer<typeof HackathonUserSchema>;
    export const HackathonUserSchema = z.object({
      name: z.string()
    });
  `,
  // 4. Using an unsupported variable in a method
  `
    const Roles = ['admin', 'user']
    export const RoleSchema = z.object({
      role: z.enum(Roles)
    })
  `
];

for (let i = 0; i < schemas.length; i++) {
  console.log(`\n--- Test ${i + 1} ---`);
  const result = parseZod(schemas[i]);
  if (result.ok) {
    console.log(`✅ Success! Root Name: ${result.rootName}`);
    console.log(JSON.stringify(result.fields, null, 2));
  } else {
    console.error(`❌ Failed: ${result.error}`);
  }
}

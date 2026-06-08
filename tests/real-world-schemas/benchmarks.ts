import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { parseTypeScript } from '../../src/lib/parser/parseTypeScript.ts'

console.log('── Running Real-World Benchmark Suite ──')

const SCHEMAS = {
  prismaUser: `
    export interface PrismaUser {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      avatarUrl: string;
      role: "ADMIN" | "USER" | "GUEST";
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }
  `,
  nextAuthSession: `
    export type Session = {
      user?: {
        name?: string | null
        email?: string | null
        image?: string | null
      }
      expires: ISODateString
    }
    type ISODateString = string
  `,
  shopifyProduct: `
    export interface ShopifyProduct {
      id: string;
      title: string;
      body_html: string;
      vendor: string;
      product_type: string;
      created_at: string;
      handle: string;
      updated_at: string;
      published_at: string;
      status: "active" | "archived" | "draft";
      tags: string;
    }
  `,
  stripeCustomer: `
    export interface StripeCustomer {
      id: string;
      object: "customer";
      address: Address | null;
      balance: number;
      created: number;
      currency: string;
      default_source: string | null;
      delinquent: boolean;
      description: string | null;
      email: string | null;
      phone: string | null;
    }
    
    interface Address {
      city: string | null;
      country: string | null;
      line1: string | null;
      line2: string | null;
      postal_code: string | null;
      state: string | null;
    }
  `,
  githubRepo: `
    export interface GithubRepository {
      id: number;
      node_id: string;
      name: string;
      full_name: string;
      private: boolean;
      owner: Owner;
      html_url: string;
      description: string | null;
      fork: boolean;
      url: string;
      created_at: string;
      updated_at: string;
      pushed_at: string;
      homepage: string | null;
      size: number;
      stargazers_count: number;
      watchers_count: number;
      language: string | null;
    }

    interface Owner {
      login: string;
      id: number;
      avatar_url: string;
      html_url: string;
      type: "User" | "Organization";
    }
  `
}

let passed = 0
const total = Object.keys(SCHEMAS).length

for (const [name, source] of Object.entries(SCHEMAS)) {
  try {
    const parsed = parseTypeScript(source)
    if (!parsed.ok) {
      console.error(`❌ ${name} failed parsing: ${parsed.error}`)
      continue
    }
    if (parsed.fields.length === 0) {
      console.error(`❌ ${name} parsed with zero fields.`)
      continue
    }
    console.log(`✅ ${name} parsed successfully (${parsed.fields.length} fields).`)
    passed++
  } catch (e) {
    console.error(`❌ ${name} threw an exception: ${e instanceof Error ? e.message : String(e)}`)
  }
}

if (passed === total) {
  console.log('\nAll real-world benchmarks passed!')
} else {
  process.exit(1)
}

// Generator layer: IR + inferred values → formatted TypeScript source string.
//
// Pipeline:
//   resolveInstance(fields, index)  →  plain JS object tree  (runs inference)
//   serializeValue(value, level)    →  TypeScript source string  (pure formatting)
//   generateFixture(opts)           →  full export declaration   (assembles both)
//
// Output is deterministic: same fields + same options → identical string every time.

import type { Field } from '../types'
import { inferValue } from '../inference/inferValue'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  /** The const variable name, e.g. "mockUser". */
  varName: string
  /**
   * TypeScript type annotation name, e.g. "User".
   * When provided: `export const mockUser: User = { ... }`
   * When omitted:  `export const mockUser = { ... }`
   */
  typeName?: string
  /** IR fields from a successful ParseResult. */
  fields: Field[]
  /** Number of fixture instances to generate (1–5). */
  count: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const INDENT = '  ' // 2 spaces

function ind(level: number): string {
  return INDENT.repeat(level)
}

// Pluralise a camelCase var name for the array variant.
//   mockUser → mockUsers
//   mockPost → mockPosts
//   mockStatus → mockStatus  (already ends in 's', don't double up)
function pluralize(name: string): string {
  return name.endsWith('s') ? name : name + 's'
}

// Returns true if key can be written bare (no quotes needed in TS object literals).
function isIdentifier(key: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
}

// Escape a string value for use inside double-quoted TypeScript string literals.
function escapeString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

// Recursively convert a plain JS value (output of inferValue) to a TypeScript
// source string at the given indentation level.
function serializeValue(value: unknown, level: number): string {
  // Primitives
  if (value === null)      return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number')  return String(value)
  if (typeof value === 'string')  return `"${escapeString(value)}"`

  // Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const lines = value.map(item => `${ind(level + 1)}${serializeValue(item, level + 1)}`)
    return `[\n${lines.join(',\n')},\n${ind(level)}]`
  }

  // Plain objects (from nested inference)
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    const lines = entries.map(([key, val]) => {
      const keyStr = isIdentifier(key) ? key : `"${escapeString(key)}"`
      return `${ind(level + 1)}${keyStr}: ${serializeValue(val, level + 1)}`
    })
    return `{\n${lines.join(',\n')},\n${ind(level)}}`
  }

  // Fallback (symbol, function, bigint — should not appear from inference)
  return String(value)
}

// Run inference on all fields at a given instance index, returning a plain
// JS object. This is the only place that touches inferValue.
function resolveInstance(fields: Field[], index: number): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const field of fields) {
    obj[field.name] = inferValue(field, index)
  }
  return obj
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a TypeScript fixture string from IR fields.
 *
 * Single instance (count = 1):
 *   export const mockUser: User = {
 *     id: "f47ac10b-...",
 *     name: "Alice Johnson",
 *   }
 *
 * Multiple instances (count > 1):
 *   export const mockUsers: User[] = [
 *     {
 *       id: "f47ac10b-...",
 *       name: "Alice Johnson",
 *     },
 *     {
 *       id: "550e8400-...",
 *       name: "Bob Smith",
 *     },
 *   ]
 */
export function generateFixture(opts: GenerateOptions): string {
  const count = Math.max(1, Math.min(5, Math.round(opts.count)))

  if (count === 1) {
    const value = resolveInstance(opts.fields, 0)
    const annotation = opts.typeName ? `: ${opts.typeName}` : ''
    return `export const ${opts.varName}${annotation} = ${serializeValue(value, 0)}\n`
  }

  // Multiple instances → array
  const varName  = pluralize(opts.varName)
  const annotation = opts.typeName ? `: ${opts.typeName}[]` : ''
  const items = Array.from({ length: count }, (_, i) => {
    const value = resolveInstance(opts.fields, i)
    return `${ind(1)}${serializeValue(value, 1)}`
  })
  return `export const ${varName}${annotation} = [\n${items.join(',\n')},\n]\n`
}

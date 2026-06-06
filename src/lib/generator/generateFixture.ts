// Generator layer: IR + inferred values → multi-format fixture output.
//
// Pipeline:
//   resolveInstance(fields, index, isAdversarial)  →  plain JS object tree
//   serializeValue(value, level)                    →  TypeScript source string
//   buildOutput(data, opts)                         →  { ts, json, msw, playwright }
//   generateFixture(opts)                           →  FixtureOutput
//
// Output is deterministic: same fields + same options → identical strings every time.

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
  /** When true, injects adversarial values into the fixture data (V2.1). */
  isAdversarial?: boolean
}

/** The four output formats produced by the generator. */
export interface FixtureOutput {
  /** Raw TypeScript export declaration (original V1 format). */
  ts: string
  /** Pretty-printed JSON (JSON.stringify with 2-space indent). */
  json: string
  /** MSW v2 handler wrapping the generated data. */
  msw: string
  /** Playwright route.fulfill() block wrapping the generated data. */
  playwright: string
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

// Indent every line of a multi-line string by the given number of spaces.
function indentLines(text: string, spaces: number): string {
  const prefix = ' '.repeat(spaces)
  return text
    .split('\n')
    .map(line => prefix + line)
    .join('\n')
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
function resolveInstance(
  fields: Field[],
  index: number,
  isAdversarial: boolean,
): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const field of fields) {
    obj[field.name] = inferValue(field, index, 0, isAdversarial)
  }
  return obj
}

// ---------------------------------------------------------------------------
// Multi-format builder
// ---------------------------------------------------------------------------

type Data = Record<string, unknown> | Record<string, unknown>[]

function buildOutput(data: Data, opts: GenerateOptions): FixtureOutput {
  const count = Math.max(1, Math.min(5, Math.round(opts.count)))

  // --- TS ---
  const annotation = opts.typeName ? `: ${opts.typeName}` : ''
  let ts: string

  if (count === 1) {
    ts = `export const ${opts.varName}${annotation} = ${serializeValue(data, 0)}\n`
  } else {
    const varName = pluralize(opts.varName)
    const annotationArr = opts.typeName ? `: ${opts.typeName}[]` : ''
    const items = (data as Record<string, unknown>[]).map(
      item => `${ind(1)}${serializeValue(item, 1)}`,
    )
    ts = `export const ${varName}${annotationArr} = [\n${items.join(',\n')},\n]\n`
  }

  // --- JSON ---
  const json = JSON.stringify(data, null, 2)

  // --- MSW ---
  const mswHandlerName = `${opts.varName}Handler`
  const msw = [
    "import { http, HttpResponse } from 'msw'\n",
    `export const ${mswHandlerName} = http.get('/api/endpoint', () => {`,
    `  return HttpResponse.json(\n${indentLines(json, 4)}\n  )`,
    '})\n',
  ].join('\n')

  // --- Playwright ---
  const playwright = [
    "await page.route('**/api/endpoint', async (route) => {",
    '  await route.fulfill({',
    '    status: 200,',
    "    contentType: 'application/json',",
    `    body: JSON.stringify(\n${indentLines(json, 6)}\n    ),`,
    '  });',
    '});\n',
  ].join('\n')

  return { ts, json, msw, playwright }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate fixture output in all four formats.
 *
 * @returns A FixtureOutput object with `ts`, `json`, `msw`, and `playwright` keys —
 *          each containing the formatted fixture string for that format.
 */
export function generateFixture(opts: GenerateOptions): FixtureOutput {
  const count = Math.max(1, Math.min(5, Math.round(opts.count)))
  const isAdversarial = opts.isAdversarial ?? false

  if (count === 1) {
    const data = resolveInstance(opts.fields, 0, isAdversarial)
    return buildOutput(data, opts)
  }

  const data = Array.from({ length: count }, (_, i) =>
    resolveInstance(opts.fields, i, isAdversarial),
  )
  return buildOutput(data, opts)
}

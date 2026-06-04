// Core inference function: maps a Field from the IR to a concrete JavaScript value.
//
// Three-tier strategy (tried in order):
//   Tier 1/2 — Semantic: field name recognized → pick from realistic value pool
//   Tier 3   — Type-based fallback: use the field's type to produce a sensible default
//
// Determinism: output is fully determined by (fieldName, index).
// Running the same schema twice always produces identical fixtures.

import type { Field, FieldType } from '../types'
import { getSemanticCategory, type SemanticCategory } from './semanticMap'
import { hashStr, pickFromPool, VALUE_BANK } from './valueBank'

// Nested objects recurse until this depth; beyond it we emit {} or [] to prevent runaway
// generation on pathological schemas (e.g. self-referential types).
const MAX_DEPTH = 5

// --- Type compatibility guard ---
// Prevents a numeric-returning category from being applied to a string-typed field, etc.

function effectiveTypeKind(type: FieldType): string {
  if (type.kind !== 'union') return type.kind
  const nonNull = type.types.find(t => t.kind !== 'null' && t.kind !== 'undefined')
  return nonNull ? nonNull.kind : type.types[0].kind
}

const NUMERIC_CATS = new Set<SemanticCategory>(['PRICE', 'QUANTITY', 'AGE'])
const BOOLEAN_CATS = new Set<SemanticCategory>(['BOOLEAN_POSITIVE', 'BOOLEAN_NEGATIVE'])

function isCategoryCompatible(category: SemanticCategory, fieldType: FieldType): boolean {
  const kind = effectiveTypeKind(fieldType)
  if (kind === 'boolean') return BOOLEAN_CATS.has(category)
  if (kind === 'number') return NUMERIC_CATS.has(category)
  // string, date, unknown, literal, union(string|null), etc. — allow any non-numeric/non-boolean category
  return !NUMERIC_CATS.has(category) && !BOOLEAN_CATS.has(category)
}

// --- Semantic value resolution ---

function pickFromCategory(category: SemanticCategory, seed: number): string | number | boolean {
  const pool = VALUE_BANK[category]
  return pickFromPool(pool as ReadonlyArray<string | number | boolean>, seed)
}

// --- Type-based fallback (Tier 3) ---
// Returns sensible non-empty, non-zero defaults.
// Arrays generate 2 items; nested objects recurse.

function typeBasedValue(type: FieldType, fieldName: string, index: number, depth: number): unknown {
  switch (type.kind) {
    case 'string':
      return 'value'

    case 'number':
      // index+1 avoids 0, which looks like an uninitialized field
      return index + 1

    case 'boolean':
      return true

    case 'date':
      return '2024-03-15T10:30:00.000Z'

    case 'null':
      return null

    case 'undefined':
      return undefined

    case 'unknown':
      return {}

    case 'literal':
      return type.value

    case 'enum':
      return type.values[0]

    case 'union': {
      // V1 rule: always pick the first non-null, non-undefined type.
      const preferred = type.types.find(t => t.kind !== 'null' && t.kind !== 'undefined')
      const chosen = preferred ?? type.types[0]
      return typeBasedValue(chosen, fieldName, index, depth)
    }

    case 'array': {
      if (depth >= MAX_DEPTH) return []
      return [0, 1].map(i =>
        inferValue({ name: fieldName, type: type.itemType, optional: false }, index + i, depth + 1),
      )
    }

    case 'object': {
      if (depth >= MAX_DEPTH) return {}
      const obj: Record<string, unknown> = {}
      for (const f of type.fields) {
        obj[f.name] = inferValue(f, index, depth + 1)
      }
      return obj
    }
  }
}

// --- Public API ---

/**
 * Infer a concrete value for a field.
 *
 * @param field  - The IR field descriptor (name, type, optional flag).
 * @param index  - Instance index (0 for first fixture, 1 for second, etc.).
 *                 Offsets pool selection so each generated fixture gets distinct values.
 * @param depth  - Current recursion depth (internal, starts at 0).
 */
export function inferValue(field: Field, index: number, depth = 0): unknown {
  // Handle depth limit before any further work
  if (depth >= MAX_DEPTH) {
    return typeBasedValue(field.type, field.name, index, depth)
  }

  // Tier 1 & 2: semantic category match
  const category = getSemanticCategory(field.name)
  if (category !== null && isCategoryCompatible(category, field.type)) {
    const seed = hashStr(field.name) + index
    return pickFromCategory(category, seed)
  }

  // Tier 3: type-based fallback
  return typeBasedValue(field.type, field.name, index, depth)
}

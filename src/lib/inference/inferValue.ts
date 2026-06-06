// Core inference function: maps a Field from the IR to a concrete JavaScript value.
//
// Three-tier strategy (tried in order):
//   Tier 1/2 — Semantic: field name recognized → pick from realistic value pool
//   Tier 3   — Type-based fallback: use the field's type to produce a sensible default
//
// Adversarial mode (V2.1):
//   When isAdversarial is true:
//     - 30 % chance to emit null/undefined for optional fields
//     - 60 % chance to pick from XSS / SQLi / boundary pools for primitives
//     - 40 % chance to fall through to normal happy-path values
//
// Determinism: output is fully determined by (fieldName, index, isAdversarial).
// Running the same schema twice with the same flags produces identical fixtures.

import type { Field, FieldType } from '../types'
import { getSemanticCategory, type SemanticCategory } from './semanticMap'
import {
  hashStr,
  pickFromPool,
  VALUE_BANK,
  ADVERSARIAL_XSS,
  ADVERSARIAL_SQLI,
  ADVERSARIAL_BOUNDARIES,
} from './valueBank'

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

// --- Adversarial value resolution (V2.1) ---
// Returns an adversarial value for primitive string/number fields, or undefined
// for composite types (objects, arrays) where adversarial pools don't apply.

const ALL_ADVERSARIAL_STRINGS: readonly string[] = [
  ...ADVERSARIAL_XSS,
  ...ADVERSARIAL_SQLI,
  ADVERSARIAL_BOUNDARIES[0] as string,
]

const ADVERSARIAL_NUMBERS: readonly number[] = ADVERSARIAL_BOUNDARIES.filter(
  (v): v is number => typeof v === 'number',
)

function pickAdversarialValue(type: FieldType, seed: number): unknown {
  const kind = effectiveTypeKind(type)
  if (kind === 'string') {
    return ALL_ADVERSARIAL_STRINGS[seed % ALL_ADVERSARIAL_STRINGS.length]
  }
  if (kind === 'number') {
    return ADVERSARIAL_NUMBERS[seed % ADVERSARIAL_NUMBERS.length]
  }
  // Non-primitive types (object, array, boolean, etc.) — adversarial pool doesn't apply
  return undefined
}

// --- Type-based fallback (Tier 3) ---
// Returns sensible non-empty, non-zero defaults.
// Arrays generate 2 items; nested objects recurse.
//
// isAdversarial is forwarded to recursive inferValue calls so nested fields
// also participate in adversarial mode.

function typeBasedValue(
  type: FieldType,
  fieldName: string,
  index: number,
  depth: number,
  isAdversarial = false,
): unknown {
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
      return typeBasedValue(chosen, fieldName, index, depth, isAdversarial)
    }

    case 'array': {
      if (depth >= MAX_DEPTH) return []
      return [0, 1].map(i =>
        inferValue(
          { name: fieldName, type: type.itemType, optional: false },
          index + i,
          depth + 1,
          isAdversarial,
        ),
      )
    }

    case 'object': {
      if (depth >= MAX_DEPTH) return {}
      const obj: Record<string, unknown> = {}
      for (const f of type.fields) {
        obj[f.name] = inferValue(f, index, depth + 1, isAdversarial)
      }
      return obj
    }
  }
}

// --- Public API ---

/**
 * Infer a concrete value for a field.
 *
 * @param field          - The IR field descriptor (name, type, optional flag).
 * @param index          - Instance index (0 for first fixture, 1 for second, etc.).
 *                         Offsets pool selection so each generated fixture gets distinct values.
 * @param depth          - Current recursion depth (internal, starts at 0).
 * @param isAdversarial  - When true, injects adversarial values and random null/undefined
 *                         to stress-test downstream consumers.
 */
export function inferValue(
  field: Field,
  index: number,
  depth = 0,
  isAdversarial = false,
): unknown {
  // Handle depth limit before any further work
  if (depth >= MAX_DEPTH) {
    return typeBasedValue(field.type, field.name, index, depth, isAdversarial)
  }

  // Adversarial: 30 % chance to emit null/undefined for optional fields.
  // Uses a distinct seed offset (9999) so the null/undefined decision is
  // independent from the adversarial pool selection.
  if (isAdversarial && field.optional) {
    const optSeed = hashStr(field.name) + index + 9999
    if (optSeed % 100 < 30) {
      return optSeed % 2 === 0 ? null : undefined
    }
  }

  // Adversarial: 60 % chance to inject an adversarial value for primitives.
  // Uses a distinct seed offset (7777) so adversarial pool selection and
  // happy-path pool selection never share the same seed.
  if (isAdversarial) {
    const advSeed = hashStr(field.name) + index + 7777
    if (advSeed % 100 < 60) {
      const adv = pickAdversarialValue(field.type, advSeed)
      if (adv !== undefined) return adv
    }
  }

  // Normal path — always taken when isAdversarial is false, and taken
  // in the remaining 40 % of cases when isAdversarial is true.
  const category = getSemanticCategory(field.name)
  if (category !== null && isCategoryCompatible(category, field.type)) {
    const seed = hashStr(field.name) + index
    return pickFromCategory(category, seed)
  }

  // Tier 3: type-based fallback
  return typeBasedValue(field.type, field.name, index, depth, isAdversarial)
}

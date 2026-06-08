// Internal Representation (IR) — the single shared data model for all pipeline layers.
// Every parser produces these types. The inference and generator layers consume them.
// No logic lives here — pure type definitions only.

export type FieldType =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'date' }
  | { kind: 'null' }
  | { kind: 'undefined' }
  | { kind: 'unknown' }
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'array'; itemType: FieldType }
  | { kind: 'object'; fields: Field[] }
  | { kind: 'record'; keyType: FieldType; valueType: FieldType }
  | { kind: 'union'; types: FieldType[] }
  | { kind: 'enum'; values: string[] }

export interface Field {
  name: string
  type: FieldType
  optional: boolean
}

export type ParseResult =
  | { ok: true; rootName: string; fields: Field[] }
  | { ok: false; error: string }

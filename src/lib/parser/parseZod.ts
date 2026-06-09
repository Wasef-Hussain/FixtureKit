// Zod schema text → IR parser.
//
// Parses Zod schema strings as text without executing any code.
// Uses a recursive-descent parser on a tokenized input stream.
//
// Supported:
//  z.object({ ... })         — top-level object schema
//  z.string()                — string field
//  z.number()                — number field
//  z.boolean()               — boolean field
//  z.date()                  — date field
//  .optional()               — field modifier
//  .nullable()               — field modifier (wraps in union with null)
//  z.array(...)              — array of any supported type
//  z.enum([...])             — string literal enum
//  z.union([...])            — union type
//  z.literal(...)            — literal value
//  Nested z.object({ ... })
//
// Unsupported:
//  .refine(), .superRefine(), .transform(), .preprocess()
//  .default(), .catch(), .pipe()
//  z.discriminatedUnion(), z.record(), z.map(), z.set()
//  z.lazy(), z.function(), z.never(), z.void()
//  .extend(), .merge(), .pick(), .omit()

import type { Field, FieldType, ParseResult } from '../types'

const ROOT_NAME = 'mockSchema'

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Token =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'identifier'; name: string }
  | { kind: 'punct'; char: string }
  | { kind: 'eof' }

function tokenize(input: string): { kind: 'ok'; tokens: Token[] } | { kind: 'error'; message: string } {
  const tokens: Token[] = []
  let i = 0

  function peek(): string {
    return i < input.length ? input[i] : ''
  }

  function advance(): string {
    return input[i++] ?? ''
  }

  while (i < input.length) {
    const ch = input[i]

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }

    // Comments (// ...)
    if (ch === '/' && i + 1 < input.length && input[i + 1] === '/') {
      i += 2
      while (i < input.length && input[i] !== '\n') i++
      continue
    }

    // Punctuation
    if ('{}[]().,:=;<>|&?!+-*/'.includes(ch)) {
      tokens.push({ kind: 'punct', char: ch })
      i++
      continue
    }

    // Strings
    if (ch === "'" || ch === '"') {
      const quote = ch
      i++
      let value = ''
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) {
          i++
          const esc = input[i]
          if (esc === 'n') value += '\n'
          else if (esc === 't') value += '\t'
          else if (esc === '\\') value += '\\'
          else if (esc === quote) value += quote
          else value += esc
        } else {
          value += input[i]
        }
        i++
      }
      if (i >= input.length) {
        return { kind: 'error', message: `Unterminated string literal: ${quote}...` }
      }
      i++ // consume closing quote
      tokens.push({ kind: 'string', value })
      continue
    }

    // Numbers
    if ((ch >= '0' && ch <= '9') || (ch === '-' && i + 1 < input.length && input[i + 1] >= '0' && input[i + 1] <= '9')) {
      let numStr = ''
      if (ch === '-') { numStr += ch; i++ }
      while (i < input.length && input[i] >= '0' && input[i] <= '9') {
        numStr += input[i++]
      }
      if (i < input.length && input[i] === '.') {
        numStr += input[i++]
        while (i < input.length && input[i] >= '0' && input[i] <= '9') {
          numStr += input[i++]
        }
      }
      tokens.push({ kind: 'number', value: parseFloat(numStr) })
      continue
    }

    // Identifiers / keywords
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
      let name = ''
      while (i < input.length &&
        ((input[i] >= 'a' && input[i] <= 'z') ||
          (input[i] >= 'A' && input[i] <= 'Z') ||
          (input[i] >= '0' && input[i] <= '9') ||
          input[i] === '_' || input[i] === '$')) {
        name += input[i++]
      }
      tokens.push({ kind: 'identifier', name })
      continue
    }

    return { kind: 'error', message: `Unexpected character: "${ch}"` }
  }

  tokens.push({ kind: 'eof' })
  return { kind: 'ok', tokens }
}

// ---------------------------------------------------------------------------
// Recursive-descent parser
// ---------------------------------------------------------------------------

class Parser {
  private tokens: Token[]
  private pos: number

  constructor(tokens: Token[]) {
    this.tokens = tokens
    this.pos = 0
  }

  private cur(): Token {
    return this.tokens[this.pos] ?? { kind: 'eof' }
  }

  private peek(kind: Token['kind'], value?: string): boolean {
    const t = this.cur()
    if (t.kind !== kind) return false
    if (value !== undefined) {
      if (t.kind === 'punct') return (t as { char: string }).char === value
      if (t.kind === 'identifier') return (t as { name: string }).name === value
      return false
    }
    return true
  }

  private consume(): Token {
    return this.tokens[this.pos++] ?? { kind: 'eof' }
  }

  private expect(kind: Token['kind'], value?: string): Token | null {
    if (this.peek(kind, value)) return this.consume()
    return null
  }

  public expectPunct(char: string): boolean {
    if (this.peek('punct', char)) {
      this.consume()
      return true
    }
    return false
  }

  private error(msg: string): never {
    const t = this.cur()
    const ctx = t.kind === 'eof'
      ? 'end of input'
      : t.kind === 'punct'
        ? `'${t.char}'`
        : t.kind === 'string'
          ? `"${t.value}"`
          : t.kind === 'number'
            ? `${t.value}`
            : `'${(t as { kind: 'identifier'; name: string }).name}'`
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Error(`${msg} (near ${ctx})`)
  }

  // Consume a parenthesized argument list, ignoring content.
  // Used to skip validation modifiers like .email(), .min(1), .max(100).
  private skipCall(): void {
    if (!this.expectPunct('(')) return
    let depth = 1
    while (depth > 0) {
      if (this.peek('eof')) this.error('Unexpected end of input while reading method arguments')
      const t = this.consume()
      if (t.kind === 'punct' && (t as any).char === '(') depth++
      else if (t.kind === 'punct' && (t as any).char === ')') depth--
    }
  }

  // Parse a full Zod schema: z.object({ ... })
  parseSchema(): { fields: Field[], rootName: string } {
    let finalRootName = ROOT_NAME
    let lastSchemaStart = 0
    let currentVarName = ROOT_NAME
    
    // Scan tokens to find the last z.object or z.discriminatedUnion in the file
    for (let i = 0; i < this.tokens.length - 2; i++) {
      const t = this.tokens[i]
      if (t.kind === 'identifier' && (t.name === 'const' || t.name === 'let' || t.name === 'var')) {
        const next = this.tokens[i+1]
        if (next && next.kind === 'identifier') {
          currentVarName = next.name
        }
      }
      
      const t1 = this.tokens[i]
      const t2 = this.tokens[i+1]
      const t3 = this.tokens[i+2]
      if (t1.kind === 'identifier' && t1.name === 'z' &&
          t2.kind === 'punct' && (t2 as any).char === '.' &&
          t3.kind === 'identifier' && (t3.name === 'object' || t3.name === 'discriminatedUnion')) {
        lastSchemaStart = i
        finalRootName = currentVarName
      }
    }

    this.pos = lastSchemaStart

    this.parseZ()
    this.expectPunct('.') || this.error('Expected z.object(...)')
    const methodName = this.expect('identifier') as { kind: 'identifier'; name: string } | null
    if (!methodName) {
      this.error('Expected z.object(...) at the top level')
    }

    let fields: Field[] = []

    if (methodName.name === 'object') {
      fields = this.parseObjectContent().fields
    } else if (methodName.name === 'discriminatedUnion') {
      const u = this.parseDiscriminatedUnionContent()
      const firstObj = u.types[0]
      if (firstObj && firstObj.kind === 'object') {
        fields = firstObj.fields
      } else {
        this.error('z.discriminatedUnion at the top level must contain objects')
      }
    } else {
      this.error('Expected z.object(...) or z.discriminatedUnion(...) at the top level')
    }
    
    return { fields, rootName: finalRootName }
  }

  // z.object({ ... })
  private parseObjectContent(): { fields: Field[] } {
    this.expectPunct('(') || this.error('Expected "(" after z.object')
    this.expectPunct('{') || this.error('Expected "{" for object fields')
    const fields = this.parseFields()
    this.expectPunct('}') || this.error('Expected "}" after object fields')
    this.expectPunct(')') || this.error('Expected ")" to close z.object')

    // Check for unsupported chain methods like .extend(), .merge(), .pick(), .omit()
    while (this.expectPunct('.')) {
      const m = this.expect('identifier') as { kind: 'identifier'; name: string } | null
      if (m) {
        this.error(`Unsupported: z.object().${m.name}() is not supported in V1`)
      }
      this.error('Expected method name after "."')
    }

    return { fields }
  }
  private parseFields(): Field[] {
    const fields: Field[] = []
    while (!this.peek('punct', '}')) {
      if (this.peek('eof')) this.error('Unexpected end of input while parsing object fields')

      // Trailing comma
      if (this.peek('punct', ',') && fields.length > 0 && this.peekAhead('punct', '}')) {
        this.consume() // skip trailing comma
        break
      }

      // Comma between fields
      if (fields.length > 0) {
        if (!this.expectPunct(',')) {
          this.error('Expected "," between fields')
        }
      }

      // Optional trailing comma after last field
      if (this.peek('punct', '}')) break

      // Parse key: type
      const keyToken = this.consume()
      let keyName: string
      if (keyToken.kind === 'string') {
        keyName = keyToken.value
      } else if (keyToken.kind === 'identifier') {
        keyName = keyToken.name
      } else {
        this.error(`Expected field name (string or identifier), got ${keyToken.kind}`)
      }
      keyName = keyName!

      this.expectPunct(':') || this.error(`Expected ":" after "${keyName}"`)

      const result = this.parseFieldType()
      fields.push({ name: keyName, type: result.type, optional: result.optional })
    }
    return fields
  }

  // Returns the type and whether modifiers made the field optional.
  private parseFieldType(): { type: FieldType; optional: boolean } {
    let type = this.parseType()
    let optional = false

    // Handle chained modifiers: .optional(), .nullable()
    while (this.expectPunct('.')) {
      const modName = this.expect('identifier') as { kind: 'identifier'; name: string } | null
      if (!modName) this.error('Expected modifier name after "."')

      if (modName.name === 'optional') {
        this.expectPunct('(') || this.error('Expected "(" after .optional')
        this.expectPunct(')') || this.error('Expected ")" to close .optional()')
        optional = true
      } else if (modName.name === 'nullable') {
        this.expectPunct('(') || this.error('Expected "(" after .nullable')
        this.expectPunct(')') || this.error('Expected ")" to close .nullable()')
        type = { kind: 'union', types: [type, { kind: 'null' }] }
      } else {
        // Unknown modifiers (.email(), .min(), .max(), .url(), .trim(), etc.)
        // are validation constraints — they don't change the IR type. Skip them.
        this.skipCall()
      }
    }

    return { type, optional }
  }

  // Parse a type expression: z.string(), z.number(), z.array(...), z.object({...}), etc.
  private parseType(): FieldType {
    if (this.peek('identifier') && !this.peek('identifier', 'z')) {
      // This is a custom identifier reference (e.g. user: HackathonUser)
      // We consume it and gracefully degrade to an unknown type rather than crashing.
      this.consume()
      return { kind: 'unknown' }
    }

    this.parseZ()
    this.expectPunct('.') || this.error('Expected z.methodName(...)')

    const method = this.expect('identifier') as { kind: 'identifier'; name: string } | null
    if (!method) this.error('Expected method name after "z."')

    switch (method.name) {
      case 'string': return this.parseCallNoArgs('string')
      case 'number': return this.parseCallNoArgs('number')
      case 'boolean': return this.parseCallNoArgs('boolean')
      case 'date': return this.parseCallNoArgs('date')
      case 'array': return this.parseArray()
      case 'enum': return this.parseEnum()
      case 'union': return this.parseUnion()
      case 'literal': return this.parseLiteral()
      case 'object': return this.parseObjectType()
      case 'discriminatedUnion': return this.parseDiscriminatedUnionContent()
      default:
        this.error(`Unsupported Zod method: z.${method.name}(). Supported: string, number, boolean, date, array, enum, union, literal, object, discriminatedUnion`)
    }
  }

  private parseDiscriminatedUnionContent(): { kind: 'union', types: FieldType[] } {
    this.expectPunct('(') || this.error('Expected "(" after z.discriminatedUnion')
    // Consume the discriminator key (e.g. "type")
    this.expect('string') || this.error('Expected string literal discriminator key in z.discriminatedUnion')
    this.expectPunct(',') || this.error('Expected "," after discriminator key')
    this.expectPunct('[') || this.error('Expected "[" for union types')
    
    const types: FieldType[] = []
    while (!this.peek('punct', ']')) {
      if (this.peek('eof')) this.error('Unexpected end of input while parsing discriminatedUnion types')
      if (types.length > 0) {
        this.expectPunct(',') || this.error('Expected "," between union members')
      }
      if (this.peek('punct', ']')) break
      types.push(this.parseType())
    }
    this.expectPunct(']') || this.error('Expected "]" after union types')
    this.expectPunct(')') || this.error('Expected ")" to close z.discriminatedUnion()')
    
    if (types.length === 0) {
      this.error('z.discriminatedUnion() must have at least one type')
    }
    return { kind: 'union', types }
  }

  private parseZ(): void {
    const z = this.expect('identifier') as { kind: 'identifier'; name: string } | null
    if (!z || z.name !== 'z') {
      this.error('Expected "z" (the Zod namespace)')
    }
  }

  private parseCallNoArgs(kind: FieldType['kind']): FieldType {
    this.expectPunct('(') || this.error(`Expected "(" after z.${kind}`)
    this.expectPunct(')') || this.error(`Expected ")" to close z.${kind}()`)
    return { kind } as FieldType
  }

  private parseArray(): FieldType {
    this.expectPunct('(') || this.error('Expected "(" after z.array')
    const itemType = this.parseType()
    this.expectPunct(')') || this.error('Expected ")" to close z.array()')
    return { kind: 'array', itemType }
  }

  private parseEnum(): FieldType {
    this.expectPunct('(') || this.error('Expected "(" after z.enum')
    this.expectPunct('[') || this.error('Expected "[" for enum values')
    const values: string[] = []
    while (!this.peek('punct', ']')) {
      if (this.peek('eof')) this.error('Unexpected end of input while parsing enum values')
      if (values.length > 0) {
        this.expectPunct(',') || this.error('Expected "," between enum values')
      }
      if (this.peek('punct', ']')) break // trailing comma

      const val = this.expect('string') as { kind: 'string'; value: string } | null
      if (!val) this.error('Expected string value in z.enum()')
      values.push(val.value)
    }
    this.expectPunct(']') || this.error('Expected "]" after enum values')
    this.expectPunct(')') || this.error('Expected ")" to close z.enum()')
    if (values.length === 0) {
      this.error('z.enum() must have at least one value')
    }
    return { kind: 'enum', values }
  }

  private parseUnion(): FieldType {
    this.expectPunct('(') || this.error('Expected "(" after z.union')
    this.expectPunct('[') || this.error('Expected "[" for union types')
    const types: FieldType[] = []
    while (!this.peek('punct', ']')) {
      if (this.peek('eof')) this.error('Unexpected end of input while parsing union types')
      if (types.length > 0) {
        this.expectPunct(',') || this.error('Expected "," between union members')
      }
      if (this.peek('punct', ']')) break
      types.push(this.parseType())
    }
    this.expectPunct(']') || this.error('Expected "]" after union types')
    this.expectPunct(')') || this.error('Expected ")" to close z.union()')
    if (types.length === 0) {
      this.error('z.union() must have at least one type')
    }

    // Collapse union of string literals into an enum
    const allStringLiteral = types.every(
      t => t.kind === 'literal' && (t as { kind: 'literal'; value: unknown }).value !== null &&
        typeof (t as { kind: 'literal'; value: unknown }).value === 'string',
    )
    if (allStringLiteral && types.length > 0) {
      return {
        kind: 'enum',
        values: types.map(t => String((t as { kind: 'literal'; value: string }).value)),
      }
    }

    return { kind: 'union', types }
  }

  private parseLiteral(): FieldType {
    this.expectPunct('(') || this.error('Expected "(" after z.literal')

    let value: string | number | boolean

    if (this.peek('string')) {
      const t = this.consume()
      value = (t as { kind: 'string'; value: string }).value
    } else if (this.peek('number')) {
      const t = this.consume()
      value = (t as { kind: 'number'; value: number }).value
    } else if (this.peek('identifier')) {
      const name = (this.cur() as { kind: 'identifier'; name: string }).name
      if (name === 'true') { this.consume(); value = true }
      else if (name === 'false') { this.consume(); value = false }
      else if (name === 'null') { this.consume(); value = 'null' }
      else if (name === 'undefined') { this.consume(); value = 'undefined' }
      else this.error(`Unexpected value in z.literal(): "${name}". Expected a string, number, boolean, null, or undefined.`)
    } else {
      this.error('Expected a literal value in z.literal()')
    }

    value = value!

    this.expectPunct(')') || this.error('Expected ")" to close z.literal()')

    // Map null/undefined literals to their type kinds
    if (value === 'null') return { kind: 'null' }
    if (value === 'undefined') return { kind: 'undefined' }
    return { kind: 'literal', value: value as string | number | boolean }
  }

  private parseObjectType(): FieldType {
    this.expectPunct('(') || this.error('Expected "(" after z.object')
    this.expectPunct('{') || this.error('Expected "{" for nested object')
    const fields = this.parseFields()
    this.expectPunct('}') || this.error('Expected "}" after nested object fields')
    this.expectPunct(')') || this.error('Expected ")" to close nested z.object()')

    // Check for unsupported chain methods on nested object
    while (this.expectPunct('.')) {
      const m = this.expect('identifier') as { kind: 'identifier'; name: string } | null
      if (m) {
        this.error(`Unsupported: z.object().${m.name}() inside nested types is not supported`)
      }
      this.error('Expected method name after "."')
    }

    return { kind: 'object', fields }
  }

  // Peek ahead past one token to check for trailing comma detection.
  private peekAhead(kind: Token['kind'], value?: string): boolean {
    if (this.pos + 1 >= this.tokens.length) return false
    const t = this.tokens[this.pos + 1]
    if (t.kind !== kind) return false
    if (value !== undefined) {
      if (t.kind === 'punct') return t.char === value
      return false
    }
    return true
  }
}

// ---------------------------------------------------------------------------
// User-friendly error detection
// ---------------------------------------------------------------------------

function detectNonZodInput(tokens: Token[]): string | null {
  let i = 0
  while (i < tokens.length && tokens[i].kind === 'identifier') {
    const name = (tokens[i] as { name: string }).name
    if (name === 'export') {
      i++
      continue
    }
    if (name === 'import') {
      while (i < tokens.length && tokens[i].kind !== 'eof') {
        if (tokens[i].kind === 'punct' && (tokens[i] as { char: string }).char === ';') {
          i++
          break
        }
        i++
      }
      continue
    }
    break
  }
  if (i < tokens.length && tokens[i].kind === 'identifier') {
    const keyword = (tokens[i] as { name: string }).name
    const typeKeywords: Record<string, string> = {
      interface: 'interface',
      type: 'type',
      class: 'class',
      enum: 'enum',
    }
    const detected = typeKeywords[keyword]
    if (detected) return detected
  }
  if (i < tokens.length && tokens[i].kind === 'punct' && (tokens[i] as { char: string }).char === '{') {
    return 'objectLiteral'
  }
  for (let j = 0; j < tokens.length - 1; j++) {
    if (tokens[j].kind === 'identifier' && (tokens[j] as { name: string }).name === 'z' &&
        tokens[j + 1].kind === 'punct' && (tokens[j + 1] as { char: string }).char === '.') {
      return null
    }
  }
  return 'noZodSchema'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a Zod schema string into the shared IR.
 *
 * @param source - Raw Zod schema code (e.g. `z.object({ name: z.string() })`).
 * @returns ParseResult with rootName="mockSchema" and fields on success, or an error message.
 *
 * @example
 *   parseZod("z.object({ name: z.string(), age: z.number() })")
 *   // → { ok: true, rootName: "mockSchema", fields: [{ name: "name", type: { kind: "string" }, optional: false }, ...] }
 *
 *   parseZod("z.object({ name: z.string() }).refine(...)")
 *   // → { ok: false, error: "Unsupported: z.object().refine() is not supported in V1" }
 */
export function parseZod(source: string): ParseResult {
  if (!source.trim()) {
    return { ok: false, error: 'No input provided. Paste a Zod schema (e.g. z.object({ ... })).' }
  }

  const tokenResult = tokenize(source)
  if (tokenResult.kind === 'error') {
    return { ok: false, error: `Invalid input: ${tokenResult.message}` }
  }

  const misinput = detectNonZodInput(tokenResult.tokens)
  if (misinput) {
    const messages: Record<string, string> = {
      interface: 'This looks like a TypeScript interface. FixtureKit needs a Zod schema (e.g. z.object({ ... })) — see the docs for examples.',
      type: 'This looks like a TypeScript type alias. FixtureKit needs a Zod schema (e.g. z.object({ ... })) — see the docs for examples.',
      class: 'This looks like a TypeScript class. FixtureKit needs a Zod schema (e.g. z.object({ ... })) — see the docs for examples.',
      enum: 'This looks like a TypeScript enum. FixtureKit needs a Zod schema (e.g. z.object({ ... })) — see the docs for examples.',
      objectLiteral: 'This looks like a plain object literal. FixtureKit needs a Zod schema (e.g. z.object({ ... })) — see the docs for examples.',
      noZodSchema: 'No Zod schema found. FixtureKit needs a Zod schema (e.g. z.object({ ... })) — see the docs for examples.',
    }
    return { ok: false, error: messages[misinput] }
  }

  try {
    const parser = new Parser(tokenResult.tokens)
    const { fields, rootName } = parser.parseSchema()

    return {
      ok: true,
      rootName,
      fields,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message.startsWith('Invalid input') ? message : `Could not parse this Zod schema. ${message}` }
  }
}

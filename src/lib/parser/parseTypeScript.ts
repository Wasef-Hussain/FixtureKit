// TypeScript interface / type-alias → IR parser.
//
// Uses the TypeScript compiler API (ts.createSourceFile) to parse a raw string
// into an AST, then walks the AST and converts it into the shared IR types
// defined in ../types.ts.
//
// Supported:
//   interface Foo { ... }
//   type Foo = { ... }
//   Property types: string, number, boolean, Date, null, undefined, unknown
//   Arrays: T[] and Array<T>
//   Nested object types, optional properties
//   String literal unions ("a" | "b" | "c")
//   Number literal types (1 | 2 | 3)
//   Union types (string | null, etc.)
//
// Unsupported (returns clear error):
//   Generics, extends, utility types, classes, intersections, mapped types,
//   conditional types, JSX, decorated properties

import ts from 'typescript'
import type { Field, FieldType, ParseResult } from '../types'

// Derive a human-friendly variable name from the interface/type name.
//   User          → mockUser
//   ProductCategory → mockProductCategory
//   Tags          → mockTags   (preserves plurals, keeps lowercase)
function deriveVarName(rootName: string): string {
  if (rootName.length === 0) return 'mockFixture'
  return 'mock' + rootName.charAt(0).toUpperCase() + rootName.slice(1)
}

// Resolve a TypeScript AST type node into a FieldType IR value.
function resolveType(node: ts.TypeNode): FieldType {
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { kind: 'string' }

    case ts.SyntaxKind.NumberKeyword:
      return { kind: 'number' }

    case ts.SyntaxKind.BooleanKeyword:
      return { kind: 'boolean' }

    case ts.SyntaxKind.NullKeyword:
      return { kind: 'null' }

    case ts.SyntaxKind.UndefinedKeyword:
      return { kind: 'undefined' }

    case ts.SyntaxKind.UnknownKeyword:
      return { kind: 'unknown' }

    case ts.SyntaxKind.ArrayType: {
      const arr = node as ts.ArrayTypeNode
      const itemType = resolveType(arr.elementType)
      // Flatten T[][] while preserving itemType accuracy.
      // If the element is already an array, just nest it.
      return { kind: 'array', itemType }
    }

    case ts.SyntaxKind.TypeReference: {
      const ref = node as ts.TypeReferenceNode
      const name = ref.typeName
      let refName = ''
      if (ts.isIdentifier(name)) {
        refName = name.text
      } else if (ts.isQualifiedName(name)) {
        refName = name.right.text
      }

      // Built-in reference types
      if (refName === 'Date') return { kind: 'date' }

      // Array<T> syntax
      if (refName === 'Array' && ref.typeArguments && ref.typeArguments.length === 1) {
        return { kind: 'array', itemType: resolveType(ref.typeArguments[0]) }
      }

      // ReadonlyArray<T> — treat same as Array<T>
      if (refName === 'ReadonlyArray' && ref.typeArguments && ref.typeArguments.length === 1) {
        return { kind: 'array', itemType: resolveType(ref.typeArguments[0]) }
      }

      // Any other type reference with generics is unsupported — will be caught
      // by the caller during unsupported-construct detection.
      // For a bare unparameterized type reference we can't resolve, treat as unknown.
      return { kind: 'unknown' }
    }

    case ts.SyntaxKind.TypeLiteral: {
      const lit = node as ts.TypeLiteralNode
      const members = lit.members
      const fields = members.map(m => resolvePropertySignature(m)).filter((f): f is Field => f !== null)
      return { kind: 'object', fields }
    }

    case ts.SyntaxKind.UnionType: {
      const union = node as ts.UnionTypeNode
      const types = union.types.map(t => resolveType(t))

      // Collapse union of string literals into an enum for nicer output.
      const allStringLiteral = types.every(t => t.kind === 'literal' && typeof t.value === 'string')
      if (allStringLiteral && types.length > 0) {
        return {
          kind: 'enum',
          values: types.map(t => (t as { kind: 'literal'; value: string }).value as string),
        }
      }

      return { kind: 'union', types }
    }

    case ts.SyntaxKind.LiteralType: {
      const lit = node as ts.LiteralTypeNode
      const literal = lit.literal
      if (ts.isStringLiteral(literal)) {
        return { kind: 'literal', value: literal.text }
      }
      if (ts.isNumericLiteral(literal)) {
        return { kind: 'literal', value: Number(literal.text) }
      }
      // true / false boolean literals
      if (literal.kind === ts.SyntaxKind.TrueKeyword) {
        return { kind: 'literal', value: true }
      }
      if (literal.kind === ts.SyntaxKind.FalseKeyword) {
        return { kind: 'literal', value: false }
      }
      // null / undefined — the TS AST represents these as LiteralType nodes
      // whose inner literal is NullKeyword or UndefinedKeyword.
      if (literal.kind === ts.SyntaxKind.NullKeyword) {
        return { kind: 'null' }
      }
      if (literal.kind === ts.SyntaxKind.UndefinedKeyword) {
        return { kind: 'undefined' }
      }
      return { kind: 'unknown' }
    }

    // Parenthesized type → unwrap
    case ts.SyntaxKind.ParenthesizedType: {
      const pt = node as ts.ParenthesizedTypeNode
      return resolveType(pt.type)
    }

    default:
      return { kind: 'unknown' }
  }
}

// Extract a property name from a PropertySignature node, handling quoted names.
function resolvePropertyName(node: ts.PropertySignature): string {
  const name = node.name
  if (ts.isIdentifier(name)) return name.text
  if (ts.isStringLiteral(name)) return name.text
  if (ts.isNumericLiteral(name)) return name.text
  // Computed property name (e.g., [key: string]) — extract text if possible
  if (ts.isComputedPropertyName(name)) {
    const expr = name.expression
    if (ts.isStringLiteral(expr)) return expr.text
    if (ts.isNumericLiteral(expr)) return expr.text
    return 'unknownKey'
  }
  return 'unknownKey'
}

// Convert a PropertySignature AST node into a Field IR value.
// Returns null for call/method/index signatures (skip quietly).
function resolvePropertySignature(node: ts.Node): Field | null {
  if (!ts.isPropertySignature(node)) return null

  // JSDoc / comments don't matter — the TS API hands us proper nodes.
  if (!node.type) return null

  const name = resolvePropertyName(node)
  const optional = node.questionToken !== undefined
  const fieldType = resolveType(node.type)

  return { name, type: fieldType, optional }
}

// Check whether a TypeAliasDeclaration's type is an object literal shape.
function isTypeLiteralAlias(node: ts.TypeAliasDeclaration): boolean {
  if (!node.type) return false
  // Unwrap parenthesized types
  let t = node.type
  if (ts.isParenthesizedTypeNode(t)) t = t.type
  return ts.isTypeLiteralNode(t)
}

// Detect unsupported constructs in a TypeReferenceNode.
// Returns an error string, or null if the node is supported.
function checkUnsupportedTypeReference(node: ts.TypeReferenceNode): string | null {
  const name = node.typeName
  let refName = ''
  if (ts.isIdentifier(name)) {
    refName = name.text
  } else if (ts.isQualifiedName(name)) {
    // QualifiedName implies namespace access like Foo.Bar — unsupported.
    return `Unsupported type: qualified names (${name.getText()}) are not supported.`
  }

  const hasTypeArgs = node.typeArguments && node.typeArguments.length > 0

  // Known supported type references
  const SUPPORTED = new Set(['Date', 'Array', 'ReadonlyArray'])
  if (SUPPORTED.has(refName)) return null

  // Utility types
  if (hasTypeArgs) {
    const UTILITY = new Set([
      'Partial', 'Required', 'Readonly', 'Record', 'Pick', 'Omit',
      'Exclude', 'Extract', 'NonNullable', 'Parameters', 'ReturnType',
      'InstanceType', 'Awaited',
    ])
    if (UTILITY.has(refName)) {
      return `Unsupported type: utility type "${refName}" is not yet supported.`
    }
    return `Unsupported type: generic type "${refName}" is not yet supported.`
  }

  return null
}

// Walk the source file AST and detect unsupported constructs at the statement level.
function detectUnsupported(sourceFile: ts.SourceFile): string | null {
  for (const stmt of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(stmt)) {
      // Generics
      if (stmt.typeParameters && stmt.typeParameters.length > 0) {
        return `Unsupported: generics are not yet supported ("${stmt.name.text}" has type parameters).`
      }
      // extends
      if (stmt.heritageClauses && stmt.heritageClauses.length > 0) {
        return `Unsupported: interface "extends" is not yet supported.`
      }
      // Walk members for unsupported things
      for (const member of stmt.members) {
        // Method signatures
        if (ts.isMethodSignature(member)) {
          return `Unsupported type: method signatures are not supported. Use a property with a function type instead.`
        }
        // Index signatures
        if (ts.isIndexSignatureDeclaration(member)) {
          return `Unsupported type: index signatures (e.g., [key: string]) are not supported.`
        }
        // Call signatures
        if (ts.isCallSignatureDeclaration(member)) {
          return `Unsupported type: call signatures are not supported.`
        }
        // Check property type references for unsupported generics/utilities
        if (ts.isPropertySignature(member) && member.type) {
          const typeErr = checkTypeNodeForUnsupported(member.type)
          if (typeErr) return typeErr
        }
      }
      continue
    }

    if (ts.isTypeAliasDeclaration(stmt)) {
      // Generics
      if (stmt.typeParameters && stmt.typeParameters.length > 0) {
        return `Unsupported: generics are not yet supported ("${stmt.name.text}" has type parameters).`
      }
      if (!stmt.type) continue

      // Check for unsupported constructs in the type node first (e.g. utility types,
      // generic references) so the error message is more specific.
      const typeErr = checkTypeNodeForUnsupported(stmt.type)
      if (typeErr) return typeErr

      // Then verify it's an object shape
      const t = ts.isParenthesizedTypeNode(stmt.type) ? stmt.type.type : stmt.type
      if (!ts.isTypeLiteralNode(t)) {
        return `Unsupported type: type aliases must be object shapes ("{ ... }"). Found: ${ts.SyntaxKind[t.kind]}.`
      }
      continue
    }

    // class, enum, function, etc.
    if (ts.isClassDeclaration(stmt)) return 'Unsupported: classes are not supported.'
    if (ts.isFunctionDeclaration(stmt)) return 'Unsupported: functions are not supported.'
    if (ts.isEnumDeclaration(stmt)) return 'Unsupported: enums are not supported. Use a string literal union instead.'
  }

  return null
}

// Recursively check a type node for unsupported constructs.
function checkTypeNodeForUnsupported(node: ts.TypeNode): string | null {
  switch (node.kind) {
    case ts.SyntaxKind.IntersectionType:
      return 'Unsupported: intersection types ("&") are not yet supported.'

    case ts.SyntaxKind.TypeReference: {
      const err = checkUnsupportedTypeReference(node as ts.TypeReferenceNode)
      if (err) return err
      // Recurse into type arguments
      const ref = node as ts.TypeReferenceNode
      if (ref.typeArguments) {
        for (const arg of ref.typeArguments) {
          const argErr = checkTypeNodeForUnsupported(arg)
          if (argErr) return argErr
        }
      }
      return null
    }

    case ts.SyntaxKind.UnionType: {
      const union = node as ts.UnionTypeNode
      for (const t of union.types) {
        const err = checkTypeNodeForUnsupported(t)
        if (err) return err
      }
      return null
    }

    case ts.SyntaxKind.ArrayType: {
      const arr = node as ts.ArrayTypeNode
      return checkTypeNodeForUnsupported(arr.elementType)
    }

    case ts.SyntaxKind.TypeLiteral: {
      const lit = node as ts.TypeLiteralNode
      for (const member of lit.members) {
        if (ts.isPropertySignature(member) && member.type) {
          const err = checkTypeNodeForUnsupported(member.type)
          if (err) return err
        }
        if (ts.isMethodSignature(member)) {
          return 'Unsupported type: method signatures are not supported.'
        }
        if (ts.isIndexSignatureDeclaration(member)) {
          return 'Unsupported type: index signatures are not supported.'
        }
      }
      return null
    }

    case ts.SyntaxKind.ParenthesizedType: {
      const pt = node as ts.ParenthesizedTypeNode
      return checkTypeNodeForUnsupported(pt.type)
    }

    case ts.SyntaxKind.MappedType:
      return 'Unsupported: mapped types are not supported.'

    case ts.SyntaxKind.ConditionalType:
      return 'Unsupported: conditional types are not supported.'

    case ts.SyntaxKind.TupleType:
      return 'Unsupported: tuple types are not supported.'

    case ts.SyntaxKind.TypeOperator:
      return 'Unsupported: type operators ("readonly", "keyof", etc.) are not supported.'

    case ts.SyntaxKind.IndexedAccessType:
      return 'Unsupported: indexed access types are not supported.'

    case ts.SyntaxKind.TemplateLiteralType:
      return 'Unsupported: template literal types are not supported.'

    default:
      return null
  }
}

// Walk the source file and extract the first interface or type-alias into IR fields.
function extractFields(sourceFile: ts.SourceFile): { rootName: string; fields: Field[] } | null {
  for (const stmt of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(stmt)) {
      const rootName = stmt.name.text
      const fields: Field[] = []
      for (const member of stmt.members) {
        const field = resolvePropertySignature(member)
        if (field) fields.push(field)
      }
      return { rootName, fields }
    }

    if (ts.isTypeAliasDeclaration(stmt)) {
      // Unwrap parenthesized type
      let typeNode = stmt.type
      if (!typeNode) continue
      if (ts.isParenthesizedTypeNode(typeNode)) typeNode = typeNode.type
      if (!ts.isTypeLiteralNode(typeNode)) return null

      const rootName = stmt.name.text
      const lit = typeNode as ts.TypeLiteralNode
      const fields: Field[] = []
      for (const member of lit.members) {
        const field = resolvePropertySignature(member)
        if (field) fields.push(field)
      }
      return { rootName, fields }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a TypeScript interface or type-alias string into the shared IR.
 *
 * @param source  - Raw TypeScript source code containing an interface or type alias.
 * @returns ParseResult with rootName and fields on success, or an error message on failure.
 *
 * @example
 *   parseTypeScript("interface User { id: string; name: string; }")
 *   // → { ok: true, rootName: "User", fields: [...] }
 *
 *   parseTypeScript("type Box<T> = { value: T }")
 *   // → { ok: false, error: "Unsupported: generics are not yet supported..." }
 */
export function parseTypeScript(source: string): ParseResult {
  if (!source.trim()) {
    return { ok: false, error: 'No input provided. Paste a TypeScript interface or type alias.' }
  }

  let sourceFile: ts.SourceFile
  try {
    // createSourceFile forwards diagnostics (e.g. parse errors) via the optional
    // second argument, but they only help for syntax errors. For unsupported
    // constructs we do our own validation in detectUnsupported().
    sourceFile = ts.createSourceFile(
      'input.ts',
      source,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
    )
  } catch (e) {
    return {
      ok: false,
      error: `Could not parse this schema. ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  // Check for raw parse errors (syntax-level failures).
  // SourceFile.parseDiagnostics is a runtime property populated by the TS parser.
  const parseDiags = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics
  if (parseDiags && parseDiags.length > 0) {
    const messages = parseDiags.map(d =>
      ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    )
    return {
      ok: false,
      error: `Parse error: ${messages.join('; ')}`,
    }
  }

  // Check for unsupported constructs
  const unsupported = detectUnsupported(sourceFile)
  if (unsupported) {
    return { ok: false, error: unsupported }
  }

  // Extract fields from the first interface/type-alias
  const extracted = extractFields(sourceFile)
  if (!extracted) {
    return {
      ok: false,
      error: 'Could not find a TypeScript interface or object-shaped type alias. Supported: interface Foo { ... } or type Foo = { ... }',
    }
  }

  return {
    ok: true,
    rootName: deriveVarName(extracted.rootName),
    fields: extracted.fields,
  }
}

// Re-export deriveVarName for testing
export { deriveVarName }

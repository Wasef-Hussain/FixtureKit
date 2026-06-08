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
//   Utility types: Partial<T>, Required<T>, Pick<T, K>, Omit<T, K>
//
// Unsupported (returns clear error):
//   Generics, extends, classes, intersections, mapped types,
//   conditional types, JSX, decorated properties
//
// ---------------------------------------------------------------------------
// Post-Parse Transformation Approach
// ---------------------------------------------------------------------------
// To support Utility Types like Partial<T> without altering the downstream IR
// (types.ts), we intercept them during AST resolution. If T is an inline
// object or a reference to an interface defined in the same input, we
// recursively resolve its fields, apply the utility's transformation
// (e.g., mark all optional, filter by keys), and return a standard
// { kind: 'object', fields } FieldType. This keeps the IR completely decoupled.

import ts from 'typescript'
import type { Field, FieldType, ParseResult } from '../types'

function deriveVarName(rootName: string): string {
  if (rootName.length === 0) return 'mockFixture'
  return 'mock' + rootName.charAt(0).toUpperCase() + rootName.slice(1)
}

function resolveType(node: ts.TypeNode, sourceFile: ts.SourceFile, resolvingTypes = new Set<string>()): FieldType {
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword: return { kind: 'string' }
    case ts.SyntaxKind.NumberKeyword: return { kind: 'number' }
    case ts.SyntaxKind.BooleanKeyword: return { kind: 'boolean' }
    case ts.SyntaxKind.NullKeyword: return { kind: 'null' }
    case ts.SyntaxKind.UndefinedKeyword: return { kind: 'undefined' }
    case ts.SyntaxKind.UnknownKeyword: return { kind: 'unknown' }

    case ts.SyntaxKind.ArrayType: {
      const arr = node as ts.ArrayTypeNode
      const itemType = resolveType(arr.elementType, sourceFile, resolvingTypes)
      return { kind: 'array', itemType }
    }

    case ts.SyntaxKind.TypeReference: {
      const ref = node as ts.TypeReferenceNode
      const name = ref.typeName
      let refName = ''
      if (ts.isIdentifier(name)) refName = name.text
      else if (ts.isQualifiedName(name)) refName = name.right.text

      if (resolvingTypes.has(refName)) {
        throw new Error("Recursive types are not supported.")
      }
      const newResolving = new Set(resolvingTypes)
      newResolving.add(refName)

      if (refName === 'Record' && ref.typeArguments?.length === 2) {
        return { 
          kind: 'object', 
          fields: [{
            name: 'key',
            type: resolveType(ref.typeArguments[1], sourceFile, newResolving),
            optional: false
          }]
        }
      }

      if (refName === 'Date') return { kind: 'date' }

      if (refName === 'Array' && ref.typeArguments?.length === 1) {
        return { kind: 'array', itemType: resolveType(ref.typeArguments[0], sourceFile, resolvingTypes) }
      }
      if (refName === 'ReadonlyArray' && ref.typeArguments?.length === 1) {
        return { kind: 'array', itemType: resolveType(ref.typeArguments[0], sourceFile, resolvingTypes) }
      }

      // Utility types
      const UTILITY = new Set(['Partial', 'Required', 'Pick', 'Omit', 'Readonly'])
      if (UTILITY.has(refName) && ref.typeArguments && ref.typeArguments.length >= 1) {
        return applyUtilityTransformation(refName, ref.typeArguments, sourceFile, newResolving)
      }

      const decl = findDeclaration(sourceFile, refName)
      if (decl && (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl))) {
        const extracted = extractFieldsFromDecl(decl, sourceFile, newResolving)
        if (extracted) {
          return { kind: 'object', fields: extracted.fields }
        }
      }

      return { kind: 'unknown' }
    }

    case ts.SyntaxKind.TypeLiteral: {
      const lit = node as ts.TypeLiteralNode
      const fields = lit.members.map(m => resolvePropertySignature(m, sourceFile, resolvingTypes)).filter((f): f is Field => f !== null)
      return { kind: 'object', fields }
    }

    case ts.SyntaxKind.UnionType: {
      const union = node as ts.UnionTypeNode
      const types = union.types.map(t => resolveType(t, sourceFile, resolvingTypes))
      const allStringLiteral = types.every(t => t.kind === 'literal' && typeof t.value === 'string')
      if (allStringLiteral && types.length > 0) {
        return { kind: 'enum', values: types.map(t => (t as { kind: 'literal'; value: string }).value as string) }
      }
      return { kind: 'union', types }
    }

    case ts.SyntaxKind.LiteralType: {
      const lit = node as ts.LiteralTypeNode
      const literal = lit.literal
      if (ts.isStringLiteral(literal)) return { kind: 'literal', value: literal.text }
      if (ts.isNumericLiteral(literal)) return { kind: 'literal', value: Number(literal.text) }
      if (literal.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'literal', value: true }
      if (literal.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'literal', value: false }
      if (literal.kind === ts.SyntaxKind.NullKeyword) return { kind: 'null' }
      if (literal.kind === ts.SyntaxKind.UndefinedKeyword) return { kind: 'undefined' }
      return { kind: 'unknown' }
    }

    case ts.SyntaxKind.ParenthesizedType: {
      const pt = node as ts.ParenthesizedTypeNode
      return resolveType(pt.type, sourceFile, resolvingTypes)
    }

    default: return { kind: 'unknown' }
  }
}

function resolvePropertyName(node: ts.PropertySignature): string {
  const name = node.name
  if (ts.isIdentifier(name)) return name.text
  if (ts.isStringLiteral(name)) return name.text
  if (ts.isNumericLiteral(name)) return name.text
  if (ts.isComputedPropertyName(name)) {
    const expr = name.expression
    if (ts.isStringLiteral(expr)) return expr.text
    if (ts.isNumericLiteral(expr)) return expr.text
  }
  return 'unknownKey'
}

function resolvePropertySignature(node: ts.Node, sourceFile: ts.SourceFile, resolvingTypes = new Set<string>()): Field | null {
  if (!ts.isPropertySignature(node)) return null
  if (!node.type) return null

  const name = resolvePropertyName(node)
  const optional = node.questionToken !== undefined
  const fieldType = resolveType(node.type, sourceFile, resolvingTypes)

  return { name, type: fieldType, optional }
}

function applyUtilityTransformation(utilityName: string, typeArgs: ts.NodeArray<ts.TypeNode>, sourceFile: ts.SourceFile, resolvingTypes = new Set<string>()): FieldType {
  const tNode = typeArgs[0]
  let baseFields: Field[] | null = null

  if (ts.isTypeLiteralNode(tNode)) {
    const objType = resolveType(tNode, sourceFile, resolvingTypes)
    if (objType.kind === 'object') baseFields = objType.fields
  } else if (ts.isTypeReferenceNode(tNode) && ts.isIdentifier(tNode.typeName)) {
    const tName = tNode.typeName.text
    const decl = findDeclaration(sourceFile, tName)
    if (!decl) throw new Error(`Cannot resolve ${utilityName}<T>: T (${tName}) must be defined in the same input.`)
    const extracted = extractFieldsFromDecl(decl, sourceFile, resolvingTypes)
    if (extracted) baseFields = extracted.fields
  }

  if (!baseFields) throw new Error(`Cannot resolve ${utilityName}<T>: T must be an object shape.`)

  const fields = baseFields.map(f => ({ ...f }))

  if (utilityName === 'Partial') {
    fields.forEach(f => { f.optional = true })
  } else if (utilityName === 'Required') {
    fields.forEach(f => { f.optional = false })
  } else if (utilityName === 'Pick' || utilityName === 'Omit') {
    const keys = extractLiteralKeys(typeArgs[1])
    if (utilityName === 'Pick') {
      return { kind: 'object', fields: fields.filter(f => keys.includes(f.name)) }
    } else {
      return { kind: 'object', fields: fields.filter(f => !keys.includes(f.name)) }
    }
  }

  return { kind: 'object', fields }
}

function extractLiteralKeys(node: ts.TypeNode): string[] {
  if (!node) return []
  if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) return [node.literal.text]
  if (ts.isUnionTypeNode(node)) {
    const keys: string[] = []
    node.types.forEach(t => {
      if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) keys.push(t.literal.text)
    })
    return keys
  }
  return []
}

function findDeclaration(sourceFile: ts.SourceFile, name: string) {
  for (const stmt of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(stmt) && stmt.name.text === name) return stmt
    if (ts.isTypeAliasDeclaration(stmt) && stmt.name.text === name) return stmt
  }
  return null
}

function checkUnsupportedTypeReference(node: ts.TypeReferenceNode): string | null {
  const name = node.typeName
  let refName = ''
  if (ts.isIdentifier(name)) refName = name.text
  else if (ts.isQualifiedName(name)) return `Unsupported type: qualified names (${name.getText()}) are not supported.`

  const hasTypeArgs = node.typeArguments && node.typeArguments.length > 0

  const SUPPORTED = new Set(['Date', 'Array', 'ReadonlyArray', 'Partial', 'Required', 'Pick', 'Omit', 'Record', 'Readonly'])
  if (SUPPORTED.has(refName)) return null

  if (hasTypeArgs) {
    const UTILITY = new Set(['Exclude', 'Extract', 'NonNullable', 'Parameters', 'ReturnType', 'InstanceType', 'Awaited'])
    if (UTILITY.has(refName)) return `Unsupported type: utility type "${refName}" is not yet supported.`
    return `Unsupported type: generic type "${refName}" is not yet supported.`
  }

  return null
}

function detectUnsupported(sourceFile: ts.SourceFile): string | null {
  for (const stmt of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(stmt)) {
      if (stmt.typeParameters && stmt.typeParameters.length > 0) return `Unsupported: generics are not yet supported ("${stmt.name.text}" has type parameters).`
      if (stmt.heritageClauses && stmt.heritageClauses.length > 0) return `Unsupported: interface "extends" is not yet supported.`
      for (const member of stmt.members) {
        if (ts.isMethodSignature(member)) return `Unsupported type: method signatures are not supported.`
        if (ts.isIndexSignatureDeclaration(member)) return `Unsupported type: index signatures are not supported.`
        if (ts.isCallSignatureDeclaration(member)) return `Unsupported type: call signatures are not supported.`
        if (ts.isPropertySignature(member) && member.type) {
          const typeErr = checkTypeNodeForUnsupported(member.type)
          if (typeErr) return typeErr
        }
      }
      continue
    }

    if (ts.isTypeAliasDeclaration(stmt)) {
      if (stmt.typeParameters && stmt.typeParameters.length > 0) return `Unsupported: generics are not yet supported ("${stmt.name.text}" has type parameters).`
      if (!stmt.type) continue

      const typeErr = checkTypeNodeForUnsupported(stmt.type)
      if (typeErr) return typeErr

      const t = ts.isParenthesizedTypeNode(stmt.type) ? stmt.type.type : stmt.type
      if (ts.isTypeReferenceNode(t)) {
        const refName = ts.isIdentifier(t.typeName) ? t.typeName.text : ''
        if (!['Partial', 'Required', 'Pick', 'Omit', 'Record', 'Readonly'].includes(refName)) {
          return `Unsupported type: type aliases must be object shapes ("{ ... }"). Found: TypeReference (${refName}).`
        }
      } else if (!ts.isTypeLiteralNode(t)) {
        return `Unsupported type: type aliases must be object shapes ("{ ... }"). Found: ${ts.SyntaxKind[t.kind]}.`
      }
      continue
    }

    if (ts.isClassDeclaration(stmt)) return 'Unsupported: classes are not supported.'
    if (ts.isFunctionDeclaration(stmt)) return 'Unsupported: functions are not supported.'
    if (ts.isEnumDeclaration(stmt)) return 'Unsupported: enums are not supported. Use a string literal union instead.'
  }

  return null
}

function checkTypeNodeForUnsupported(node: ts.TypeNode): string | null {
  switch (node.kind) {
    case ts.SyntaxKind.IntersectionType: return 'Unsupported: intersection types ("&") are not yet supported.'
    case ts.SyntaxKind.TypeReference: {
      const err = checkUnsupportedTypeReference(node as ts.TypeReferenceNode)
      if (err) return err
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
        if (ts.isMethodSignature(member)) return 'Unsupported type: method signatures are not supported.'
        if (ts.isIndexSignatureDeclaration(member)) return 'Unsupported type: index signatures are not supported.'
      }
      return null
    }
    case ts.SyntaxKind.ParenthesizedType: {
      const pt = node as ts.ParenthesizedTypeNode
      return checkTypeNodeForUnsupported(pt.type)
    }
    case ts.SyntaxKind.MappedType: return 'Unsupported: mapped types are not supported.'
    case ts.SyntaxKind.ConditionalType: return 'Unsupported: conditional types are not supported.'
    case ts.SyntaxKind.TupleType: return 'Unsupported: tuple types are not supported.'
    case ts.SyntaxKind.TypeOperator: return 'Unsupported: type operators ("readonly", "keyof", etc.) are not supported.'
    case ts.SyntaxKind.IndexedAccessType: return 'Unsupported: indexed access types are not supported.'
    case ts.SyntaxKind.TemplateLiteralType: return 'Unsupported: template literal types are not supported.'
    default: return null
  }
}

function extractFieldsFromDecl(stmt: ts.Statement, sourceFile: ts.SourceFile, resolvingTypes = new Set<string>()): { rootName: string; fields: Field[] } | null {
  if (ts.isInterfaceDeclaration(stmt)) {
    const rootName = stmt.name.text
    const fields: Field[] = []
    for (const member of stmt.members) {
      const field = resolvePropertySignature(member, sourceFile, resolvingTypes)
      if (field) fields.push(field)
    }
    return { rootName, fields }
  }

  if (ts.isTypeAliasDeclaration(stmt)) {
    let typeNode = stmt.type
    if (!typeNode) return null
    if (ts.isParenthesizedTypeNode(typeNode)) typeNode = typeNode.type

    const rootName = stmt.name.text

    if (ts.isTypeReferenceNode(typeNode)) {
      const resolved = resolveType(typeNode, sourceFile, resolvingTypes)
      if (resolved.kind === 'object') return { rootName, fields: resolved.fields }
    }

    if (!ts.isTypeLiteralNode(typeNode)) return null

    const lit = typeNode as ts.TypeLiteralNode
    const fields: Field[] = []
    for (const member of lit.members) {
      const field = resolvePropertySignature(member, sourceFile, resolvingTypes)
      if (field) fields.push(field)
    }
    return { rootName, fields }
  }

  return null
}

function extractFields(sourceFile: ts.SourceFile): { rootName: string; fields: Field[] } | null {
  const candidates: { decl: ts.Statement; extracted: { rootName: string; fields: Field[] } }[] = []

  for (const stmt of sourceFile.statements) {
    const res = extractFieldsFromDecl(stmt, sourceFile)
    if (res) candidates.push({ decl: stmt, extracted: res })
  }

  if (candidates.length === 0) return null

  // 1. Export default
  for (const c of candidates) {
    if (c.decl.modifiers && c.decl.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      return c.extracted
    }
  }

  // 2. Exported type alias
  for (const c of candidates) {
    if (ts.isTypeAliasDeclaration(c.decl) && c.decl.modifiers && c.decl.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      return c.extracted
    }
  }

  // 3. Exported interface
  for (const c of candidates) {
    if (ts.isInterfaceDeclaration(c.decl) && c.decl.modifiers && c.decl.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      return c.extracted
    }
  }

  // 4. Last type alias
  for (let i = candidates.length - 1; i >= 0; i--) {
    if (ts.isTypeAliasDeclaration(candidates[i].decl)) {
      return candidates[i].extracted
    }
  }

  // 5. Last interface (or fallback)
  return candidates[candidates.length - 1].extracted
}

export function parseTypeScript(source: string): ParseResult {
  if (!source.trim()) return { ok: false, error: 'No input provided. Paste a TypeScript interface or type alias.' }

  let sourceFile: ts.SourceFile
  try {
    sourceFile = ts.createSourceFile('input.ts', source, ts.ScriptTarget.Latest, true)
  } catch (e) {
    return { ok: false, error: `Could not parse this schema. ${e instanceof Error ? e.message : String(e)}` }
  }

  const parseDiags = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics
  if (parseDiags && parseDiags.length > 0) {
    const messages = parseDiags.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    return { ok: false, error: `Parse error: ${messages.join('; ')}` }
  }

  const unsupported = detectUnsupported(sourceFile)
  if (unsupported) return { ok: false, error: unsupported }

  let extracted: { rootName: string; fields: Field[] } | null = null
  try {
    extracted = extractFields(sourceFile)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  if (!extracted) {
    return { ok: false, error: 'Could not find a TypeScript interface or object-shaped type alias. Supported: interface Foo { ... } or type Foo = { ... }' }
  }

  return { ok: true, rootName: deriveVarName(extracted.rootName), fields: extracted.fields }
}

// Re-export deriveVarName for testing
export { deriveVarName }

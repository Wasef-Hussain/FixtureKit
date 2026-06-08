import re

with open('src/lib/parser/parseTypeScript.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update resolveType signature
code = code.replace(
    'function resolveType(node: ts.TypeNode, sourceFile: ts.SourceFile): FieldType {',
    'function resolveType(node: ts.TypeNode, sourceFile: ts.SourceFile, resolvingTypes = new Set<string>()): FieldType {'
)

# 2. Update resolveType recursive calls (ArrayType, Array, ReadonlyArray)
code = code.replace(
    'const itemType = resolveType(arr.elementType, sourceFile)',
    'const itemType = resolveType(arr.elementType, sourceFile, resolvingTypes)'
)
code = code.replace(
    "return { kind: 'array', itemType: resolveType(ref.typeArguments[0], sourceFile) }",
    "return { kind: 'array', itemType: resolveType(ref.typeArguments[0], sourceFile, resolvingTypes) }"
)

# 3. Update resolveType UnionType mapping
code = code.replace(
    'const types = union.types.map(t => resolveType(t, sourceFile))',
    'const types = union.types.map(t => resolveType(t, sourceFile, resolvingTypes))'
)

# 4. Update resolveType ParenthesizedType mapping
code = code.replace(
    'return resolveType(pt.type, sourceFile)',
    'return resolveType(pt.type, sourceFile, resolvingTypes)'
)

# 5. Add Cycle Detection and Record handling
type_ref_block_orig = """    case ts.SyntaxKind.TypeReference: {
      const ref = node as ts.TypeReferenceNode
      const name = ref.typeName
      let refName = ''
      if (ts.isIdentifier(name)) refName = name.text
      else if (ts.isQualifiedName(name)) refName = name.right.text

      if (refName === 'Date') return { kind: 'date' }"""

type_ref_block_new = """    case ts.SyntaxKind.TypeReference: {
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
          kind: 'record', 
          keyType: resolveType(ref.typeArguments[0], sourceFile, newResolving), 
          valueType: resolveType(ref.typeArguments[1], sourceFile, newResolving) 
        }
      }

      if (refName === 'Date') return { kind: 'date' }"""
code = code.replace(type_ref_block_orig, type_ref_block_new)

# 6. Update UTILITY handling to pass newResolving
code = code.replace(
    'return applyUtilityTransformation(refName, ref.typeArguments, sourceFile)',
    'return applyUtilityTransformation(refName, ref.typeArguments, sourceFile, newResolving)'
)

# 7. Add named interface resolution in TypeReference
utility_block_orig = """      // Utility types
      const UTILITY = new Set(['Partial', 'Required', 'Pick', 'Omit'])
      if (UTILITY.has(refName) && ref.typeArguments && ref.typeArguments.length >= 1) {
        return applyUtilityTransformation(refName, ref.typeArguments, sourceFile, newResolving)
      }

      return { kind: 'unknown' }
    }"""

utility_block_new = """      // Utility types
      const UTILITY = new Set(['Partial', 'Required', 'Pick', 'Omit'])
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
    }"""
code = code.replace(utility_block_orig, utility_block_new)

# 8. Update TypeLiteral resolution
code = code.replace(
    'const fields = lit.members.map(m => resolvePropertySignature(m, sourceFile)).filter((f): f is Field => f !== null)',
    'const fields = lit.members.map(m => resolvePropertySignature(m, sourceFile, resolvingTypes)).filter((f): f is Field => f !== null)'
)

# 9. Update resolvePropertySignature signature
code = code.replace(
    'function resolvePropertySignature(node: ts.Node, sourceFile: ts.SourceFile): Field | null {',
    'function resolvePropertySignature(node: ts.Node, sourceFile: ts.SourceFile, resolvingTypes = new Set<string>()): Field | null {'
)
code = code.replace(
    'const fieldType = resolveType(node.type, sourceFile)',
    'const fieldType = resolveType(node.type, sourceFile, resolvingTypes)'
)

# 10. Update applyUtilityTransformation
code = code.replace(
    'function applyUtilityTransformation(utilityName: string, typeArgs: ts.NodeArray<ts.TypeNode>, sourceFile: ts.SourceFile): FieldType {',
    'function applyUtilityTransformation(utilityName: string, typeArgs: ts.NodeArray<ts.TypeNode>, sourceFile: ts.SourceFile, resolvingTypes = new Set<string>()): FieldType {'
)
code = code.replace(
    "const objType = resolveType(tNode, sourceFile)",
    "const objType = resolveType(tNode, sourceFile, resolvingTypes)"
)
code = code.replace(
    'const extracted = extractFieldsFromDecl(decl, sourceFile)',
    'const extracted = extractFieldsFromDecl(decl, sourceFile, resolvingTypes)'
)

# 11. Update extractFieldsFromDecl
code = code.replace(
    'function extractFieldsFromDecl(stmt: ts.Statement, sourceFile: ts.SourceFile): { rootName: string; fields: Field[] } | null {',
    'function extractFieldsFromDecl(stmt: ts.Statement, sourceFile: ts.SourceFile, resolvingTypes = new Set<string>()): { rootName: string; fields: Field[] } | null {'
)
code = code.replace(
    'const field = resolvePropertySignature(member, sourceFile)',
    'const field = resolvePropertySignature(member, sourceFile, resolvingTypes)'
)

# 12. Support Record in checkUnsupportedTypeReference
code = code.replace(
    "const SUPPORTED = new Set(['Date', 'Array', 'ReadonlyArray', 'Partial', 'Required', 'Pick', 'Omit'])",
    "const SUPPORTED = new Set(['Date', 'Array', 'ReadonlyArray', 'Partial', 'Required', 'Pick', 'Omit', 'Record'])"
)

with open('src/lib/parser/parseTypeScript.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("Refactored parseTypeScript.ts")

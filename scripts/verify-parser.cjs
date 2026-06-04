// Standalone verification script for the TypeScript parser.
// Runs 10 example inputs and prints the resulting IR.
// Run: node scripts/verify-parser.cjs

const ts = require('typescript');

// ---------------------------------------------------------------------------
// Inline copy of parser logic (same as src/lib/parser/parseTypeScript.ts)
// ---------------------------------------------------------------------------

function deriveVarName(rootName) {
  if (rootName.length === 0) return 'mockFixture';
  return 'mock' + rootName.charAt(0).toUpperCase() + rootName.slice(1);
}

function resolveType(node) {
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword: return 'string';
    case ts.SyntaxKind.NumberKeyword: return 'number';
    case ts.SyntaxKind.BooleanKeyword: return 'boolean';
    case ts.SyntaxKind.NullKeyword: return 'null';
    case ts.SyntaxKind.UndefinedKeyword: return 'undefined';
    case ts.SyntaxKind.UnknownKeyword: return 'unknown';

    case ts.SyntaxKind.ArrayType: {
      const arr = node;
      return { kind: 'array', itemType: resolveType(arr.elementType) };
    }

    case ts.SyntaxKind.TypeReference: {
      const ref = node;
      let refName = '';
      if (ts.isIdentifier(ref.typeName)) refName = ref.typeName.text;
      else if (ts.isQualifiedName(ref.typeName)) refName = ref.typeName.right.text;
      if (refName === 'Date') return 'date';
      if ((refName === 'Array' || refName === 'ReadonlyArray') && ref.typeArguments?.length === 1)
        return { kind: 'array', itemType: resolveType(ref.typeArguments[0]) };
      return 'unknown';
    }

    case ts.SyntaxKind.TypeLiteral: {
      const lit = node;
      const fields = lit.members
        .map(m => resolvePropertySignature(m))
        .filter(Boolean);
      return { kind: 'object', fields };
    }

    case ts.SyntaxKind.UnionType: {
      const union = node;
      const types = union.types.map(t => resolveType(t));
      const allStrLit = types.every(
        t => typeof t === 'object' && t.kind === 'literal' && typeof t.value === 'string'
      );
      if (allStrLit && types.length > 0) {
        return { kind: 'enum', values: types.map(t => t.value) };
      }
      return { kind: 'union', types };
    }

    case ts.SyntaxKind.LiteralType: {
      const lit = node;
      const literal = lit.literal;
      if (ts.isStringLiteral(literal)) return { kind: 'literal', value: literal.text };
      if (ts.isNumericLiteral(literal)) return { kind: 'literal', value: Number(literal.text) };
      if (literal.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'literal', value: true };
      if (literal.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'literal', value: false };
      // null / undefined — TS AST uses LiteralType for these
      if (literal.kind === ts.SyntaxKind.NullKeyword) return 'null';
      if (literal.kind === ts.SyntaxKind.UndefinedKeyword) return 'undefined';
      return 'unknown';
    }

    case ts.SyntaxKind.ParenthesizedType: {
      return resolveType(node.type);
    }

    default:
      return 'unknown';
  }
}

function resolvePropertyName(node) {
  if (ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isStringLiteral(node.name)) return node.name.text;
  if (ts.isNumericLiteral(node.name)) return node.name.text;
  return 'unknownKey';
}

function resolvePropertySignature(node) {
  if (!ts.isPropertySignature(node) || !node.type) return null;
  const name = resolvePropertyName(node);
  const optional = node.questionToken !== undefined;
  const fieldType = resolveType(node.type);
  return { name, type: fieldType, optional };
}

function detectUnsupported(sourceFile) {
  for (const stmt of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(stmt)) {
      if (stmt.typeParameters?.length)
        return `Unsupported: generics are not yet supported ("${stmt.name.text}" has type parameters).`;
      if (stmt.heritageClauses?.length)
        return `Unsupported: interface "extends" is not yet supported.`;
      for (const member of stmt.members) {
        if (ts.isMethodSignature(member))
          return 'Unsupported type: method signatures are not supported.';
        if (ts.isIndexSignatureDeclaration(member))
          return 'Unsupported type: index signatures are not supported.';
        if (ts.isPropertySignature(member) && member.type) {
          const e = checkTypeNodeForUnsupported(member.type);
          if (e) return e;
        }
      }
      continue;
    }
    if (ts.isTypeAliasDeclaration(stmt)) {
      if (stmt.typeParameters?.length)
        return `Unsupported: generics are not yet supported ("${stmt.name.text}" has type parameters).`;
      if (!stmt.type) continue;
      // Check unsupported constructs first (utility types, generics) for better error messages
      const typeErr = checkTypeNodeForUnsupported(stmt.type);
      if (typeErr) return typeErr;
      const t = ts.isParenthesizedTypeNode(stmt.type) ? stmt.type.type : stmt.type;
      if (!ts.isTypeLiteralNode(t))
        return `Unsupported type: type aliases must be object shapes.`;
      continue;
    }
    if (ts.isClassDeclaration(stmt)) return 'Unsupported: classes are not supported.';
    if (ts.isEnumDeclaration(stmt)) return 'Unsupported: enums are not supported.';
  }
  return null;
}

function checkUnsupportedTypeReference(node) {
  let refName = '';
  if (ts.isIdentifier(node.typeName)) refName = node.typeName.text;
  else if (ts.isQualifiedName(node.typeName))
    return `Unsupported type: qualified names not supported.`;
  const hasArgs = node.typeArguments?.length > 0;
  const SUPPORTED = new Set(['Date', 'Array', 'ReadonlyArray']);
  if (SUPPORTED.has(refName)) return null;
  if (hasArgs) {
    const UTILITY = new Set([
      'Partial', 'Required', 'Readonly', 'Record', 'Pick', 'Omit',
      'Exclude', 'Extract', 'NonNullable', 'Parameters', 'ReturnType',
      'InstanceType', 'Awaited',
    ]);
    if (UTILITY.has(refName))
      return `Unsupported type: utility type "${refName}" is not yet supported.`;
    return `Unsupported type: generic type "${refName}" is not yet supported.`;
  }
  return null;
}

function checkTypeNodeForUnsupported(node) {
  switch (node.kind) {
    case ts.SyntaxKind.IntersectionType:
      return 'Unsupported: intersection types ("&") are not yet supported.';
    case ts.SyntaxKind.TypeReference: {
      const err = checkUnsupportedTypeReference(node);
      if (err) return err;
      if (node.typeArguments) {
        for (const arg of node.typeArguments) {
          const e = checkTypeNodeForUnsupported(arg);
          if (e) return e;
        }
      }
      return null;
    }
    case ts.SyntaxKind.UnionType:
      for (const t of node.types) { const e = checkTypeNodeForUnsupported(t); if (e) return e; }
      return null;
    case ts.SyntaxKind.ArrayType:
      return checkTypeNodeForUnsupported(node.elementType);
    case ts.SyntaxKind.TypeLiteral:
      for (const m of node.members) {
        if (ts.isPropertySignature(m) && m.type) {
          const e = checkTypeNodeForUnsupported(m.type); if (e) return e;
        }
        if (ts.isMethodSignature(m))
          return 'Unsupported type: method signatures are not supported.';
      }
      return null;
    case ts.SyntaxKind.MappedType: return 'Unsupported: mapped types are not supported.';
    case ts.SyntaxKind.ConditionalType: return 'Unsupported: conditional types are not supported.';
    case ts.SyntaxKind.TupleType: return 'Unsupported: tuple types are not supported.';
    case ts.SyntaxKind.TypeOperator: return 'Unsupported: type operators not supported.';
    case ts.SyntaxKind.IndexedAccessType: return 'Unsupported: indexed access types not supported.';
    case ts.SyntaxKind.TemplateLiteralType: return 'Unsupported: template literal types not supported.';
    default: return null;
  }
}

function extractFields(sourceFile) {
  for (const stmt of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(stmt)) {
      const fields = stmt.members.map(m => resolvePropertySignature(m)).filter(Boolean);
      return { rootName: stmt.name.text, fields };
    }
    if (ts.isTypeAliasDeclaration(stmt)) {
      let t = stmt.type;
      if (!t) continue;
      if (ts.isParenthesizedTypeNode(t)) t = t.type;
      if (!ts.isTypeLiteralNode(t)) return null;
      const fields = t.members.map(m => resolvePropertySignature(m)).filter(Boolean);
      return { rootName: stmt.name.text, fields };
    }
  }
  return null;
}

function parseTypeScript(source) {
  if (!source.trim()) return { ok: false, error: 'No input provided.' };
  let sourceFile;
  try {
    sourceFile = ts.createSourceFile('input.ts', source, ts.ScriptTarget.Latest, true);
  } catch (e) {
    return { ok: false, error: `Parse failed: ${e.message}` };
  }
  const diags = sourceFile.parseDiagnostics || [];
  if (diags.length > 0)
    return { ok: false, error: `Syntax error: ${diags.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('; ')}` };
  const u = detectUnsupported(sourceFile);
  if (u) return { ok: false, error: u };
  const extracted = extractFields(sourceFile);
  if (!extracted) return { ok: false, error: 'No interface or object-shaped type alias found.' };
  return { ok: true, rootName: deriveVarName(extracted.rootName), fields: extracted.fields };
}

// ---------------------------------------------------------------------------
// Pretty-printing
// ---------------------------------------------------------------------------

function fmtType(t) {
  if (typeof t === 'string') return t;
  switch (t.kind) {
    case 'literal': return JSON.stringify(t.value);
    case 'array': return `array<${fmtType(t.itemType)}>`;
    case 'object': return `{ ${t.fields.map(f => f.name + (f.optional ? '?' : '') + ': ' + fmtType(f.type)).join('; ')} }`;
    case 'union': return t.types.map(fmtType).join(' | ');
    case 'enum': return t.values.map(v => JSON.stringify(v)).join(' | ');
    default: return t.kind;
  }
}

function fmtFlat(t) {
  if (typeof t === 'string') return t;
  switch (t.kind) {
    case 'literal': return `literal<${typeof t.value === 'string' ? `"${t.value}"` : t.value}>`;
    case 'array': return `array<${fmtFlat(t.itemType)}>`;
    case 'object': return `object{${t.fields.map(f => f.name).join(',')}}`;
    case 'union': return `union[${t.types.map(fmtFlat).join(',')}]`;
    case 'enum': return `enum<${t.values.map(v => `"${v}"`).join('|')}>`;
    default: return t.kind;
  }
}

let testNum = 0;
function test(label, input) {
  testNum++;
  const r = parseTypeScript(input);
  const border = '─'.repeat(70);
  console.log(`\n${border}`);
  console.log(`Test ${testNum}: ${label}`);
  console.log(border);
  console.log(`Input:\n  ${input.replace(/\n/g, '\n  ')}`);
  console.log();
  if (r.ok) {
    console.log(`  rootName: "${r.rootName}"`);
    console.log(`  fields (${r.fields.length}):`);
    for (const f of r.fields) {
      console.log(`    ${f.name}${f.optional ? '?' : ''}: ${fmtFlat(f.type)}`);
    }
    console.log();
    console.log('  Full IR:');
    console.log(`  ${JSON.stringify(r.fields, null, 4).replace(/\n/g, '\n  ')}`);
  } else {
    console.log(`  ERROR: ${r.error}`);
  }
}

// ==========================================================================
// 10 TEST CASES
// ==========================================================================

test('01 — Simple interface (flat, all primitive types)',
  `interface User {\n  id: string;\n  name: string;\n  age: number;\n  isActive: boolean;\n}`);

test('02 — Nested object',
  `interface Order {\n  user: { id: string; email: string };\n  total: number;\n}`);

test('03 — Array (T[] syntax + objects)',
  `interface Blog {\n  title: string;\n  posts: Post[];\n}`);

test('04 — Array (Array<T> syntax)',
  `interface Config {\n  tags: Array<string>;\n}`);

test('05 — Optional field',
  `interface Post {\n  title: string;\n  subtitle?: string;\n}`);

test('06 — Union (string | null)',
  `interface Item {\n  deletedAt: Date | null;\n}`);

test('07 — Enum (string literal union)',
  `type Status = {\n  value: 'active' | 'inactive' | 'pending';\n}`);

test('08 — Date type',
  `interface Event {\n  createdAt: Date;\n  updatedAt: Date;\n}`);

test('09 — Unsupported: generic interface',
  `interface Box<T> {\n  value: T;\n}`);

test('10 — Unsupported: utility type',
  `type PartialUser = Partial<User>`);

test('11 — **BONUS** Type alias object shape',
  `type Product = {\n  name: string;\n  price: number;\n};`);

test('12 — **BONUS** Union of number literals',
  `type Rating = {\n  score: 1 | 2 | 3 | 4 | 5;\n}`);

console.log(`\n${'─'.repeat(70)}`);
console.log('All 12 test cases complete.');

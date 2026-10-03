import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let tsInstance = null;

function getTs() {
  if (!tsInstance) {
    try {
      tsInstance = require('typescript');
    } catch {
      tsInstance = null;
    }
  }
  return tsInstance;
}

const CODE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts']);
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx']);

function getScriptKind(ext) {
  const ts = getTs();
  if (!ts) return undefined;
  const normalized = (ext || '').toLowerCase();
  switch (normalized) {
    case '.ts':
    case '.mts':
    case '.cts':
      return ts.ScriptKind.TS;
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.js':
    case '.mjs':
    case '.cjs':
    default:
      return ts.ScriptKind.JS;
  }
}

function cleanAbstract(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/^(\/\*\*|\/\*|\/\/|#+)/, '')
    .replace(/\*\/$/, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s*#/]+/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts single-line purpose/abstract and exported symbols array from content.
 *
 * @param {string} content - Source file text content
 * @param {string} ext - File extension (e.g. '.js', '.ts', '.md')
 * @returns {{ abstract: string, exportedSymbols: string[] }}
 */
export function extractL0Abstract(content, ext = '') {
  if (typeof content !== 'string') {
    return { abstract: '', exportedSymbols: [] };
  }

  const normalizedExt = (ext || '').toLowerCase();

  // Handle Markdown
  if (MARKDOWN_EXTENSIONS.has(normalizedExt)) {
    const headings = [];
    let title = '';
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const text = match[2].trim();
        headings.push(text);
        if (!title) {
          title = text;
        }
      }
    }

    if (!title && lines.length > 0) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('<!--')) {
          title = trimmed;
          break;
        }
      }
    }

    return {
      abstract: cleanAbstract(title),
      exportedSymbols: headings,
    };
  }

  let abstract = '';
  const exportedSymbols = new Set();

  // Extract top-level comment / JSDoc for abstract
  const blockCommentMatch = content.match(/^\s*\/\*\*?([\s\S]*?)\*\//);
  if (blockCommentMatch) {
    abstract = cleanAbstract(blockCommentMatch[1]);
  } else {
    const lineCommentMatch = content.match(/^\s*\/\/\s*(.*)/);
    if (lineCommentMatch) {
      abstract = cleanAbstract(lineCommentMatch[1]);
    }
  }

  const ts = getTs();
  if (ts && CODE_EXTENSIONS.has(normalizedExt)) {
    try {
      const scriptKind = getScriptKind(normalizedExt);
      const sourceFile = ts.createSourceFile('file' + normalizedExt, content, ts.ScriptTarget.Latest, true, scriptKind);

      function hasExportModifier(node) {
        if (!node.modifiers) return false;
        return node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      }

      function hasDefaultModifier(node) {
        if (!node.modifiers) return false;
        return node.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      }

      for (const statement of sourceFile.statements) {
        if (hasExportModifier(statement)) {
          if (ts.isFunctionDeclaration(statement) && statement.name) {
            exportedSymbols.add(statement.name.text);
          } else if (ts.isClassDeclaration(statement) && statement.name) {
            exportedSymbols.add(statement.name.text);
          } else if (ts.isInterfaceDeclaration(statement) && statement.name) {
            exportedSymbols.add(statement.name.text);
          } else if (ts.isTypeAliasDeclaration(statement) && statement.name) {
            exportedSymbols.add(statement.name.text);
          } else if (ts.isEnumDeclaration(statement) && statement.name) {
            exportedSymbols.add(statement.name.text);
          } else if (ts.isVariableStatement(statement)) {
            for (const decl of statement.declarationList.declarations) {
              if (decl.name && ts.isIdentifier(decl.name)) {
                exportedSymbols.add(decl.name.text);
              }
            }
          }
        }

        if (ts.isExportDeclaration(statement)) {
          if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
            for (const el of statement.exportClause.elements) {
              exportedSymbols.add(el.name.text);
            }
          }
        } else if (ts.isExportAssignment(statement)) {
          if (statement.expression && ts.isIdentifier(statement.expression)) {
            exportedSymbols.add(statement.expression.text);
          } else {
            exportedSymbols.add('default');
          }
        } else if (hasDefaultModifier(statement)) {
          if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
            exportedSymbols.add(statement.name.text);
          } else {
            exportedSymbols.add('default');
          }
        }
      }
    } catch {
      // Safe fallback if AST parsing encounters edge cases
    }
  }

  // Fallback regex scan for exports if AST found nothing or TS unavailable
  if (exportedSymbols.size === 0 && CODE_EXTENSIONS.has(normalizedExt)) {
    const exportRegex = /export\s+(?:default\s+)?(?:(?:async\s+)?function\s+([a-zA-Z0-9_$]+)|class\s+([a-zA-Z0-9_$]+)|(?:const|let|var|type|interface|enum)\s+([a-zA-Z0-9_$]+))/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3];
      if (name) exportedSymbols.add(name);
    }
  }

  return {
    abstract: abstract || (exportedSymbols.size > 0 ? `Exports: ${Array.from(exportedSymbols).join(', ')}` : ''),
    exportedSymbols: Array.from(exportedSymbols),
  };
}

/**
 * Extracts compacted AST skeleton with function/method bodies replaced with
 * `{ throw new Error("[COMPACTED SKELETON: IMPLEMENTATION STRIPPED - DO NOT EXECUTE]"); }`.
 *
 * Multi-tier fallback:
 * 1. TypeScript Compiler API AST transformation for code files (.ts, .tsx, .js, etc.)
 * 2. Markdown outline extraction for .md
 * 3. Safe fallback for other files or parse errors
 *
 * @param {string} content - Source file text content
 * @param {string} ext - File extension
 * @returns {string} Compacted skeleton text
 */
export function extractL1Skeleton(content, ext = '') {
  if (typeof content !== 'string') return '';
  const normalizedExt = (ext || '').toLowerCase();

  // Tier 2: Non-code (Markdown) outline extraction
  if (MARKDOWN_EXTENSIONS.has(normalizedExt)) {
    const outlineLines = [];
    for (const line of content.split(/\r?\n/)) {
      if (/^#{1,6}\s+/.test(line)) {
        outlineLines.push(line);
      }
    }
    return outlineLines.join('\n');
  }

  // Tier 1: TypeScript Compiler API AST transformation
  const ts = getTs();
  if (ts && CODE_EXTENSIONS.has(normalizedExt)) {
    try {
      const scriptKind = getScriptKind(normalizedExt);
      const sourceFile = ts.createSourceFile('file' + normalizedExt, content, ts.ScriptTarget.Latest, true, scriptKind);

      const dummyBody = ts.factory.createBlock(
        [
          ts.factory.createThrowStatement(
            ts.factory.createNewExpression(ts.factory.createIdentifier('Error'), undefined, [
              ts.factory.createStringLiteral('[COMPACTED SKELETON: IMPLEMENTATION STRIPPED - DO NOT EXECUTE]'),
            ])
          ),
        ],
        true
      );

      const transformer = (context) => {
        const visitor = (node) => {
          if (ts.isFunctionDeclaration(node)) {
            if (node.body) {
              return ts.factory.updateFunctionDeclaration(
                node,
                node.modifiers,
                node.asteriskToken,
                node.name,
                node.typeParameters,
                node.parameters,
                node.type,
                dummyBody
              );
            }
            return node;
          }

          if (ts.isMethodDeclaration(node)) {
            if (node.body) {
              return ts.factory.updateMethodDeclaration(
                node,
                node.modifiers,
                node.asteriskToken,
                node.name,
                node.questionToken,
                node.typeParameters,
                node.parameters,
                node.type,
                dummyBody
              );
            }
            return node;
          }

          if (ts.isConstructorDeclaration(node)) {
            if (node.body) {
              return ts.factory.updateConstructorDeclaration(node, node.modifiers, node.parameters, dummyBody);
            }
            return node;
          }

          if (ts.isGetAccessorDeclaration(node)) {
            if (node.body) {
              return ts.factory.updateGetAccessorDeclaration(node, node.modifiers, node.name, node.parameters, node.type, dummyBody);
            }
            return node;
          }

          if (ts.isSetAccessorDeclaration(node)) {
            if (node.body) {
              return ts.factory.updateSetAccessorDeclaration(node, node.modifiers, node.name, node.parameters, dummyBody);
            }
            return node;
          }

          if (ts.isArrowFunction(node)) {
            return ts.factory.updateArrowFunction(
              node,
              node.modifiers,
              node.typeParameters,
              node.parameters,
              node.type,
              node.equalsGreaterThanToken,
              dummyBody
            );
          }

          if (ts.isFunctionExpression(node)) {
            return ts.factory.updateFunctionExpression(
              node,
              node.modifiers,
              node.asteriskToken,
              node.name,
              node.typeParameters,
              node.parameters,
              node.type,
              dummyBody
            );
          }

          return ts.visitEachChild(node, visitor, context);
        };
        return (sf) => ts.visitNode(sf, visitor);
      };

      const result = ts.transform(sourceFile, [transformer]);
      const transformedSourceFile = result.transformed[0];
      const printer = ts.createPrinter({ removeComments: false });
      const printed = printer.printFile(transformedSourceFile);
      result.dispose();
      return printed;
    } catch {
      // Safe fallback on parse error
    }
  }

  // Tier 3: Safe fallback for parse errors or unsupported non-code
  return `// [COMPACTED SKELETON: IMPLEMENTATION STRIPPED - DO NOT EXECUTE]\n${content.slice(0, 500)}`;
}

---
id: compiler-ast
title: AST（抽象構文木）の基礎と TypeScript における活用
sidebar_position: 1
tags: [AST, TypeScript, コンパイラ, 言語処理系, LSP]
last_update:
  date: 2026-03-06
---

# AST（抽象構文木）の基礎と TypeScript における活用

## 概要

AST（Abstract Syntax Tree、抽象構文木）とは、ソースコードの構文構造を木構造で表現したデータ構造である。コンパイラやインタプリタの中核をなす中間表現であり、リンター・フォーマッター・IDE の補完機能など、現代の開発ツールの多くが AST を基盤として動作している。本ドキュメントでは AST の基礎概念を整理し、TypeScript コンパイラを例にその具体的な役割を解説する。

## 背景・動機

フロントエンド開発では ESLint、Prettier、TypeScript コンパイラなど AST を内部的に利用するツールを日常的に使っているが、その仕組みを理解する機会は少ない。AST の基礎を理解することで、カスタム ESLint ルールの作成、コードの自動変換（codemods）、静的解析ツールの構築といった応用が可能になる。

## 調査内容

### AST とは何か

AST はソースコードを解析（パース）した結果として得られる木構造データである[[1]](#参考リンク)。プログラムの各構成要素（変数宣言、関数呼び出し、演算子など）がノードとなり、親子関係でコード全体の構造を表現する。

例えば `1 + 2;` というコードは以下のような AST になる[[9]](#参考リンク):

```json title="1 + 2; の AST 表現"
{
  "type": "ExpressionStatement",
  "expression": {
    "type": "BinaryExpression",
    "left": { "type": "Literal", "value": 1 },
    "operator": "+",
    "right": { "type": "Literal", "value": 2 }
  }
}
```

重要なのは、AST は**抽象**構文木であるという点だ。具象構文木（CST: Concrete Syntax Tree）がソースコードの全ての構文要素（括弧、セミコロン、空白など）を保持するのに対し、AST はプログラムの意味に関係する情報のみを抽出する[[1]](#参考リンク)。

### コンパイラにおける AST の位置づけ

一般的なコンパイラの処理パイプラインにおいて、AST は以下の位置に存在する:

```
ソースコード → 字句解析(Scanner) → トークン列 → 構文解析(Parser) → AST → 意味解析 → コード生成
```

- **字句解析（Scanner/Lexer）**: ソースコードの文字列をトークン（キーワード、識別子、リテラルなど）に分割する
- **構文解析（Parser）**: トークン列を文法規則に基づいて AST に変換する
- **意味解析**: AST を走査して型チェックやスコープ解決などを行う

### TypeScript コンパイラのアーキテクチャ

TypeScript コンパイラ（`tsc`）は 5 つの主要コンポーネントで構成されている[[3]](#参考リンク):

```
ソースコード → Scanner → トークン → Parser → AST → Binder → シンボル → Checker → 型検証
                                                                   AST + Checker → Emitter → JavaScript
```

| コンポーネント | ファイル | 役割 |
|---|---|---|
| **Scanner** | `scanner.ts` | ソースコードをトークン列に変換 |
| **Parser** | `parser.ts` | トークン列から AST を生成 |
| **Binder** | `binder.ts` | AST ノードからシンボル（変数・関数の宣言情報）を生成し、宣言間を接続 |
| **Checker** | `checker.ts` | シンボルと AST を用いて型の整合性を検証 |
| **Emitter** | `emitter.ts` | AST から JavaScript コードを生成 |

構文的に正しくても意味的に誤っているコード（例: `let x: number = "hello"`）は、Parser では問題なく AST に変換されるが、Checker が型エラーとして検出する[[3]](#参考リンク)。

### TypeScript Compiler API による AST 操作

TypeScript は Compiler API を公開しており、プログラムから AST を操作できる[[2]](#参考リンク):

```typescript title="ast-example.ts"
import * as ts from "typescript";

// プログラムの作成と型チェッカーの取得
const program = ts.createProgram(["example.ts"], {});
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile("example.ts");

if (sourceFile) {
  // AST を再帰的に走査する
  ts.forEachChild(sourceFile, function visit(node) {
    // ノードの種類を判別（型ガード関数を使用）
    if (ts.isVariableDeclaration(node) && node.name) {
      const symbol = checker.getSymbolAtLocation(node.name);
      if (symbol) {
        const type = checker.getTypeOfSymbolAtLocation(symbol, node);
        console.log(
          `変数: ${symbol.getName()}, 型: ${checker.typeToString(type)}`
        );
      }
    }
    ts.forEachChild(node, visit);
  });
}
```

各ノードは `SyntaxKind` という列挙型で種類が識別され、`ts.isVariableDeclaration()` のような型ガード関数で安全にノードの種類を判別できる。[AST Viewer](https://ts-ast-viewer.com/) を使えば、任意の TypeScript コードの AST 構造をブラウザで確認できる[[4]](#参考リンク)。

### ts-morph: TypeScript AST 操作の高レベルラッパー

TypeScript Compiler API は低レベルで扱いが複雑なため、**ts-morph** というラッパーライブラリがよく使われる[[5]](#参考リンク)。ts-morph は AST の探索・変更をより直感的な API で提供する:

```typescript title="ts-morph-example.ts"
import { Project } from "ts-morph";

const project = new Project();
const sourceFile = project.addSourceFileAtPath("example.ts");

// 全ての関数宣言を取得
const functions = sourceFile.getFunctions();
for (const func of functions) {
  console.log(`関数名: ${func.getName()}`);
  console.log(`パラメータ数: ${func.getParameters().length}`);
  console.log(`戻り値の型: ${func.getReturnType().getText()}`);
}

// プログラムによるコード変更（リファクタリング）
sourceFile.getFunction("oldName")?.rename("newName");
sourceFile.saveSync();
```

### AST と型システムの関係

AST 単体ではソースコードの構造情報しか持たない。型情報を扱うには、AST の上に構築された**型チェッカー**が必要になる[[2]](#参考リンク)。

TypeScript の型チェッカーが行う処理:

1. **型推論**: 明示的な型注釈がない場合、AST ノードの文脈から型を推論する
2. **型の整合性検証**: 代入・関数呼び出し・演算において型の互換性を検証する
3. **シンボル解決**: インポートやスコープチェーンを辿り、識別子が参照する宣言を特定する

```typescript title="type-checker-example.ts"
import * as ts from "typescript";

// Type Checker で AST を超えた型情報を取得する例
function analyzeType(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isTypeAliasDeclaration(node)) {
    const type = checker.getTypeAtLocation(node.name);
    // 型のプロパティを列挙
    for (const prop of type.getProperties()) {
      const propType = checker.getTypeOfSymbolAtLocation(prop, node);
      console.log(`${prop.getName()}: ${checker.typeToString(propType)}`);
    }
  }
}
```

AST は構文の「骨格」を、型チェッカーはその骨格に「意味」を付与する関係にある。この二層構造により、構文解析と意味解析を分離して段階的に処理できる。

### Language Server Protocol（LSP）と AST

**Language Server Protocol（LSP）** は、エディタと言語サーバー間の通信を標準化するプロトコルである[[7]](#参考リンク)。言語サーバーの内部では AST が中核的な役割を果たしている。

#### 言語サーバーの仕組み

言語サーバーは以下のように動作する:

1. エディタがソースコードの変更を言語サーバーに通知する
2. 言語サーバーがコードをパースして AST を構築する
3. AST を走査・解析して、補完候補・定義ジャンプ・診断情報などを提供する
4. 結果を JSON-RPC でエディタに返す

エラートレラントパーサー（不完全なコードでも意味のある AST を生成できるパーサー）が重要であり、ユーザーが入力中の不完全なコードに対しても補完やエラー表示を行う必要がある[[7]](#参考リンク)。

#### Volar.js: フレームワーク固有の言語サーバー

**Volar.js** は、Vue の Single File Component（`.vue`ファイル）のような、複数言語が埋め込まれたファイル形式に対応する言語サーバーフレームワークである[[8]](#参考リンク)。内部的に TypeScript の言語サービスをプロキシ接続し、フレームワーク固有の AST 解析と TypeScript の型チェックを統合している。Volar.js は Vue に限らず、Astro や Svelte など任意のファイル形式に対応可能な汎用設計になっている。

### AST ベースの実用ツール

#### typescript-eslint

typescript-eslint は TypeScript コードに対して ESLint ルールを適用するためのツールチェーンである[[9]](#参考リンク)。内部的に2種類の AST を扱う:

- **ESTree AST**: JavaScript の標準的な AST 仕様。ESLint のルールはこの形式で動作する
- **TypeScript AST**: TypeScript コンパイラが生成する AST。型情報へのアクセスに使用する

typescript-eslint のパーサーはこの2つの AST 間でノードの対応関係を追跡し、ESLint ルールから TypeScript の型チェック API にアクセスできるようにしている。

#### ast-grep

**ast-grep**（sg）は、AST ベースの構造的なコード検索・置換ツールである[[10]](#参考リンク)。通常の `grep` がテキストパターンで検索するのに対し、ast-grep は構文構造を考慮した検索が可能:

```bash
# console.log(...) の呼び出しを全て検索
sg --pattern 'console.log($$$ARGS)' --lang ts

# console.log を logger.debug に置換
sg --pattern 'console.log($$$ARGS)' --rewrite 'logger.debug($$$ARGS)' --lang ts
```

内部的には tree-sitter を使ったパースを行い、パターンマッチングで AST ノードを検索する。テキストベースの正規表現では対応できない、構文を考慮した正確な検索・置換が可能になる。

## 検証結果

[TypeScript AST Viewer](https://ts-ast-viewer.com/) で以下のコードの AST 構造を確認した:

```typescript title="検証コード"
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return `Hello, ${user.name}!`;
}
```

このコードは以下のような AST ノード構造に変換される:

```
SourceFile
+-- InterfaceDeclaration (User)
|   +-- Identifier ("User")
|   +-- PropertySignature (name: string)
|   |   +-- Identifier ("name")
|   |   \-- StringKeyword
|   \-- PropertySignature (age: number)
|       +-- Identifier ("age")
|       \-- NumberKeyword
\-- FunctionDeclaration (greet)
    +-- Identifier ("greet")
    +-- Parameter (user: User)
    |   +-- Identifier ("user")
    |   \-- TypeReference (User)
    +-- StringKeyword (戻り値型)
    \-- Block
        \-- ReturnStatement
            \-- TemplateExpression
```

`InterfaceDeclaration` や `PropertySignature` は TypeScript 固有のノードであり、ESTree 仕様には存在しない。これが TypeScript AST と ESTree AST の違いの一例である。

## まとめ

- AST はソースコードの構造を木構造で表現した中間表現であり、コンパイラ・リンター・フォーマッター・IDE など開発ツール全般の基盤技術である
- TypeScript コンパイラは Scanner → Parser → Binder → Checker → Emitter の 5 段階で処理し、AST は Parser が生成する
- AST は構文情報のみを持ち、型情報は Checker（型チェッカー）が AST を走査して付与する。この分離が段階的な処理を可能にしている
- Language Server Protocol（LSP）では、言語サーバーが AST を構築・解析して IDE 機能（補完・定義ジャンプ・診断）を提供する
- ts-morph や ast-grep といったツールを使えば、AST を活用したコード解析・変換を実務で手軽に行える
- TypeScript Compiler API を直接使えば、型情報を含むより深い静的解析も可能

## 参考リンク

1. [抽象構文木 - Wikipedia](https://ja.wikipedia.org/wiki/%E6%8A%BD%E8%B1%A1%E6%A7%8B%E6%96%87%E6%9C%A8)
2. [Going beyond the AST with the TypeScript Type Checker - Satellytes](https://www.satellytes.com/blog/post/typescript-ast-type-checker/)
3. [TypeScript Compiler Internals - TypeScript Deep Dive](https://basarat.gitbook.io/typescript/overview)
4. [TypeScript AST Viewer](https://ts-ast-viewer.com/)
5. [ts-morph - Documentation](https://ts-morph.com/)
6. [AST-based refactoring with ts-morph - kimmo.blog](https://kimmo.blog/posts/8-ast-based-refactoring-with-ts-morph/)
7. [Language Server Protocol - Official Page](https://microsoft.github.io/language-server-protocol/)
8. [Volar: a New Beginning - The Vue Point](https://blog.vuejs.org/posts/volar-a-new-beginning)
9. [ASTs and typescript-eslint](https://typescript-eslint.io/blog/asts-and-typescript-eslint/)
10. [ast-grep | structural search/rewrite tool](https://ast-grep.github.io/)

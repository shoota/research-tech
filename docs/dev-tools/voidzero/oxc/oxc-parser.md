---
id: oxc-parser
title: OXC Parser - 最速のJavaScript/TypeScriptパーサー
description: "SWCの3倍・Biomeの5倍高速なRust製JS/TSパーサー。OXCツールチェーン全体の基盤コンポーネントとしての役割と性能を調査。"
sidebar_position: 4
tags: [oxc, parser, ast, javascript, typescript, rust]
last_update:
  date: 2026-05-28
---

# OXC Parser - 最速のJavaScript/TypeScriptパーサー

## 概要

OXC ParserはRustで実装されたJavaScript/TypeScriptパーサーで、SWCの3倍・Biomeの5倍高速である。OXCツールチェーン全体の基盤コンポーネントとして機能する。

## 背景・動機

JavaScript/TypeScriptのパース処理は、リンター・フォーマッター・バンドラー・トランスパイラーなどあらゆるツールの入口となる。パーサーの性能がツールチェーン全体のボトルネックとなるため、高速なパーサーは開発者体験全体の改善に直結する[[1]](#参考リンク)。

## 調査内容

### パフォーマンス

- **SWCパーサーの3倍高速**
- **Biomeの5倍高速**（ただしBiomeはCST（具体的構文木）を生成するため、直接比較には注意が必要）[[2]](#参考リンク)

公式トップページに掲載されている計測例（Macbook Pro M3 Max、`typescript.js` のパース）[[4]](#参考リンク)：

| パーサー | 処理時間 |
|---------|---------|
| OXC | 26.3 ms |
| SWC | 84.1 ms |
| Biome | 130.1 ms |

### 対応言語

- JavaScript（`.js`, `.mjs`, `.cjs`）
- JSX（`.jsx`）
- TypeScript（`.ts`, `.mts`, `.cts`）
- TSX（`.tsx`）

### 標準準拠

- **Test262 Stage 4テストを全パス**
- **Babelテストの99%をパス**
- **TypeScriptテストの99%をパス**[[1]](#参考リンク)

### 機能

- ESM情報（import/export）を外部ツール不要で直接返却
- TypeScriptチェッカーとの統合
- ツーリング向けAST（抽象構文木）を生成

### 利用形態

#### Node.js

```bash
pnpm add oxc-parser
```

```ts title="parse-example.ts"
import { parseSync } from "oxc-parser";

const source = `
  const greeting: string = "Hello, OXC!";
  export default greeting;
`;

// parseSync で AST を取得
const result = parseSync("example.ts", source);
console.log(result.program); // AST のルートノード
```

`parseSync()`はプログラムオブジェクトを返し、AST（抽象構文木）にアクセスできる[[1]](#参考リンク)。

#### Rust

```toml title="Cargo.toml"
[dependencies]
oxc = { version = "*", features = ["parser"] }
# または個別 crate
oxc_ast = "*"
oxc_parser = "*"
```

### OXCツールチェーン内での位置づけ

OXC Parserは他のすべてのOXCプロダクトの基盤である：

```
ソースコード
  \-- Parser (AST生成)
        +-- Oxlint (リント)
        +-- Oxfmt (フォーマット)
        +-- Transformer (変換)
        \-- Minifier (圧縮)
```

Rolldownもバンドル時のコード解析にOXC Parserを使用している[[3]](#参考リンク)。2026年5月にリリースされた **Rolldown 1.0 安定版** でも基盤コンポーネントとして利用されている[[5]](#参考リンク)。

### 既知の制限事項

公式ドキュメントによると、現時点では以下の制限がある[[1]](#参考リンク)：

- コメントの出力は未サポート（将来的に対応予定）

### 新たな採用事例

2026年4月にVoidZeroチームが発表した **Oxc-based Angular Compiler** では、OXC Parser を起点にAngularテンプレートを Rust で解析。型チェックをスキップする設計により、Angular CLI 比6.4倍、Webpack ベース Angular ツールチェーン比 20.7倍の高速化を達成した[[6]](#参考リンク)。

## 直近のアップデート（2026-04〜2026-05）

GitHubリリースから抽出した主な変更点：

- セマンティック分析が識別子のハッシュ事前計算により **約4〜6%高速化**[[7]](#参考リンク)
- rest assignment 構文に対するエラーメッセージの改善
- スコープハンドリングの強化
- enumのインライン化精度向上

## まとめ

OXC ParserはJavaScript/TypeScriptパーサーとして業界最速クラスの性能を持ち、Test262の全テストをパスする高い標準準拠性を実現している。npm パッケージ（`oxc-parser`）としてNode.jsから、Rust crateとしてRustから利用可能で、OXCエコシステム全体および Rolldown 1.0、Oxc-based Angular Compiler の基盤として広く採用されている。

## 参考リンク

1. [OXC Parser - 公式ドキュメント](https://oxc.rs/docs/guide/usage/parser)
2. [All Benchmarks - OXC公式](https://oxc.rs/docs/guide/benchmarks)
3. [OXC GitHub リポジトリ](https://github.com/oxc-project/oxc)
4. [OXC 公式サイト](https://oxc.rs/)
5. [Announcing Rolldown 1.0](https://voidzero.dev/posts/announcing-rolldown-1-0)
6. [How we made the Angular Compiler faster using AI](https://voidzero.dev/posts/oxc-angular-compiler)
7. [What's New in ViteLand: February 2026 Recap](https://voidzero.dev/posts/whats-new-feb-2026)

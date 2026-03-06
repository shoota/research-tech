---
id: oxc-transformer
title: OXC Transformer - 高速TS/JSX変換
sidebar_position: 5
tags: [oxc, transformer, typescript, jsx, babel, swc, rust]
last_update:
  date: 2026-03-06
---

# OXC Transformer - 高速TS/JSX変換

## 概要

OXC TransformerはTypeScript・JSX・モダンJavaScriptの変換（トランスパイル）を行うツールである。SWCの4倍・Babelの40倍高速で、メモリ消費も大幅に削減している。

## 背景・動機

TypeScriptやJSXの変換処理はビルドパイプラインの中核であり、Babel・SWCが広く使われてきた。OXC TransformerはOXC Parserの高速なAST生成を基盤として、変換処理も桁違いの高速化を実現する[[1]](#参考リンク)。

## 調査内容

### パフォーマンス

| 比較対象 | 速度 | メモリ | パッケージサイズ |
|---------|------|--------|----------------|
| vs SWC | 4倍高速 | 20%削減 | 35MB削減 |
| vs Babel | 40倍高速 | 70%削減 | 19MB削減 |

[[2]](#参考リンク)

### 対応する変換

#### TypeScript変換

TypeScriptコードからJavaScriptへの変換。型注釈の除去、enum・namespaceの変換などを行う。

#### JSX変換

JSX構文をJavaScriptに変換。React Fast Refreshにもビルトインで対応している。

#### ESNext → ES2015ローダリング

モダンJavaScript構文をES2015互換のコードに変換する。

#### Isolated Declarations

TypeScriptコンパイラを使用せずに`.d.ts`宣言ファイルを生成する機能。ライブラリ開発で型定義ファイルの生成を高速化できる。

#### グローバル変数置換

ビルド時に特定の変数を定数値に置換する（`define`相当の機能）。

## 検証結果

### Node.jsからの利用

```bash
pnpm add oxc-transform
```

```ts title="transform-example.ts"
import { transform } from "oxc-transform";

const result = transform("app.tsx", `
  interface Props {
    name: string;
  }

  const App: React.FC<Props> = ({ name }) => {
    return <div>Hello, {name}!</div>;
  };

  export default App;
`);

console.log(result.code);
// 型注釈除去 + JSX変換後のJavaScriptが出力される
```

### ビルドツール統合

以下のプラグインで既存ビルドツールに統合可能[[1]](#参考リンク)：

| プラグイン | 対応環境 |
|-----------|---------|
| `unplugin-oxc` | Vite / Rollup / webpack / esbuild 等 |
| `unplugin-isolated-decl` | `.d.ts`生成用 |
| `oxc-webpack-loader` | webpack専用ローダー |

```bash title="unplugin-oxcのインストール"
pnpm add -D unplugin-oxc
```

### Rust からの利用

```toml title="Cargo.toml"
[dependencies]
oxc = { version = "*", features = ["transformer"] }
```

## まとめ

OXC Transformerは現在アルファ版だが、Babelの40倍という圧倒的な速度差と大幅なメモリ削減を実現している。Rolldown経由でVite 8のビルドパイプラインに組み込まれており、実質的に広範な本番利用が進んでいる。`unplugin-oxc`を使えば既存のビルド環境にも容易に統合できる。

## 参考リンク

1. [OXC Transformer - 公式ドキュメント](https://oxc.rs/docs/guide/usage/transformer)
2. [All Benchmarks - OXC公式](https://oxc.rs/docs/guide/benchmarks)
3. [OXC GitHub リポジトリ](https://github.com/oxc-project/oxc)

---
id: oxc-overview
title: OXC（The JavaScript Oxidation Compiler）全体像
sidebar_position: 1
tags: [oxc, rust, javascript, toolchain, voidzero]
last_update:
  date: 2026-03-06
---

# OXC（The JavaScript Oxidation Compiler）全体像

## 概要

OXC（読み：オー・エックス・シー）は、Rustで構築されたJavaScript/TypeScript向け高性能ツール群である。VoidZero社が開発を主導し、Viteエコシステムの次世代基盤として位置付けられている。

:::info 関連ドキュメント
- [VoidZero エコシステム全体像 - プロダクト・成熟度・言語選定](../voidzero-ecosystem)
- [Vite 8 + Rolldown - Rustベースの次世代ビルドツール](../vite/vite8-rolldown)
- [Vite+ - 統合ツールチェーンとモノレポサポート](../vite/vite-plus)
:::

## 背景・動機

JavaScript開発ツールチェーンは長年、パフォーマンスの課題を抱えてきた。ESLint・Prettier・webpack・Babelなど広く使われるツールはJavaScriptで書かれており、大規模プロジェクトではリント・フォーマット・ビルドに数分かかることも珍しくない。OXCはこの問題をRustによるネイティブ実装で根本的に解決するプロジェクトとして誕生した[[1]](#参考リンク)。

## 設計思想

OXCは4つの原則に基づいて設計されている[[2]](#参考リンク)。

### 1. パフォーマンスは機能である

速度向上はローカル開発のフィードバックループを改善し、CIコストを削減する。パフォーマンス劣化はバグとして扱われる。

### 2. 共有ビルディングブロック

リンター・フォーマッター・パーサー・トランスフォーマー・ミニファイアー・リゾルバーが共通基盤の上に構築され、一貫性を確保しつつ重複作業を排除している。

### 3. 正確性と明確な境界

予測可能な動作を優先し、他ツールとの動作差異は偶然の互換性ではなくドキュメントで明示する。

### 4. 実用的な開発者体験

合理的なデフォルト設定、理解しやすい設定体系、安定した出力を重視する。

## プロダクト一覧

OXCは以下の6つのプロダクトで構成される。

| プロダクト | npm パッケージ | Rust Crate | ステータス | 概要 |
|-----------|---------------|------------|-----------|------|
| **Oxlint** | `oxlint` | - | 安定版（v1.0） | 最速のJavaScript/TypeScriptリンター |
| **Oxfmt** | `oxfmt` | - | ベータ版 | Prettier互換の最速フォーマッター |
| **Parser** | `oxc-parser` | `oxc_parser` | 安定版 | 最速のJS/TSパーサー |
| **Transformer** | `oxc-transform` | `oxc_transformer` | アルファ版 | TS/JSX/モダンJS変換 |
| **Minifier** | `oxc-minify` | `oxc_minifier` | アルファ版 | 最速のミニファイアー |
| **Resolver** | `oxc-resolver` | `oxc_resolver` | 安定版 | 最速のモジュールリゾルバー |

## ベンチマーク比較

各プロダクトの競合ツールとの速度比較[[3]](#参考リンク)：

| プロダクト | 比較対象 | 速度差 |
|-----------|---------|--------|
| Parser | SWC | 3倍高速 |
| Parser | Biome | 5倍高速 |
| Transformer | SWC | 4倍高速・メモリ20%削減 |
| Transformer | Babel | 40倍高速・メモリ70%削減 |
| Oxlint | ESLint | 50〜100倍高速 |
| Oxfmt | Prettier | 35倍高速 |
| Oxfmt | Biome | 3倍高速 |
| Resolver | enhanced-resolve | 30倍高速 |

## VoidZeroエコシステムにおける位置づけ

OXCはVoidZero社が推進する統一ツールチェーンの基盤コンパイラ層として機能する[[4]](#参考リンク)。

```
Vite+ (CLI / DX レイヤー)
  \-- Vite 8 (ビルドツール)
        \-- Rolldown (バンドラー)
              \-- OXC (コンパイラ基盤)
                    +-- Parser
                    +-- Transformer
                    +-- Minifier
                    \-- Resolver
```

**Rolldown**はVite 8のバンドラーとしてesbuild + Rollupの組み合わせを置き換え、内部でOXCのParser・Transformer・Minifier・Resolverを使用している[[5]](#参考リンク)。

**Vite+**はViteの上位互換CLIとして開発中で、プロジェクトスキャフォールディング・テスト・リント・フォーマット・ライブラリバンドルをワンストップで提供する計画である[[6]](#参考リンク)。

## 採用事例

以下の主要プロジェクト・企業がOXCを採用している[[1]](#参考リンク)：

- **Rolldown** - Parser・Transformer・Minifier・Resolverを使用
- **Nuxt** - Parserを採用
- **Shopify・Airbnb・Miro** - Oxlintを本番利用
- **Turborepo・Hugging Face・Lichess** - Oxlint/Oxfmtへ移行
- **Preact・date-fns・PostHog** - Oxlintを本番利用
- **Nova・swc-node・knip** - Resolverを使用

## 各プロダクト詳細

各プロダクトの詳細は個別ドキュメントを参照：

- [Oxlint（リンター）](./oxc-oxlint.md)
- [Oxfmt（フォーマッター）](./oxc-oxfmt.md)
- [Parser（パーサー）](./oxc-parser.md)
- [Transformer（トランスフォーマー）](./oxc-transformer.md)
- [Minifier（ミニファイアー）](./oxc-minifier.md)
- [Resolver（リゾルバー）](./oxc-resolver.md)

## まとめ

OXCはJavaScriptツールチェーンの性能ボトルネックをRust実装で解消するプロジェクトであり、単体ツールとしてだけでなくVite/Rolldownエコシステムの基盤として急速に浸透している。特にOxlintとOxfmtは既に本番利用可能なレベルに達しており、ESLint・Prettierからの移行先として現実的な選択肢となっている。

VoidZeroのVite+構想が実現すれば、開発者はプロジェクト全体のツールチェーンをOXCベースの統一環境に移行できるようになる。

## 参考リンク

1. [OXC GitHub リポジトリ](https://github.com/oxc-project/oxc)
2. [What is Oxc? - 公式ドキュメント](https://oxc.rs/docs/guide/what-is-oxc)
3. [All Benchmarks - OXC公式](https://oxc.rs/docs/guide/benchmarks)
4. [Announcing VoidZero](https://voidzero.dev/posts/announcing-voidzero-inc)
5. [Vite 8 Beta: The Rolldown-powered Vite](https://voidzero.dev/posts/announcing-vite-8-beta)
6. [Announcing Vite+](https://voidzero.dev/posts/announcing-vite-plus)
7. [OXC 公式サイト](https://oxc.rs/)

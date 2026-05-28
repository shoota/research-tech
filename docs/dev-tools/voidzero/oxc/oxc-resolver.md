---
id: oxc-resolver
title: OXC Resolver - 最速のモジュールリゾルバー
description: "webpackのenhanced-resolveの30倍高速なRust製モジュールリゾルバー。CJS・ESM両対応のパス解決アルゴリズムと設定体系を解説。"
sidebar_position: 7
tags: [oxc, resolver, module-resolution, node, webpack, rust]
last_update:
  date: 2026-05-28
---

# OXC Resolver - 最速のモジュールリゾルバー

## 概要

OXC Resolver は Node.js 互換のモジュールパス解決ツールで、webpack の `enhanced-resolve` の **28〜30倍高速** である[[1]](#参考リンク)[[4]](#参考リンク)。CJS・ESM 両方の解決アルゴリズムをサポートし、webpack と同じ設定体系を持つ。

## 背景・動機

モジュール解決（`import`や`require`のパスから実際のファイルパスを特定する処理）は、バンドラー・リンター・エディタツールなどが頻繁に実行する基本処理である。webpackの`enhanced-resolve`が広く使われてきたが、パフォーマンスが課題だった。OXC Resolverはこの処理をRustで実装し、30倍の高速化を実現している[[1]](#参考リンク)。

## 調査内容

### パフォーマンス

- **webpack の enhanced-resolve の 28〜30倍高速**[[2]](#参考リンク)[[4]](#参考リンク)（ベンチマークページは30倍、トップページは28倍表記）
- 詳細ベンチマーク: [oxc-project/bench-resolver](https://github.com/oxc-project/bench-resolver)

### 互換性

- すべての設定が`webpack/enhanced-resolve`と整合[[1]](#参考リンク)
- CommonJS（CJS）解決アルゴリズムをサポート
- ECMAScript Modules（ESM）解決アルゴリズムをサポート
- `exports`フィールド、`imports`フィールド、`browser`フィールド等のpackage.json仕様に対応

### 採用状況

以下のプロジェクトがOXC Resolverを採用している[[3]](#参考リンク)：

- **Rolldown 1.0** - バンドラーのモジュール解決（2026年5月に安定版リリース）[[5]](#参考リンク)
- **Nova** - モジュール解決基盤
- **swc-node** - モジュール解決
- **knip** - 未使用コード検出ツールのモジュール解決
- **Oxlint** - リンター内のモジュールグラフ構築
- **Vite+ Alpha** - 統一ツールチェーンのモジュール解決層[[6]](#参考リンク)

## 検証結果

### Node.jsからの利用

```bash
pnpm add oxc-resolver
```

### Rustからの利用

```toml title="Cargo.toml"
[dependencies]
oxc_resolver = "*"
```

### 設定オプション

webpackの`resolve`設定と同等のオプションが利用可能：

- `alias` - モジュールエイリアス
- `extensions` - 拡張子の自動解決
- `mainFields` - package.jsonのメインフィールド指定
- `conditionNames` - exports条件名
- `modules` - モジュール検索ディレクトリ

## まとめ

OXC Resolver はモジュール解決に特化した安定版プロダクトで、enhanced-resolve との完全な設定互換性を持つ。28〜30倍の高速化により、特にモノレポのような大量のモジュール解決が必要な環境で効果を発揮する。Rolldown 1.0・Oxlint・knip・Vite+ など主要ツールに広く採用されており、OXC プロダクト群の中でも特に実績のあるコンポーネントである。

## 参考リンク

1. [OXC Resolver - 公式ドキュメント](https://oxc.rs/docs/guide/usage/resolver)
2. [All Benchmarks - OXC公式](https://oxc.rs/docs/guide/benchmarks)
3. [OXC GitHub リポジトリ](https://github.com/oxc-project/oxc)
4. [OXC 公式サイト](https://oxc.rs/)
5. [Announcing Rolldown 1.0](https://voidzero.dev/posts/announcing-rolldown-1-0)
6. [Announcing Vite+ Alpha](https://voidzero.dev/posts/announcing-vite-plus-alpha)

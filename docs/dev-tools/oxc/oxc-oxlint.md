---
id: oxc-oxlint
title: Oxlint - 最速のJavaScript/TypeScriptリンター
sidebar_position: 2
tags: [oxc, oxlint, linter, eslint, rust]
last_update:
  date: 2026-03-06
---

# Oxlint - 最速のJavaScript/TypeScriptリンター

## 概要

OxlintはOXCコンパイラスタック上に構築されたJavaScript/TypeScript向けリンターである。ESLintと比較して50〜100倍高速で、690以上のルールを搭載している。

## 背景・動機

ESLintはJavaScriptエコシステムの標準リンターだが、大規模プロジェクトでは実行時間が問題になる。特にCI環境での数分のリント時間はフィードバックループを遅延させる。OxlintはRustのネイティブ実装でこの問題を解決し、ESLintエコシステムとの互換性を維持しつつ桁違いの高速化を実現する[[1]](#参考リンク)。

## 調査内容

### 主な特徴

- **ESLintの50〜100倍高速**（CPUコア数に依存）[[2]](#参考リンク)
- **690以上のルール搭載**: ESLintコア・TypeScript・React・Jest・Unicorn・jsx-a11y等のプラグイン相当をネイティブ実装
- **型認識リンティング**: TypeScript 7（tsgo）のGo移植版を内蔵し、型情報を用いた高度なチェックが可能
- **マルチファイル分析**: プロジェクト全体のモジュールグラフを構築し、`import/no-cycle`等のルールを高速に実行
- **自動修正**: `--fix`オプションで自動修正をサポート
- **ゼロ設定**: 合理的なデフォルト設定で即座に利用開始可能

### 対応ファイル形式

| 形式 | 拡張子 |
|------|--------|
| JavaScript | `.js`, `.mjs`, `.cjs` |
| TypeScript | `.ts`, `.mts`, `.cts` |
| JSX/TSX | `.jsx`, `.tsx` |
| フレームワーク | Vue・Svelte・Astroの`<script>`ブロック |

### JavaScriptプラグインサポート

2025年10月にJavaScriptプラグイン機能がサポートされた[[3]](#参考リンク)。これにより、npmに公開されている約28万のESLintプラグインの多くが修正なしで動作する。

#### Raw Transfer アーキテクチャ

従来はRustからJavaScriptへのデータ転送がボトルネックだったが、新アーキテクチャでは処理済みコードを透過的に共有する仕組み（Raw Transfer）を実現。これによりJavaScriptプラグインが**86%高速化**（1,360ms → 189ms）され、Rustに匹敵するパフォーマンスを達成した[[3]](#参考リンク)。

### 型認識リンティング

TypeScript 7のGo移植版（tsgo）を内蔵し、以下のような型情報が必要なルールをサポートする：

- `strict-boolean-expressions` - 厳密なブール式チェック
- `no-deprecated` - 非推奨API使用検出
- `prefer-includes` - `indexOf` → `includes` 推奨
- `no-floating-promises` - 未処理Promise検出

`tsconfig.json`の並行検索により型チェック処理も高速化されている[[4]](#参考リンク)。

## 検証結果

### インストールと基本的な使い方

```bash title="インストール"
pnpm add -D oxlint
```

```json title="package.json"
{
  "scripts": {
    "lint": "oxlint",
    "lint:fix": "oxlint --fix"
  }
}
```

### 設定ファイル

```json title="oxlint.json"
{
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "error",
    "react/exhaustive-deps": "error"
  },
  "plugins": ["react", "typescript", "unicorn"],
  "ignorePatterns": ["dist/", "node_modules/"]
}
```

2026年1月からは動的設定ファイル（`oxlint.config.ts`）もサポートされている[[4]](#参考リンク)。

### ESLintからの移行

#### 段階的移行（大規模リポジトリ推奨）

OxlintとESLintを並行実行し、重複ルールを`eslint-plugin-oxlint`で無効化する方法：

```bash
# ESLint側でOxlintが担当するルールを無効化
pnpm add -D eslint-plugin-oxlint
```

```js title="eslint.config.js"
import oxlint from "eslint-plugin-oxlint";

export default [
  // ... 既存の設定
  oxlint.configs["flat/recommended"],
];
```

#### 完全置き換え

`@oxlint/migrate`を使ってESLint設定を一括移行する：

```bash
npx @oxlint/migrate
```

### エディタ統合

- **VS Code**: Oxc拡張機能が提供されている
- **Zed**: ネイティブ統合で診断・コードアクションを直接利用可能[[4]](#参考リンク)

## まとめ

OxlintはESLintのドロップイン代替として実用段階に達しており、以下のような場面で特に効果的である：

- **大規模モノレポ**: 数分かかっていたリントが数秒に短縮
- **CI/CD**: フィードバックループの大幅な高速化
- **型認識リンティング**: tsgoによりTypeScript固有の問題を高速に検出

JavaScriptプラグインサポートにより、既存のESLintプラグイン資産も活用可能となり、移行障壁が大幅に低下している。

## 参考リンク

1. [Oxlint - 公式ドキュメント](https://oxc.rs/docs/guide/usage/linter)
2. [All Benchmarks - OXC公式](https://oxc.rs/docs/guide/benchmarks)
3. [Announcing Oxlint JavaScript Plugin Support - VoidZero](https://voidzero.dev/posts/announcing-oxlint-js-plugins)
4. [What's New in ViteLand: January 2026 Recap](https://voidzero.dev/posts/whats-new-jan-2026)
5. [OXC GitHub リポジトリ](https://github.com/oxc-project/oxc)

---
id: oxc-oxlint
title: Oxlint - 最速のJavaScript/TypeScriptリンター
description: "ESLintの50〜100倍高速なRust製リンターOxlintの特徴、690以上のルール、ESLintとの互換性と移行方法を解説。"
sidebar_position: 2
tags: [oxc, oxlint, linter, eslint, rust]
last_update:
  date: 2026-05-28
---

# Oxlint - 最速のJavaScript/TypeScriptリンター

## 概要

OxlintはOXCコンパイラスタック上に構築されたJavaScript/TypeScript向けリンターである。ESLintと比較して50〜100倍高速で、**801以上のルール**を搭載している（2026年5月時点、公式表記）[[6]](#参考リンク)。最新版は **v1.67.0**（2026-05-26リリース）[[7]](#参考リンク)。

## 背景・動機

ESLintはJavaScriptエコシステムの標準リンターだが、大規模プロジェクトでは実行時間が問題になる。特にCI環境での数分のリント時間はフィードバックループを遅延させる。OxlintはRustのネイティブ実装でこの問題を解決し、ESLintエコシステムとの互換性を維持しつつ桁違いの高速化を実現する[[1]](#参考リンク)。

## 調査内容

### 主な特徴

- **ESLintの50〜100倍高速**（CPUコア数に依存）[[2]](#参考リンク)
- **801以上のルール搭載**: ESLintコア・TypeScript・React・Jest・Vitest・Import・Unicorn・jsx-a11y等のプラグイン相当をネイティブ実装[[6]](#参考リンク)
- **型認識リンティング**: TypeScript（tsgo）のGo移植版を内蔵し、型情報を用いた高度なチェックが可能
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

2025年10月にプレビュー版として公開された JavaScript プラグイン機能が、**2026年3月に Alpha として正式リリース**された[[3]](#参考リンク)[[8]](#参考リンク)。これにより、npm に公開されている約28万の ESLint プラグインの多くが修正なしで動作する。公式表記では **「near-100% ESLint プラグイン互換」かつ「最大100倍高速」** を実現している[[8]](#参考リンク)。

#### Raw Transfer アーキテクチャ

従来はRustからJavaScriptへのデータ転送がボトルネックだったが、新アーキテクチャでは処理済みコードを透過的に共有する仕組み（Raw Transfer）を実現。これによりJavaScriptプラグインが**86%高速化**（1,360ms → 189ms）され、Rustに匹敵するパフォーマンスを達成した[[3]](#参考リンク)。

#### Alpha時点の既知の制限

- Vue / Svelte テンプレート用のカスタムパーサーは未対応
- JavaScript で実装した型認識カスタムルールは未対応[[8]](#参考リンク)

### 型認識リンティング

TypeScript の Go 移植版（tsgo）を内蔵し、以下のような型情報が必要なルールをサポートする：

- `strict-boolean-expressions` - 厳密なブール式チェック
- `no-deprecated` - 非推奨API使用検出
- `prefer-includes` - `indexOf` → `includes` 推奨
- `no-floating-promises` - 未処理Promise検出

`tsconfig.json`の並行検索により型チェック処理も高速化されている[[4]](#参考リンク)。

#### tsgolint 統合の進展（2026-02）

`tsgolint` 統合が進み、**12ルールが追加**されたことで `typescript-eslint` の **61ルール中59ルールに対応** した[[9]](#参考リンク)。また、型認識リンティングを設定ファイル（`oxlint.json` / `oxlint.config.ts`）から有効化できるようになり、CLI フラグに依存せず構成できる。

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

### 直近追加された主な機能（2026-03〜2026-05）

- 新Reactルール: `react/no-clone-element`、`react/no-react-children`、`react/no-object-type-as-default-prop`、`react/no-unstable-nested-components`[[10]](#参考リンク)[[11]](#参考リンク)
- `reportUnusedDisableDirectives` オプション（不要な lint disable コメントを検出）[[10]](#参考リンク)
- 未定義変数に対する「Did you mean?」サジェスト機能[[10]](#参考リンク)
- ESLint互換ルール `id-match` / `no-implied-eval` 実装[[11]](#参考リンク)
- `import/newline-after-import` 実装[[11]](#参考リンク)
- 多数のVueルール追加: `no-expose-after-await`、`no-computed-properties-in-data` ほか15+[[7]](#参考リンク)
- `unicorn/import-style` 実装[[7]](#参考リンク)
- `no-misleading-character-class` の正規表現サジェスト[[7]](#参考リンク)

### フレームワークサポート RFC（2026-04）

VoidZero チームの Cameron Clark 氏より、Vue/Svelte/Astro 等のフレームワーク固有ルールを正式実装するための RFC が公開された[[12]](#参考リンク)。

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

### 採用事例の拡大

2026年春以降、以下の大型採用が確認されている：

- **Renovate**: ESLint から Oxlint に完全移行[[12]](#参考リンク)
- **Midjourney**: 本番運用に投入[[8]](#参考リンク)
- **Preact・PostHog**: 本番運用継続

## まとめ

OxlintはESLintのドロップイン代替として実用段階に達しており、以下のような場面で特に効果的である：

- **大規模モノレポ**: 数分かかっていたリントが数秒に短縮
- **CI/CD**: フィードバックループの大幅な高速化
- **型認識リンティング**: tsgo / tsgolint により TypeScript 固有の問題を高速に検出

JavaScript プラグインサポートが Alpha として正式リリースされ、既存の ESLint プラグイン資産も活用可能となり、移行障壁が大幅に低下している。Renovate のような大規模プロジェクトでの完全移行事例も登場し、エンタープライズでの採用が加速している。

## 参考リンク

1. [Oxlint - 公式ドキュメント](https://oxc.rs/docs/guide/usage/linter)
2. [All Benchmarks - OXC公式](https://oxc.rs/docs/guide/benchmarks)
3. [Announcing Oxlint JavaScript Plugin Support - VoidZero](https://voidzero.dev/posts/announcing-oxlint-js-plugins)
4. [What's New in ViteLand: January 2026 Recap](https://voidzero.dev/posts/whats-new-jan-2026)
5. [OXC GitHub リポジトリ](https://github.com/oxc-project/oxc)
6. [OXC 公式サイト（Oxlint Linter ページ）](https://oxc.rs/docs/guide/usage/linter)
7. [oxlint v1.67.0 リリースノート](https://github.com/oxc-project/oxc/releases)
8. [Tales from the Void: March Launch Week Recap](https://voidzero.dev/posts/whats-new-march-launch-week-2026)
9. [What's New in ViteLand: February 2026 Recap](https://voidzero.dev/posts/whats-new-feb-2026)
10. [Tales from the Void: March 2026 Recap](https://voidzero.dev/posts/whats-new-mar-2026)
11. [oxlint v1.66.0 リリースノート](https://github.com/oxc-project/oxc/releases)
12. [Tales from the Void: April 2026 Recap](https://voidzero.dev/posts/whats-new-apr-2026)

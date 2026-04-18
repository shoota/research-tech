---
id: knip
title: Knip - JavaScript/TypeScript プロジェクトの未使用コード検出ツール
description: "未使用ファイル・エクスポート・依存関係をmark-and-sweepアルゴリズムで検出するKnipの仕組み、設定方法、モノレポ対応を解説。"
sidebar_position: 6
tags: [knip, unused-code, dead-code, lint, monorepo, typescript]
last_update:
  date: 2026-03-10
---

# Knip - JavaScript/TypeScript プロジェクトの未使用コード検出ツール

## 概要

Knip は JavaScript / TypeScript プロジェクトにおける未使用ファイル・未使用エクスポート・未使用依存関係・未使用型定義を静的解析で検出するツールである。mark-and-sweep アルゴリズムにより、エントリポイントから到達不能なコードを特定し、プロジェクトのコードベースをクリーンに保つことを目的としている[[1]](#参考リンク)。

:::info 関連ドキュメント
- [モノレポ戦略 - Turborepo / Nx によるスケーラブルな開発基盤](/docs/dev-tools/monorepo/monorepo-strategy)
- [OXC（The JavaScript Oxidation Compiler）全体像](/docs/dev-tools/voidzero/oxc/oxc-overview)
:::

## 背景・動機

プロジェクトが成長するにつれて、リファクタリングや機能削除の過程で未使用のコードや依存関係が蓄積していく。これらのデッドコードは以下の問題を引き起こす:

- **ビルド時間の増大**: 不要なコードがバンドルに含まれる
- **メンテナンスコストの増加**: 使われていないコードにも保守・レビューの手間がかかる
- **リファクタリングの阻害**: 依存関係が不明確になり変更の影響範囲が把握しづらい
- **セキュリティリスク**: 未使用の依存パッケージに脆弱性が残る

ESLint の `no-unused-vars` は変数レベルの検出に限定されるが、Knip はプロジェクト全体のファイル・エクスポート・依存関係を横断的に分析できる点で差別化されている。

## 調査内容

### 検出できるもの

Knip は以下の項目を検出する[[1]](#参考リンク):

| 検出対象 | 説明 |
|---|---|
| **未使用ファイル** | どのエントリポイントからも到達できないソースファイル |
| **未使用依存関係** | `package.json` に記載されているが実際にインポートされていないパッケージ |
| **未使用 devDependencies** | 開発依存関係の未使用検出 |
| **未使用エクスポート** | `export` されているが他のファイルからインポートされていない関数・変数・型 |
| **未使用型定義** | TypeScript の型定義で参照されていないもの |
| **未使用クラスメンバー** | クラス内の未使用メソッド・プロパティ |
| **未使用 enum メンバー** | enum の未使用メンバー |
| **未リスト依存関係** | コードで使用されているが `package.json` に記載されていないパッケージ |
| **重複エクスポート** | 同じシンボルが複数回エクスポートされている箇所 |

### 動作原理: Mark-and-Sweep アルゴリズム

Knip はエントリポイントから始めて、すべてのインポートをたどり、到達可能なコードを「マーク」する。マークされなかったコードが「未使用」として報告される[[1]](#参考リンク)。

```
エントリポイント → import を再帰的にたどる → 到達可能なコードをマーク → マークされなかったものを報告
```

この仕組みにより、単純な正規表現マッチングでは見つけられない、プロジェクト全体の依存グラフに基づいた精度の高い検出が可能になる。

### インストールと基本的な使い方

```bash title="インストール"
# npm
npm install -D knip

# pnpm
pnpm add -D knip

# bun
bun add -D knip
```

```json title="package.json"
{
  "scripts": {
    "knip": "knip"
  }
}
```

ゼロコンフィグで実行可能であり、`package.json` のエントリポイントやフレームワークのプラグインから自動的に解析対象を判定する[[1]](#参考リンク):

```bash
# 基本実行
npx knip

# 未使用ファイルのみ表示
npx knip --files

# 依存関係のみチェック
npx knip --dependencies

# エクスポートのみチェック
npx knip --exports
```

### 設定ファイル

設定ファイルは以下の 3 形式に対応している[[2]](#参考リンク):

1. **JSON**: `knip.json`（JSON Schema 対応）
2. **JSONC**: `knip.jsonc`（コメント・末尾カンマ対応）
3. **TypeScript**: `knip.ts`（動的・型付き設定）

```json title="knip.json"
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/index.ts", "src/cli.ts"],
  "project": ["src/**/*.ts"],
  "ignore": ["src/generated/**"],
  "ignoreDependencies": ["@types/node"],
  "ignoreBinaries": ["docker"]
}
```

#### 主要な設定オプション

| オプション | 説明 |
|---|---|
| `entry` | エントリファイルの glob パターン |
| `project` | 解析対象のプロジェクトファイル |
| `ignore` | 解析から除外するファイルパターン |
| `ignoreDependencies` | チェック対象外にする依存パッケージ（正規表現対応） |
| `ignoreBinaries` | 未使用として報告しないバイナリ |
| `ignoreMembers` | 未使用として報告しないクラス・enum メンバー |
| `ignoreUnresolved` | 未解決インポートの無視 |
| `ignoreExportsUsedInFile` | ファイル内でのみ使用されるエクスポートを無視 |
| `includeEntryExports` | エントリファイルのエクスポートも検出対象に含める |
| `paths` | TypeScript の `compilerOptions.paths` と同様のパスエイリアス |
| `rules` | issue タイプごとのルール（`error` / `warn` / `off`） |
| `tags` | JSDoc/TSDoc タグによるフィルタリング（`@internal` 等） |

#### TypeScript での設定例

```typescript title="knip.ts"
import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: ['src/index.ts'],
  project: ['src/**/*.ts'],
  ignore: ['src/**/*.test.ts'],
  ignoreDependencies: ['@types/jest'],
  rules: {
    files: 'error',
    dependencies: 'error',
    exports: 'warn',
    types: 'warn',
  },
};

export default config;
```

### プラグインシステム

Knip は **139 個の組み込みプラグイン**を提供しており、各ツール・フレームワークの設定ファイルを自動的に解析する[[3]](#参考リンク)。

#### プラグインの動作原理

プラグインは `package.json` の依存関係に基づいて**自動的にアクティベート**される。例えば `eslint` が依存関係にあれば、ESLint プラグインが自動で有効化され、`.eslintrc.json` などの設定ファイルを解析して参照される依存関係を検出する[[3]](#参考リンク)。

各プラグインは 2 種類のファイルを扱う:

- **Config ファイル**: プラグインが動的にロードし、参照される依存関係を抽出する
- **Entry ファイル**: モジュールグラフに追加され、静的解析の対象となる

#### 主要プラグイン一覧

| カテゴリ | プラグイン例 |
|---|---|
| **ビルドツール** | Vite, webpack, Rollup, Rspack, Rsbuild, Next.js, Nuxt, Astro, SvelteKit |
| **テスト** | Jest, Vitest, Playwright, Cypress, Mocha, Ava, WebdriverIO |
| **リンター・フォーマッター** | ESLint, Prettier, Biome, Oxlint, Stylelint, commitlint |
| **フレームワーク** | React Native, Expo, Angular, Svelte, Vue, Remix, React Router |
| **ドキュメント** | Docusaurus, Storybook, TypeDoc, VitePress, Starlight |
| **CI/CD** | GitHub Actions, Travis CI, Netlify, Sentry, Wrangler |
| **パッケージ管理** | Changesets, Semantic Release, Release It!, pnpm, Syncpack |
| **開発ツール** | husky, lint-staged, Lefthook, nodemon, tsx, ts-node |
| **DB/ORM** | Prisma, Drizzle, Knex |

#### プラグインの設定カスタマイズ

```json title="knip.json - プラグイン設定の上書き"
{
  "eslint": {
    "config": [".eslintrc.custom.js"],
    "entry": ["**/*.test.ts"]
  },
  "playwright": {
    "config": ["e2e/playwright.config.ts"]
  },
  "vitest": false
}
```

プラグインを `false` に設定すると無効化、`true` で強制有効化できる。`config` や `entry` を指定するとデフォルトのファイルパターンを上書きする。

### モノレポ対応

Knip はモノレポ / ワークスペースをネイティブにサポートしており、以下のワークスペース定義を自動検出する[[4]](#参考リンク):

1. **npm / Yarn / Bun / Lerna**: `package.json` の `workspaces` フィールド
2. **pnpm**: `pnpm-workspace.yaml` の `packages` フィールド
3. **レガシー形式**: `package.json` の `workspaces.packages`
4. **手動設定**: Knip 設定ファイルの `workspaces` オブジェクト

#### モノレポ設定例

```json title="knip.json - モノレポ設定"
{
  "workspaces": {
    ".": {
      "entry": "scripts/*.js",
      "project": "scripts/**/*.js"
    },
    "packages/*": {
      "entry": "{index,cli}.ts",
      "project": "**/*.ts"
    },
    "apps/web": {
      "entry": "src/main.tsx",
      "project": "src/**/*.{ts,tsx}",
      "ignoreDependencies": ["@internal/shared"]
    }
  }
}
```

**重要**: ルートレベルの `entry` / `project` はマルチワークスペースプロジェクトでは無視される。ルートワークスペースの設定は `workspaces["."]` に記述する必要がある[[4]](#参考リンク)。

#### ワークスペースフィルタリング

```bash
# 特定のワークスペースのみ解析
knip --workspace packages/my-lib

# パッケージ名で指定
knip --workspace @myorg/*

# 複数指定と除外
knip --workspace './apps/*' --workspace '!@myorg/legacy'
```

#### Integrated Monorepo（Nx スタイル）

単一の `package.json` を持つ統合型モノレポ（Nx の integrated style）もサポートされている[[5]](#参考リンク):

```json title="knip.json - Nx integrated monorepo"
{
  "entry": ["{apps,libs}/**/src/index.{ts,tsx}"],
  "project": ["{apps,libs}/**/src/**/*.{ts,tsx}"],
  "eslint": {
    "config": ["{apps,libs}/**/.eslintrc.json"]
  },
  "cypress": {
    "entry": ["apps/**/cypress.config.ts", "apps/**/cypress/e2e/*.spec.ts"]
  }
}
```

### CLI オプション

#### モードオプション

```bash
# プロダクションコードのみ解析（テストファイル除外）
knip --production

# 厳格モード（ワークスペース分離 + 直接依存のみ）
knip --strict

# ファイル変更の監視
knip --watch

# AST キャッシュでの高速化
knip --cache
```

#### 自動修正

```bash
# 安全に修正可能なものを自動修正
knip --fix

# ファイル削除も許可
knip --fix --allow-remove-files

# 特定の issue タイプのみ修正
knip --fix-type exports

# 修正後にフォーマッタを実行
knip --fix --format
```

**注意**: `--fix` はエントリポイントの設定が不十分な場合、使用中のコードを削除する可能性がある。設定が安定するまでは手動での確認を推奨する[[6]](#参考リンク)。

#### レポーター

```bash
# コンパクト表示
knip --reporter compact

# JSON 出力（CI 向け）
knip --reporter json

# Markdown 出力
knip --reporter markdown

# issue 数の上限設定（CI での閾値）
knip --max-issues 10

# 非ゼロ終了コードを抑制
knip --no-exit-code
```

#### デバッグ・トレース

```bash
# 詳細なデバッグ出力
knip --debug

# パフォーマンスプロファイリング
knip --performance

# 特定のエクスポートの利用箇所をトレース
knip --trace-export MyComponent

# 特定の依存パッケージの利用箇所をトレース
knip --trace-dependency lodash

# メモリ使用量の表示
knip --memory
```

### CI/CD 連携

#### GitHub Actions での利用例

```yaml title=".github/workflows/knip.yml"
name: Knip
on: [pull_request]

jobs:
  knip:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx knip --reporter json --max-issues 0
```

#### Rules & Filters による段階的導入

既存プロジェクトへの導入時は、全ての issue を一度に修正するのは現実的でない場合がある。`rules` を活用して段階的に厳格化できる:

```json title="knip.json - 段階的導入"
{
  "rules": {
    "files": "error",
    "dependencies": "error",
    "unlisted": "error",
    "exports": "warn",
    "types": "off",
    "classMembers": "off"
  }
}
```

`error` は非ゼロ終了コードを返し CI を失敗させるが、`warn` は表示のみ、`off` は検出しない。

### 偽陽性への対処

Knip が誤って未使用と報告するケースとその対処法[[6]](#参考リンク):

| ケース | 対処法 |
|---|---|
| 動的インポート | `entry` パターンに追加 |
| 環境依存の依存関係 | `ignoreDependencies` で除外 |
| `.svg` 等の非標準拡張子 | 拡張子を明示的に指定 |
| ジェネレートされたコード | 事前に生成してから解析、または `ignore` で除外 |
| プラグイン未対応ツール | カスタムプラグインを作成 |

## 検証結果

### 基本的な実行例

```bash
# ゼロコンフィグで実行
$ npx knip

Unused files (3)
  src/utils/deprecated.ts
  src/helpers/old-format.ts
  src/types/legacy.ts

Unused dependencies (2)
  moment        package.json
  lodash        package.json

Unused exports (5)
  formatDate    src/utils/format.ts:15
  parseConfig   src/config/parser.ts:42
  OldComponent  src/components/Old.tsx:8
  helperFn      src/helpers/index.ts:3
  LegacyType    src/types/index.ts:12

Unlisted dependencies (1)
  dotenv        src/config/env.ts:1
```

### Docusaurus プロジェクトでの利用

本サイト（Docusaurus 3）のようなプロジェクトでも Knip の Docusaurus プラグインにより設定不要で解析が可能:

```json title="knip.json - Docusaurus プロジェクト用"
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "ignore": ["build/**"]
}
```

Docusaurus プラグインが `docusaurus.config.ts` を自動検出し、エントリポイントやプラグイン設定を解析する。

## まとめ

- **ゼロコンフィグで即座に利用可能**: `npx knip` だけで未使用コードの検出を開始できる
- **139 の組み込みプラグイン**: 主要なフレームワーク・ツールの設定ファイルを自動解析し、偽陽性を最小化
- **モノレポのネイティブサポート**: npm / pnpm / Yarn ワークスペースに加え、Nx の integrated monorepo にも対応
- **段階的導入が可能**: `rules` でissue タイプごとに `error` / `warn` / `off` を設定し、既存プロジェクトにも無理なく導入可能
- **CI/CD 連携**: `--reporter json` や `--max-issues` でパイプラインに組み込みやすい
- **自動修正**: `--fix` で安全な修正を自動化（ただし設定の安定後に利用すること）

ESLint の `no-unused-vars` や TypeScript の `noUnusedLocals` では検出できないプロジェクト横断的な未使用コードを発見できるため、コードベースの健全性維持に有効なツールである。

## 参考リンク

1. [Knip 公式サイト](https://knip.dev/)
2. [Configuration | Knip](https://knip.dev/reference/configuration)
3. [Plugins | Knip](https://knip.dev/explanations/plugins)
4. [Monorepos & Workspaces | Knip](https://knip.dev/features/monorepos-and-workspaces)
5. [Integrated Monorepos | Knip](https://knip.dev/features/integrated-monorepos)
6. [Handling Issues | Knip](https://knip.dev/guides/handling-issues)
7. [CLI Arguments | Knip](https://knip.dev/reference/cli)
8. [Plugins (137) | Knip](https://knip.dev/reference/plugins)
9. [Writing A Plugin | Knip](https://knip.dev/writing-a-plugin)

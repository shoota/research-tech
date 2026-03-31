---
id: shadcn-cli-v4
title: shadcn CLI v4 の新機能と既存コンポーネントへの影響
description: "shadcn/cli v4のskills・presets・dry-run・モノレポ対応などの新機能と、Tailwind v4・React 19対応に伴う既存コンポーネントへの影響を調査。"
sidebar_position: 4
tags: [shadcn, ui, cli, tailwind-v4, react-19, radix-ui, ai]
last_update:
  date: 2026-03-07
---

## 概要

2026年3月にリリースされた shadcn/cli v4 の新機能（skills、presets、dry-run、monorepo 対応など）と、Tailwind v4・React 19 対応に伴う既存コンポーネントへの影響について調査した。

## 背景・動機

shadcn/ui はコピー＆ペースト方式のコンポーネントライブラリとして広く普及している。CLI v4 では AI コーディングエージェントとの統合（shadcn/skills）や、デザインシステムの共有を容易にするプリセット機能など、開発ワークフローを大きく変える機能が追加された。同時に、Tailwind v4 / React 19 への対応により既存コンポーネントの書き方にも変更が生じているため、移行の判断材料として整理する。

## 調査内容

### 1. shadcn/skills — AI エージェント統合

shadcn/skills は、AI コーディングエージェント（Claude Code など）に shadcn/ui の深いコンテキストを提供する仕組みである[[1]](#参考リンク)。

#### インストール

```bash
pnpm dlx skills add shadcn/ui
```

#### 動作メカニズム

プロジェクトに `components.json` が存在すると自動的にアクティベートされ、以下の4段階で動作する[[1]](#参考リンク):

1. **プロジェクト検出**: `components.json` ファイルを発見して起動
2. **コンテキスト注入**: `shadcn info --json` を実行し、フレームワーク・Tailwind バージョン・パスエイリアス・インストール済みコンポーネント等の情報を AI のコンテキストに挿入
3. **パターン強制**: FieldGroup によるフォーム構成、ToggleGroup によるオプション実装など、shadcn/ui の構成規則を AI に適用
4. **コンポーネント検出**: `shadcn docs` や `search` コマンドで事前に情報取得

#### 提供されるコンテキスト

| カテゴリ | 内容 |
|---|---|
| プロジェクト設定 | フレームワーク、Tailwind バージョン、パスエイリアス、ベースライブラリ（Radix/Base UI） |
| CLI コマンド | `init`, `add`, `search`, `view`, `docs`, `diff`, `info`, `build` のリファレンス |
| テーミング | CSS 変数、OKLCH カラー、ダークモード、カスタムカラー、border-radius |
| レジストリ | カスタムコンポーネントレジストリの構築・公開方法 |
| MCP サーバー | レジストリの検索・閲覧・インストール |

#### ユースケース

AI エージェントに対して以下のような自然言語でのリクエストが可能になる:

```
「メールとパスワードのログインフォームを追加して」
「プロフィール編集の設定ページを作って」
「サイドバー、統計カード、データテーブルのあるダッシュボードを作って」
```

skills が無い場合、AI はライブラリのコンテキストをほぼ持たないため、古い API やパターンを使ってしまうことがある。skills はこの問題を解決する[[1]](#参考リンク)。

### 2. プリセットシステム

プリセットはデザインシステムの設定（カラー、テーマ、アイコンライブラリ、フォント、border-radius）を短いコードにパッケージ化する機能である[[2]](#参考リンク)。

```bash
# プリセットを指定して初期化
pnpm dlx shadcn@latest init --preset <preset-name-or-url>
```

#### 特徴

- **shadcn/create でビルド**: ライブプレビュー付きでプリセットを視覚的にカスタマイズ
- **チーム間共有**: プリセットコード or URL で設定を共有
- **AI ツールとの連携**: エージェントにプリセットを渡してプロジェクトを初期化

### 3. dry-run / diff / view

CLI v4 では、コンポーネント追加前に変更内容を確認するための3つのフラグが追加された[[2]](#参考リンク)。

| フラグ | 用途 |
|---|---|
| `--dry-run` | ファイルを書き込まずに、何が追加されるかプレビュー |
| `--diff` | レジストリの更新内容とローカルの変更を差分表示し、マージ可能 |
| `--view` | インストール前にレジストリペイロードの内容を確認 |

```bash
# dry-run: 何が追加されるか確認
pnpm dlx shadcn@latest add button --dry-run

# diff: ローカルの変更とレジストリの差分を確認
pnpm dlx shadcn@latest add button --diff

# view: ペイロードの中身を確認
pnpm dlx shadcn@latest view button
```

これらは既存プロジェクトのコンポーネントをアップデートする際に特に有用で、ローカルのカスタマイズが上書きされるリスクを事前に把握できる。

### 4. モノレポサポート

`--monorepo` フラグでモノレポ構成のプロジェクトを初期化できるようになった[[2]](#参考リンク)。

```bash
pnpm dlx shadcn@latest init --monorepo
```

### 5. プロジェクトテンプレート

`shadcn init` が完全なプロジェクトテンプレートのスキャフォールドに対応した[[2]](#参考リンク)。対応フレームワーク:

- Next.js
- Vite
- Laravel
- React Router
- Astro
- TanStack Start

```bash
# Next.js テンプレートで初期化
pnpm dlx shadcn@latest init -t next
```

すべてのテンプレートにダークモードサポートが含まれる。

### 6. 新しい CLI コマンド

| コマンド | 説明 |
|---|---|
| `shadcn info` | フレームワーク、バージョン、CSS 変数、インストール済みコンポーネントを表示 |
| `shadcn docs <component>` | 任意のコンポーネントのドキュメントとコード例を取得 |
| `shadcn search` | 複数レジストリ（`@shadcn`, `@v0`, カスタム）からコンポーネントを検索 |
| `shadcn build` | レジストリ JSON ファイルを生成 |
| `shadcn migrate radix` | 個別 `@radix-ui/react-*` から統合 `radix-ui` パッケージへ移行 |
| `shadcn migrate rtl` | RTL（右から左）レイアウト対応へ自動変換 |

### 7. レジストリの進化

新しいレジストリタイプとして `registry:base` と `registry:font` が追加された[[2]](#参考リンク)。

- **`registry:base`**: デザインシステム全体を単一のペイロードとして配布可能
- **`registry:font`**: フォントがファーストクラスのレジストリアイテムとして扱われる

### 8. 既存コンポーネントへの影響

shadcn/ui のコンポーネントは Tailwind v4 と React 19 に対応する過程で、以下の変更が加えられている[[3]](#参考リンク)[[4]](#参考リンク)。

#### `forwardRef` の削除

React 19 で `forwardRef` が非推奨になったことに伴い、すべてのコンポーネントから `forwardRef` が削除された[[3]](#参考リンク)。

**変更前（React 18 / Tailwind v3）:**

```tsx title="components/ui/button.tsx（旧）"
import * as React from "react"

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  return (
    <button ref={ref} className={className} {...props} />
  )
})
Button.displayName = "Button"

export { Button }
```

**変更後（React 19 / Tailwind v4）:**

```tsx title="components/ui/button.tsx（新）"
import * as React from "react"

function Button({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button data-slot="button" className={className} {...props} />
  )
}

export { Button }
```

主な変更点:
- `React.forwardRef` → 通常の関数コンポーネント
- `ref` は React 19 で自動的に props として受け渡される
- 型は `React.ComponentProps<"button">` を使用
- `displayName` の設定が不要に

#### `data-slot` 属性の追加

すべてのプリミティブに `data-slot` 属性が追加された[[3]](#参考リンク)。これにより、複合コンポーネントの内部パーツをクラス名に依存せずにスタイリングできる。

```tsx
// 各コンポーネントに data-slot が付与される
<button data-slot="button" />
<div data-slot="accordion-item" />
<input data-slot="input" />
```

```css
/* data-slot を使った CSS ターゲティング */
[data-slot="button"] {
  cursor: default;
}
```

#### HSL → OKLCH カラースペース

CSS 変数のカラーが HSL から OKLCH に変換された[[3]](#参考リンク)。OKLCH は知覚的な均一性に優れたカラースペースで、より正確な色の表現が可能になる。

**変更前:**

```css
:root {
  --primary: 222.2 47.4% 11.2%;
}
/* 使用時 */
.element {
  color: hsl(var(--primary));
}
```

**変更後:**

```css
@theme inline {
  --color-primary: oklch(0.21 0.034 264.66);
}
/* 使用時 */
.element {
  color: var(--color-primary);
}
```

チャートカラーも影響を受け、`hsl()` ラッパーが不要になる:

```tsx
// 旧
color: "hsl(var(--chart-1))"

// 新
color: "var(--chart-1)"
```

#### Radix UI 統合パッケージへの移行

`new-york` スタイルでは、個別の `@radix-ui/react-*` パッケージから統合 `radix-ui` パッケージに移行した[[5]](#参考リンク)。

**変更前:**

```tsx
import * as DialogPrimitive from "@radix-ui/react-dialog"
import * as SelectPrimitive from "@radix-ui/react-select"
```

**変更後:**

```tsx
import { Dialog as DialogPrimitive } from "radix-ui"
import { Select as SelectPrimitive } from "radix-ui"
```

移行は CLI で自動化できる:

```bash
# UI コンポーネントディレクトリを移行
pnpm dlx shadcn@latest migrate radix

# カスタムディレクトリも対象に含める
pnpm dlx shadcn@latest migrate radix src/components/custom
```

移行後、使われなくなった `@radix-ui/react-*` パッケージを `package.json` から削除する。

#### デフォルトスタイルの変更

- **`default` スタイルが非推奨**: 新規プロジェクトは `new-york` がデフォルト
- **ボタンのカーソル**: `cursor: pointer` から `cursor: default` に変更
- **toast コンポーネント**: 非推奨。`sonner` への移行を推奨

#### RTL（右から左）サポート

CLI がインストール時に自動的にクラスを変換する[[6]](#参考リンク):

| 物理クラス | 論理クラス |
|---|---|
| `left-*` | `start-*` |
| `right-*` | `end-*` |
| `ml-*` | `ms-*` |
| `mr-*` | `me-*` |
| `pl-*` | `ps-*` |
| `pr-*` | `pe-*` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |

```bash
# RTL 移行
pnpm dlx shadcn@latest migrate rtl
```

### 9. 既存プロジェクトの後方互換性

**Tailwind v3 / React 18 のプロジェクトはそのまま動作する**[[3]](#参考リンク)。コンポーネントを追加する際も、プロジェクトの設定に応じて v3 / React 18 版がインストールされる。Tailwind v4 / React 19 への移行は任意であり、新規プロジェクトのみがデフォルトで v4 / React 19 を使用する。

## 検証結果

### マイグレーションチェックリスト

既存プロジェクトを Tailwind v4 / React 19 に対応させる場合の手順[[3]](#参考リンク):

1. Tailwind v4 アップグレードガイドに従い `@tailwindcss/upgrade@next` codemod を実行
2. CSS 変数を更新: `:root` / `.dark` を `@layer base` の外に移動し、`@theme inline` を使用
3. チャートカラーの `hsl()` ラッパーを削除
4. `w-* h-*` を `size-*` ユーティリティに置換
5. Radix UI 依存関係を更新（`pnpm dlx shadcn@latest migrate radix`）
6. `forwardRef` を削除（React codemod または手動）
7. コンポーネントを v4 版で再追加: `pnpm dlx shadcn@latest add --all --overwrite`

### CLI v4 の機能選択ガイド

| やりたいこと | 使う機能 |
|---|---|
| AI エージェントの shadcn/ui 理解を向上 | `skills add shadcn/ui` |
| チーム全体でデザイン設定を統一 | プリセット |
| コンポーネント更新の影響を事前確認 | `--dry-run` / `--diff` |
| モノレポでの利用 | `--monorepo` |
| Radix UI パッケージの整理 | `migrate radix` |
| RTL 対応 | `migrate rtl` |
| コンポーネントの仕様確認 | `shadcn docs <component>` |

## まとめ

shadcn CLI v4 は、**AI ファースト**と**デザインシステムの標準化**を2つの大きな柱として進化した。

**CLI v4 の主な価値:**

- **shadcn/skills** により、AI コーディングエージェントが shadcn/ui のパターン・API・レジストリを正しく理解した上でコードを生成できるようになった。`components.json` の検出からコンテキスト注入まで自動化されており、導入のハードルが低い
- **プリセット** により、デザインシステムの設定をコードとして共有・再利用できるようになり、チーム間やプロジェクト間での一貫性が保てる
- **`--dry-run` / `--diff`** により、既存のカスタマイズを壊すことなくコンポーネントを安全にアップデートできる

**既存コンポーネントへの影響:**

- `forwardRef` の削除と `data-slot` の追加は React 19 への移行に伴う変更で、コンポーネントの型定義と ref の扱いが簡潔になる
- HSL → OKLCH への移行はカラー定義の書き換えが必要だが、視覚的な変化は最小限
- Radix UI の統合パッケージ化により `package.json` がシンプルになる
- **後方互換性は維持されており**、Tailwind v3 / React 18 プロジェクトはそのまま動作する。移行は任意のタイミングで段階的に行える

## 参考リンク

1. [Skills - shadcn/ui](https://ui.shadcn.com/docs/skills)
2. [Changelog - shadcn/ui](https://ui.shadcn.com/docs/changelog)
3. [Tailwind v4 - shadcn/ui](https://ui.shadcn.com/docs/tailwind-v4)
4. [Tailwind v4 and React 19 · Issue #6585 · shadcn-ui/ui](https://github.com/shadcn-ui/ui/issues/6585)
5. [February 2026 - Unified Radix UI Package - shadcn/ui](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui)
6. [January 2026 - RTL Support - shadcn/ui](https://ui.shadcn.com/docs/changelog)

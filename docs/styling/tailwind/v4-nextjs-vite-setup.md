---
id: tailwind-v4-nextjs-vite-setup
title: Tailwind CSS v4 の Next.js・Vite セットアップと利用方法
sidebar_position: 4
last_update:
  date: 2026-03-05
---

## 概要

Tailwind CSS v4 における Next.js および Vite でのセットアップ方法と、ビルド統合方式（PostCSS プラグイン・Vite プラグイン・CLI）の使い分けについて調査した。v4 では CSS ファーストの設定モデルへ移行し、パフォーマンスが大幅に向上している。

## 背景・動機

Tailwind CSS v4.0 は 2025 年 1 月にリリースされた大規模なリライト版であり、v3 からの設定方式の変更（JavaScript → CSS）、ビルドツール統合の刷新、パフォーマンス改善など多くの変更がある。Next.js と Vite は現在最も採用されているフロントエンドフレームワーク/ビルドツールであり、それぞれでの正しいセットアップ方法を把握する必要がある。

## 調査内容

### 1. ビルド統合方式の全体像

Tailwind CSS v4 は 3 つのビルド統合方式を提供している[[1]](#参考リンク)。

| 方式 | パッケージ | 主な用途 |
|------|-----------|---------|
| PostCSS プラグイン | `@tailwindcss/postcss` | Next.js、Angular など PostCSS ベースのフレームワーク |
| Vite プラグイン | `@tailwindcss/vite` | Vite ベースのフレームワーク（SvelteKit、React Router、Nuxt 等） |
| CLI | `@tailwindcss/cli` | フレームワークを使わないプロジェクト、静的サイト |

#### 使い分けの指針

- **Next.js** → `@tailwindcss/postcss`（Next.js は内部で PostCSS を使用するため）
- **Vite ベースのプロジェクト** → `@tailwindcss/vite`（PostCSS 不要で最高のパフォーマンス）
- **フレームワークなし** → `@tailwindcss/cli`（ビルドツールに依存しない）

v3 との大きな違いとして、`tailwindcss` パッケージ自体を直接 PostCSS プラグインとして使うことはできなくなった[[5]](#参考リンク)。代わりに `@tailwindcss/postcss` を使用する必要がある。

### 2. Next.js でのセットアップと利用

#### インストール手順

```bash title="ターミナル"
# 新規プロジェクト作成（--tailwind フラグで自動設定）
npx create-next-app@latest my-project --typescript --eslint --app --tailwind

# 既存プロジェクトへの追加
npm install tailwindcss @tailwindcss/postcss postcss
```

#### PostCSS 設定

```js title="postcss.config.mjs"
// v4 では @tailwindcss/postcss を使用する
// postcss-import や autoprefixer は不要（自動で処理される）
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

#### CSS 設定

```css title="app/globals.css"
/* v3 の @tailwind base; @tailwind components; @tailwind utilities; を置き換え */
@import "tailwindcss";

/* @theme でデザイントークンをカスタマイズ */
@theme {
  --color-primary: oklch(0.6 0.2 260);
  --color-secondary: oklch(0.7 0.15 180);
  --font-display: "Inter", sans-serif;
}
```

#### コンポーネントでの利用

```tsx title="app/page.tsx"
// Server Components でも Client Components でも同じ書き方で利用可能
export default function Home() {
  return (
    <h1 className="text-3xl font-bold text-primary underline">
      Hello world!
    </h1>
  );
}
```

#### tailwind.config.js からの移行（v3 → v4）

v4 では `tailwind.config.js` は自動検出されなくなった[[5]](#参考リンク)。移行には 2 つの方法がある。

**方法 1: CSS ファースト設定に完全移行（推奨）**

```css title="app/globals.css"
@import "tailwindcss";

/* v3 の tailwind.config.js の theme.extend をそのまま CSS に移行 */
@theme {
  /* colors.primary → --color-primary */
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;

  /* fontFamily.sans → --font-sans */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;

  /* screens.3xl → --breakpoint-3xl */
  --breakpoint-3xl: 120rem;
}
```

**方法 2: 既存の設定ファイルを明示的に読み込む（互換性維持）**

```css title="app/globals.css"
@import "tailwindcss";

/* v3 の設定ファイルを明示的に読み込む */
@config "../../tailwind.config.js";
```

ただし、v4 では `corePlugins`、`safelist`、`separator` オプションはサポートされない[[5]](#参考リンク)。

**自動移行ツール**

```bash title="ターミナル"
# ブランチを切ってから実行を推奨
npx @tailwindcss/upgrade
```

#### App Router と Pages Router の違い

セットアップ手順自体に大きな違いはない[[4]](#参考リンク)。どちらも `@tailwindcss/postcss` を使用し、`globals.css` に `@import "tailwindcss"` を記述する。違いは CSS の読み込み場所のみ。

```tsx title="app/layout.tsx（App Router）"
// App Router では layout.tsx でグローバル CSS を読み込む
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
```

```tsx title="pages/_app.tsx（Pages Router）"
// Pages Router では _app.tsx でグローバル CSS を読み込む
import "../styles/globals.css";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
```

#### Server Components での注意点

Tailwind CSS はビルド時に静的な CSS ファイルを生成するため、Server Components でも Client Components でも同じように利用できる。ランタイムの JavaScript は不要であり、Server Components との相性は良い。

ただし、以下の点に注意する。

- **動的なクラス名の生成は避ける**: `bg-${color}-500` のような文字列結合はビルド時にスキャンできない
- **完全なクラス名を使用する**: 条件分岐でも `text-red-600` のように完全な文字列で記述する

#### CSS Modules との併用（@reference）

Next.js で CSS Modules と Tailwind を併用する場合、`@reference` ディレクティブを使う[[8]](#参考リンク)。

```css title="components/Button.module.css"
/* @reference でテーマ変数とユーティリティを参照（CSS は出力しない） */
@reference "tailwindcss";

.button {
  /* @apply で Tailwind のユーティリティを CSS Modules 内で使用 */
  @apply rounded-lg px-4 py-2 font-bold;
  background-color: var(--color-primary);
}

.button:hover {
  @apply opacity-80;
}
```

```tsx title="components/Button.tsx"
import styles from "./Button.module.css";

export function Button({ children }: { children: React.ReactNode }) {
  return <button className={styles.button}>{children}</button>;
}
```

`@reference "tailwindcss"` はデフォルトテーマのみ使う場合に有効。カスタムテーマを定義している場合は、メインの CSS ファイルを参照する。

```css title="components/Card.module.css"
/* カスタムテーマを使う場合はメインの CSS を参照 */
@reference "../../app/globals.css";

.card {
  @apply rounded-xl shadow-md;
  color: var(--color-primary);
}
```

#### Turbopack 対応

Next.js 13.1 以降、Turbopack は PostCSS および Tailwind CSS をサポートしている[[9]](#参考リンク)。`@tailwindcss/postcss` を使用する場合、Turbopack でも特別な設定は不要。

```bash title="ターミナル"
# Turbopack を有効にして開発サーバーを起動
npx next dev --turbopack
```

### 3. Vite でのセットアップと利用

#### インストール手順

```bash title="ターミナル"
# Vite プロジェクト作成
npm create vite@latest my-project -- --template react-ts
cd my-project

# Tailwind CSS と Vite プラグインをインストール
# PostCSS は不要
npm install tailwindcss @tailwindcss/vite
```

#### Vite プラグイン設定

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    // Tailwind CSS の Vite プラグイン
    // PostCSS 設定は不要
    tailwindcss(),
    react(),
  ],
});
```

#### CSS の設定

```css title="src/index.css"
/* Vite でも同様に @import で読み込む */
@import "tailwindcss";

@theme {
  --color-brand: oklch(0.65 0.2 250);
}
```

#### フレームワーク別の利用

**React + Vite**

```tsx title="src/App.tsx"
function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <h1 className="text-4xl font-bold text-brand">
        React + Vite + Tailwind v4
      </h1>
    </div>
  );
}

export default App;
```

**Vue + Vite**

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    vue(),
  ],
});
```

```vue title="src/App.vue"
<template>
  <div class="min-h-screen bg-gray-50">
    <h1 class="text-4xl font-bold text-brand">
      Vue + Vite + Tailwind v4
    </h1>
  </div>
</template>

<!-- Vue の <style> ブロックでは @reference を使用 -->
<style scoped>
@reference "tailwindcss";

h1 {
  @apply tracking-tight;
}
</style>
```

**Svelte + Vite（SvelteKit）**

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
  ],
});
```

#### HMR（Hot Module Replacement）の動作

Vite プラグインは Vite のビルドパイプラインに直接統合されるため、HMR が高速に動作する。

- **新しい CSS が不要な変更**（既存クラスの追加・削除）: **192 マイクロ秒**（v3 比 182 倍高速）[[1]](#参考リンク)
- **新しい CSS が必要な変更**（初めて使うユーティリティの追加）: **5ms**（v3 比 8.8 倍高速）[[1]](#参考リンク)

#### ビルドパフォーマンス

| 指標 | v3.4 | v4.0 | 改善率 |
|------|------|------|--------|
| フルビルド | 378ms | 100ms | 3.78 倍 |
| インクリメンタル（新 CSS あり） | 44ms | 5ms | 8.8 倍 |
| インクリメンタル（新 CSS なし） | 35ms | 192us | 182 倍 |

上記のベンチマーク数値は Tailwind CSS v4.0 リリースブログからの引用[[1]](#参考リンク)。

### 4. 両環境共通のトピック

#### @theme によるデザイントークンのカスタマイズ

`@theme` ディレクティブは CSS 変数を定義するだけでなく、対応するユーティリティクラスも自動生成する[[6]](#参考リンク)。

```css title="globals.css"
@import "tailwindcss";

@theme {
  /* カラー: bg-mint-500, text-mint-500 等が生成される */
  --color-mint-500: oklch(0.72 0.11 178);

  /* フォント: font-display が生成される */
  --font-display: "Satoshi", sans-serif;

  /* ブレークポイント: 3xl: バリアントが生成される */
  --breakpoint-3xl: 120rem;

  /* スペーシングの基本単位を変更 */
  --spacing: 0.25rem;
}
```

**名前空間の完全リセット**

```css title="globals.css"
@import "tailwindcss";

@theme {
  /* デフォルトカラーをすべて削除し、独自カラーのみ定義 */
  --color-*: initial;
  --color-white: #fff;
  --color-black: #000;
  --color-primary: oklch(0.6 0.2 260);
  --color-secondary: oklch(0.7 0.15 180);
}
```

**@theme inline（変数参照時に使用）**

```css title="globals.css"
@import "tailwindcss";

/* 他の CSS 変数を参照する場合は inline を使用 */
@theme inline {
  --font-sans: var(--font-inter);
}
```

#### @source によるスキャン対象の制御

v4 ではコンテンツの自動検出が行われ、`.gitignore` に記載されたファイルや `node_modules` は除外される[[7]](#参考リンク)。

```css title="globals.css"
@import "tailwindcss";

/* 外部ライブラリのクラスをスキャンに含める */
@source "../node_modules/@acmecorp/ui-lib";

/* 特定のディレクトリを除外 */
@source not "../src/legacy";
```

**スキャンのベースパスを変更（モノレポ向け）**

```css title="globals.css"
/* スキャン起点を明示的に設定 */
@import "tailwindcss" source("../src");
```

**自動検出を無効化して手動指定のみ使用**

```css title="globals.css"
@import "tailwindcss" source(none);
@source "../admin";
@source "../shared";
```

**セーフリスト（クラスの強制生成）**

```css title="globals.css"
@import "tailwindcss";

/* ソースに存在しないクラスを強制的に生成 */
@source inline("underline");

/* バリアント付きで生成 */
@source inline("{hover:,focus:,}bg-blue-{500,600,700}");
```

#### @plugin によるプラグイン読み込み

v4 では 2 つのプラグイン利用方法がある[[8]](#参考リンク)。

**方法 1: CSS ベースのプラグイン（v4 ネイティブ）**

```css title="plugins/custom.css"
/* CSS ファイルがそのままプラグインになる */
@utility scrollbar-hidden {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

@custom-variant theme-dark (&:where([data-theme="dark"] *));
```

```css title="globals.css"
@import "tailwindcss";
/* CSS プラグインは @import で読み込む */
@import "./plugins/custom.css";
```

**方法 2: JavaScript プラグイン（v3 互換）**

```css title="globals.css"
@import "tailwindcss";

/* v3 の JavaScript プラグインは @plugin で読み込む */
@plugin "@tailwindcss/typography";
@plugin "@tailwindcss/forms";
```

#### エコシステムライブラリとの併用

**tailwind-merge + clsx の組み合わせ（cn ユーティリティ）**

```ts title="lib/utils.ts"
import { twMerge } from "tailwind-merge";
import { clsx, type ClassValue } from "clsx";

// tailwind-merge v3.x は Tailwind CSS v4 をサポート[[10]](#参考リンク)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```tsx title="components/Button.tsx"
import { cn } from "@/lib/utils";

interface ButtonProps {
  variant?: "primary" | "secondary";
  className?: string;
  children: React.ReactNode;
}

export function Button({ variant = "primary", className, children }: ButtonProps) {
  return (
    <button
      className={cn(
        // ベーススタイル
        "rounded-lg px-4 py-2 font-semibold transition-colors",
        // バリアント
        variant === "primary" && "bg-blue-600 text-white hover:bg-blue-700",
        variant === "secondary" && "bg-gray-200 text-gray-800 hover:bg-gray-300",
        // 外部から渡されるクラスで上書き可能
        className
      )}
    >
      {children}
    </button>
  );
}
```

**CVA（Class Variance Authority）との併用**

```ts title="components/Badge.tsx"
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// CVA でバリアントを定義
const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "bg-blue-100 text-blue-800",
        success: "bg-green-100 text-green-800",
        warning: "bg-yellow-100 text-yellow-800",
        error: "bg-red-100 text-red-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant, className, children }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}
```

#### 公式プラグインの利用

```bash title="ターミナル"
# 公式プラグインのインストール
npm install @tailwindcss/typography @tailwindcss/forms @tailwindcss/container-queries
```

```css title="globals.css"
@import "tailwindcss";

/* v4 では @plugin ディレクティブで JavaScript プラグインを読み込む */
@plugin "@tailwindcss/typography";
@plugin "@tailwindcss/forms";
@plugin "@tailwindcss/container-queries";
```

### 5. PostCSS プラグイン vs Vite プラグインの比較

| 比較項目 | `@tailwindcss/postcss` | `@tailwindcss/vite` |
|---------|----------------------|-------------------|
| パフォーマンス | 高速（v3 比 3.5 倍以上） | さらに高速（PostCSS オーバーヘッドなし） |
| HMR 速度 | 高速 | Vite パイプライン直結でさらに高速 |
| 依存関係 | `postcss` が必要 | PostCSS 不要 |
| 設定ファイル | `postcss.config.mjs` が必要 | `vite.config.ts` のみ |
| 対応フレームワーク | Next.js、Angular、その他 PostCSS 対応ツール | Vite ベースのフレームワーク全般 |
| 他の PostCSS プラグイン | 併用可能 | PostCSS レイヤーなし |

#### どのフレームワークでどちらを使うべきか

| フレームワーク | 推奨方式 | 理由 |
|--------------|---------|------|
| Next.js | `@tailwindcss/postcss` | Next.js の内部で PostCSS を使用するため |
| Vite + React | `@tailwindcss/vite` | 最高のパフォーマンスと最小の設定 |
| SvelteKit | `@tailwindcss/vite` | Vite ベース |
| Nuxt | `@tailwindcss/vite` | Vite ベース |
| React Router (Remix) | `@tailwindcss/vite` | Vite ベース |
| Angular | `@tailwindcss/postcss` | Webpack/esbuild ベース |
| Astro | `@tailwindcss/vite` | Vite ベース |

## 検証結果

### v3 からの主要な破壊的変更

実際に移行する際に注意が必要な変更点をまとめる。

```html
<!-- ユーティリティ名の変更 -->
<!-- v3: shadow-sm → v4: shadow-xs -->
<!-- v3: shadow → v4: shadow-sm -->
<!-- v3: rounded-sm → v4: rounded-xs -->
<!-- v3: blur-sm → v4: blur-xs -->
<!-- v3: outline-none → v4: outline-hidden -->
<!-- v3: ring → v4: ring-3 -->

<!-- !important 修飾子の位置変更 -->
<!-- v3 -->
<div class="!flex !bg-red-500"></div>
<!-- v4 -->
<div class="flex! bg-red-500!"></div>

<!-- 任意値での変数参照 -->
<!-- v3 -->
<div class="bg-[--brand-color]"></div>
<!-- v4: 丸括弧を使用 -->
<div class="bg-(--brand-color)"></div>
```

### カスタムユーティリティの定義方法

```css title="globals.css"
/* v3: @layer utilities を使用 */
/* @layer utilities {
  .tab-4 { tab-size: 4; }
} */

/* v4: @utility を使用（バリアント対応が自動で行われる） */
@utility tab-4 {
  tab-size: 4;
}
/* → hover:tab-4, lg:tab-4 等が自動的に利用可能になる */
```

### ブラウザ要件

v4 は以下のブラウザバージョンを要求する[[1]](#参考リンク)。

- Safari 16.4+
- Chrome 111+
- Firefox 128+

`@property` や `color-mix()` など、モダンな CSS 機能に依存しているため、古いブラウザのサポートが必要な場合は注意が必要。

## まとめ

- **Next.js では `@tailwindcss/postcss`、Vite ベースのプロジェクトでは `@tailwindcss/vite` を使用する**のが正しい選択。
- v4 の CSS ファースト設定（`@theme`）は、デザイントークンを CSS 変数として直接管理でき、JavaScript 設定ファイルが不要になる大きなメリットがある。
- パフォーマンスは v3 比でフルビルドが 3.78 倍、インクリメンタルビルドが最大 182 倍高速化しており、開発体験が大幅に向上している[[1]](#参考リンク)。
- `tailwind-merge` v3.x、CVA、clsx 等のエコシステムライブラリは v4 に対応しており、既存のコンポーネント設計パターンをそのまま利用可能。
- v3 からの移行は `npx @tailwindcss/upgrade` で多くの変更を自動化できるが、ユーティリティ名の変更や `!important` 修飾子の位置変更など、手動確認が必要な箇所もある[[5]](#参考リンク)。
- `@reference` ディレクティブにより CSS Modules との併用が容易になり、段階的な移行も現実的[[8]](#参考リンク)。

## 参考リンク

1. [Tailwind CSS v4.0 リリースブログ](https://tailwindcss.com/blog/tailwindcss-v4)
2. [Tailwind CSS v4 インストール - Vite](https://tailwindcss.com/docs/installation/using-vite)
3. [Tailwind CSS v4 インストール - PostCSS](https://tailwindcss.com/docs/installation/using-postcss)
4. [Tailwind CSS v4 インストール - Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
5. [Tailwind CSS v4 アップグレードガイド](https://tailwindcss.com/docs/upgrade-guide)
6. [Tailwind CSS v4 @theme ディレクティブ](https://tailwindcss.com/docs/theme)
7. [Tailwind CSS v4 ソースファイルの検出](https://tailwindcss.com/docs/detecting-classes-in-source-files)
8. [Tailwind CSS v4 関数とディレクティブ](https://tailwindcss.com/docs/functions-and-directives)
9. [Next.js Tailwind CSS ガイド](https://nextjs.org/docs/app/getting-started/css)
10. [tailwind-merge npm](https://www.npmjs.com/package/tailwind-merge)
11. [Class Variance Authority (CVA)](https://cva.style/docs)

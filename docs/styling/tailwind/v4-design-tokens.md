---
id: tailwind-v4-design-tokens
title: v4のデザイントークンについて
description: "Tailwind CSS v4の@themeディレクティブによるCSSネイティブなデザイントークン管理、ソーススキャンの仕組み、クラス名解決パイプラインを調査。"
sidebar_position: 1
last_update:
  date: 2026-03-05
---

# Tailwind CSS v4 のデザイントークン

:::info 関連ドキュメント
- [CSS ビルドシステムの全体像](/docs/styling/css/css-build-system) — CSS プリプロセッサ・CSS Modules・型安全CSS の体系的な整理
:::

## 概要

Tailwind CSS v4 におけるデザイントークンの種類・構造、ソースファイルのスキャンの仕組み、クラス名の解決パイプラインについて調査した。v4 では JavaScript 設定ファイルが不要になり、CSS ネイティブな `@theme` ディレクティブでデザイントークンを一元管理する設計に刷新されている。

## 背景・動機

Tailwind CSS v4 は v3 からのフルリライトで、設定方式が JavaScript（`tailwind.config.js`）から CSS ファーストへ大きく変わった。デザイントークンの管理方法、スキャンの仕組み、クラス名がどのように解決・生成されるかを理解することは、プロダクトでの導入・運用設計に不可欠である。

## 調査内容

### 1. デザイントークンの種類と名前空間

v4 では `@theme` ディレクティブ内で CSS カスタムプロパティとしてデザイントークンを定義する[[1]](#参考リンク)。名前空間（プレフィックス）ごとに対応するユーティリティクラスが自動生成される。

| 名前空間 | ユーティリティ例 | 説明 |
|---------|-----------------|------|
| `--color-*` | `bg-red-500`, `text-sky-300` | カラーパレット |
| `--font-*` | `font-sans`, `font-serif` | フォントファミリー |
| `--text-*` | `text-xl`, `text-2xl` | フォントサイズ |
| `--font-weight-*` | `font-bold`, `font-semibold` | フォントウェイト |
| `--tracking-*` | `tracking-wide` | レタースペーシング |
| `--leading-*` | `leading-tight` | 行の高さ |
| `--spacing-*` | `px-4`, `gap-2`, `w-16` | スペーシング・サイジング |
| `--breakpoint-*` | `sm:*`, `md:*` | レスポンシブブレークポイント |
| `--container-*` | `@sm:*`, `@md:*` | コンテナクエリ |
| `--radius-*` | `rounded-sm`, `rounded-lg` | ボーダー半径 |
| `--shadow-*` | `shadow-md`, `shadow-lg` | ボックスシャドウ |
| `--inset-shadow-*` | `inset-shadow-xs` | インセットシャドウ |
| `--drop-shadow-*` | `drop-shadow-md` | ドロップシャドウ |
| `--blur-*` | `blur-md`, `blur-lg` | ブラーフィルター |
| `--perspective-*` | `perspective-near` | パースペクティブ |
| `--aspect-*` | `aspect-video` | アスペクト比 |
| `--ease-*` | `ease-out`, `ease-in-out` | イージング関数 |
| `--animate-*` | `animate-spin` | アニメーション |

### 2. @theme ディレクティブの構造

#### 基本的な定義

```css title="app.css"
@import "tailwindcss";

@theme {
  /* スペーシングの基本単位 */
  --spacing: 0.25rem;

  /* カスタムカラー */
  --color-brand-500: oklch(0.72 0.11 221.19);
  --color-brand-600: oklch(0.60 0.12 221.19);

  /* フォントファミリー */
  --font-display: "Satoshi", sans-serif;

  /* ブレークポイント */
  --breakpoint-3xl: 120rem;
}
```

ビルド時にこれらは通常の CSS カスタムプロパティとして `:root` に出力される[[1]](#参考リンク):

```css title="出力される CSS"
:root {
  --spacing: 0.25rem;
  --color-brand-500: oklch(0.72 0.11 221.19);
  --color-brand-600: oklch(0.60 0.12 221.19);
  --font-display: "Satoshi", sans-serif;
  --breakpoint-3xl: 120rem;
}
```

#### @theme と :root の違い

- **`@theme`**: デザイントークンとして登録され、対応するユーティリティクラスが生成される
- **`:root`**: 通常の CSS 変数。ユーティリティクラスは生成されない

#### @theme inline — 変数の参照

他の CSS 変数を参照するトークンを定義する場合に使う:

```css title="app.css"
@theme inline {
  --font-sans: var(--font-inter);
}
```

`inline` を使うと、生成されるユーティリティが参照先の変数をそのまま使うため、ダークモード等でスコープが変わっても正しく解決される[[1]](#参考リンク)。

#### 名前空間のリセット

`initial` キーワードで特定の名前空間やテーマ全体をリセットできる[[1]](#参考リンク):

```css title="完全カスタムテーマ"
@import "tailwindcss";

@theme {
  --color-*: initial;  /* デフォルトカラーをすべて削除 */
  --color-white: #fff;
  --color-primary: oklch(0.72 0.11 221.19);
  --color-secondary: oklch(0.74 0.17 40.24);
}
```

```css title="すべてのデフォルトをリセット"
@theme {
  --*: initial;
  /* ここから独自のトークンのみを定義 */
}
```

### 3. ソースファイルスキャンの仕組み

#### 自動コンテンツ検出

v4 では `content` 配列の設定が不要になった[[2]](#参考リンク)。ヒューリスティクスにより自動的にスキャン対象を決定する:

- `.gitignore` に記載されたファイルは自動除外
- バイナリファイル（画像、動画、ZIP 等）は自動除外
- CSS ファイル、ロックファイルも除外
- それ以外のソースファイルをプレーンテキストとしてスキャン

#### Oxide スキャナー（Rust 実装）

スキャン処理は `@tailwindcss/oxide` パッケージの Rust/NAPI-RS 実装で高速化されている[[5]](#参考リンク):

- `Scanner::scan()` がソースファイルからクラス名候補を抽出
- `scanFiles()`, `scanDir()` メソッドでファイル/ディレクトリ単位のスキャンが可能
- プラットフォーム別ネイティブバイナリ（darwin-arm64, linux-x64-gnu 等）で提供
- WebAssembly フォールバックも用意

**スキャンの特徴**: ファイルをプログラミング言語として解析するのではなく、テキストとしてトークンを検索する[[2]](#参考リンク)。そのため文字列連結や補間による動的クラス名は検出できない。

#### @source ディレクティブ

自動検出の制御に使う CSS ディレクティブ[[6]](#参考リンク):

```css title="スキャン対象の制御"
@import "tailwindcss";

/* 外部ライブラリをスキャン対象に追加 */
@source "../node_modules/@acmecorp/ui-lib";

/* レガシーコードを除外 */
@source not "../src/components/legacy";
```

```css title="自動検出を無効化して明示的に指定"
@import "tailwindcss" source(none);
@source "../admin";
@source "../shared";
```

#### セーフリスティング（@source inline）

ソースに出現しないクラスを強制的に生成する[[2]](#参考リンク):

```css title="クラスの強制生成"
/* 単一クラス */
@source inline("underline");

/* バリアント付き + ブレース展開 */
@source inline("{hover:,focus:,}bg-red-{50,{100..900..100},950}");

/* 特定クラスを除外 */
@source not inline("bg-red-*");
```

### 4. クラス名の解決パイプライン

Tailwind v4 のクラス名解決は以下の 3 段階で行われる[[5]](#参考リンク):

```
parseCandidate() → canonicalizeCandidates() → compileCandidates()
```

#### Step 1: parseCandidate — 構造化パース

クラス名文字列を構造化コンポーネントに分解する:

- **バリアント**: `hover:`, `md:`, `dark:` 等の条件部分
- **ルート**: ユーティリティのベース名（`bg`, `text`, `w` 等）
- **値**: テーマ値や任意値（`red-500`, `[#ff0000]` 等）
- **モディファイア**: `/50`（opacity）等の修飾子

#### Step 2: canonicalizeCandidates — 正規化

レガシーなクラス名表記を v4 の標準形式に変換する。

#### Step 3: compileCandidates — CSS 生成

ユーティリティの種類に応じて CSS を生成する:

- **静的ユーティリティ**: `flex`, `hidden` のような固定名 → 固定 CSS を出力
- **関数型ユーティリティ**: `w-*`, `bg-*` のような動的値 → テーマ値を参照して CSS を出力

`DesignSystem` クラスがオーケストレーションし、各ユーティリティの `CompileFn` が候補を受け取って AST ノードを生成する[[5]](#参考リンク)。

#### 最適化パス（optimizeAst）

最終的な CSS 出力前に以下の最適化が行われる:

- 宣言の重複排除
- 未使用 CSS 変数の削除
- `@property` ルールの生成（ブラウザ互換性）
- `color-mix()` フォールバック生成
- ルールの統合・並べ替え

### 5. カスタムユーティリティの定義（@utility）

独自のユーティリティクラスを CSS で定義できる[[3]](#参考リンク):

```css title="静的ユーティリティ"
/* 固定値のユーティリティ */
@utility content-auto {
  content-visibility: auto;
}
```

```css title="関数型ユーティリティ（動的値）"
@theme {
  --tab-size-2: 2;
  --tab-size-4: 4;
  --tab-size-github: 8;
}

/* テーマ値 + 任意値に対応 */
@utility tab-* {
  tab-size: --value(--tab-size-*);    /* テーマ値: tab-2, tab-github */
  tab-size: --value(integer);          /* 裸の値: tab-1, tab-76 */
  tab-size: --value([integer]);        /* 任意値: tab-[8] */
}
```

### 6. ビルドパフォーマンス

Rust ベースの新エンジンにより大幅に高速化[[4]](#参考リンク):

| 指標 | v3.4 | v4.0 | 改善率 |
|------|------|------|--------|
| フルビルド | 378ms | 100ms | **3.78x** |
| インクリメンタル（CSS変更あり） | 44ms | 5ms | **8.8x** |
| インクリメンタル（CSS変更なし） | 35ms | 192us | **182x** |

### 7. テーマの共有と配布

CSS ファイルとして定義するため、モノレポや npm パッケージでの共有が容易:

```css title="packages/brand/theme.css"
@theme {
  --*: initial;
  --spacing: 4px;
  --font-body: Inter, sans-serif;
  --color-primary: oklch(0.72 0.11 221.19);
}
```

```css title="packages/admin/app.css"
@import "tailwindcss";
@import "../brand/theme.css";
```

## 検証結果

### デザイントークンの定義と利用

```css title="app.css"
@import "tailwindcss";

@theme {
  /* カスタムカラーパレット */
  --color-primary-50: oklch(0.97 0.01 250);
  --color-primary-500: oklch(0.55 0.20 250);
  --color-primary-900: oklch(0.25 0.10 250);

  /* スペーシングの基本単位を変更 */
  --spacing: 0.25rem;

  /* カスタムフォント */
  --font-heading: "Inter", sans-serif;

  /* カスタムブレークポイント */
  --breakpoint-xs: 30rem;
}
```

```html title="ユーティリティクラスとして使用"
<!-- @theme で定義したトークンがそのままクラスに -->
<div class="bg-primary-500 text-primary-50 font-heading p-4 xs:p-8">
  <h1 class="text-2xl">見出し</h1>
</div>
```

```css title="CSS変数としてカスタムCSSから参照"
@layer components {
  .card {
    background: var(--color-primary-50);
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);  /* --spacing * 6 = 1.5rem */
  }
}
```

```tsx title="JavaScriptからの参照"
// ランタイムでCSS変数を取得
const styles = getComputedStyle(document.documentElement);
const primaryColor = styles.getPropertyValue("--color-primary-500");
```

### 動的クラス名の注意点

```tsx title="Component.tsx"
// NG: 文字列補間によるクラス名は検出されない
function Badge({ color }: { color: string }) {
  return <span className={`bg-${color}-500`}>...</span>;
}

// OK: 完全なクラス名をマッピングで定義
const colorMap = {
  red: "bg-red-500 text-white",
  blue: "bg-blue-500 text-white",
  green: "bg-green-500 text-white",
} as const;

function Badge({ color }: { color: keyof typeof colorMap }) {
  return <span className={colorMap[color]}>...</span>;
}
```

## まとめ

- **CSS ファースト設計**: `tailwind.config.js` が不要になり、`@theme` で CSS 内にデザイントークンを一元管理。設定とスタイルが同じ言語（CSS）で完結する
- **ランタイム利用可能**: テーマ変数はすべて CSS カスタムプロパティとして出力されるため、JavaScript やインラインスタイルからも参照可能。ダークモード切替などの動的テーマも再ビルド不要
- **名前空間による自動マッピング**: `--color-*` → `bg-*`, `text-*` のように、変数名のプレフィックスからユーティリティクラスが自動生成される。独自の名前空間も `@utility` で追加できる
- **高速スキャン**: Rust 実装の Oxide スキャナーによりフルビルド 3.78x、インクリメンタルビルド最大 182x の高速化を実現[[4]](#参考リンク)
- **自動コンテンツ検出**: `content` 配列の設定が不要。`.gitignore` やバイナリ判定のヒューリスティクスで自動判別し、`@source` で微調整可能
- **テーマの共有**: CSS ファイルとして定義するため、モノレポや npm パッケージでの配布が容易

プロダクトへの適用においては、デザイントークンを `@theme` で定義し、デザインシステムのパッケージとして CSS ファイルを共有する運用が効果的と考えられる。

:::tip 関連ドキュメント
- [Tailwind CSS v4 の Next.js・Vite セットアップ](/docs/styling/tailwind/tailwind-v4-nextjs-vite-setup) — フレームワーク別のセットアップ手順
- [shadcn/ui の設計思想とアーキテクチャ](/docs/styling/shadcn-ui/shadcn-ui-design-and-architecture) — Tailwind v4 の `@theme inline` を活用したテーマシステムの実例
:::

## 参考リンク

1. [Theme variables - Tailwind CSS](https://tailwindcss.com/docs/theme)
2. [Detecting classes in source files - Tailwind CSS](https://tailwindcss.com/docs/detecting-classes-in-source-files)
3. [Adding custom styles - Tailwind CSS](https://tailwindcss.com/docs/adding-custom-styles)
4. [Tailwind CSS v4.0 リリースブログ](https://tailwindcss.com/blog/tailwindcss-v4)
5. [tailwindlabs/tailwindcss アーキテクチャ解析 - DeepWiki](https://deepwiki.com/tailwindlabs/tailwindcss)
6. [Tailwind @source Directive ガイド](https://tailkits.com/blog/tailwind-at-source-directive/)

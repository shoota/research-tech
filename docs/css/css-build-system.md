---
id: css-build-system
title: "CSS ビルドシステムの全体像 — プリプロセッサ・CSS Modules・型安全CSS"
sidebar_position: 1
tags: [CSS, CSS Modules, Sass, SCSS, Less, PostCSS, Lightning CSS, TypeScript, vanilla-extract]
last_update:
  date: 2026-03-06
---

# CSS ビルドシステムの全体像 — プリプロセッサ・CSS Modules・型安全CSS

:::info 関連ドキュメント
- [Tailwind CSS v4 のデザイントークン](/docs/tailwind/tailwind-v4-design-tokens) — ユーティリティファースト CSS のトークン設計
- [shadcn/ui の設計思想とアーキテクチャ](/docs/shadcn-ui/shadcn-ui-design-and-architecture) — Tailwind CSS ベースの UI コンポーネント設計
:::

## 概要

CSS のビルドシステムに関わる技術を体系的に調査した。CSS プリプロセッサ（Sass/SCSS、Less）、CSS Modules によるスコーピング、PostCSS・Lightning CSS によるポストプロセス、そして CSS を TypeScript の型として扱う方法（typed-css-modules、vanilla-extract 等）について、仕組み・設定方法・実務での使い分けを整理する。

## 背景・動機

フロントエンド開発では CSS のビルドパイプラインに複数のツールが関与するが、それぞれの役割と関係性が混同されやすい。「Sass と PostCSS の違い」「CSS Modules は何をしているのか」「CSS を型安全にするにはどうすればよいか」といった疑問に体系的に答えるため、CSS ビルドシステムの全体像を整理する。

## 調査内容

### 1. CSS ビルドパイプラインの全体像

モダンフロントエンドにおける CSS の処理は、以下のパイプラインで行われる:

```
ソースファイル        ビルド時の変換                 ブラウザ
─────────────    ──────────────────────────    ─────────
.scss / .less  → プリプロセッサ(Sass/Less)  ──┐
                                               ├→ CSS
.css           ──────────────────────────────┘
                                               │
              CSS Modules (クラス名のハッシュ化) ←┤
                                               │
              PostCSS / Lightning CSS          ←┤
              (ベンダープレフィックス・           │
               ネスト展開・ミニファイ)            │
                                               ↓
                                          最終 CSS
                                         (+ JS マッピング)
```

各ステージは独立しており、プロジェクトの要件に応じて組み合わせる。例えば「SCSS + CSS Modules + PostCSS」「CSS + Lightning CSS」「vanilla-extract（TypeScript で直接記述）」など、多様な構成が可能。

### 2. CSS プリプロセッサ

#### Sass / SCSS

Sass は最も広く使われている CSS プリプロセッサであり、2つの構文を持つ[[1]](#参考リンク):

| 構文 | 拡張子 | 特徴 |
|---|---|---|
| **SCSS** | `.scss` | CSS 互換のブレース構文。既存 CSS をそのまま SCSS として使える |
| **Sass（インデント構文）** | `.sass` | インデントベース。ブレースとセミコロンが不要 |

現在は SCSS が主流であり、以降「Sass」と表記する場合も SCSS 構文を指す。

**主要機能:**

```scss title="Sass の主要機能"
// 変数
$primary-color: #0ea5e9;
$spacing-unit: 8px;

// ネスト
.card {
  padding: $spacing-unit * 3;
  background: white;

  &__title {
    font-size: 1.5rem;
    color: $primary-color;
  }

  &__body {
    padding: $spacing-unit * 2;

    // 親セレクタ参照（&）
    &:hover {
      background: lighten($primary-color, 40%);
    }
  }
}

// ミックスイン
@mixin responsive($breakpoint) {
  @if $breakpoint == mobile {
    @media (max-width: 768px) { @content; }
  } @else if $breakpoint == tablet {
    @media (max-width: 1024px) { @content; }
  }
}

.container {
  max-width: 1200px;

  @include responsive(mobile) {
    max-width: 100%;
    padding: 0 16px;
  }
}

// パーシャルとインポート
// _variables.scss, _mixins.scss をパーシャルとして分割管理
@use 'variables' as vars;
@use 'mixins';
```

**Dart Sass と sass-embedded:**

Sass の公式実装は **Dart Sass** であり、npm では 2 つのパッケージとして配布されている[[2]](#参考リンク):

| パッケージ | 実装 | 速度 | 用途 |
|---|---|---|---|
| `sass` | Dart→JavaScript にトランスパイル | 遅め | 互換性重視 |
| `sass-embedded` | ネイティブ Dart 実行ファイル | 高速 | パフォーマンス重視 |

Vite は `sass-embedded` がインストールされていれば自動的にそちらを使用する[[3]](#参考リンク)。大規模プロジェクトでは `sass-embedded` の方がコンパイル速度が大幅に向上する。

**Modern Compiler API:**

Sass は新しい Compiler API を提供しており、単一のコンパイラインスタンスを複数のコンパイルで再利用できる[[2]](#参考リンク):

```typescript title="Sass Modern API"
import * as sass from 'sass';

// 単発コンパイル
const result = sass.compile('style.scss');
console.log(result.css);

// 非同期コンパイル
const asyncResult = await sass.compileAsync('style.scss');

// 文字列からのコンパイル
const stringResult = sass.compileString(`
  $color: #333;
  body { color: $color; }
`);
```

#### Less

Less は Sass と類似した CSS プリプロセッサで、より CSS に近いシンプルな構文が特徴[[4]](#参考リンク):

```less title="Less の基本構文"
// 変数（@プレフィックス）
@primary-color: #0ea5e9;
@spacing: 8px;

// ネスト
.card {
  padding: @spacing * 3;

  .title {
    color: @primary-color;
  }
}

// ミックスイン（関数形式）
.border-radius(@radius: 4px) {
  border-radius: @radius;
}

.button {
  .border-radius(8px);
}
```

Less はブラウザ上でもクライアントサイドコンパイルが可能だが、本番環境では非推奨。2026 年時点では Sass/SCSS の方がエコシステムの成熟度・フレームワークサポートで優位にあり、新規プロジェクトでは SCSS が推奨される[[4]](#参考リンク)。

#### ネイティブ CSS の進化とプリプロセッサの必要性

2025-2026 年時点で、ネイティブ CSS は以下の機能をサポートしており、プリプロセッサの必要性が減少傾向にある[[5]](#参考リンク):

| 機能 | ネイティブ CSS | Sass が依然優位な点 |
|---|---|---|
| 変数 | CSS Custom Properties（`--var`） | 算術演算、リスト・マップ操作 |
| ネスト | CSS Nesting（`&` セレクタ） | より柔軟なネスト |
| カラー関数 | `oklch()`, `color-mix()` | `lighten()`, `darken()` |
| スコープ | `@scope` ルール | パーシャル・`@use` による分割管理 |
| — | — | ミックスイン、ループ、条件分岐 |

ミックスインや複雑なロジック（ループ、条件分岐）が不要であれば、ネイティブ CSS + PostCSS / Lightning CSS で十分なケースが増えている。

### 3. CSS Modules

#### 仕組み

CSS Modules は CSS のクラス名をローカルスコープにする仕組みである[[6]](#参考リンク)。ビルド時にクラス名をハッシュ付きのユニークな名前に変換し、JavaScript にマッピングオブジェクトをエクスポートする:

```css title="button.module.css"
/* ソースコード */
.primary {
  background: #0ea5e9;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
}

.disabled {
  opacity: 0.5;
  pointer-events: none;
}
```

ビルド後、クラス名がハッシュ化される:

```css title="ビルド後の出力"
/* .primary → button_primary_x7k2a のように変換される */
.button_primary_x7k2a {
  background: #0ea5e9;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
}

.button_disabled_m3p9q {
  opacity: 0.5;
  pointer-events: none;
}
```

JavaScript 側にはマッピングオブジェクトがエクスポートされる:

```tsx title="Button.tsx"
import styles from './button.module.css';

// styles = { primary: "button_primary_x7k2a", disabled: "button_disabled_m3p9q" }
function Button({ disabled, children }: { disabled?: boolean; children: React.ReactNode }) {
  return (
    <button className={`${styles.primary} ${disabled ? styles.disabled : ''}`}>
      {children}
    </button>
  );
}
```

**クラス名のハッシュ生成パターン**: `[filename]_[classname]__[hash]` 形式が一般的。ファイルパスとクラス名を組み合わせてハッシュを生成するため、異なるファイルで同名のクラスがあっても衝突しない[[6]](#参考リンク)。

#### Composition（composes）

CSS Modules は `composes` キーワードで他のクラスを合成できる[[7]](#参考リンク):

```css title="styles.module.css"
/* 基本スタイルを定義 */
.base {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 600;
}

/* base を合成（継承のように使える） */
.primary {
  composes: base;
  background: #0ea5e9;
  color: white;
}

/* 別ファイルのクラスも合成可能 */
.card {
  composes: shadow from './shared.module.css';
  background: white;
}
```

#### グローバルセレクタ

スコープから除外したいクラスは `:global` で指定する[[7]](#参考リンク):

```css title="styles.module.css"
/* :global でスコープ外のクラスを参照 */
.container :global(.third-party-class) {
  margin: 0;
}

/* 完全にグローバルなクラスを定義 */
:global(.page-title) {
  font-size: 2rem;
}
```

#### Vite での設定

Vite は `.module.css` ファイルを自動的に CSS Modules として処理する[[3]](#参考リンク)。追加設定は不要だが、カスタマイズも可能:

```typescript title="vite.config.ts"
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    modules: {
      // クラス名の命名規則（デフォルト: camelCaseOnly）
      localsConvention: 'camelCase',
      // クラス名の生成パターン
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
});
```

SCSS との組み合わせも可能。ファイル名を `.module.scss` にするだけでよい:

```scss title="card.module.scss"
$card-padding: 24px;

.card {
  padding: $card-padding;
  border-radius: 8px;

  &Title {
    font-size: 1.25rem;
    font-weight: 700;
  }
}
```

```tsx title="Card.tsx"
import styles from './card.module.scss';

// styles.card, styles.cardTitle が利用可能
```

### 4. ポストプロセッサ

#### PostCSS

PostCSS は CSS パーサーとプラグインアーキテクチャを提供するツールであり、プリプロセッサとは異なり CSS を入力として受け取り CSS を出力する[[8]](#参考リンク):

```
CSS → PostCSS パーサー → AST → プラグイン群 → 変換後の CSS
```

**主要プラグイン:**

| プラグイン | 役割 |
|---|---|
| `autoprefixer` | ベンダープレフィックスの自動付与 |
| `postcss-preset-env` | 将来の CSS 構文を現在のブラウザ向けに変換 |
| `cssnano` | CSS のミニファイ |
| `postcss-import` | `@import` のインライン展開 |
| `postcss-nesting` | CSS Nesting の変換 |

```javascript title="postcss.config.js"
module.exports = {
  plugins: [
    require('postcss-import'),
    require('postcss-preset-env')({
      stage: 2,
      features: {
        'nesting-rules': true,
        'custom-media-queries': true,
      },
    }),
    require('autoprefixer'),
    require('cssnano')({ preset: 'default' }),
  ],
};
```

Vite はプロジェクトに PostCSS 設定ファイルがあれば自動的に適用する[[3]](#参考リンク)。

#### Lightning CSS

Lightning CSS は Rust で書かれた CSS パーサー・トランスフォーマー・ミニファイアであり、JavaScript ベースのツールと比較して **100 倍以上高速**に動作する[[9]](#参考リンク)。Parcel チームが開発し、Tailwind CSS v4 のエンジンとしても採用されている。

**主要機能:**

| 機能 | 説明 |
|---|---|
| CSS Modules | クラス名のハッシュ化・スコーピング |
| ベンダープレフィックス | browserslist に基づく自動付与 |
| CSS Nesting 変換 | ネスト構文の展開 |
| カスタムメディアクエリ | ドラフト仕様のサポート |
| ミニファイ | 高速な CSS 圧縮 |
| 構文ダウンレベル | 新しい CSS 機能を古いブラウザ向けに変換 |

```typescript title="Lightning CSS API"
import { transform } from 'lightningcss';

const { code, map } = transform({
  filename: 'style.css',
  code: Buffer.from(`
    .card {
      background: oklch(0.9 0.05 250);
      &:hover { background: oklch(0.85 0.08 250); }
    }
  `),
  minify: true,
  sourceMap: true,
  targets: { chrome: 95 << 16 },  // browserslist ターゲット
});
```

**Vite での Lightning CSS 有効化:**

```typescript title="vite.config.ts"
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    // PostCSS の代わりに Lightning CSS を使用
    transformer: 'lightningcss',
    lightningcss: {
      // CSS Modules の設定
      cssModules: {
        pattern: '[name]_[local]_[hash]',
      },
    },
  },
  build: {
    // ミニファイにも Lightning CSS を使用
    cssMinify: 'lightningcss',
  },
});
```

Lightning CSS を有効にすると、`autoprefixer`、`postcss-preset-env`、CSS Modules など主要な PostCSS プラグインの機能を単一ツールで代替できる。ただし、Tailwind CSS のような PostCSS プラグインが必要な場合は PostCSS と併用する[[9]](#参考リンク)。

#### PostCSS vs Lightning CSS

| 観点 | PostCSS | Lightning CSS |
|---|---|---|
| 実装 | JavaScript（プラグイン方式） | Rust（ネイティブ） |
| 速度 | 遅い | 100 倍以上高速 |
| 拡張性 | 500以上のプラグイン | 組み込み機能のみ |
| カスタマイズ | プラグインで自由に拡張 | 設定オプションで制御 |
| 成熟度 | 非常に高い | 本番利用可能（2025年〜） |
| 推奨用途 | カスタムプラグインが必要な場合 | 標準的な CSS 処理 |

### 5. CSS を TypeScript の型として扱う

#### アプローチの分類

CSS を TypeScript で型安全に扱うアプローチは大きく 2 つに分類できる:

```
アプローチ1: 既存の CSS ファイルから型定義を生成
  .module.css → ツールで .d.ts を生成 → TypeScript で型チェック

アプローチ2: TypeScript で直接 CSS を記述
  .css.ts → ビルド時に CSS を生成 → 最初から型安全
```

#### アプローチ1: CSS Modules + 型定義の自動生成

**手動による型定義:**

```typescript title="button.module.css.d.ts（手動作成）"
declare const styles: {
  readonly primary: string;
  readonly disabled: string;
  readonly large: string;
};
export default styles;
```

手動では保守が困難なため、自動生成ツールを使用する。

**typed-css-modules:**

CSS Modules から `.d.ts` ファイルを自動生成するツール[[10]](#参考リンク):

```bash
# インストール
npm install -D typed-css-modules

# 実行（全 .module.css ファイルの型定義を生成）
npx tcm src/

# ウォッチモード（ファイル変更時に自動再生成）
npx tcm --watch src/
```

```json title="package.json のスクリプト設定"
{
  "scripts": {
    "dev": "vite & tcm --watch src/",
    "check:css-types": "tcm --listDifferent src/"
  }
}
```

生成される型定義:

```typescript title="button.module.css.d.ts（自動生成）"
declare const styles: {
  readonly primary: string;
  readonly disabled: string;
  readonly large: string;
};
export default styles;
```

**typed-scss-modules:**

SCSS ファイル用の型定義生成ツール[[11]](#参考リンク):

```bash
npm install -D typed-scss-modules

# SCSS ファイルから型定義を生成
npx tsm src/
```

**happy-css-modules:**

型定義に加えて **declaration map**（`.d.ts.map`）も生成し、エディタから CSS の定義元へジャンプできるようにするツール[[12]](#参考リンク):

```bash
npm install -D happy-css-modules

# 型定義 + declaration map を生成
npx hcm 'src/**/*.module.css'
```

Vite 用プラグイン `vite-plugin-happy-css-modules` を使えば、開発サーバーと連動して自動的に型定義を更新できる。

**各ツールの比較:**

| ツール | 対応形式 | declaration map | Vite プラグイン | 特徴 |
|---|---|---|---|---|
| `typed-css-modules` | `.css` | なし | なし | シンプル・安定 |
| `typed-scss-modules` | `.scss` | なし | なし | SCSS 特化 |
| `happy-css-modules` | `.css`, `.scss`, `.less` | あり | あり | 定義ジャンプ対応 |
| `vite-plugin-typed-css-modules` | `.css` | なし | 組み込み | Vite ネイティブ |

**CI での型チェック:**

```bash title="CI パイプラインでの検証"
# 型定義が最新かチェック（差分があればエラー）
npx tcm --listDifferent src/

# または husky の pre-commit フックで検証
# .husky/pre-commit
npx tcm --listDifferent src/
```

#### アプローチ2: vanilla-extract — TypeScript で CSS を直接記述

vanilla-extract は CSS を TypeScript ファイル（`.css.ts`）に記述し、ビルド時に静的 CSS を生成するゼロランタイムのライブラリである[[13]](#参考リンク)。最初から TypeScript で書くため、型安全性が**組み込み**で保証される。

**基本的な使い方:**

```typescript title="button.css.ts"
import { style, styleVariants } from '@vanilla-extract/css';

// style() でクラスを定義（型安全な CSS プロパティ）
export const base = style({
  padding: '8px 16px',
  borderRadius: '4px',
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  transition: 'background 0.2s ease',
});

// styleVariants() でバリアントを定義
export const variant = styleVariants({
  primary: [base, { background: '#0ea5e9', color: 'white' }],
  secondary: [base, { background: '#e2e8f0', color: '#1a202c' }],
  danger: [base, { background: '#ef4444', color: 'white' }],
});

// 存在しない CSS プロパティを書くとコンパイルエラー
// export const broken = style({ colour: 'red' }); // ← TypeScript エラー
```

```tsx title="Button.tsx"
import { base, variant } from './button.css';

// variant は { primary: string; secondary: string; danger: string } 型
// 存在しないバリアントを指定するとコンパイルエラー
function Button({ type = 'primary' }: { type?: keyof typeof variant }) {
  return <button className={variant[type]}>Click</button>;
}
```

**テーマシステム:**

```typescript title="theme.css.ts"
import { createTheme, createThemeContract } from '@vanilla-extract/css';

// テーマ契約（型定義）を作成
const vars = createThemeContract({
  color: {
    brand: null,       // null は「値を後で定義する」意味
    background: null,
    text: null,
  },
  space: {
    small: null,
    medium: null,
    large: null,
  },
});

// ライトテーマ
export const lightTheme = createTheme(vars, {
  color: {
    brand: '#0ea5e9',
    background: '#ffffff',
    text: '#1a202c',
  },
  space: {
    small: '4px',
    medium: '8px',
    large: '16px',
  },
});

// ダークテーマ（同じ契約に基づくため型安全）
export const darkTheme = createTheme(vars, {
  color: {
    brand: '#38bdf8',
    background: '#0f172a',
    text: '#e2e8f0',
  },
  space: {
    small: '4px',
    medium: '8px',
    large: '16px',
  },
});

// テーマ変数を使ったスタイル定義
export const container = style({
  background: vars.color.background,
  color: vars.color.text,
  padding: vars.space.large,
});
```

**Recipes（バリアント管理）:**

```typescript title="button-recipe.css.ts"
import { recipe, type RecipeVariants } from '@vanilla-extract/recipes';

export const buttonRecipe = recipe({
  base: {
    padding: '8px 16px',
    borderRadius: '4px',
    fontWeight: 600,
    border: 'none',
  },
  variants: {
    color: {
      primary: { background: '#0ea5e9', color: 'white' },
      secondary: { background: '#e2e8f0', color: '#1a202c' },
    },
    size: {
      small: { fontSize: '0.875rem', padding: '4px 8px' },
      medium: { fontSize: '1rem', padding: '8px 16px' },
      large: { fontSize: '1.125rem', padding: '12px 24px' },
    },
  },
  defaultVariants: {
    color: 'primary',
    size: 'medium',
  },
});

// 型の抽出
export type ButtonVariants = RecipeVariants<typeof buttonRecipe>;
// ButtonVariants = { color?: 'primary' | 'secondary'; size?: 'small' | 'medium' | 'large' }
```

**ビルドツール統合:**

```typescript title="vite.config.ts（vanilla-extract + Vite）"
import { defineConfig } from 'vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';

export default defineConfig({
  plugins: [vanillaExtractPlugin()],
});
```

#### 型安全 CSS アプローチの比較

| 観点 | CSS Modules + 型定義生成 | vanilla-extract |
|---|---|---|
| **型安全性** | 外部ツールで生成（後付け） | 組み込み（最初から型安全） |
| **ランタイムコスト** | ゼロ | ゼロ |
| **記法** | 通常の CSS / SCSS | TypeScript オブジェクト |
| **学習コスト** | 低い（CSS の知識がそのまま使える） | 中（独自 API の学習が必要） |
| **エディタ補完** | ツール依存 | TypeScript の補完がフル活用可能 |
| **テーマシステム** | CSS 変数で手動管理 | `createTheme` / `createThemeContract` |
| **バリアント管理** | 自前で実装 | `@vanilla-extract/recipes` |
| **既存プロジェクトへの導入** | 容易（CSS ファイルはそのまま） | 大規模な書き換えが必要 |
| **フレームワーク統合** | 全フレームワーク対応 | Vite, webpack, Next.js, Remix 等 |

### 6. 実務での構成パターン

#### パターン1: SCSS + CSS Modules（安定志向）

```
src/
  components/
    Button/
      Button.tsx
      Button.module.scss      ← SCSS + CSS Modules
      Button.module.scss.d.ts ← typed-scss-modules で生成
```

- 最も実績のある構成。CSS の知識がそのまま活かせる
- `typed-scss-modules` で型安全性を追加
- Mantine が採用しているアプローチ

#### パターン2: CSS Modules + Lightning CSS（モダン・高速）

```typescript title="vite.config.ts"
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      cssModules: { pattern: '[name]_[local]_[hash]' },
    },
  },
  build: {
    cssMinify: 'lightningcss',
  },
});
```

- PostCSS の代わりに Lightning CSS を使い、ビルド速度を大幅に改善
- ベンダープレフィックス・ネスト展開・ミニファイを単一ツールで処理
- Sass が不要な場合の最もシンプルな構成

#### パターン3: vanilla-extract（型安全重視）

```
src/
  components/
    Button/
      Button.tsx
      button.css.ts     ← TypeScript で CSS を記述
      theme.css.ts      ← テーマ定義
```

- CSS プロパティの型チェック・自動補完がフルに効く
- テーマ契約による型安全なテーマ切り替え
- 新規プロジェクトで型安全性を最優先する場合に最適

#### パターン4: Tailwind CSS（ユーティリティファースト）

```tsx
// CSS ファイルを持たず、ユーティリティクラスで直接記述
<button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
  Click
</button>
```

- CSS ファイルの管理が不要
- shadcn/ui 等のエコシステムとの相性が良い
- 詳細は [Tailwind CSS v4 のデザイントークン](/docs/tailwind/tailwind-v4-design-tokens) を参照

## 検証結果

### Vite での CSS Modules + TypeScript 型定義生成

Vite プロジェクトで `typed-css-modules` を使った型定義の自動生成を検証した:

```bash title="セットアップ"
# typed-css-modules をインストール
npm install -D typed-css-modules

# 型定義を生成
npx tcm src/
# → src/components/Button/button.module.css.d.ts が生成される
```

生成された `.d.ts` ファイルにより、存在しないクラス名を `styles.nonExistent` のように参照するとTypeScript がコンパイルエラーを報告する。`--watch` モードでは CSS ファイルの変更を検知して自動的に型定義を更新するため、開発体験も良好。

### Lightning CSS の CSS Modules

Vite で `css.transformer: 'lightningcss'` を有効にした場合、CSS Modules のハッシュ化やベンダープレフィックスが PostCSS なしで高速に処理されることを確認した。`composes` による合成や `:global` セレクタも正しく動作する。PostCSS から Lightning CSS への切り替えはほぼ設定変更のみで済む。

## まとめ

- **プリプロセッサ**: SCSS が主流だが、ネイティブ CSS の進化により必要性は減少傾向。ミックスイン・ループ・条件分岐が不要であればネイティブ CSS で十分
- **CSS Modules**: クラス名をビルド時にハッシュ化してローカルスコープにする仕組み。Vite は `.module.css` ファイルを自動的に処理する
- **PostCSS vs Lightning CSS**: Lightning CSS は Rust 製で 100 倍以上高速。標準的な CSS 処理であれば PostCSS を完全に代替できる。Tailwind CSS v4 も Lightning CSS ベース
- **CSS の型安全化**: 2つのアプローチがある
  - **CSS Modules + 型定義生成**（`typed-css-modules`, `happy-css-modules`）: 既存の CSS をそのまま活かせる。導入コストが低い
  - **vanilla-extract**: TypeScript で CSS を直接記述。型安全性は最高だが、独自 API の学習コストがある
- **実務での選択**: 既存プロジェクトには CSS Modules + 型定義生成、新規プロジェクトで型安全性を重視するなら vanilla-extract、ユーティリティファーストなら Tailwind CSS が適切

## 参考リンク

1. [Sass 公式サイト — Dart Sass](https://sass-lang.com/dart-sass/)
2. [Speeding Up Your Sass Compilation in Vite and Webpack — OddBird](https://www.oddbird.net/2024/08/14/sass-compiler/)
3. [Vite — Features (CSS)](https://vite.dev/guide/features#css)
4. [Sass vs Less: CSS Preprocessor Guide 2026 — font-size.com](https://font-size.com/less-vs-sass-vs-scss/)
5. [Is CSS the New Sass? Here's What You Need to Know in 2025 — Medium](https://medium.com/@erennaktas/is-css-the-new-sass-heres-what-you-need-to-know-in-2025-fef0e9a379c6)
6. [CSS Modules — Lightning CSS](https://lightningcss.dev/css-modules.html)
7. [css-loader — webpack (CSS Modules)](https://webpack.js.org/loaders/css-loader/)
8. [CSS Preprocessors vs Postprocessors: Is It Time to Switch? — talent500](https://talent500.com/blog/css-preprocessors-vs-postprocessors-modern-toolchain/)
9. [Getting Started — Lightning CSS](https://lightningcss.dev/docs.html)
10. [typed-css-modules — GitHub](https://github.com/Quramy/typed-css-modules)
11. [typed-scss-modules — GitHub](https://github.com/skovy/typed-scss-modules)
12. [happy-css-modules — GitHub](https://github.com/mizdra/happy-css-modules)
13. [vanilla-extract — Zero-runtime Stylesheets-in-TypeScript](https://vanilla-extract.style/)
14. [How to write type-safe CSS Modules — LogRocket](https://blog.logrocket.com/write-type-safe-css-modules/)
15. [Compiling CSS With Vite and Lightning CSS — CSS-Tricks](https://css-tricks.com/compiling-css-with-vite-and-lightning-css/)

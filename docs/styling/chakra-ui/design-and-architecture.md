---
id: chakra-ui-design-and-architecture
title: "Chakra UI v3 の設計思想とアーキテクチャ"
description: "Chakra UI v3の合成コンポーネントへの転換、Panda CSS由来のレシピシステム、セマンティックトークン、Ark UI・Zag.jsエコシステムを調査。"
sidebar_position: 1
tags: [Chakra UI, React, デザインシステム, CSS-in-JS]
last_update:
  date: 2026-03-06
---

# Chakra UI v3 の設計思想とアーキテクチャ

:::info 関連ドキュメント
- [Chakra UI v3 の運用ガイド — AI連携・カスタマイズ・落とし穴](/docs/styling/chakra-ui/chakra-ui-operations-and-ai) — AI連携、移行戦略、運用上の注意点
- [shadcn/ui と類似デザインシステムの比較](/docs/styling/shadcn-ui/shadcn-ui-comparison-with-alternatives) — shadcn/ui, MUI, Chakra UI 等の横断比較
:::

## 概要

Chakra UI v3 の設計思想（クローズドからオープンな合成コンポーネントへの転換）、Panda CSS 由来のレシピシステム、デザイントークンとセマンティックトークンによるテーマシステム、および Ark UI・Panda CSS・Zag.js を含むエコシステム全体のアーキテクチャについて調査した。

## 背景・動機

Chakra UI は 2019 年の登場以来、直感的なスタイルプロップスと優れた DX で人気を博してきた。しかし v2 はランタイム CSS-in-JS のパフォーマンス問題や React Server Components との非互換性といった課題を抱えていた。2024 年にリリースされた v3 はこれらの課題に対応する完全な書き直しであり、設計思想自体が大きく転換された[[1]](#参考リンク)。shadcn/ui との設計アプローチの違いを理解し、プロジェクトへの適用判断に役立てるため調査を行う。

## 調査内容

### 1. v2 から v3 への設計思想の転換

#### クローズドからオープンな合成コンポーネントへ

v3 最大の設計変更は、クローズドコンポーネントからオープンな合成（compound）コンポーネントへの移行である[[1]](#参考リンク)[[2]](#参考リンク)。

```tsx title="v2: クローズドコンポーネント"
import { Checkbox } from "@chakra-ui/react";

// v2 では単一のコンポーネントに全てが内包されている
<Checkbox isChecked={checked} onChange={handleChange}>
  利用規約に同意する
</Checkbox>
```

```tsx title="v3: オープンな合成コンポーネント"
import { Checkbox } from "@chakra-ui/react";

// v3 ではコンポーネントが構成部品に分割されている
<Checkbox.Root checked={checked} onCheckedChange={handleChange}>
  <Checkbox.HiddenInput />
  <Checkbox.Control>
    <Checkbox.Indicator />
  </Checkbox.Control>
  <Checkbox.Label>利用規約に同意する</Checkbox.Label>
</Checkbox.Root>
```

この変更により、各構成部品に個別のスタイルやイベントハンドラを付与でき、カスタマイズの柔軟性が大幅に向上した。一方で記述量が増えるため、**Snippets**（後述）でこの複雑さを緩和している。

#### Props の標準化

v3 では HTML 標準に近い Props 命名に統一された[[2]](#参考リンク):

| v2 | v3 | 理由 |
|---|---|---|
| `isDisabled` | `disabled` | HTML 標準属性に統一 |
| `isLoading` | `loading` | 簡潔化 |
| `isChecked` | `checked` | HTML 標準に準拠 |
| `spacing` | `gap` | CSS 標準の `gap` プロパティに準拠 |
| `leftIcon` / `rightIcon` | 子要素として直接配置 | 合成パターンに統一 |

#### 依存関係の削減

v2 では 4 パッケージが必要だったが、v3 では大幅に削減された[[2]](#参考リンク):

```bash title="v2 のインストール"
npm install @chakra-ui/react @emotion/react @emotion/styled framer-motion
```

```bash title="v3 のインストール"
npm install @chakra-ui/react @emotion/react
```

`@emotion/styled` が不要になり、`framer-motion` はプラットフォーム標準の CSS アニメーションに置き換えられた。これによりバンドルサイズが削減されている。

### 2. エコシステムのアーキテクチャ — Chakraverse

Chakra UI の作者 Segun Adebayo は、3つの相補的なプロジェクトからなるエコシステム「Chakraverse」を構築している[[3]](#参考リンク):

```
Chakraverse エコシステム
+-- Zag.js          — ステートマシン駆動のUIロジック（フレームワーク非依存）
+-- Ark UI           — Zag.js ベースのヘッドレスUIコンポーネント（React/Vue/Svelte/Solid対応）
+-- Panda CSS        — ビルド時CSS-in-JS（静的解析ベース）
+-- Chakra UI v3     — Ark UI + Emotion によるスタイル付きコンポーネント
\-- Park UI          — Ark UI + Panda CSS によるスタイル付きコンポーネント
```

**各レイヤーの役割:**

| レイヤー | ライブラリ | 役割 |
|---|---|---|
| **ロジック層** | Zag.js | UI コンポーネントの状態管理をステートマシンで実装。フレームワーク非依存 |
| **ヘッドレス層** | Ark UI | Zag.js のロジックを React/Vue/Svelte/Solid のコンポーネントとして提供 |
| **スタイリング層（ランタイム）** | Chakra UI v3 | Ark UI + Emotion によるスタイル付きコンポーネント |
| **スタイリング層（ビルド時）** | Park UI | Ark UI + Panda CSS によるスタイル付きコンポーネント |

Chakra UI v3 は本質的に「Ark UI のスタイル済みバージョン」であり[[3]](#参考リンク)、ロジック層は Zag.js のステートマシンが担い、スタイリング層は Panda CSS のレシピ API と整合性を持つ Emotion ベースの実装となっている。

### 3. レシピシステム

v3 のスタイリングの中核は、Panda CSS から着想を得た**レシピ（Recipe）システム**である[[1]](#参考リンク)[[4]](#参考リンク)。v2 のランタイムでスタイルを計算する関数ベースのアプローチから、宣言的なバリアント定義に移行した。

#### Recipe（単一パーツ）

単一要素のスタイルバリアントを定義する:

```tsx title="recipe の定義例"
import { defineRecipe } from "@chakra-ui/react";

// Badge のカスタムレシピ
const badgeRecipe = defineRecipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    fontWeight: "semibold",
    borderRadius: "md",
  },
  variants: {
    // バリアントでスタイルの差分を管理
    variant: {
      solid: { bg: "colorPalette.solid", color: "colorPalette.contrast" },
      outline: { borderWidth: "1px", borderColor: "colorPalette.muted" },
      subtle: { bg: "colorPalette.subtle", color: "colorPalette.fg" },
    },
    size: {
      sm: { fontSize: "xs", px: "2", py: "0.5" },
      md: { fontSize: "sm", px: "3", py: "1" },
      lg: { fontSize: "md", px: "4", py: "1.5" },
    },
  },
  defaultVariants: {
    variant: "solid",
    size: "md",
  },
});
```

#### Slot Recipe（複数パーツ）

複数の構成要素を持つコンポーネント向けのレシピ[[4]](#参考リンク)。各「スロット」に対してバリアントごとのスタイルを定義できる:

```tsx title="slot recipe の定義例"
import { defineSlotRecipe } from "@chakra-ui/react";

// Alert のスロットレシピ（root, indicator, title, description の4パーツ）
const alertSlotRecipe = defineSlotRecipe({
  slots: ["root", "indicator", "title", "description"],
  base: {
    root: { display: "flex", alignItems: "flex-start", gap: "3", p: "4", borderRadius: "md" },
    indicator: { flexShrink: 0, width: "5", height: "5" },
    title: { fontWeight: "semibold" },
    description: { fontSize: "sm", opacity: 0.8 },
  },
  variants: {
    status: {
      info: {
        root: { bg: "blue.subtle", color: "blue.fg" },
        indicator: { color: "blue.solid" },
      },
      warning: {
        root: { bg: "orange.subtle", color: "orange.fg" },
        indicator: { color: "orange.solid" },
      },
      error: {
        root: { bg: "red.subtle", color: "red.fg" },
        indicator: { color: "red.solid" },
      },
    },
  },
  defaultVariants: {
    status: "info",
  },
});
```

shadcn/ui の CVA（Class Variance Authority）と Chakra UI のレシピは、どちらも「バリアントベースのスタイル定義」という共通の設計思想を持つ。違いは、shadcn/ui が Tailwind のユーティリティクラスを文字列として組み立てるのに対し、Chakra UI はオブジェクト記法で CSS プロパティを直接指定する点にある。

### 4. テーマシステム

#### デザイントークン

Chakra UI v3 のテーマは **トークン** と **セマンティックトークン** の2層構造で構成される[[5]](#参考リンク)[[6]](#参考リンク):

```tsx title="テーマの定義"
import { createSystem, defineConfig, defaultConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    // デザイントークン: 生の値を定義
    tokens: {
      colors: {
        brand: {
          50: { value: "#e6f2ff" },
          100: { value: "#b3d9ff" },
          500: { value: "#0066cc" },
          900: { value: "#003366" },
        },
      },
      fonts: {
        heading: { value: "'Noto Sans JP', sans-serif" },
        body: { value: "'Noto Sans JP', sans-serif" },
      },
    },

    // セマンティックトークン: コンテキスト依存の値を定義
    semanticTokens: {
      colors: {
        "brand.solid": { value: { _light: "{colors.brand.500}", _dark: "{colors.brand.200}" } },
        "brand.fg": { value: { _light: "{colors.brand.700}", _dark: "{colors.brand.300}" } },
        "brand.subtle": { value: { _light: "{colors.brand.50}", _dark: "{colors.brand.900}" } },
      },
    },
  },
});

// defaultConfig とマージしてシステムを作成
const system = createSystem(defaultConfig, config);
```

#### セマンティックトークンの 7 パターン

v3 では各カラーパレットに対して 7 つのセマンティックトークンが自動的に提供される[[1]](#参考リンク):

| トークン | 用途 | 例 |
|---|---|---|
| `solid` | 塗りつぶし背景 | ボタンの背景色 |
| `muted` | 控えめな背景 | 非アクティブ要素 |
| `subtle` | 微かな背景 | ホバー状態の背景 |
| `emphasized` | 強調 | 選択状態 |
| `contrast` | コントラスト（solid 上のテキスト） | ボタンのテキスト色 |
| `fg` | 前景色 | テキスト・アイコン |
| `focusRing` | フォーカスリング | フォーカス状態 |

#### colorPalette によるダイナミックカラー

`colorPalette` プロップを使うと、コンポーネントツリー内でカラーパレットを動的に切り替えられる[[1]](#参考リンク):

```tsx title="colorPalette の活用"
import { Box, Button } from "@chakra-ui/react";

// colorPalette を指定すると、子要素の colorPalette.* トークンが動的に解決される
<Box colorPalette="teal">
  <Button variant="solid">Teal ボタン</Button>
  <Button variant="outline">Teal アウトラインボタン</Button>
</Box>

<Box colorPalette="purple">
  <Button variant="solid">Purple ボタン</Button>
</Box>
```

この仕組みは CSS カスタムプロパティで実装されており、ランタイムのオーバーヘッドなしにテーマのカラーを動的に切り替えられる。

#### ダークモード対応

セマンティックトークンの `_light` / `_dark` 条件で自動的に切り替わる[[5]](#参考リンク)。Next.js では `next-themes` との統合が推奨されている:

```tsx title="Provider セットアップ（Next.js App Router）"
"use client";

import { ChakraProvider } from "@chakra-ui/react";
import { ThemeProvider } from "next-themes";
import { system } from "@/theme"; // createSystem で生成したシステム

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <ThemeProvider attribute="class" disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </ChakraProvider>
  );
}
```

### 5. Snippets — コードコピー方式

v3 では shadcn/ui に影響を受けた **Snippets** という仕組みが導入された[[7]](#参考リンク)[[8]](#参考リンク)。合成コンポーネントの定型的な組み立てパターンをプロジェクトにコピーし、カスタマイズの起点として利用する。

```bash title="Snippets CLI"
# 全スニペットを追加
npx @chakra-ui/cli snippet add --all

# 特定のスニペットを追加
npx @chakra-ui/cli snippet add button dialog toaster

# 利用可能なスニペット一覧
npx @chakra-ui/cli snippet list

# 出力先ディレクトリを指定
npx @chakra-ui/cli snippet add dialog --outdir ./components/custom
```

Snippets は `components/ui/` ディレクトリに生成され、合成コンポーネントの構成をプリセットとして提供する。shadcn/ui のコンポーネントコピーに類似するが、Chakra UI の Snippets はスタイリングロジックをテーマ側（レシピ）に保持し、構成パターンのみをコピーする点が異なる。

### 6. パフォーマンス特性

v3 のパフォーマンス改善は以下の 3 点に集約される[[1]](#参考リンク):

| 改善項目 | 詳細 |
|---|---|
| **スタイリングエンジンの外部化** | React ツリーの外でスタイリングエンジンを初期化し、コンポーネントが消費する方式に変更。レンダリングのたびにスタイルを再計算しない |
| **framer-motion の除去** | プラットフォーム標準の CSS アニメーション / CSS Transitions に置き換え。バンドルサイズ削減 |
| **レシピシステム** | ランタイム関数から宣言的なバリアント定義に移行し、スタイル解決のオーバーヘッドを削減 |

ただし、v3 は依然として **Emotion（ランタイム CSS-in-JS）を内部的に使用**している[[3]](#参考リンク)。Panda CSS の API と整合性を持たせることで、将来的にビルド時 CSS 生成への移行パスを用意しているが、現時点ではランタイムコストが存在する。この点は、ゼロランタイムの shadcn/ui（Tailwind CSS）や Mantine（CSS Modules）と比較した際の弱みとなる。

### 7. shadcn/ui との設計比較

| 観点 | Chakra UI v3 | shadcn/ui |
|---|---|---|
| **配布方式** | npm パッケージ（`@chakra-ui/react`） | CLI でソースコードをコピー |
| **スタイリング** | Emotion（ランタイム CSS-in-JS） | Tailwind CSS（ゼロランタイム） |
| **スタイル定義** | オブジェクト記法のレシピ | CVA + Tailwind クラス文字列 |
| **テーマシステム** | `createSystem` + トークン / セマンティックトークン | CSS 変数 + `@theme inline` |
| **ヘッドレス基盤** | Ark UI（Zag.js ステートマシン） | Radix UI / Base UI |
| **コード所有** | Snippets で構成パターンをコピー（スタイルはテーマ側） | コンポーネント全体をコピーして所有 |
| **RSC 対応** | `use client` が必要（Emotion のため） | ゼロランタイムで良好 |
| **マルチフレームワーク** | React のみ（Ark UI は React/Vue/Svelte/Solid 対応） | React のみ（コミュニティ版あり） |
| **ダークモード** | セマンティックトークンの条件分岐 | CSS 変数の `.dark` クラス切り替え |

## 検証結果

### テーマ構成の実例

`createSystem` を使ったテーマカスタマイズを検証した:

```tsx title="theme.ts"
import { createSystem, defineConfig, defaultConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#f0f9ff" },
          100: { value: "#e0f2fe" },
          200: { value: "#bae6fd" },
          300: { value: "#7dd3fc" },
          400: { value: "#38bdf8" },
          500: { value: "#0ea5e9" },
          600: { value: "#0284c7" },
          700: { value: "#0369a1" },
          800: { value: "#075985" },
          900: { value: "#0c4a6e" },
        },
      },
    },
    semanticTokens: {
      colors: {
        // カスタムカラーのセマンティックトークン
        "brand.solid": { value: { _light: "{colors.brand.500}", _dark: "{colors.brand.300}" } },
        "brand.contrast": { value: { _light: "white", _dark: "{colors.brand.900}" } },
        "brand.fg": { value: { _light: "{colors.brand.700}", _dark: "{colors.brand.200}" } },
        "brand.subtle": { value: { _light: "{colors.brand.50}", _dark: "{colors.brand.950}" } },
        "brand.muted": { value: { _light: "{colors.brand.100}", _dark: "{colors.brand.900}" } },
      },
    },
    recipes: {
      // カスタムレシピの追加
      button: {
        variants: {
          variant: {
            brand: {
              bg: "brand.solid",
              color: "brand.contrast",
              _hover: { bg: "brand.600" },
            },
          },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
```

`defineConfig` で設定を定義し、`defaultConfig` とマージする方式は、既存のテーマを壊さずに拡張できるため実用的である。CLI で型定義を自動生成（`npx @chakra-ui/cli typegen`）すれば、カスタムトークンの自動補完も有効になる。

## まとめ

- Chakra UI v3 は v2 からの**完全な書き直し**であり、オープンな合成コンポーネント、Panda CSS 由来のレシピシステム、2層のトークン構造（デザイントークン + セマンティックトークン）が設計の柱となっている
- エコシステムは **Zag.js（ロジック）→ Ark UI（ヘッドレス）→ Chakra UI v3（スタイル付き）** の階層構造であり、各層が独立して利用可能
- **Emotion を維持**しているため、ランタイム CSS-in-JS のコストが存在する。shadcn/ui（Tailwind）や Mantine（CSS Modules）と比べて RSC 対応では不利
- **Snippets** は shadcn/ui のコードコピー方式に影響を受けたもので、合成コンポーネントの定型パターンをプロジェクトにコピーする。ただし shadcn/ui と異なり、スタイルはテーマ側に残る
- **colorPalette** によるダイナミックカラーと **7 つのセマンティックトークン**の自動提供は、テーマ設計の生産性を高める独自の強み
- 将来的に Panda CSS（ビルド時 CSS）への移行パスが用意されており、ランタイムコストの課題は段階的に解消される見込み

## 参考リンク

1. [Announcing Chakra UI v3](https://chakra-ui.com/blog/announcing-v3)
2. [Chakra v2 vs v3 - A Detailed Comparison](https://chakra-ui.com/blog/chakra-v2-vs-v3-a-detailed-comparison)
3. [Chakra, Panda and Ark - What's the plan? — Segun Adebayo](https://www.adebayosegun.com/blog/chakra-panda-ark-whats-the-plan)
4. [Recipes — Chakra UI](https://chakra-ui.com/docs/theming/customization/recipes)
5. [Theming Overview — Chakra UI](https://chakra-ui.com/docs/theming/overview)
6. [Semantic Tokens — Chakra UI](https://chakra-ui.com/docs/theming/semantic-tokens)
7. [Snippets CLI — Chakra UI](https://chakra-ui.com/docs/get-started/cli)
8. [Migration to v3 — Chakra UI](https://chakra-ui.com/docs/get-started/migration)
9. [Slot Recipes — Chakra UI](https://chakra-ui.com/docs/theming/slot-recipes)
10. [The future of Chakra UI — Segun Adebayo](https://www.adebayosegun.com/blog/the-future-of-chakra-ui)

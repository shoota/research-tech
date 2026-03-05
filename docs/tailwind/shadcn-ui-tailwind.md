---
id: tailwind-shadcn-ui
title: shadcn/ui の Tailwind CSS 利用パターン
sidebar_position: 3
last_update:
  date: 2026-03-05
---

# shadcn/ui の Tailwind CSS 利用パターン

## 概要

shadcn/ui が Tailwind CSS をどのように活用しているかを調査した。CSS 変数によるテーマシステム、ユーティリティ関数、Tailwind v4 対応、他ライブラリとの比較を整理する。

## 背景・動機

shadcn/ui は 2023 年の登場以降、React UI コンポーネントの構築手法として急速に普及した。従来の UI ライブラリとは異なる「コピー＆ペースト」アーキテクチャと Tailwind CSS の深い統合が特徴であり、そのアプローチを理解することで Tailwind CSS の高度な利用パターンを学べる。

## 調査内容

### 1. shadcn/ui のアーキテクチャ概要

shadcn/ui は従来の UI ライブラリとは根本的に異なるアプローチを採用している。

**コピー＆ペースト方式**

- npm パッケージとしてインストールするのではなく、CLI (`npx shadcn@latest add button` 等) でコンポーネントのソースコードをプロジェクトに直接コピーする
- コピーされたコードはプロジェクトの `components/ui/` ディレクトリに配置され、開発者が完全に所有する
- ロックインがなく、コンポーネントの内部ロジックやスタイルを自由に変更可能

**Radix UI 依存**

- アクセシビリティとインタラクションの基盤として [Radix UI](https://www.radix-ui.com/) のプリミティブを使用
- WAI-ARIA 準拠のキーボードナビゲーション、フォーカス管理等を Radix が担当
- shadcn/ui はその上に Tailwind CSS でスタイリングを施す構成

**構成要素の関係**

```
Radix UI (アクセシビリティ・インタラクション)
  + Tailwind CSS (スタイリング)
  + CSS 変数 (テーマシステム)
  + CVA (バリアント管理)
  + cn() (クラス名マージ)
  = shadcn/ui コンポーネント
```

### 2. Tailwind CSS 利用パターン

#### CSS 変数によるテーマシステム

shadcn/ui はすべてのコンポーネントで共通の CSS 変数を参照する設計になっている。これにより、CSS 変数の値を変更するだけでサイト全体のテーマを一括変更できる。

**globals.css での定義（OKLCH カラー、Tailwind v4）**

```css
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  /* ... */
}
```

**background / foreground の命名規約**

shadcn/ui は色の命名に「background と foreground」のペア規約を採用している。

- `--primary` はその要素の背景色
- `--primary-foreground` はその要素上のテキスト色

コンポーネントでは以下のように使う:

```tsx
<div className="bg-primary text-primary-foreground">Hello</div>
```

#### Tailwind v4 での @theme inline 設定

Tailwind v4 では `tailwind.config.js` が不要になり、CSS 内の `@theme inline` ディレクティブで Tailwind にカスタムカラーを認識させる。

```css
@import "tailwindcss";
@import "tw-animate-css";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  /* ... */
}
```

`@theme inline` により、`:root` で定義した CSS 変数を `bg-primary` や `text-foreground` といった Tailwind ユーティリティクラスとして利用可能にしている。

#### Tailwind v3 での tailwind.config.js パターン（従来方式）

Tailwind v3 では `tailwind.config.js` の `extend.colors` で CSS 変数を参照していた。

```js
// tailwind.config.js (v3)
module.exports = {
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ...
      },
    },
  },
}
```

v3 では CSS 変数に hsl の各チャンネル値（`0 0% 100%`）を格納し、`hsl(var(--変数名))` でラップしていた。v4 では変数に `oklch(1 0 0)` のように完全な色値を格納する方式に変わった。

### 3. Tailwind v4 対応状況

2025年3月時点で shadcn/ui は Tailwind v4 を完全サポートしている。主な変更点は以下の通り。

**HSL から OKLCH への移行**

- v3: `--primary: 0 0% 3.9%;` (HSL チャンネル値)
- v4: `--primary: oklch(0.205 0 0);` (OKLCH 完全値)
- OKLCH はより広い色域をカバーし、人間の知覚に近い色空間

**設定方法の変化**

- `tailwind.config.js` / `tailwind.config.ts` → CSS 内の `@theme inline` ディレクティブに移行
- `@plugin 'tailwindcss-animate'` → `@import "tw-animate-css"` に移行（2025年3月19日）
- チャートの色参照: `"hsl(var(--chart-1))"` → `"var(--chart-1)"` に簡素化

**data-slot 属性の追加**

Tailwind v4 対応版ではすべてのプリミティブに `data-slot` 属性が付与された。これにより、親コンポーネントから子のスタイリングを Tailwind で制御しやすくなった。

```tsx
function AccordionItem({ className, ...props }) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  )
}
```

**size-\* ユーティリティの採用**

```tsx
// v3
<Icon className="w-4 h-4" />

// v4
<Icon className="size-4" />
```

**後方互換性**

既存の Tailwind v3 + React 18 プロジェクトは引き続き動作する。新しいコンポーネントを追加する際も v3 形式が維持され、プロジェクト全体をアップグレードした場合のみ v4 形式になる。

### 4. ユーティリティ関数

#### cn() ヘルパー関数

shadcn/ui のすべてのコンポーネントで使用される中核ユーティリティ。`clsx` と `tailwind-merge` を組み合わせている。

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**各ライブラリの役割:**

- **clsx**: 条件付きクラス名の結合（falsy 値の除外、配列・オブジェクト記法対応）
- **tailwind-merge**: Tailwind クラスの競合解決（例: `p-4` と `p-2` が両方指定された場合、後者を採用）

**使用例:**

```tsx
// 条件付きクラスの結合 + Tailwind 競合解決
<div className={cn(
  "rounded-lg p-4",           // ベーススタイル
  isActive && "bg-primary",   // 条件付き
  className                   // 外部からの上書き許可
)} />
```

#### class-variance-authority (CVA)

コンポーネントのバリアント（サイズ、色、状態等）を宣言的に定義するライブラリ。

```tsx
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  // ベーススタイル
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

CVA で定義したバリアントは TypeScript の型としても抽出でき、コンポーネントの props に型安全にマッピングされる。

### 5. デザイントークン構造

shadcn/ui が定義するデザイントークン（CSS 変数）の全体構造:

| カテゴリ | 変数名 | 用途 |
|---------|--------|------|
| **ベース** | `--background`, `--foreground` | ページ全体の背景色・テキスト色 |
| **カード** | `--card`, `--card-foreground` | カードコンポーネントの背景・テキスト |
| **ポップオーバー** | `--popover`, `--popover-foreground` | ポップオーバーの背景・テキスト |
| **プライマリ** | `--primary`, `--primary-foreground` | 主要アクション（ボタン等） |
| **セカンダリ** | `--secondary`, `--secondary-foreground` | 副次的アクション |
| **ミュート** | `--muted`, `--muted-foreground` | 控えめな要素・補助テキスト |
| **アクセント** | `--accent`, `--accent-foreground` | 強調要素・ホバー状態 |
| **デストラクティブ** | `--destructive` | 削除・エラー等の破壊的アクション |
| **UI 要素** | `--border`, `--input`, `--ring` | ボーダー、入力フィールド、フォーカスリング |
| **チャート** | `--chart-1` 〜 `--chart-5` | グラフ・チャートの配色 |
| **サイドバー** | `--sidebar`, `--sidebar-foreground` 等 | サイドバー専用の配色セット |
| **角丸** | `--radius` | コンポーネント共通の角丸サイズ |

**ベースカラーのプリセット**

shadcn/ui は以下のベースカラーパレットを提供している:

- Neutral（デフォルト）
- Stone
- Zinc
- Gray
- Slate

各プリセットは `:root` と `.dark` の両方の変数セットを持ち、OKLCH 形式で定義されている。

**カスタムカラーの追加方法**

```css
/* 1. CSS 変数を定義 */
:root {
  --warning: oklch(0.84 0.16 84);
  --warning-foreground: oklch(0.28 0.07 46);
}
.dark {
  --warning: oklch(0.41 0.11 46);
  --warning-foreground: oklch(0.99 0.02 95);
}

/* 2. @theme inline で Tailwind に認識させる */
@theme inline {
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

これで `bg-warning text-warning-foreground` が使用可能になる。

### 6. 他の UI ライブラリとの比較

| 観点 | shadcn/ui | MUI (Material UI) | Chakra UI |
|------|-----------|-------------------|-----------|
| **提供形態** | ソースコードのコピー | npm パッケージ | npm パッケージ |
| **スタイリング** | Tailwind CSS (ゼロランタイム) | Emotion / styled-components (CSS-in-JS) | Emotion (CSS-in-JS) |
| **カスタマイズ性** | コード所有により完全に自由 | テーマオブジェクトで設定 | テーマオブジェクトで設定 |
| **バンドルサイズ** | 使用分のみ (小) | ランタイム含む (大) | ランタイム含む (中) |
| **デザイン哲学** | ヘッドレス + 自由な設計 | Material Design 準拠 | アクセシビリティ優先 |
| **ロックイン** | なし | あり | あり |
| **学習コスト** | Tailwind CSS 知識が必要 | 独自 API の習得が必要 | 比較的低い |
| **アクセシビリティ** | Radix UI が担当 | 組み込み | WAI-ARIA 準拠 |

**shadcn/ui のアプローチの利点:**

1. **ゼロランタイムオーバーヘッド**: Tailwind CSS はビルド時にクラスを生成するため、CSS-in-JS のようなランタイムコストがない
2. **完全なコード所有**: パッケージ更新による破壊的変更の影響を受けない
3. **バンドルサイズの最適化**: 使用するコンポーネントのコードのみがプロジェクトに含まれる
4. **Tailwind エコシステムとの統合**: Tailwind の全機能（レスポンシブ、ダークモード、アニメーション等）をそのまま活用可能
5. **CSS 変数によるテーマの一貫性**: すべてのコンポーネントが同じ変数を参照するため、サードパーティ製のコンポーネントも自動的にテーマに適合する

**shadcn/ui のアプローチの課題:**

1. **Tailwind CSS の習熟が前提**: ユーティリティファーストの CSS に馴染みがないと学習コストが高い
2. **コンポーネント更新の手動管理**: パッケージのように自動更新されず、差分の適用は開発者責任
3. **デザイン判断が必要**: MUI のように完成されたデザインシステムがないため、デザインの意思決定が求められる

## まとめ

shadcn/ui の Tailwind CSS 利用は以下の点で優れた設計パターンを示している:

- **CSS 変数 + Tailwind の組み合わせ**: テーマの柔軟性とユーティリティクラスの生産性を両立
- **OKLCH カラースペースの採用**: Tailwind v4 と連動し、より正確な色管理を実現
- **cn() + CVA の組み合わせ**: 型安全で保守性の高いコンポーネントバリアント管理
- **@theme inline による宣言的設定**: Tailwind v4 のネイティブ機能を最大限活用

Tailwind CSS を使ったコンポーネント設計のリファレンス実装として、shadcn/ui のパターンは非常に参考になる。特に CSS 変数によるテーマシステムと CVA によるバリアント管理の組み合わせは、独自のデザインシステム構築にも応用可能である。

## 参考リンク

- [shadcn/ui 公式サイト](https://ui.shadcn.com/)
- [Theming - shadcn/ui](https://ui.shadcn.com/docs/theming)
- [Tailwind v4 - shadcn/ui](https://ui.shadcn.com/docs/tailwind-v4)
- [Manual Installation - shadcn/ui](https://ui.shadcn.com/docs/installation/manual)
- [Class Variance Authority (CVA)](https://cva.style/docs)
- [React UI libraries in 2025: Comparing shadcn/ui, Radix, Mantine, MUI, Chakra & more - Makers' Den](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra)
- [Why I Chose Shadcn Over MUI/Chakra for My SaaS UI - Medium](https://medium.com/@joseph.goins/why-i-chose-shadcn-over-mui-chakra-for-my-saas-ui-ad3b1eeaa727)
- [Exploring globals.css | Vercel Academy](https://vercel.com/academy/shadcn-ui/exploring-globals-css)
- [React UI with shadcn/ui + Radix + Tailwind | Vercel Academy](https://vercel.com/academy/shadcn-ui)
- [Making Sense of Shadcn UI's Theming and Color Variables - Denys Isaichenko](https://isaichenko.dev/blog/shadcn-colors-naming/)
- [Updating shadcn/ui to Tailwind 4 - Shadcnblocks.com](https://www.shadcnblocks.com/blog/tailwind4-shadcn-themeing/)

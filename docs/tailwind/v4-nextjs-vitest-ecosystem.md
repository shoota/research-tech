---
id: tailwind-v4-nextjs-vitest-ecosystem
title: v4のNext.js・Vitest利用とエコシステム
sidebar_position: 4
---

# Tailwind CSS v4 の Next.js・Vitest 利用とエコシステム

## 概要

Tailwind CSS v4 を Next.js（App Router）および Vitest で利用する方法と、周辺エコシステム（clsx / tailwind-merge / cva / tailwind-variants / 公式プラグイン）の対応状況・使い分けを調査した。

## 背景・動機

Tailwind CSS v4 は 2025 年 1 月にリリースされ、JavaScript 設定ファイルから CSS ファーストへの移行、PostCSS プラグインの刷新（`@tailwindcss/postcss`）、Vite 専用プラグイン（`@tailwindcss/vite`）の追加など、セットアップ方法が大きく変化した。Next.js プロジェクトへの導入手順、テスト環境（Vitest）での扱い、周辺ライブラリの v4 対応状況を把握することで、プロダクト導入時の判断材料を得る。

## 調査内容

### 1. Next.js (App Router) での Tailwind CSS v4 セットアップ

#### インストール

```bash
npm install tailwindcss @tailwindcss/postcss postcss
```

Next.js は Vite ベースではないため、**PostCSS プラグイン経由**で Tailwind を統合する。`@tailwindcss/vite` は使用しない。

#### PostCSS 設定

プロジェクトルートに `postcss.config.mjs` を作成する。

```javascript title="postcss.config.mjs"
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

v3 で使用していた `tailwindcss` や `autoprefixer` のプラグイン指定は不要になった。`@tailwindcss/postcss` が一括で処理する。

#### CSS ファイルの設定

`app/globals.css`（または `src/app/globals.css`）に以下を記述する。

```css title="app/globals.css"
@import "tailwindcss";
```

v3 での `@tailwind base; @tailwind components; @tailwind utilities;` は `@import "tailwindcss";` の一行に置き換わった。

#### カスタムテーマの定義

`tailwind.config.js` は不要。CSS 内の `@theme` ディレクティブで定義する。

```css title="app/globals.css"
@import "tailwindcss";

@theme {
  --color-brand: oklch(0.72 0.19 231.4);
  --font-display: "Inter", sans-serif;
  --breakpoint-3xl: 1920px;
}
```

#### コンテンツの自動検出

v4 ではソースファイルの自動スキャンが行われるため、`content` 配列の設定は不要。`.gitignore` に記載されたディレクトリは自動的に除外される。明示的にソースを追加する場合は `@source` ディレクティブを使う。

```css title="app/globals.css"
@import "tailwindcss";
@source "../node_modules/@my-company/ui-lib";
```

#### create-next-app による自動セットアップ

```bash
npx create-next-app@latest my-project
```

プロンプトで Tailwind CSS を選択すると、v4 の設定が自動的に行われる。手動セットアップは不要。

### 2. Next.js での Tailwind v4 利用パターン

#### Server Components での利用

Tailwind CSS はビルド時に静的な CSS を生成するため、React Server Components (RSC) と完全に互換性がある。ランタイムで JavaScript を必要としないため、Server Components のゼロバンドルサイズの方針に合致する。`className` にユーティリティクラスを記述するだけで動作する。

```tsx title="app/page.tsx"
// Server Component（デフォルト）
export default function Home() {
  return (
    <h1 className="text-3xl font-bold text-brand underline">
      Hello world!
    </h1>
  );
}
```

#### CSS Modules との併用

Tailwind v4 では CSS Modules 内で `@apply` を使う場合、`@reference` ディレクティブが必要になった。

```css title="components/Button.module.css"
@reference "tailwindcss";

.button {
  @apply rounded-lg bg-blue-500 px-4 py-2 text-white;
}

.button:hover {
  @apply bg-blue-600;
}
```

ただし、Tailwind の公式な推奨は CSS Modules + `@apply` よりも、直接 `className` にユーティリティクラスを記述するアプローチである。CSS Modules は Tailwind のユーティリティでは表現しにくい複雑なスタイル（アニメーション定義など）に限定して使うのがベストプラクティスとされる。

#### スタイリング戦略の使い分け

| 方式 | 用途 |
|------|------|
| Tailwind ユーティリティ（`className`） | コンポーネントのスタイリング全般（推奨） |
| CSS Modules | Tailwind で表現しにくいスコープ付きカスタム CSS |
| グローバル CSS（`globals.css`） | Tailwind の `@theme` 定義、リセット等 |

### 3. Vitest で Tailwind クラスをテストする方法

#### 根本的な課題

Tailwind CSS v4 は CSS ネスティングや `@supports` などのモダン CSS 機能に大きく依存しているが、Vitest のデフォルトテスト環境（jsdom）はこれらの CSS 構文を正しくパースできない。`css: true` を設定すると `"Could not parse CSS stylesheet"` エラーが発生する。これは Tailwind v4 のバグではなく、**jsdom の制限**である（Tailwind チームが確認済み）。

#### アプローチ 1: CSS インポートのモック（推奨・最もシンプル）

ほとんどのユニットテストでは CSS の実際の処理は不要。CSS インポートをモックして無視する。

```typescript title="vitest.config.ts"
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    css: false, // CSS処理を無効化（デフォルト）
  },
});
```

この設定ではスタイルの適用は検証できないが、クラス名の存在チェックやスナップショットテストは可能。

#### アプローチ 2: クラス名のアサーション

Tailwind のクラスが正しく適用されているかは、DOM 要素のクラス属性を検証する形でテストする。

```typescript title="Button.test.tsx"
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Button } from './Button';

test('プライマリボタンに正しいクラスが適用される', () => {
  render(<Button variant="primary">Click</Button>);
  const button = screen.getByRole('button');

  // 特定のTailwindクラスの存在を検証
  expect(button.className).toContain('bg-blue-500');
  expect(button.className).toContain('text-white');

  // toHaveClass（@testing-library/jest-dom）を使う方法
  expect(button).toHaveClass('bg-blue-500', 'text-white', 'rounded-lg');
});
```

#### アプローチ 3: スナップショットテスト

コンポーネントの出力全体をスナップショットとして保存し、意図しない変更を検出する。

```typescript title="Button.test.tsx"
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Button } from './Button';

test('ボタンのスナップショット', () => {
  const { container } = render(<Button variant="primary">Click</Button>);
  expect(container.firstChild).toMatchSnapshot();
});
```

スナップショットにはクラス名が文字列として含まれるため、クラスの変更を検出できる。ただし、実際のスタイル（背景色が青かどうか等）は検証できない。

#### アプローチ 4: Vitest Browser Mode（視覚的テスト）

実際のブラウザ環境でテストを実行し、CSS の適用結果を含めて検証する場合は Vitest Browser Mode を使う。

```typescript title="vitest.config.ts"
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
    },
  },
});
```

Browser Mode では jsdom の制限を回避でき、`getComputedStyle` による実際のスタイル値の検証も可能になる。

### 4. @tailwindcss/vite プラグインの役割と設定

#### 概要

`@tailwindcss/vite` は Vite プロジェクト専用のファーストパーティプラグイン。PostCSS を介さず Vite のビルドパイプラインに直接統合されるため、PostCSS プラグインよりも高いパフォーマンスを発揮する。

#### インストールと設定

```bash
npm install tailwindcss @tailwindcss/vite
```

```typescript title="vite.config.ts"
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
});
```

```css title="src/style.css"
@import "tailwindcss";
```

`postcss.config.mjs` は不要。Vite プラグインが CSS の処理を直接行う。

#### パフォーマンス

PostCSS プラグインと比較して以下の優位性がある。

| 指標 | PostCSS | Vite プラグイン |
|------|---------|----------------|
| フルビルド | 100ms | さらに高速 |
| インクリメンタルリビルド（新規CSS） | 5ms | さらに高速 |
| インクリメンタルリビルド（CSS変更なし） | 192us | さらに高速 |

Vite のモジュールグラフに直接統合されるため、HMR（ホットモジュールリプレースメント）の速度も向上する。

#### 注意: Vitest との相互作用

`@tailwindcss/vite` プラグインを Vite 設定に追加した状態で Vitest を実行すると、jsdom 環境では CSS パースエラーが発生することがある（前述の jsdom の制限による）。テスト用の設定では `css: false` にするか、Vitest Browser Mode を使用する。

### 5. Tailwind v4 と併用可能な主要ライブラリ

#### clsx

条件付きでクラス名を結合する軽量ユーティリティ。Tailwind v4 との互換性に問題はない（CSS クラス名の文字列操作のみで Tailwind に依存しないため）。

```bash
npm install clsx
```

```tsx
import clsx from 'clsx';

function Button({ primary, disabled }: { primary: boolean; disabled: boolean }) {
  return (
    <button
      className={clsx(
        'rounded-lg px-4 py-2',
        primary && 'bg-blue-500 text-white',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      Click
    </button>
  );
}
```

#### tailwind-merge

Tailwind CSS のクラス競合を解決するライブラリ。**v3.x が Tailwind CSS v4 に対応**している（v2.x は Tailwind v3 向け）。

```bash
npm install tailwind-merge
```

```tsx
import { twMerge } from 'tailwind-merge';

// 後のクラスが優先される
twMerge('bg-red-500 bg-blue-500');
// => 'bg-blue-500'

twMerge('px-4 px-6');
// => 'px-6'
```

v3 での主な変更点:
- Tailwind CSS v4 のクラス体系に対応
- `isLength` バリデーターが `isNumber` と `isFraction` に分割
- Tailwind CSS v4 で削除されたクラスのサポートを終了

#### cn ユーティリティ関数（clsx + tailwind-merge の組み合わせ）

多くのプロジェクト（shadcn/ui 等）で採用されているパターン。

```typescript title="lib/utils.ts"
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```tsx
// 使用例: 条件付きクラス + 競合解決
<div className={cn(
  'bg-red-500 p-4',
  isActive && 'bg-blue-500', // bg-red-500 を上書き
)} />
```

#### cva (class-variance-authority)

コンポーネントのバリアント（サイズ、色、状態など）を型安全に定義するライブラリ。Tailwind に依存しないためv4でもそのまま使える。

```bash
npm install class-variance-authority
# または短縮名でインストール
npm install cva@npm:class-variance-authority
```

```tsx
import { cva, type VariantProps } from 'class-variance-authority';

const button = cva(
  // 基本クラス
  'rounded-lg font-semibold transition-colors',
  {
    variants: {
      intent: {
        primary: 'bg-blue-500 text-white hover:bg-blue-600',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
        danger: 'bg-red-500 text-white hover:bg-red-600',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
      },
    },
    defaultVariants: {
      intent: 'primary',
      size: 'md',
    },
  },
);

// TypeScript型が自動生成される
type ButtonProps = VariantProps<typeof button>;
```

VS Code の Tailwind CSS IntelliSense を cva 内で有効にするには以下の設定を追加する。

```json title=".vscode/settings.json"
{
  "tailwindCSS.classFunctions": ["cva", "cx"]
}
```

#### tailwind-variants

Stitches にインスピレーションを得たバリアント API ライブラリ。**v1.x が Tailwind CSS v4 に対応**（tailwind-merge v3.x が必要）。

```bash
npm install tailwind-variants
```

```tsx
import { tv } from 'tailwind-variants';

const button = tv({
  base: 'rounded-lg font-semibold transition-colors',
  variants: {
    color: {
      primary: 'bg-blue-500 text-white',
      secondary: 'bg-gray-200 text-gray-800',
    },
    size: {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    },
  },
  defaultVariants: {
    color: 'primary',
    size: 'md',
  },
});

// 使用
<button className={button({ color: 'primary', size: 'lg' })}>
  Click
</button>
```

cva との主な差異:
- tailwind-merge が内蔵されている（クラス競合を自動解決）
- **スロット機能**: 複合コンポーネント（カード、モーダルなど）の各パーツを個別にスタイル定義できる
- **`extend`**: 既存のバリアント定義を継承・拡張できる
- v4 対応に際して、`responsiveVariants` 機能は削除された（Tailwind v4 が `config.content.transform` を廃止したため）

#### 公式プラグイン（@tailwindcss/typography, @tailwindcss/forms）

v4 ではプラグインの読み込み方法が変更された。`tailwind.config.js` の `plugins` 配列ではなく、**CSS 内の `@plugin` ディレクティブ**を使用する。

```css title="app/globals.css"
@import "tailwindcss";

/* 公式プラグインの読み込み */
@plugin "@tailwindcss/typography";
@plugin "@tailwindcss/forms";
```

`@tailwindcss/forms` のオプション設定も CSS 内で行う。

```css title="app/globals.css"
@import "tailwindcss";

@plugin "@tailwindcss/typography";

/* クラスベースのフォームスタイルのみ生成（グローバルスタイルを汚染しない） */
@plugin "@tailwindcss/forms" {
  strategy: "class";
}
```

| プラグイン | v4 対応 | 用途 |
|-----------|---------|------|
| `@tailwindcss/typography` | 対応済み | `prose` クラスによる文章コンテンツのスタイリング |
| `@tailwindcss/forms` | 対応済み | フォーム要素のリセット・スタイリング |
| `@tailwindcss/container-queries` | **v4 に内蔵** | コンテナクエリ（プラグイン不要） |
| `@tailwindcss/aspect-ratio` | **v4 に内蔵** | アスペクト比（プラグイン不要） |

### 6. PostCSS プラグイン vs Vite プラグインの使い分け

#### 比較表

| 項目 | `@tailwindcss/postcss` | `@tailwindcss/vite` |
|------|----------------------|---------------------|
| 対象フレームワーク | Next.js, Nuxt, Angular, Webpack 等 | Vite ベースのプロジェクト |
| 設定ファイル | `postcss.config.mjs` が必要 | `vite.config.ts` のみ |
| パフォーマンス | 高速（v3 比 3.78x） | PostCSS よりさらに高速 |
| HMR | PostCSS 経由 | Vite のモジュールグラフに直接統合 |
| 依存パッケージ | `tailwindcss`, `@tailwindcss/postcss`, `postcss` | `tailwindcss`, `@tailwindcss/vite` |
| 他の PostCSS プラグインとの共存 | 可能 | 不要（Vite が直接処理） |

#### 選定基準

- **Next.js を使う場合** → `@tailwindcss/postcss`（Next.js は Webpack/Turbopack ベースのため）
- **Vite ベースのプロジェクト（React + Vite, SvelteKit, Astro 等）** → `@tailwindcss/vite`（公式推奨）
- **Webpack / その他のバンドラーを使う場合** → `@tailwindcss/postcss`
- **Vitest でテスト実行する場合** → `@tailwindcss/vite` を使っていても、テスト設定で `css: false` にするか Browser Mode を使う

## 検証結果

### セットアップの簡素化

v4 では設定ファイルが大幅に削減された。

| 項目 | v3 | v4 |
|------|----|----|
| `tailwind.config.js` | 必須 | 不要（CSS の `@theme` で代替） |
| `postcss.config.js` の内容 | `tailwindcss` + `autoprefixer` | `@tailwindcss/postcss` のみ |
| CSS エントリポイント | 3 行（`@tailwind base/components/utilities`） | 1 行（`@import "tailwindcss"`） |
| `content` 設定 | 必須（ファイルパスを明示） | 不要（自動検出） |

### エコシステムの v4 対応状況（2025 年時点）

| ライブラリ | v4 対応バージョン | 備考 |
|-----------|-----------------|------|
| tailwind-merge | v3.x | v2.x は Tailwind v3 専用 |
| tailwind-variants | v1.x | `responsiveVariants` は削除 |
| cva | 現行バージョン | Tailwind に非依存のため問題なし |
| clsx | 現行バージョン | Tailwind に非依存のため問題なし |
| @tailwindcss/typography | 対応済み | `@plugin` ディレクティブで読み込み |
| @tailwindcss/forms | 対応済み | `@plugin` ディレクティブで読み込み |
| shadcn/ui | 対応済み | Tailwind v4 + `cn` ユーティリティ |

## まとめ

- **Next.js (App Router) では `@tailwindcss/postcss`** を使用する。`postcss.config.mjs` に `@tailwindcss/postcss` を指定し、CSS に `@import "tailwindcss"` を書くだけで動作する。Server Components とも完全に互換性がある。
- **Vitest でのテストは、CSS の処理を無効化してクラス名ベースでアサーションする**のが現実的。jsdom が Tailwind v4 の出力する CSS ネスティングをパースできないため、`css: true` の利用は困難。視覚的なテストが必要な場合は Vitest Browser Mode を検討する。
- **Vite プロジェクトでは `@tailwindcss/vite` が推奨**。PostCSS よりも高速で設定も簡潔。ただし Next.js では使えない。
- **エコシステムの v4 対応は概ね完了**しており、tailwind-merge v3 / tailwind-variants v1 / cva / clsx はいずれも v4 で問題なく利用可能。公式プラグインは `@plugin` ディレクティブに移行した。
- **CSS Modules との併用**は `@reference "tailwindcss"` を使えば可能だが、直接 `className` にユーティリティクラスを記述するアプローチが推奨される。

## 参考リンク

- [Tailwind CSS v4.0 リリースブログ](https://tailwindcss.com/blog/tailwindcss-v4)
- [Tailwind CSS - PostCSS でのインストール](https://tailwindcss.com/docs/installation/using-postcss)
- [Tailwind CSS - Next.js ガイド](https://tailwindcss.com/docs/guides/nextjs)
- [Tailwind CSS - Vite でのインストール](https://tailwindcss.com/docs)
- [Tailwind CSS v4 アップグレードガイド](https://tailwindcss.com/docs/upgrade-guide)
- [@tailwindcss/vite - npm](https://www.npmjs.com/package/@tailwindcss/vite)
- [tailwind-merge GitHub](https://github.com/dcastil/tailwind-merge)
- [tailwind-merge v3 の Tailwind v4 対応](https://github.com/dcastil/tailwind-merge/discussions/468)
- [tailwind-variants 公式ドキュメント](https://www.tailwind-variants.org/docs/introduction)
- [cva 公式ドキュメント](https://cva.style/docs)
- [@tailwindcss/vite と Vitest の互換性問題 (GitHub Issue #18952)](https://github.com/tailwindlabs/tailwindcss/issues/18952)
- [Tailwind v4 と Next.js CSS Modules の議論](https://github.com/tailwindlabs/tailwindcss/discussions/17342)
- [Tailwind CSS forms プラグイン v4 ガイド](https://benjamincrozat.com/tailwind-css-forms-plugin)
- [Vitest で Tailwind + PostCSS エラーを解決する方法](https://iifx.dev/en/articles/457740147/solving-the-invalid-postcss-plugin-error-in-vitest-with-tailwind-css-and-next-js)
- [Next.js CSS ドキュメント](https://nextjs.org/docs/app/getting-started/css)

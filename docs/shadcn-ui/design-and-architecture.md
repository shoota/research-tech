---
id: shadcn-ui-design-and-architecture
title: "shadcn/ui の設計思想とアーキテクチャ"
sidebar_position: 1
last_update:
  date: 2026-03-06
---

## 概要

shadcn/ui の設計思想（「ライブラリではなくコンポーネント集」というアプローチ）、Radix UI / Base UI の2系統アーキテクチャ、および CSS 変数ベースのテーマシステムについて調査した。

## 背景・動機

React のコンポーネントライブラリは数多く存在するが、shadcn/ui は従来のライブラリとは根本的に異なるアプローチを取り、急速に普及している。特に 2025年12月の `npx shadcn create` リリースで Base UI 対応と5つのビジュアルスタイルが追加され、アーキテクチャの選択肢が大きく広がった。プロジェクトへの導入判断のため、設計思想・アーキテクチャ・テーマシステムを体系的に整理する。

## 調査内容

### 1. デザインコンセプト

#### 「ライブラリではなくコンポーネント集」というアプローチ

shadcn/ui の公式サイトには次のように明記されている。

> "This is not a component library. It is how you build your component library."

従来のコンポーネントライブラリ（MUI, Ant Design 等）は npm パッケージとしてインストールし、提供された API の範囲内でカスタマイズする。一方、shadcn/ui は CLI を通じてコンポーネントのソースコードをプロジェクトに直接コピーする。`package.json` に依存関係として追加されるのは Radix UI や Tailwind CSS などの基盤ライブラリのみで、shadcn/ui 自体はランタイム依存に含まれない。

#### コードオーナーシップの思想

shadcn/ui の5つの設計原則は以下の通り。

1. **Open Code** -- コンポーネントコードの最上位レイヤーは開発者が自由に変更できる
2. **Composition** -- すべてのコンポーネントが共通のコンポーザブルなインターフェースを持つ
3. **Distribution** -- フラットファイルスキーマと CLI によるコード配布システム
4. **Beautiful Defaults** -- 統一されたデザインシステムとして機能するデフォルトスタイル
5. **AI-Ready** -- LLM がコードを読み取り・理解・改善しやすいオープンコード構造

この設計により、ライブラリのアップデートに振り回されることなく、コンポーネントを完全にコントロールできる。

#### New York / Default の2プリセット（旧体系）

2025年12月のアップデート以前は、以下の2つのスタイルプリセットが存在した。

| 特性 | Default | New York |
|------|---------|----------|
| ボタンサイズ | 大きめ（h-10） | 小さめ（h-9） |
| ボーダー半径 | md | lg |
| 外観の印象 | シャープ | やや丸みがある |
| アイコンセット | lucide-react | Radix Icons |
| アニメーション | tailwindcss-animate | tailwindcss-animate |
| カードスタイル | フラット | シャドウ付き |

2025年12月以降、この2プリセットは5つの新しいビジュアルスタイル（後述）に置き換えられている。

### 2. Radix UI ベースと Base UI ベースの2系統

#### 経緯

shadcn/ui は当初 Radix UI のみをヘッドレスコンポーネント基盤として採用していた。2025年12月、Base UI（MUI チームが開発するヘッドレス UI ライブラリ）が v1.0 安定版に到達したのを受け、shadcn/ui は `npx shadcn create` コマンドで Base UI を第2の選択肢として正式サポートした。2026年1月には Base UI 向けの完全なドキュメントが公開された。

#### Radix UI の特徴

- **プリミティブ分割アーキテクチャ**: コンポーネントを小さなプリミティブに分割し、ドット記法で合成する（例: `Dialog.Root`, `Dialog.Trigger`, `Dialog.Content`）
- **`asChild` パターン**: 子要素にプリミティブの振る舞いを委譲する独自の合成パターン
- **パッケージ構成**: 2025年以降は統合 `radix-ui` パッケージに移行（以前は `@radix-ui/react-*` 個別パッケージ）
- **成熟したエコシステム**: 大規模な採用実績とコミュニティ

```tsx title="RadixUIのDialog例"
import * as Dialog from "radix-ui/dialog";

// Radix UI はドット記法でプリミティブを組み合わせる
function MyDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>開く</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Dialog.Title>タイトル</Dialog.Title>
          <Dialog.Description>説明文</Dialog.Description>
          <Dialog.Close>閉じる</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

#### Base UI の特徴

- **統合パッケージ**: `@base-ui/react` 単一パッケージですべてのコンポーネントを提供（ツリーシェイキング対応）
- **`render` プロップパターン**: Radix の `asChild` に対応する合成手法として `render` プロップを採用
- **追加コンポーネント**: マルチセレクト、コンボボックス、オートコンプリート、ナンバーフィールド、メーターなど、Radix にないコンポーネントを提供
- **MUI チームの知見**: Material-UI で培われたアクセシビリティとコンポーネント設計の経験

```tsx title="BaseUIのDialog例"
import { Dialog } from "@base-ui/react/dialog";

// Base UI はよりシンプルな API 構造
function MyDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>開く</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Dialog.Title>タイトル</Dialog.Title>
          <Dialog.Description>説明文</Dialog.Description>
          <Dialog.Close>閉じる</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

#### 5つのビジュアルスタイル（2025年12月〜）

`npx shadcn create` で選択できるビジュアルスタイルは以下の5つ。Radix UI / Base UI いずれの基盤でも利用可能。

| スタイル | 特徴 | 適したユースケース |
|----------|------|-------------------|
| **Vega** | クラシックな shadcn/ui の外観。中程度のボーダー半径とバランスの取れたスペーシング。旧 New York スタイルに相当 | 汎用的な Web アプリケーション |
| **Nova** | パディングとマージンを縮小したコンパクトレイアウト | ダッシュボード、管理画面 |
| **Maia** | 大きなボーダー半径（完全な丸みを含む）と広いスペーシング。柔らかく親しみやすい印象 | コンシューマー向けプロダクト、LP |
| **Lyra** | ボーダー半径ゼロ。ボックス型でシャープな外観。モノスペースフォントと相性が良い | 開発者ツール、技術系インターフェース |
| **Mira** | 最もコンパクトなスタイル。密度の高いインターフェース向け | データテーブル、スプレッドシート風 UI |

#### プロジェクトでの選択基準

**Radix UI を選ぶべきケース:**
- Tailwind CSS + shadcn/ui の既存エコシステムを最大限活用したい
- 実績のある安定した基盤を求める
- コミュニティの情報量を重視する

**Base UI を選ぶべきケース:**
- MUI からの移行や MUI との親和性を求める
- マルチセレクト、コンボボックス等の追加コンポーネントが必要
- 新規プロジェクトでモダンな API 設計を優先する

#### 混在利用について

shadcn/ui は「同じ抽象化、異なるプリミティブ（Same Abstraction, Different Primitives）」を掲げており、CLI がプロジェクト設定に基づいて正しいバリアントを自動選択する。公式には Radix と Base UI は別々の基盤として機能する設計であり、1つのプロジェクト内での混在は推奨されない。プロジェクト初期化時にどちらか一方を選択する運用が想定されている。

### 3. テーマシステムの詳細

#### CSS 変数の命名規約

shadcn/ui のテーマは CSS カスタムプロパティ（CSS 変数）で構成される。命名は `background` / `foreground` ペア規約に従う。

**コア変数一覧:**

| 変数名 | 用途 |
|--------|------|
| `--background` / `--foreground` | ページ全体の背景色 / テキスト色 |
| `--card` / `--card-foreground` | カードの背景色 / テキスト色 |
| `--popover` / `--popover-foreground` | ポップオーバーの背景色 / テキスト色 |
| `--primary` / `--primary-foreground` | プライマリボタン等の背景色 / テキスト色 |
| `--secondary` / `--secondary-foreground` | セカンダリ要素の背景色 / テキスト色 |
| `--muted` / `--muted-foreground` | 控えめな要素の背景色 / テキスト色 |
| `--accent` / `--accent-foreground` | アクセント要素の背景色 / テキスト色 |
| `--destructive` / `--destructive-foreground` | 破壊的操作の背景色 / テキスト色 |
| `--border` | ボーダー色 |
| `--input` | フォーム入力のボーダー色 |
| `--ring` | フォーカスリング色 |
| `--radius` | ボーダー半径の基準値 |
| `--chart-1` 〜 `--chart-5` | チャート用カラー |
| `--sidebar-*` | サイドバー固有のカラー群 |

`background` サフィックスは、変数がコンポーネントの背景色として使われる場合に省略される。例えば `--primary` が背景色、`--primary-foreground` がその上のテキスト色となる。

#### OKLCH カラーシステム

shadcn/ui は OKLCH（Oklab Lightness Chroma Hue）カラースペースを採用している。OKLCH は知覚的に均一な色空間であり、以下の利点がある。

- 明度・彩度・色相が独立しているため、一貫性のあるカラースケールを作りやすい
- 現代のディスプレイでより鮮やかな色を表現できる
- ライトモード / ダークモード間で自然な色の遷移が可能

```css title="globals.css"
/* ライトモード用のカラー定義 */
:root {
  --background: oklch(1 0 0);           /* 白 */
  --foreground: oklch(0.205 0 0);       /* ほぼ黒 */
  --primary: oklch(0.205 0 0);          /* プライマリカラー */
  --primary-foreground: oklch(0.985 0 0); /* プライマリ上のテキスト */
  --muted: oklch(0.97 0 0);             /* 控えめな背景 */
  --muted-foreground: oklch(0.556 0 0); /* 控えめなテキスト */
  --border: oklch(0.922 0 0);           /* ボーダー */
  --ring: oklch(0.708 0 0);             /* フォーカスリング */
  --radius: 0.625rem;                   /* ボーダー半径 */
}

/* ダークモード用のカラー定義（.dark クラスで切り替え） */
.dark {
  --background: oklch(0.145 0 0);       /* ほぼ黒 */
  --foreground: oklch(0.985 0 0);       /* ほぼ白 */
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --border: oklch(0.269 0 0);
  --ring: oklch(0.556 0 0);
}
```

#### Tailwind v4 での @theme inline による統合

Tailwind v4 では `@theme inline` ディレクティブを使用して CSS 変数を Tailwind のユーティリティクラスとして公開する。

```css title="globals.css"
/* CSS 変数を Tailwind のカラーユーティリティとして登録 */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius: var(--radius);
}
```

これにより `bg-primary`, `text-muted-foreground` のようなユーティリティクラスが自動的に使用可能になる。Tailwind v3 では `hsl(var(--primary))` のようなラッパーが必要だったが、v4 では変数に直接 OKLCH 値を含めるため不要になった。

#### ダークモード対応の仕組み

ダークモードは `.dark` クラスベースの戦略で実装される。

1. `<html>` 要素に `.dark` クラスを付与/除去してテーマを切り替える
2. CSS 変数の値が `:root`（ライト）と `.dark`（ダーク）で切り替わる
3. コンポーネント側のコード変更は不要

テーマの永続化は `localStorage` で管理され、3つの状態をサポートする。

- `'light'` -- 明示的なライトモード
- `'dark'` -- 明示的なダークモード
- `'system'` -- OS のプリファレンスに追従（`prefers-color-scheme` メディアクエリ）

Next.js では `next-themes` ライブラリとの組み合わせが推奨されている。

```tsx title="app/layout.tsx"
import { ThemeProvider } from "next-themes";

// next-themes によるダークモード対応
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        {/* attribute="class" で .dark クラスベースの切り替えを有効化 */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

#### テーマプリセット（ベースカラー）

5つのニュートラルカラープリセットが用意されている。いずれもグレースケールのバリエーションで、UI 全体のトーンを決定する。

| プリセット | 特徴 |
|-----------|------|
| **Neutral** | 純粋なグレースケール。色味なし |
| **Stone** | 暖かみのあるグレー（わずかにベージュ寄り） |
| **Zinc** | クールなグレー（わずかにブルー寄り） |
| **Gray** | バランスの取れたブルーグレー |
| **Slate** | 深みのあるブルーグレー |

これらのプリセットは `npx shadcn create` の初期化時に選択でき、ライト・ダーク両モードの完全な変数定義が生成される。プライマリカラーやアクセントカラーは別途カスタマイズ可能。

#### テーマカスタマイズの方法

カスタマイズは CSS 変数の値を変更するだけで実現できる。

```css title="globals.css"
:root {
  /* カラー変更: プライマリカラーをブルーに */
  --primary: oklch(0.623 0.214 259.815);
  --primary-foreground: oklch(0.985 0 0);

  /* ボーダー半径の変更 */
  --radius: 0.75rem;
}

/* 独自のセマンティックカラーを追加する場合 */
:root {
  --warning: oklch(0.82 0.189 84.429);
  --warning-foreground: oklch(0.316 0.077 70.08);
}

.dark {
  --warning: oklch(0.555 0.163 58.958);
  --warning-foreground: oklch(0.982 0.042 87.562);
}

/* @theme inline で Tailwind ユーティリティとして公開 */
@theme inline {
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

## 検証結果

### CLI によるプロジェクト初期化の流れ

`npx shadcn create` を実行すると、対話的に以下の選択を行う。

1. **フレームワーク**: Next.js / Vite / TanStack Start
2. **コンポーネント基盤**: Radix UI / Base UI
3. **ビジュアルスタイル**: Vega / Nova / Maia / Lyra / Mira
4. **ベースカラー**: Neutral / Stone / Zinc / Gray / Slate
5. **アイコンセット・フォント**

選択結果に基づいてコンポーネントコードが生成される。単なるテーマ変数の切り替えではなく、コンポーネントのソースコード自体が選択に応じて書き換えられる点が特徴的。

### Tailwind v4 でのテーマ構成

Tailwind v4 環境では以下の構成になる。

```css title="globals.css"
@import "tailwindcss";

/* 1. CSS変数の定義（ライトモード） */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.205 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  /* ...他の変数 */
}

/* 2. ダークモードのオーバーライド */
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  /* ...他の変数 */
}

/* 3. Tailwind ユーティリティへのマッピング */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ...他のマッピング */
  --radius: var(--radius);
}
```

Tailwind v3 からの移行時は `@tailwindcss/upgrade@next` コードモッドにより、`hsl(var(--primary))` 形式から `var(--primary)` 形式への変換が自動的に行われる。

## まとめ

### 設計思想の評価

shadcn/ui の「コードをコピーして所有する」アプローチは、ライブラリのバージョンアップに伴う破壊的変更の影響を受けないという大きなメリットがある。一方で、上流の修正やセキュリティパッチを自動的に受け取れないため、メンテナンスコストとのトレードオフが存在する。

### Radix UI vs Base UI の選択

2026年3月時点では、Radix UI の方がエコシステムの成熟度とコミュニティの情報量で優位にある。Base UI は v1.0 安定版として提供されており、マルチセレクトやコンボボックスなどの追加コンポーネントが魅力的。新規プロジェクトで MUI との親和性を求める場合は Base UI、既存の shadcn/ui エコシステムの知見を活用したい場合は Radix UI が適している。

### テーマシステムの実用性

CSS 変数 + OKLCH + Tailwind v4 の `@theme inline` による構成は、シンプルかつ強力なカスタマイズ手段を提供する。変数の値を変更するだけでライト/ダーク両モードに反映され、独自のセマンティックカラーの追加も容易。プロジェクト固有のデザインシステム構築の基盤として十分に実用的である。

### プロジェクトへの適用

- **小〜中規模プロジェクト**: shadcn/ui のデフォルト構成で十分。Vega スタイル + Radix UI が安定した選択
- **大規模デザインシステム**: テーマ変数のカスタマイズと独自コンポーネントの追加で拡張可能
- **データ密度の高い管理画面**: Nova または Mira スタイルが適している
- **コンシューマー向けプロダクト**: Maia スタイルの柔らかい外観が有効

## 参考リンク

- [shadcn/ui 公式サイト](https://ui.shadcn.com/)
- [shadcn/ui Introduction](https://ui.shadcn.com/docs)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui Dark Mode](https://ui.shadcn.com/docs/dark-mode)
- [shadcn/ui Changelog](https://ui.shadcn.com/docs/changelog)
- [December 2025 - npx shadcn create](https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create)
- [January 2026 - Base UI Documentation](https://ui.shadcn.com/docs/changelog/2026-01-base-ui)
- [Why shadcn/ui is Different | Vercel Academy](https://vercel.com/academy/shadcn-ui/why-shadcn-ui-is-different)
- [Base UI vs Radix UI Features | Shadcn Studio](https://shadcnstudio.com/blog/base-ui-vs-radix-ui)
- [shadcn/ui Component Styles: Vega, Nova, Maia, Lyra, and Mira | Shadcnblocks](https://www.shadcnblocks.com/blog/shadcn-component-styles-vega-nova-maia-lyra-mira)
- [Radix UI vs Base UI | Preblocks](https://preblocks.com/blog/radix-ui-vs-base-ui)

---
id: tailwind-design-tokens-concept
title: デザイントークンの概念とTailwind CSSの設計変遷
sidebar_position: 2
---

# デザイントークンの概念的理解と、Tailwind CSS のデザイントークン設計の変遷

## 概要

デザイントークンの概念的な定義・階層構造を整理し、Tailwind CSS が v1 から v4 にかけてデザイントークン管理をどのように進化させてきたかを調査した。あわせて、Salesforce Lightning Design System や Material Design 3 といった既存のデザイントークン理論との関係性、および CSS Custom Properties をデザイントークンとして運用するアプローチの利点と課題を分析した。

## 背景・動機

デザインシステムの構築においてデザイントークンは中核的な概念であるが、W3C 仕様の安定版リリース（2025年10月）や Tailwind CSS v4 の CSS ファーストアプローチへの刷新により、デザイントークンの実装パターンが大きく変化している。これらの変化を体系的に理解し、プロダクトのデザインシステム設計に活かすことを目的とする。

## 調査内容

### 1. デザイントークンとは何か

#### W3C Design Tokens Community Group の定義

デザイントークンは、W3C Design Tokens Community Group（DTCG）によって標準化が進められている概念である。DTCG の仕様では、デザイントークンを以下のように定義している。

> **(Design) Token** とは、人間が読める名前に関連づけられた情報であり、最低限「名前と値のペア」で構成される。

例: `color-text-primary: #000000;`、`font-size-heading-level-1: 44px;`

デザイントークンは、色、スペーシング、タイポグラフィスケールなど、デザインシステムにおける分割不可能な（indivisible）最小単位のデザイン判断を表現する。

#### 仕様の安定版リリース（2025.10）

2025年10月28日、DTCG は Design Tokens Format Module の最初の安定版（2025.10）を公開した。数年にわたる共同開発を経て、ツール間・プラットフォーム間でデザイン判断を共有するための、プロダクション対応かつベンダー中立なフォーマットが確立された。

#### JSON フォーマットの構造

仕様では JSON を交換フォーマットとして採用し、以下のプロパティ構造を定義している。すべての仕様定義プロパティにはドル記号（`$`）がプレフィックスとして付く。

- **`$value`**（必須）: トークンの実際の値
- **`$type`**（任意）: トークンの型。`color`, `dimension`, `fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `number` などのプリミティブ型と、`border`, `shadow`, `gradient`, `typography` などの複合型がある
- **`$description`**（任意）: トークンの説明
- **`$deprecated`**（任意）: 非推奨フラグ
- **`$extensions`**（任意）: ベンダー固有の拡張

```json title="トークンファイルの例（.tokens.json）"
{
  "color": {
    "$type": "color",
    "primary": {
      "$value": "#0066cc",
      "$description": "ブランドのプライマリカラー"
    },
    "secondary": {
      "$value": "#ff00ff"
    }
  },
  "spacing": {
    "small": {
      "$type": "dimension",
      "$value": { "value": 8, "unit": "px" }
    }
  }
}
```

トークン間の参照（エイリアシング）は波括弧構文 `"{group.token}"` で表現される。推奨ファイル拡張子は `.tokens` または `.tokens.json`、MIME タイプは `application/design-tokens+json` である。

### 2. デザイントークンの階層構造（Global / Alias / Component）

デザイントークンは一般的に3層の階層構造で管理される。この階層化により、デザインシステム内での分離と制御が実現される。

#### Global トークン（Primitive トークン）

トークン階層のルートレベルに位置する原始的な値。コンテキストに依存しない名前を持ち、デザインシステムの基盤となる。

- 色のヘックスコード、フォントサイズ、スペーシング値などの静的な値
- コンテキスト非依存であり、明示的な意味や意図を持たない
- 例: `blue-500: #3B82F6`、`space-4: 16px`、`font-size-16: 1rem`

#### Alias トークン（Semantic トークン）

Global トークンに対して、用途に基づく意味のある名前を付けたもの。Global トークンとコンテキストの間に関係性を構築する。

- Global トークンを参照することで一貫性を確保
- デザインの見た目・感覚についての「意見」を形成する
- 参照先のトークンが変更されると、エイリアス側も自動的に更新される
- 例: `color-action-primary → blue-500`、`color-background → gray-50`、`color-error → red-600`

#### Component トークン

特定のコンポーネントに紐づくトークン。Alias トークンを参照し、コンポーネント単位でスタイルの微調整を可能にする。

- 特定の UI 要素（ボタン、カードなど）に限定した値
- 例: `button-primary-background → color-action-primary`、`card-padding → space-4`
- コンポーネント単位で変更しても他への影響がない

#### 3層構造の利点

2層構造（Global + Alias）では、Alias トークンの変更が複数のコンポーネントに波及する。3層構造では、コンポーネントレベルでトークンが分離されているため、特定のコンポーネントのみへの変更が安全に行える。リファクタリング時の影響範囲を限定できる点が最大のメリットである。

### 3. Tailwind CSS v1〜v3 でのデザイントークン管理の変遷

#### Tailwind CSS v1（2019年5月リリース）

v1.0 で設定ファイル（`tailwind.config.js`）は完全にオプションとなり、追加する場合もカスタマイズ部分のみの記述で済むようになった。

- 新しい数値ベースのカラーパレット（各色9シェード、v0.x の7シェードから拡張）
- レスポンシブブレークポイントの更新（`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`）
- `tailwind.config.js` の `theme` セクションでカラーパレット、タイプスケール、フォントスタック、ブレークポイント、ボーダー半径などのデザイン値を定義

この段階では「デザイントークン」という概念を明示的に意識した設計ではなく、ユーティリティクラス生成のための設定値として位置づけられていた。

#### Tailwind CSS v2（2020年11月リリース）

- ダークモードサポートの追加
- 拡張カラーパレット（新色追加、各色に50〜900の10段階 + 950を一部追加）
- `theme.extend` による既存テーマの拡張パターンが確立
- プラグインシステムの強化

v2 では `tailwind.config.js` がデザイントークンの一元管理場所としての役割を本格的に担い始めた。ただし、これは JavaScript オブジェクトであり、ビルド時にのみ参照される静的な設定だった。

#### Tailwind CSS v3（2021年12月リリース）

- JIT（Just-In-Time）エンジンの標準化
- 任意値（arbitrary values）のサポート: `w-[137px]`, `bg-[#1da1f2]`
- すべてのカラーがデフォルトで有効化
- `tailwind.config.js` での `theme` / `theme.extend` によるトークン管理が成熟

v3 における `tailwind.config.js` のデザイントークン管理の特徴は以下の通り。

- **JavaScript オブジェクトによる定義**: 色、スペーシング、フォントなどを JS のオブジェクトとして記述
- **ビルド時のみ有効**: 設定値はビルドプロセスでのみ参照され、ランタイムではアクセス不可
- **CSS 変数との二重管理**: デザイントークンを CSS 変数としても公開したい場合、`tailwind.config.js` と CSS の両方に定義する必要があった
- **非 CSS 言語による設定**: デザインの値を CSS ではなく JavaScript で管理するという構造的なミスマッチがあった

### 4. Tailwind CSS v4 での設計刷新

#### CSS-First Configuration

Tailwind CSS v4（2025年1月リリース）は v3 からのフルリライトであり、最大の変更点は設定方式の根本的な刷新である。`tailwind.config.js` が不要になり、CSS ファイル内で直接すべてのカスタマイズを定義する。

```css title="v3 までの設定（JavaScript）"
/* tailwind.config.js */
module.exports = {
  theme: {
    extend: {
      colors: {
        avocado: {
          100: '#f5f8f3',
          200: '#ecf2e7',
          500: '#6d9b3a',
        }
      }
    }
  }
}
```

```css title="v4 の設定（CSS）"
/* app.css */
@import "tailwindcss";

@theme {
  --color-avocado-100: oklch(0.99 0 0);
  --color-avocado-200: oklch(0.98 0.04 113.22);
  --color-avocado-500: oklch(0.84 0.18 117.33);
}
```

#### @theme ディレクティブ

`@theme` は CSS ブロックとしてデザイントークンを宣言する専用ディレクティブである。ここで定義した CSS カスタムプロパティは以下の2つの役割を同時に果たす。

1. **ユーティリティクラスの生成元**: `--color-avocado-500` → `bg-avocado-500`, `text-avocado-500` 等
2. **ランタイム CSS 変数**: `:root` に出力され、`var(--color-avocado-500)` として任意の場所から参照可能

`@theme` と `:root` の違いは明確で、`@theme` に定義した変数のみがユーティリティクラスを生成する。通常の `:root` 変数はクラス生成の対象にならない。

#### 主な技術的改善

- **自動コンテンツ検出**: `content` 配列の設定が不要。`.gitignore` やファイル種別のヒューリスティクスで自動判別
- **高速ビルド**: Rust ベースの新エンジン（Oxide）により、フルビルド 3.78x、インクリメンタルビルド最大 182x 高速化
- **OKLCH カラー**: 知覚的に均等なステップを持つカラースペースをデフォルト採用
- **@import のビルトインサポート**: PostCSS プラグイン不要
- **カスケードレイヤー**: `@layer` による CSS の優先順位制御

### 5. Tailwind v4 と従来のデザイントークン理論との関係

#### Salesforce Lightning Design System（SLDS）

Salesforce は「デザイントークン」という用語を最初に広めた先駆者である。SLDS では、デザインの本質的な値（色、スペーシング、フォント、ボーダー）を名前付きトークンとして抽出し、Lightning コンポーネントの CSS リソース全体で再利用する。

SLDS 2（Spring '25）では、従来のデザイントークンを CSS Custom Properties ベースの「グローバルスタイリングフック」に進化させた。この方向性は Tailwind v4 の `@theme` アプローチと軌を一にしており、どちらもネイティブな CSS カスタムプロパティをデザイントークンの実装手段として採用している。

#### Material Design 3（M3）

Google の Material Design 3 では、デザイントークンを3層構造で管理する。

- **Reference トークン**: パレットから生成される原始的な値（例: `--md-ref-palette-primary-40`）
- **System トークン**: 意味的な名前を持つトークン。Reference トークンを参照する（例: `--md-sys-color-primary`）
- **Component トークン**: コンポーネント固有のトークン。System トークンを参照する（例: `--md-comp-filled-button-container-color`）

Web 実装では CSS カスタムプロパティを使用し、CSS セレクタでスコープを制御する。

#### Tailwind v4 との対応関係

Tailwind v4 の3層トークンアーキテクチャは、これらの理論と本質的に同じ構造を持つ。

| 層 | デザイントークン理論 | Material Design 3 | SLDS | Tailwind v4 |
|---|---|---|---|---|
| 第1層 | Global / Primitive | Reference トークン | 標準デザイントークン | `@theme` の基本値（カラースケール、スペーシング単位） |
| 第2層 | Alias / Semantic | System トークン | グローバルスタイリングフック | `:root` や `@theme inline` でのセマンティック変数 |
| 第3層 | Component | Component トークン | コンポーネントスタイリングフック | コンポーネント CSS 内の変数参照 |

ただし、重要な違いがある。Salesforce や Material Design がデザインシステムとして3層を明確に規定するのに対し、Tailwind v4 はユーティリティフレームワークとして第1層（`@theme`）を強力にサポートし、第2層・第3層の構築は利用者に委ねている。Tailwind v4 は「デザイントークンのインフラ」を提供するが、「デザイントークンの体系」そのものは規定しない。

### 6. CSS Custom Properties をデザイントークンとして使うアプローチの利点と課題

#### 利点

**動的な反応性**: プリプロセッサ変数（Sass の `$variable` 等）がビルド時にコンパイルされて消えるのに対し、CSS カスタムプロパティはブラウザ内で動的に変更可能。ページリロードなしでリアルタイムにテーマ切替やレスポンシブ調整が行える。

**カスケードとスコーピング**: CSS のカスケード規則に従うため、`:root` でのグローバル適用とコンポーネントレベルでのオーバーライドを自然に両立できる。Shadow DOM との親和性も高い（SLDS 2 がこの点を重視した理由でもある）。

**ライブ計算**: `calc()` 関数と組み合わせることで、ビューポート変化に自動適応するレスポンシブなデザイン値を実現できる。

**単一の情報源**: Tailwind v4 のように `@theme` で定義すれば、設定ファイルと CSS の二重管理が不要になる。定義した値がそのままユーティリティクラスの生成元かつランタイム変数となる。

**クロスツール互換性**: フレームワークやライブラリに依存しない標準技術であるため、React、Vue、Web Components など異なる技術スタック間で共有可能。

#### 課題

**実装の複雑性**: 手動でのセットアップはデザインシステムの規模拡大とともに煩雑になる。Style Dictionary などのビルドツールによる自動変換が実質的に必要になる。

**命名規律の要求**: 一貫した階層的命名規則がなければ、名前空間の汚染や意味の曖昧さが生じる。チーム全体での規約策定と遵守が不可欠。

**スコープ管理の難しさ**: グローバル変数とコンポーネント固有トークンのバランスを誤ると、意図しないカスケード効果が発生する。

**新規参入者の学習コスト**: CSS カスタムプロパティによるトークンシステムは、構築者にとっては合理的だが、新たにプロジェクトに参加するメンバーにとっては「CSS の上に構築された独自の抽象層」となり、理解に時間がかかる。

**クロスプラットフォームの限界**: CSS カスタムプロパティは Web 固有の技術であり、iOS/Android ネイティブアプリなど他のプラットフォームでは直接利用できない。W3C DTCG の JSON フォーマットのようなプラットフォーム非依存の中間表現から、各プラットフォーム向けに変換する仕組み（Style Dictionary 等）が必要になる。

**レガシーブラウザ対応**: IE11 は CSS カスタムプロパティを一切サポートしないため、フォールバック戦略やポリフィルが必要になる（ただし2026年現在、IE11 対応が求められるケースは大幅に減少している）。

## まとめ

**デザイントークンの標準化が成熟段階に入った。** W3C DTCG の仕様安定版（2025.10）により、ツール間のトークン交換フォーマットが標準化された。`$value`, `$type` を軸とした JSON 構造と、Global / Alias / Component の3層階層が業界標準として確立しつつある。

**Tailwind CSS の変遷は「JS 設定から CSS ネイティブへ」の流れ。** v1〜v3 では `tailwind.config.js` という JavaScript オブジェクトでデザイン値を管理していたが、v4 では `@theme` ディレクティブにより CSS 内でトークンを直接定義する方式に刷新された。これにより設定とスタイルの言語が統一され、ランタイムでの変数参照も可能になった。

**業界のデザイントークン理論と Tailwind v4 は収斂している。** Salesforce SLDS 2 が CSS Custom Properties ベースのスタイリングフックに移行し、Material Design 3 も CSS カスタムプロパティで実装している。Tailwind v4 の `@theme` もこの潮流の中にあり、「CSS カスタムプロパティをデザイントークンの実装手段とする」というアプローチが Web 開発の共通解になりつつある。

**Tailwind v4 はトークンの「インフラ」を提供する。** SLDS や M3 がトークンの「体系」を規定するのに対し、Tailwind v4 は第1層（プリミティブ値）の定義と自動ユーティリティ生成を担い、セマンティック層やコンポーネント層の設計はプロジェクトの判断に委ねている。これは Tailwind の「ユーティリティファースト」哲学と一貫している。

**CSS Custom Properties によるトークン実装は利点が大きいが、設計規律が求められる。** 動的性・カスケード・ランタイム参照といった利点がある一方、命名規約の策定、スコープ管理、クロスプラットフォーム対応には追加の仕組みが必要になる。

## 参考リンク

- [Design Tokens Community Group（W3C）](https://www.w3.org/community/design-tokens/)
- [Design Tokens Format Module 2025.10（仕様書）](https://www.designtokens.org/tr/drafts/format/)
- [Design Tokens specification reaches first stable version](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)
- [Tailwind CSS v4.0 リリースブログ](https://tailwindcss.com/blog/tailwindcss-v4)
- [Theme variables - Tailwind CSS v4 ドキュメント](https://tailwindcss.com/docs/theme)
- [Theme Configuration - Tailwind CSS v1 ドキュメント](https://v1.tailwindcss.com/docs/theme)
- [Theme Configuration - Tailwind CSS v3 ドキュメント](https://v3.tailwindcss.com/docs/theme)
- [Design Tokens That Scale in 2026（Tailwind v4 + CSS Variables）](https://www.maviklabs.com/blog/design-tokens-tailwind-v4-2026)
- [Exploring Typesafe design tokens in Tailwind 4 - DEV Community](https://dev.to/wearethreebears/exploring-typesafe-design-tokens-in-tailwind-4-372d)
- [Tailwind CSS 4 @theme: The Future of Design Tokens](https://medium.com/@sureshdotariya/tailwind-css-4-theme-the-future-of-design-tokens-at-2025-guide-48305a26af06)
- [Design tokens - Material Design 3](https://m3.material.io/foundations/design-tokens/overview)
- [Styling with Design Tokens and Styling Hooks - Salesforce Lightning](https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/tokens_intro.htm)
- [Understanding Salesforce Lightning Design System 2](https://trailhead.salesforce.com/content/learn/modules/salesforce-lightning-design-system-2-for-developers/explore-salesforce-lightning-design-system-2)
- [The developer's guide to design tokens and CSS variables - Penpot](https://penpot.app/blog/the-developers-guide-to-design-tokens-and-css-variables/)
- [Design Tokens: What are global, alias and component tokens](https://medium.com/@yamini1020.yanamala/design-system-what-are-global-alias-and-component-tokens-part-1-78420a5827a1)
- [What Are Design Tokens? - CSS-Tricks](https://css-tricks.com/what-are-design-tokens/)
- [Design Tokens Community Group | Style Dictionary](https://styledictionary.com/info/dtcg/)

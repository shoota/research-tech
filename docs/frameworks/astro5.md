---
id: astro5
title: Astro 5 - コンテンツファーストのWebフレームワーク
sidebar_position: 1
tags: [astro, framework, ssg, islands-architecture, content]
last_update:
  date: 2026-03-06
---

# Astro 5 - コンテンツファーストのWebフレームワーク

## 概要

Astro 5 は、コンテンツサイト構築に特化した Web フレームワーク Astro のメジャーバージョンである。Content Layer API、Server Islands、Vite 6 統合などの新機能を搭載し、コンテンツファーストのアーキテクチャをさらに強化している。

:::info 関連ドキュメント
- [Hono - Web Standards ベースの超軽量マルチランタイムWebフレームワーク](../frameworks/hono) - HonoX が同じ Islands Architecture を採用
:::

## 背景・動機

本プロジェクト（research-tech）は Docusaurus で構築されているが、コンテンツサイト向けフレームワークの選択肢として Astro の存在感が増している。Islands Architecture によるゼロ JS デフォルト、柔軟なコンテンツ管理、複数フレームワークの共存といった特徴は、コンテンツサイトの構築・運用において重要な検討材料となる。Astro 5 で導入された Content Layer や Server Islands の実用性を調査し、既存の SSG/フレームワークとの比較を行う。

## 調査内容

### Islands Architecture（アイランドアーキテクチャ）

Astro の中核をなす設計思想が Islands Architecture である。ページ全体を静的 HTML としてレンダリングし、インタラクティブ性が必要な箇所だけを JavaScript の「島（Island）」として独立させる[[1]](#参考リンク)。

従来の SPA フレームワークではページ全体を JavaScript でハイドレーションするのに対し、Astro では以下のように動作する:

1. ビルド時にすべてのコンポーネントを HTML に変換
2. `client:*` ディレクティブが指定されたコンポーネントのみ JavaScript を配信
3. 各 Island は独立してロード・ハイドレーションされる

この結果、コンテンツサイトでは JavaScript の送信量が大幅に削減され、Time-to-Interactive が改善される[[2]](#参考リンク)。

### Zero-JS デフォルトの仕組み

Astro はデフォルトですべてのクライアントサイド JavaScript を除去する。コンポーネントが `.astro`、React、Vue いずれで書かれていても、明示的に `client:*` ディレクティブを付与しない限り、サーバー側で HTML にレンダリングされ、JavaScript は一切配信されない[[3]](#参考リンク)。

インタラクティブ性が必要な場合は、以下のクライアントディレクティブで制御する:

| ディレクティブ | 動作 |
|---|---|
| `client:load` | ページ読み込み時に即座にハイドレーション |
| `client:idle` | ブラウザがアイドル状態になったらハイドレーション |
| `client:visible` | コンポーネントがビューポートに入ったらハイドレーション |
| `client:media` | 指定したメディアクエリに一致したらハイドレーション |
| `client:only` | サーバーレンダリングをスキップし、クライアントのみでレンダリング |

### Astro 5 の主要な新機能

#### Content Layer API

Astro 5 最大の新機能が Content Layer API である。従来の Content Collections はローカルの Markdown ファイルのみを扱えたが、Content Layer によりあらゆるデータソース（API、データベース、ヘッドレス CMS）からコンテンツを型安全に取得できるようになった[[4]](#参考リンク)。

主な改善点:

- **ビルトインローダー**: ローカルファイル（Markdown、MDX 等）用のローダー
- **カスタムローダー**: 任意の API やデータソースに対応するローダーを少ないコードで定義可能
- **コミュニティローダー**: Storyblok、Cloudinary、Hygraph 等のプラットフォーム向けローダー
- **パフォーマンス向上**: Markdown ビルドが最大 5 倍高速化、MDX が 2 倍高速化、メモリ使用量が 25-50% 削減[[4]](#参考リンク)

#### Server Islands

Server Islands は Islands Architecture をサーバーサイドに拡張した機能である。静的にプリレンダリングされたページ内に、サーバーサイドで動的に生成されるコンポーネントを配置できる[[5]](#参考リンク)。

ユースケースとしては、ユーザーアバター、ショッピングカート、パーソナライズされたコンテンツなど、ページの大部分が静的でありながら一部だけ動的な要素が必要なケースが想定される。

主な特徴:

- 各 Island は独立して読み込まれ、遅い Island が他をブロックしない
- Island ごとにキャッシュヘッダーを設定可能
- プロップスの自動暗号化によるプライバシー保護
- フォールバックコンテンツの表示が可能[[5]](#参考リンク)

#### astro:env モジュール

環境変数を型安全に管理するモジュールが追加された。クライアント/サーバーの分離、シークレット指定、必須/任意の区別、型定義（string, number, boolean, enum）をサポートする[[4]](#参考リンク)。

#### Vite 6 統合

Astro 5 は Vite 6 を同梱し、新しい Environment API により開発環境と本番環境の整合性が向上している[[4]](#参考リンク)。

#### プリレンダリングの簡素化

従来の `hybrid` と `static` の出力モードが統合され、デフォルトで静的出力となった。個別のルートをサーバーサイドレンダリングする場合はアダプターを追加するだけでよく、複雑な設定が不要になった[[4]](#参考リンク)。

### View Transitions 対応

Astro は `<ClientRouter />` コンポーネントを提供し、MPA（マルチページアプリケーション）でありながら SPA のようなスムーズなページ遷移を実現する[[6]](#参考リンク)。

主な機能:

- **ビルトインアニメーション**: fade（デフォルト）、slide、none
- **状態の永続化**: `transition:persist` ディレクティブにより、ページ遷移を跨いで要素の状態を維持
- **要素のマッチング**: `transition:name` で遷移前後の要素を明示的にペアリング
- **フォールバック制御**: View Transitions API 非対応ブラウザ向けの挙動設定
- **アクセシビリティ**: ページタイトル変更の自動アナウンス、`prefers-reduced-motion` への対応

### フレームワーク統合

Astro は複数の UI フレームワークを同一プロジェクト内で共存させることができる[[7]](#参考リンク)。公式にサポートされるフレームワーク:

- React (`@astrojs/react`)
- Vue (`@astrojs/vue`)
- Svelte (`@astrojs/svelte`)
- SolidJS (`@astrojs/solid-js`)
- Preact (`@astrojs/preact`)
- Alpine.js (`@astrojs/alpinejs`)

さらに SSR アダプター（Vercel、Netlify、Cloudflare、Node）やコンテンツツール（MDX、Markdoc）などの公式インテグレーションも提供されている。

### Docusaurus・Next.js との比較

コンテンツサイト構築の観点で 3 つのフレームワークを比較する[[8]](#参考リンク)[[9]](#参考リンク)。

| 観点 | Astro | Docusaurus | Next.js |
|---|---|---|---|
| **設計思想** | コンテンツファースト、Zero-JS デフォルト | ドキュメント特化 | フルスタック React |
| **JS 配信量** | 極小（必要な Island のみ） | 中程度（React ハイドレーション） | 大（RSC で改善傾向） |
| **コンテンツ管理** | Content Collections + Content Layer | Markdown + MDX（ビルトイン） | ファイルシステム or 任意 |
| **UI フレームワーク** | React/Vue/Svelte 等、複数共存可 | React のみ | React のみ |
| **SSR サポート** | Server Islands + アダプター | なし（静的のみ） | フル SSR |
| **ドキュメント機能** | プラグインで対応（Starlight） | ビルトイン（バージョニング、検索） | 自前実装が必要 |
| **ビルド速度** | 高速（Vite 6 ベース） | 中程度（Webpack → Rspack 移行中） | 中程度（Turbopack で改善中） |
| **学習コスト** | 中（独自テンプレート構文） | 低（React + 設定ファイル） | 高（フルスタック知識が必要） |

**コンテンツサイトにおける選択指針:**

- **Astro**: パフォーマンス最優先、複数フレームワークの利用、柔軟なコンテンツソースが必要な場合
- **Docusaurus**: 技術ドキュメントサイトを最小限の設定で構築したい場合。バージョニング、検索、ナビゲーションがビルトイン
- **Next.js**: コンテンツサイトに加えてアプリケーション機能（認証、API 等）が必要な場合

### パフォーマンス特性

Astro のパフォーマンス上の優位性は以下の点にある[[2]](#参考リンク)[[8]](#参考リンク):

- **JavaScript 配信量の削減**: コンテンツサイトでは Next.js 比で 90% 以上の JavaScript 削減が可能
- **高速な初期描画**: 静的 HTML がそのまま配信されるため、FCP（First Contentful Paint）が高速
- **Core Web Vitals の改善**: LCP、CLS、INP すべてにおいて良好なスコアを得やすい
- **ビルドパフォーマンス**: Content Layer により Markdown ビルドが最大 5 倍高速化

## 検証結果

### Content Collections の定義

```typescript title="src/content.config.ts"
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// ローカル Markdown ファイルからコレクションを定義
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/data/blog" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().default(false),
  }),
});

// 外部 API からコレクションを定義（Content Layer の新機能）
const products = defineCollection({
  loader: async () => {
    const response = await fetch("https://api.example.com/products");
    const data = await response.json();
    return data.map((product: any) => ({
      id: product.slug,
      ...product,
    }));
  },
  schema: z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    description: z.string(),
  }),
});

export const collections = { blog, products };
```

### Islands Architecture の実装例

```astro title="src/pages/index.astro"
---
// サーバーサイドで実行されるフロントマター
import Header from '../components/Header.astro';
import Hero from '../components/Hero.astro';
import SearchBar from '../components/SearchBar.tsx';  // React コンポーネント
import Newsletter from '../components/Newsletter.vue'; // Vue コンポーネント
import Footer from '../components/Footer.astro';
---

<html lang="ja">
  <body>
    <!-- 静的 HTML（JavaScript なし） -->
    <Header />
    <Hero />

    <!-- Island: ページ読み込み時にハイドレーション -->
    <SearchBar client:load />

    <!-- Island: ビューポートに入ったらハイドレーション -->
    <Newsletter client:visible />

    <!-- 静的 HTML（JavaScript なし） -->
    <Footer />
  </body>
</html>
```

### Server Islands の実装例

```astro title="src/pages/product.astro"
---
import ProductInfo from '../components/ProductInfo.astro';
import UserReviews from '../components/UserReviews.astro';
import RecommendedProducts from '../components/RecommendedProducts.astro';
import GenericPlaceholder from '../components/GenericPlaceholder.astro';
---

<html lang="ja">
  <body>
    <!-- 静的にプリレンダリングされる製品情報 -->
    <ProductInfo />

    <!-- Server Island: パーソナライズされたレビュー -->
    <UserReviews server:defer>
      <GenericPlaceholder slot="fallback" />
    </UserReviews>

    <!-- Server Island: ユーザーに基づくレコメンド -->
    <RecommendedProducts server:defer>
      <div slot="fallback">おすすめ商品を読み込み中...</div>
    </RecommendedProducts>
  </body>
</html>
```

### View Transitions の実装例

```astro title="src/layouts/BaseLayout.astro"
---
import { ClientRouter } from 'astro:transitions';

interface Props {
  title: string;
}

const { title } = Astro.props;
---

<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>{title}</title>
    <!-- View Transitions を有効化 -->
    <ClientRouter />
  </head>
  <body>
    <nav transition:persist>
      <!-- ナビゲーションはページ遷移を跨いで状態を維持 -->
      <a href="/">ホーム</a>
      <a href="/blog">ブログ</a>
    </nav>

    <main transition:animate="slide">
      <slot />
    </main>
  </body>
</html>
```

### 複数フレームワークの共存

```javascript title="astro.config.mjs"
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import svelte from '@astrojs/svelte';

export default defineConfig({
  integrations: [
    react(),   // React コンポーネントのサポート
    vue(),     // Vue コンポーネントのサポート
    svelte(),  // Svelte コンポーネントのサポート
  ],
});
```

### 環境変数の型安全な管理

```javascript title="astro.config.mjs"
import { defineConfig, envField } from 'astro/config';

export default defineConfig({
  env: {
    schema: {
      // サーバーサイドのみで利用可能なシークレット
      STRIPE_API_KEY: envField.string({
        context: 'server',
        access: 'secret',
      }),
      // クライアントからもアクセス可能な公開変数
      PUBLIC_SITE_URL: envField.string({
        context: 'client',
        access: 'public',
        default: 'http://localhost:4321',
      }),
    },
  },
});
```

## まとめ

### 所感

Astro 5 は、コンテンツサイト構築において非常に完成度の高いフレームワークに進化している。特に以下の点が印象的である:

1. **Content Layer API の柔軟性**: ローカルファイルから外部 API まで、統一的かつ型安全にコンテンツを扱える仕組みは、ヘッドレス CMS との連携が求められるプロジェクトにおいて大きな優位性がある
2. **Server Islands の実用性**: 「ほぼ静的だが一部だけ動的」というユースケースに対して、エレガントな解決策を提供している。従来は SSR 全体を導入するか、クライアントサイド JavaScript で対応するしかなかったパターンを簡潔に実装できる
3. **Zero-JS デフォルトの哲学**: コンテンツサイトにおいてはこの設計思想が正しいアプローチであり、パフォーマンスへの効果は明確である

### プロジェクトへの適用可否

本プロジェクト（research-tech）は現在 Docusaurus で構築されており、技術ドキュメントサイトとしての要件（Markdown/MDX、サイドバー自動生成、検索機能等）を十分に満たしている。直ちに Astro への移行が必要な状況ではないが、以下のケースでは Astro（特に Astro + Starlight）への移行を検討する価値がある:

- ドキュメント以外のコンテンツ（ブログ、ポートフォリオ、デモ等）を同一サイトに統合したい場合
- 外部 CMS からコンテンツを取得する要件が生じた場合
- パフォーマンスの最適化が重要課題となった場合
- React 以外のフレームワーク（Vue、Svelte 等）のコンポーネントを利用したい場合

## 参考リンク

1. [Astro Islands - Astro Docs](https://docs.astro.build/en/concepts/islands/)
2. [Astro Islands Architecture: A Deep Dive into High Performance and Zero JS by Default - Leapcell](https://leapcell.io/blog/astro-islands-architecture-a-deep-dive-into-high-performance-and-zero-js-by-default)
3. [Astro Islands Architecture Explained - Strapi](https://strapi.io/blog/astro-islands-architecture-explained-complete-guide)
4. [Astro 5.0 - Astro Blog](https://astro.build/blog/astro-5/)
5. [Server Islands - Astro Docs](https://docs.astro.build/en/guides/server-islands/)
6. [View Transitions - Astro Docs](https://docs.astro.build/en/guides/view-transitions/)
7. [Integrations Guide - Astro Docs](https://docs.astro.build/en/guides/integrations-guide/)
8. [Astro vs Next.js (2026): Real Benchmarks, SEO & Costs - Senorit](https://senorit.de/en/blog/astro-vs-nextjs-2025)
9. [Top 12 SSGs in 2026 - Hygraph](https://hygraph.com/blog/top-12-ssgs)

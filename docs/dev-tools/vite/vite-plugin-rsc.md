---
id: vite-plugin-rsc
title: Vite と React Server Components - @vitejs/plugin-rsc の仕組みと意義
sidebar_position: 2
tags: [vite, react, rsc, server-components, bundler, plugin]
last_update:
  date: 2026-03-10
---

# Vite と React Server Components - @vitejs/plugin-rsc の仕組みと意義

## 概要

`@vitejs/plugin-rsc` は、Vite の Environment API を基盤として React Server Components（RSC）のバンドラー統合を実現する公式プラグインである。本ドキュメントでは、RSC がなぜバンドラー統合を必要とするのかという根本原理から出発し、Vite の Environment API がどのようにマルチ環境ビルドを可能にするか、そしてこのプラグインが Waku・React Router・Cloudflare Workers などのエコシステムにどのような価値をもたらしているかを調査した。

:::info 関連ドキュメント
- [React Server Components / Server Actions 実践パターン](../../react/react-server-components)
- [Vite 8 + Rolldown - Rustベースの次世代ビルドツール](./vite8-rolldown)
:::

## 背景・動機

React Server Components は React 19 で安定版となったが、その実行には**バンドラーとの深い統合**が不可欠である。従来、RSC を利用できるフレームワークは事実上 Next.js（webpack ベース）に限られていた。Vite エコシステムで RSC を利用するには、Vite 自体がマルチ環境ビルドに対応し、`'use client'` / `'use server'` ディレクティブを理解するバンドラー統合層が必要だった。

`@vitejs/plugin-rsc` は、Vite 6 で導入された Environment API を活用することで、**フレームワーク非依存**の RSC バンドラー統合を実現し、Next.js 以外のフレームワーク（Waku、React Router、独自フレームワーク）でも RSC を利用可能にした。

## 調査内容

### 1. RSC の基礎: なぜバンドラー統合が必要なのか

#### RSC の動作原理

React Server Components は、サーバー上でのみ実行されるコンポーネントである。クライアントにコードが送信されず、レンダリング結果が **RSC Payload** というシリアライズ形式でクライアントに送られる[[1]](#参考リンク)。

```
[サーバー] Server Component 実行 → RSC Payload 生成
                                        ↓
[クライアント] RSC Payload を受信 → React ツリーに復元 → DOM に反映
```

Server Component はデータベースやファイルシステムに直接アクセスでき、重い依存ライブラリ（マークダウンパーサー等）をバンドルに含めずに利用できる[[1]](#参考リンク):

```tsx title="ServerComponent.tsx"
// Server Component: このコードはクライアントに送信されない
// marked や sanitize-html のバンドルサイズ（75KB+）が削減される
async function Page({ page }) {
  const content = await fs.readFile(`${page}.md`, 'utf-8');
  return <div>{sanitizeHtml(marked(content))}</div>;
}
```

インタラクティブな機能が必要な場合は、`"use client"` ディレクティブで Client Component を宣言し、Server Component と組み合わせる:

```tsx title="Expandable.tsx"
"use client"

import { useState } from 'react';

// Client Component: このコードはクライアントバンドルに含まれる
export default function Expandable({ children }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button onClick={() => setExpanded(!expanded)}>Toggle</button>
      {expanded && children}
    </div>
  );
}
```

#### バンドラーが果たす3つの役割

RSC はデータだけでなく**コード（モジュール参照）の送信**を行う。`<Counter />` のような Client Component をシリアライズする際、その JavaScript 実装をクライアントで読み込めるようにする必要がある。Dan Abramov は「RSC はデータだけでなくコードの送信も扱う」と説明している[[2]](#参考リンク)。

バンドラーは RSC において以下の 3 つの責務を担う[[2]](#参考リンク):

| フェーズ | バンドラーの責務 | 具体的な処理 |
|---|---|---|
| **ビルド時** | `'use client'` のあるファイルを検出し、クライアント用チャンクを生成 | Islands アーキテクチャと同様に、クライアントエントリポイントを自動抽出 |
| **サーバー実行時** | モジュール参照のシリアライズ方法を React に教える | ソースパス `/src/Counter.js` → バンドル参照 `chunk123.js#Counter` に変換 |
| **クライアント実行時** | モジュール参照からコンポーネントを復元する方法を React に教える | バンドラー固有の API でチャンクをロード |

ソースファイルパスを直接参照する方式では、クライアントが依存ツリーを事前に把握できず**ネットワークウォーターフォール**が発生する。バンドラーが最適化されたチャンクにまとめることで、この問題を解決している[[2]](#参考リンク)。

#### `'use client'` と `'use server'` ディレクティブ

これらのディレクティブは**モジュール境界**を宣言するものであり、コンポーネントの種別を定義するものではない[[1]](#参考リンク):

| ディレクティブ | 意味 | バンドラーの処理 |
|---|---|---|
| `'use client'` | このモジュールはクライアントバンドルに含める | クライアント用チャンクのエントリポイントとして登録 |
| `'use server'` | このモジュールの export を RPC で呼び出し可能にする | サーバーアクション用のエンドポイントとして登録 |
| （ディレクティブなし） | デフォルトで Server Component | サーバーでのみ実行、クライアントに送信しない |

**重要**: `'use server'` は Server Component を宣言するものではなく、**Server Functions（Server Actions）** を宣言するディレクティブである[[1]](#参考リンク)。Server Component にはディレクティブが不要で、デフォルトでサーバー実行となる。

### 2. Vite Environment API: マルチ環境ビルドの基盤

#### 従来の Vite の限界

Vite 5 以前は `ssr: boolean` フラグによって「クライアント」と「SSR」の 2 環境のみを区別していた。しかし RSC では以下の **3 つの環境**が必要になる:

1. **RSC 環境**: `react-server` condition でモジュールを解決し、Server Component を実行
2. **SSR 環境**: RSC Payload を受け取り、HTML にレンダリング
3. **クライアント環境**: ハイドレーションとインタラクティブ機能を担当

Vite 6 で導入された Environment API は、任意の数の環境を定義し、それぞれに独立したモジュールグラフ・プラグインパイプライン・resolve 条件を設定できる[[3]](#参考リンク)。

#### Environment API がもたらした変化

```
Vite 5 以前:  client / ssr（boolean フラグ）
                ↓
Vite 6 以降:  client / ssr / rsc / workers / ...（任意の環境）
```

Vite 6 では**すべての環境が単一プロセス内でビルド**される。これにより、環境間の通信にマニフェストファイルを介する必要がなくなり、プラグイン間の連携が容易になった[[3]](#参考リンク)。

### 3. @vitejs/plugin-rsc の仕組み

#### 3 環境アーキテクチャ

`@vitejs/plugin-rsc` は Vite の Environment API を使い、RSC に必要な 3 環境を構成する[[4]](#参考リンク):

```
┌──────────────────────────────────────────────────────┐
│                   Vite Dev Server                    │
│                                                      │
│  ┌─────────┐    RSC Payload    ┌─────────┐          │
│  │   RSC   │ ───────────────→  │   SSR   │ → HTML   │
│  │  環境   │                   │  環境   │          │
│  └─────────┘                   └─────────┘          │
│       │                                              │
│       │        RSC Payload     ┌─────────┐          │
│       └───────────────────→    │ Client  │ → DOM    │
│                                │  環境   │          │
│                                └─────────┘          │
└──────────────────────────────────────────────────────┘
```

| 環境 | モジュール条件 | 役割 |
|---|---|---|
| **rsc** | `react-server` | Server Component の実行、RSC Stream の生成 |
| **ssr** | （通常条件） | RSC Stream → HTML の変換（`renderToReadableStream`） |
| **client** | （通常条件） | ハイドレーション、RSC Stream の受信、Server Functions の呼び出し |

#### ビルドパイプライン

プロダクションビルドでは以下の順序で処理される[[5]](#参考リンク):

```
rsc (scan) → ssr (scan) → rsc (real build) → client → ssr (real build)
```

最初の scan フェーズで `'use client'` / `'use server'` ディレクティブのあるモジュールを検出し、各環境のエントリポイントを確定する。その後の real build フェーズでチャンク生成・最適化を行う。

#### 設定例

```typescript title="vite.config.ts"
import { defineConfig } from 'vite';
import { rsc } from '@vitejs/plugin-rsc';

export default defineConfig({
  plugins: [rsc()],
  environments: {
    rsc: {
      build: {
        rollupOptions: {
          input: { index: './src/entry.rsc.tsx' },
        },
      },
    },
    ssr: {
      build: {
        rollupOptions: {
          input: { index: './src/entry.ssr.tsx' },
        },
      },
    },
    client: {
      build: {
        rollupOptions: {
          input: { index: './src/entry.browser.tsx' },
        },
      },
    },
  },
});
```

#### 主要 API

プラグインは `import.meta.viteRsc` を通じて各環境固有の API を提供する[[4]](#参考リンク):

**RSC / SSR 共通:**

| API | 説明 |
|---|---|
| `import.meta.viteRsc.loadModule(env, entry?)` | 他の環境からモジュールをインポート |
| `import.meta.viteRsc.import(specifier, { environment })` | より簡潔なクロス環境インポート |

**RSC 環境専用:**

| API | 説明 |
|---|---|
| `import.meta.viteRsc.loadCss(moduleId?)` | サーバーモジュール経由の CSS を収集し、React ノードとして返す |

**SSR 環境専用:**

| API | 説明 |
|---|---|
| `import.meta.viteRsc.loadBootstrapScriptContent()` | ブラウザエントリの JavaScript をインラインスクリプトとして提供 |

**クライアント環境:**

| API | 説明 |
|---|---|
| `rsc:update` イベント | サーバーモジュールの変更時に発火し、RSC の再フェッチ・再レンダリングをトリガー |

#### HMR サポート

開発中は Client Component と Server Component の両方で HMR が動作する。Server Component の変更時には `rsc:update` イベントがクライアントに通知され、RSC Payload の再フェッチのみで UI が更新される。フルリロードを必要としないため、開発体験が維持される[[4]](#参考リンク)。

#### CSS ハンドリング

Server Component からインポートされた CSS も自動的にコード分割・注入される。`loadCss()` API により、サーバーサイドでレンダリングされるコンポーネントの CSS を収集して `<head>` に注入できる[[4]](#参考リンク)。

#### セキュリティ: Server Actions の暗号化

`enableActionEncryption` オプションにより、本番環境で Server Actions のペイロードを暗号化できる。これにより、サーバー関数の参照が露出するリスクを軽減する[[5]](#参考リンク)。

### 4. Vite で RSC を利用する意義

#### Next.js 一強からの脱却

RSC のバンドラー統合は複雑であり、長らく webpack ベースの Next.js だけが対応していた。`@vitejs/plugin-rsc` の登場により、**Vite エコシステム全体で RSC が利用可能**になった:

| フレームワーク | 統合方法 | 状況 |
|---|---|---|
| **Waku** | 内部実装から `@vitejs/plugin-rsc` に移行[[6]](#参考リンク) | 安定版で採用 |
| **React Router** | `@vitejs/plugin-rsc` を peer dependency として RSC Framework Mode を提供[[7]](#参考リンク) | v7.9.2 でプレビュー |
| **Cloudflare Workers** | Cloudflare Vite プラグインが `@vitejs/plugin-rsc` と統合[[8]](#参考リンク) | 利用可能 |
| **独自フレームワーク** | starter テンプレートから構築可能 | 実験的 |

#### フレームワーク非依存・ランタイム非依存

このプラグインは意図的に「低レベル API」として設計されている。フレームワーク固有のルーティングやデータ取得の仕組みは含まず、RSC のバンドラー統合に必要な最小限のプリミティブのみを提供する[[4]](#参考リンク)。

この設計により:

- **フレームワーク作者**は RSC バンドラー統合を自前で実装する必要がなくなり、ルーティングやデータ取得などの上位レイヤーに集中できる
- **ランタイム非依存**で、Node.js だけでなく Cloudflare Workers などのエッジランタイムでも動作する

#### Waku の移行事例

Waku は RSC を Vite 上で先駆的に実装したフレームワークであり、その知見が `@vitejs/plugin-rsc` にフィードバックされた。移行により以下のメリットがあった[[6]](#参考リンク):

- **内部アーキテクチャの簡素化**: RSC バンドラー層をプラグインに委譲
- **Vite プラグインエコシステムへのフルアクセス**: 独自実装では利用できなかった Vite プラグインとの互換性を確保
- **将来の Rolldown 対応**: Vite 8 で Rolldown が統合された際にビルドパフォーマンスの恩恵を自動的に受けられる

重要な点として、ルーティングロジックには変更がなかった。Waku の「階層的ルーティングアーキテクチャ」により、インフラ層の変更がアプリケーション層に影響しない設計が維持された[[6]](#参考リンク)。

#### React Router の RSC Framework Mode

React Router v7.9.2 では `@vitejs/plugin-rsc` を peer dependency として RSC Framework Mode のプレビューが提供された[[7]](#参考リンク):

```typescript title="vite.config.ts - React Router RSC"
import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import { unstable_reactRouterRSC } from '@react-router/dev/vite';

export default defineConfig({
  plugins: [
    unstable_reactRouterRSC(),
    reactRouter(),
  ],
});
```

React Router の RSC 対応は、複雑さを 2 つのレイヤーに分離している:

- **RSC Data Mode**（低レベル）: ルーティング・データローディング・アクション処理の安定した基盤 API
- **RSC Framework Mode**（高レベル）: Data Mode の上に構築された薄いレイヤーで、ビルド設定・HMR・型生成・ファイルシステムルーティングを提供

ビルド出力は `build/server/index.js` という単一ファイルになり、非 RSC アプリケーションと同じ方法でデプロイできる[[7]](#参考リンク)。

### 5. Vite 基礎情報の補足

Vite の基礎的なアーキテクチャについては [Vite 8 + Rolldown](./vite8-rolldown) で詳細を扱っているが、RSC との関連で重要な特性を補足する:

- **ネイティブ ESM 開発サーバー**: バンドルなしでモジュールを配信するため、RSC 環境の追加によるビルド時間の増加が最小限
- **プラグインシステム**: Rollup 互換のプラグイン API により、RSC プラグインが既存のエコシステム（TypeScript、CSS Modules、画像最適化等）と共存
- **Environment API（Vite 6+）**: 環境ごとに独立したモジュールグラフとビルド設定を持てるため、RSC の 3 環境モデルを自然に表現可能

## 検証結果

### スターターテンプレートの起動

```bash
# Vite RSC スターターの作成
npm create vite@latest my-rsc-app -- --template rsc
cd my-rsc-app
npm install
npm run dev
```

スターターテンプレートでは、3 つのエントリポイント（`entry.rsc.tsx`、`entry.ssr.tsx`、`entry.browser.tsx`）が生成され、最小限の RSC アプリケーションが動作する。

### エントリポイントの構造例

```tsx title="entry.rsc.tsx - RSC環境のエントリ"
// react-server condition でモジュールが解決される
import { renderToReadableStream } from 'react-server-dom-vite/server';

export async function render(request: Request) {
  const stream = renderToReadableStream(<App />, bundlerConfig);
  return new Response(stream);
}
```

```tsx title="entry.ssr.tsx - SSR環境のエントリ"
// RSC Stream を受け取り、HTML に変換する
import { createFromReadableStream } from 'react-server-dom-vite/client';
import { renderToReadableStream } from 'react-dom/server';

export async function render(rscStream: ReadableStream) {
  const tree = await createFromReadableStream(rscStream);
  const html = await renderToReadableStream(tree);
  return html;
}
```

```tsx title="entry.browser.tsx - クライアント環境のエントリ"
// ハイドレーションと RSC の再フェッチを担当
import { createFromFetch } from 'react-server-dom-vite/client';
import { hydrateRoot } from 'react-dom/client';

async function main() {
  const response = fetch('/rsc');
  const tree = await createFromFetch(response);
  hydrateRoot(document.getElementById('root')!, tree);
}
main();
```

### Server Component と Client Component の共存

```tsx title="App.tsx - Server Component（デフォルト）"
// ディレクティブなし = Server Component
import Counter from './Counter';

export default async function App() {
  // サーバーでのみ実行される
  const data = await db.posts.findMany();

  return (
    <main>
      <h1>Posts ({data.length})</h1>
      {data.map(post => <p key={post.id}>{post.title}</p>)}
      {/* Client Component を Server Component 内で使用 */}
      <Counter initialCount={data.length} />
    </main>
  );
}
```

```tsx title="Counter.tsx - Client Component"
"use client"

import { useState } from 'react';

// クライアントバンドルに含まれる
export default function Counter({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
}
```

バンドラー（`@vitejs/plugin-rsc`）は `Counter.tsx` の `"use client"` を検出し、自動的にクライアントチャンクのエントリポイントとして登録する。RSC Payload 内では `Counter` はモジュール参照（`chunk123.js#Counter`）としてシリアライズされ、クライアント側でバンドラーが実際のコンポーネント関数に復元する。

## まとめ

- **RSC はバンドラー統合が必須**: `'use client'` / `'use server'` ディレクティブの処理、モジュール参照のシリアライズ/デシリアライズ、チャンク最適化はバンドラーの役割であり、ランタイムだけでは実現できない
- **Vite Environment API が突破口**: Vite 6 で導入されたマルチ環境ビルド基盤により、RSC に必要な 3 環境（rsc / ssr / client）を単一プロセス内で自然に表現できるようになった
- **`@vitejs/plugin-rsc` の設計哲学**: フレームワーク非依存・ランタイム非依存の低レベルプリミティブとして設計され、フレームワーク作者がルーティングやデータ取得に集中できる
- **エコシステムの広がり**: Waku（移行完了）、React Router（プレビュー）、Cloudflare Workers（統合済み）と、複数のフレームワーク・プラットフォームで採用が進んでいる
- **Next.js 以外の選択肢**: RSC を使いたいが Next.js の意見の強いアーキテクチャに縛られたくない開発者に、Vite ベースの代替手段を提供する
- **将来性**: Vite 8 の Rolldown 統合により、RSC ビルドのさらなる高速化が期待される

## 参考リンク

1. [Server Components – React（公式ドキュメント）](https://react.dev/reference/rsc/server-components)
2. [Why Does RSC Integrate with a Bundler? — overreacted（Dan Abramov）](https://overreacted.io/why-does-rsc-integrate-with-a-bundler/)
3. [Environment API for Plugins | Vite](https://vite.dev/guide/api-environment-plugins)
4. [vitejs/vite-plugin-react - plugin-rsc（GitHub）](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc)
5. [@vitejs/plugin-rsc | DeepWiki](https://deepwiki.com/vitejs/vite-plugin-react/2.4-@vitejsplugin-rsc)
6. [Migration to @vitejs/plugin-rsc — Waku](https://waku.gg/blog/migration-to-vite-plugin-rsc)
7. [React Router RSC Framework Mode Preview | Remix](https://remix.run/blog/rsc-framework-mode-preview)
8. [Improved React Server Components support in the Cloudflare Vite plugin](https://developers.cloudflare.com/changelog/post/2026-02-11-vite-plugin-child-environments/)

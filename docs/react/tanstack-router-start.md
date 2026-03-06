---
id: tanstack-router-start
title: TanStack Router / TanStack Start - 型安全なルーティングとフルスタックフレームワーク
sidebar_position: 6
tags: [tanstack, router, typescript, fullstack, react]
last_update:
  date: 2026-03-06
---

# TanStack Router / TanStack Start - 型安全なルーティングとフルスタックフレームワーク

## 概要

TanStack Routerの型安全なルーティング設計と、それを基盤とするフルスタックフレームワークTanStack Startの機能・アーキテクチャについて調査した。Next.jsやRemixとの比較を含め、プロジェクトへの導入可否を検討する。

## 背景・動機

Reactのルーティングライブラリとしては長らくReact Routerが標準的な選択肢であったが、TypeScriptプロジェクトにおけるルートパラメータやクエリパラメータの型安全性に課題があった。TanStack Routerは「100%型安全なルーティング」を掲げており[[1]](#参考リンク)、さらにTanStack Startはそのルーターを基盤にSSR・Server Functionsを提供するフルスタックフレームワークとして登場した[[2]](#参考リンク)。Next.jsやRemixに対する新たな選択肢としての実力を評価する。

## 調査内容

### 1. TanStack Routerの設計思想

TanStack Routerは「クライアントファースト、サーバー対応、完全型安全」を設計方針とするルーティングライブラリである[[3]](#参考リンク)。主な特徴は以下の通り:

- **100%型安全**: パスパラメータ、Search Params、コンテキスト、ローダーデータまですべてTypeScriptで型推論される[[1]](#参考リンク)
- **ファーストクラスのSearch Params**: URLクエリパラメータをスキーマ付きで管理し、バリデーション・型安全性・前後処理を提供[[1]](#参考リンク)
- **組み込みデータローディング**: ルートローダーAPIにより、ウォーターフォールを回避しキャッシュ付きのデータ取得を実現
- **自動コード分割**: ルーティングロジックをクリティカル（パス解析・バリデーション・データローディング）と非クリティカル（UIコンポーネント・エラーバウンダリ）に分割[[1]](#参考リンク)
- **開発者ツール**: 公式DevToolsでルート状態・データローダー・キャッシュ・エラーをデバッグ可能

### 2. ファイルベースルーティング vs コードベースルーティング

TanStack Routerは2つのルーティング定義方式をサポートしている[[4]](#参考リンク)。

#### ファイルベースルーティング

ファイルシステムのディレクトリ構成がそのままルート階層になる方式。ファイル名に`.`（ドット）を使うことで、ディレクトリを作らずにネストを表現できる。動的パラメータは`$`プレフィックスで定義する[[4]](#参考リンク)。

```text
src/routes/
├── __root.tsx          # ルートレイアウト
├── index.tsx           # / (トップページ)
├── about.tsx           # /about
├── posts.tsx           # /posts レイアウト
├── posts.index.tsx     # /posts (一覧)
├── posts.$postId.tsx   # /posts/:postId (詳細)
└── settings/
    ├── index.tsx        # /settings
    └── profile.tsx      # /settings/profile
```

ルートツリーは自動生成され、`routeTree.gen.ts`としてエクスポートされる:

```tsx title="src/main.tsx"
import { routeTree } from './routeTree.gen'
import { createRouter, RouterProvider } from '@tanstack/react-router'

// 自動生成されたルートツリーからルーターを作成
const router = createRouter({ routeTree })

function App() {
  return <RouterProvider router={router} />
}
```

#### コードベースルーティング

明示的にJavaScript/TypeScriptでルートツリーを定義する方式。複雑なルーティング要件やプログラマティックな制御が必要な場合に適している[[5]](#参考リンク)。

```tsx title="src/routes.tsx"
import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'

// ルートルートの定義
const rootRoute = createRootRoute({
  component: RootLayout,
})

// 各ルートを明示的に定義
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: AboutPage,
})

// ルートツリーを構築
const routeTree = rootRoute.addChildren([indexRoute, aboutRoute])
const router = createRouter({ routeTree })
```

ファイルベースルーティングは自動コード分割や型リンケージの自動生成という利点があり、一般的にはこちらが推奨される。

### 3. Search Params（型安全なクエリパラメータ管理）

TanStack Routerの最大の差別化ポイントの1つが、URLのクエリパラメータ（Search Params）に対する型安全なAPI提供である[[6]](#参考リンク)。

#### 手動バリデーション

`validateSearch`オプションでSearch Paramsのパース・バリデーションを定義する:

```tsx title="src/routes/products.tsx"
// Search Paramsの型定義
type ProductSearchSortOptions = 'newest' | 'oldest' | 'price'
type ProductSearch = {
  page: number
  filter: string
  sort: ProductSearchSortOptions
}

export const Route = createFileRoute('/shop/products')({
  // Search Paramsのバリデーション・パース
  validateSearch: (search: Record<string, unknown>): ProductSearch => {
    return {
      page: Number(search?.page ?? 1),
      filter: (search.filter as string) || '',
      sort: (search.sort as ProductSearchSortOptions) || 'newest',
    }
  },
})
```

#### Zodアダプタによるスキーマバリデーション

`@tanstack/zod-adapter`を使用すると、Zodスキーマによるバリデーションが可能になる[[7]](#参考リンク):

```tsx title="src/routes/search.tsx"
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator, fallback } from '@tanstack/zod-adapter'
import { z } from 'zod'

// Zodスキーマで検索パラメータを定義
const searchSchema = z.object({
  query: z.string().min(1).max(100),
  page: fallback(z.number().int().positive(), 1),       // デフォルト値付き
  sortBy: z.enum(['name', 'date', 'relevance']).optional(),
  filters: z.array(z.string()).optional(),
})

export const Route = createFileRoute('/search')({
  validateSearch: zodValidator(searchSchema),
  component: SearchPage,
})

function SearchPage() {
  // 型安全にSearch Paramsにアクセス（型はZodスキーマから推論）
  const { query, page, sortBy } = Route.useSearch()
  return (
    <div>
      <p>検索語: {query}</p>
      <p>ページ: {page}</p>
    </div>
  )
}
```

`fallback`関数により、パラメータが不正または欠落している場合のデフォルト値を宣言的に定義できる。

### 4. Loaders（データフェッチ）

ルートの`loader`オプションでデータフェッチを定義すると、ナビゲーション時にコンポーネントのレンダリング前にデータが取得される[[8]](#参考リンク)。

```tsx title="src/routes/posts.tsx"
import { createFileRoute } from '@tanstack/react-router'

// 投稿一覧のデータをルートローダーで取得
export const Route = createFileRoute('/posts')({
  loader: async () => {
    const response = await fetch('/api/posts')
    const posts = await response.json()
    return { posts }
  },
  component: PostsPage,
})

function PostsPage() {
  // useLoaderData で型安全にデータを取得
  const { posts } = Route.useLoaderData()
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

パスパラメータやコンテキストへのアクセスも型安全に行える:

```tsx title="src/routes/posts.$postId.tsx"
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  // params.postId は string 型として推論される
  loader: async ({ params }) => {
    const response = await fetch(`/api/posts/${params.postId}`)
    return await response.json()
  },
  component: PostDetailPage,
})

function PostDetailPage() {
  const post = Route.useLoaderData()
  return <h1>{post.title}</h1>
}
```

さらに、TanStack Queryとの統合パターンも用意されており、キャッシュ管理やバックグラウンド再取得を含むより高度なデータフェッチが実現できる。

### 5. TanStack Startの概要

TanStack Startは、TanStack Routerを基盤とするフルスタックReactフレームワークである[[2]](#参考リンク)。主な機能は以下の通り:

- **SSR（サーバーサイドレンダリング）**: ストリーミング対応のフルドキュメントSSR
- **Server Functions**: 型安全なサーバー/クライアント間RPC
- **ミドルウェア**: リクエスト/レスポンスの処理とデータ注入
- **フルスタックバンドリング**: クライアント・サーバーコードの最適化ビルド
- **ユニバーサルデプロイ**: 任意のVite互換ホスティングプロバイダーにデプロイ可能

レンダリングモードとして、SSR（デフォルト）、静的プリレンダリング、ISR（Incremental Static Regeneration）、SPAモードを選択できる[[2]](#参考リンク)。

### 6. Server Functions

TanStack Startの`createServerFn`は、サーバー上でのみ実行されるロジックを定義し、クライアントから型安全に呼び出すための仕組みである[[9]](#参考リンク)。

```tsx title="src/server/functions.ts"
import { createServerFn } from '@tanstack/react-start'

// GETリクエスト（デフォルト）: サーバー時刻を取得
export const getServerTime = createServerFn().handler(async () => {
  // このコードはサーバー上でのみ実行される
  return new Date().toISOString()
})

// POSTリクエスト: データの保存
export const saveData = createServerFn({ method: 'POST' }).handler(
  async () => {
    // データベースへの書き込みなど
    return { success: true }
  }
)
```

入力バリデーションにはZod等のスキーマライブラリを統合できる:

```tsx title="src/server/users.ts"
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const UserSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(0),
})

// 入力をZodスキーマでバリデーション
export const createUser = createServerFn({ method: 'POST' })
  .inputValidator(UserSchema)
  .handler(async ({ data }) => {
    // data は { name: string; age: number } として型推論される
    return `Created user: ${data.name}, age ${data.age}`
  })
```

Server Functionsはローダー、コンポーネント、フック、他のServer Functionsなどアプリケーション内のどこからでも呼び出し可能であり、データベースアクセスや環境変数の参照など、サーバーサイドでしかできない処理を安全に実行できる[[9]](#参考リンク)。

### 7. Vinxiベースのサーバーアーキテクチャ

TanStack Startは当初Vinxi（Vite + Nitroを組み合わせたメタフレームワーク）を基盤としていた。VinxiはViteをバンドラー・開発サーバーとして、NitroをHTTPサーバーとして利用する構成であった[[10]](#参考リンク)。

Nitroはサーバーサイドのランタイムを抽象化する「アダプターレス」なアーキテクチャを提供する。H3というHTTPフレームワーク上に構築されており、各ホスティングプラットフォーム向けの低レベルアダプターを内部的に管理するため、開発者はデプロイ先を意識せずにサーバーコードを記述できる[[10]](#参考リンク)。

現在はVinxiへの依存を解消（「Devinxi」と呼ばれるプロジェクト）し、ViteのDevサーバーインスタンスを直接使用するアーキテクチャに移行している[[11]](#参考リンク)。プロダクションビルドのみNitroサーバーを使用する構成となっており、より柔軟でシンプルなアーキテクチャが実現されている。

### 8. Next.js / Remixとの比較

TanStack Start、Next.js、Remixの主要な差異を以下に整理する[[12]](#参考リンク)[[13]](#参考リンク)。

| 観点 | TanStack Start | Next.js | Remix (React Router v7) |
|---|---|---|---|
| **設計思想** | データファースト、ルーター駆動 | ハイブリッドレンダリング、SEO重視 | Web標準準拠、プログレッシブエンハンスメント |
| **レンダリング** | SSR（デフォルト）+ SPA遷移 | SSR / SSG / ISR / PPR | SSR + 強力なキャッシュ |
| **型安全性** | ルーティング全体で100%型安全 | 部分的（パラメータは手動型付け） | 部分的 |
| **データ取得** | Router Loader + TanStack Query統合 | Server Components + fetch | Loader / Action |
| **Server Components** | 対応（Composite Components方式）[[14]](#参考リンク) | 完全対応 | 対応 |
| **バンドルサイズ** | RSCによる最適化が可能 | RSCで選択的に最適化 | 約371kB（Next.jsより約35%小） |
| **エッジ対応** | 設定可能 | 追加設定が必要な場合あり | ネイティブ対応 |
| **エコシステム** | 成長中（TanStack中心） | 最大規模 | 拡大中 |
| **DX** | 透明性が高く、マジックが少ない | 規約ベースの自動化が多い | Web標準に忠実 |

TanStack Startの強みは「型安全性」と「透明性の高いDX」にある。Next.jsのように「マジカル」な規約に依存せず、データのロード方法・実行場所・レンダリング対象を開発者が明示的に選択できる[[13]](#参考リンク)。React Server Componentsについても「Composite Components」というアプローチで対応しており、サーバーコンポーネントをシリアライズされたJSXのストリームとして扱い、TanStack QueryやRouterの既存のキャッシュ・データフェッチ機構と統合する設計となっている[[14]](#参考リンク)。

### 9. 導入方法と設定

#### プロジェクトの作成

```bash
# 新規プロジェクトの作成
npm create @tanstack/start@latest my-app
cd my-app
npm install
```

#### 設定ファイル

```tsx title="vite.config.ts"
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    // プラグインの順序が重要: TanStack Start -> React
    tsConfigPaths(),
    tanstackStart(),
    viteReact(),
  ],
})
```

#### プロジェクト構成

```text
my-app/
├── src/
│   ├── routes/
│   │   ├── __root.tsx        # ルートレイアウト
│   │   ├── index.tsx         # トップページ
│   │   └── about.tsx         # Aboutページ
│   ├── router.tsx            # ルーター設定
│   └── routeTree.gen.ts      # 自動生成されるルートツリー
├── vite.config.ts            # Vite設定
├── tsconfig.json
└── package.json
```

#### TypeScript設定

```json title="tsconfig.json"
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "target": "ES2022",
    "skipLibCheck": true,
    "strictNullChecks": true
  }
}
```

## 検証結果

### ファイルベースルーティングの型安全性

ファイルベースルーティングでは、`routeTree.gen.ts`に全ルートの型情報が自動生成される。これにより`<Link>`コンポーネントやナビゲーション関数で存在しないルートを指定するとコンパイルエラーになる:

```tsx
import { Link } from '@tanstack/react-router'

function Navigation() {
  return (
    <nav>
      {/* 型安全: パスとパラメータが自動補完される */}
      <Link to="/posts/$postId" params={{ postId: '123' }}>
        投稿を見る
      </Link>

      {/* コンパイルエラー: 存在しないルート */}
      {/* <Link to="/nonexistent">リンク</Link> */}

      {/* コンパイルエラー: 必須パラメータの欠落 */}
      {/* <Link to="/posts/$postId">投稿</Link> */}
    </nav>
  )
}
```

### Search Paramsの型推論

`validateSearch`で定義したスキーマの型がコンポーネント内で完全に推論される:

```tsx
// ルート定義時にスキーマを設定
export const Route = createFileRoute('/products')({
  validateSearch: zodValidator(
    z.object({
      category: z.string().optional(),
      minPrice: fallback(z.number(), 0),
      maxPrice: fallback(z.number(), 10000),
    })
  ),
  component: ProductList,
})

function ProductList() {
  // category: string | undefined, minPrice: number, maxPrice: number として推論
  const { category, minPrice, maxPrice } = Route.useSearch()

  // ナビゲーション時もSearch Paramsが型チェックされる
  const navigate = Route.useNavigate()
  navigate({
    search: { minPrice: 100, maxPrice: 500 },
    // search: { invalidParam: true } // コンパイルエラー
  })
}
```

### Server FunctionsとLoaderの連携

TanStack StartではServer FunctionsをLoaderから呼び出すことで、サーバーサイドのデータ取得を型安全に実行できる:

```tsx title="src/routes/dashboard.tsx"
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

// サーバー上でのみ実行されるデータ取得関数
const getDashboardData = createServerFn().handler(async () => {
  // データベースに直接アクセス可能
  const stats = await db.query('SELECT count(*) FROM users')
  const recent = await db.query('SELECT * FROM activities ORDER BY created_at DESC LIMIT 10')
  return { userCount: stats[0].count, recentActivities: recent }
})

export const Route = createFileRoute('/dashboard')({
  // ローダーからServer Functionを呼び出す
  loader: async () => {
    return await getDashboardData()
  },
  component: DashboardPage,
})

function DashboardPage() {
  // 戻り値の型が完全に推論される
  const { userCount, recentActivities } = Route.useLoaderData()
  return (
    <div>
      <h1>ダッシュボード</h1>
      <p>ユーザー数: {userCount}</p>
      <ul>
        {recentActivities.map((activity) => (
          <li key={activity.id}>{activity.description}</li>
        ))}
      </ul>
    </div>
  )
}
```

## まとめ

### 所感

TanStack Router / TanStack Startは、TypeScriptプロジェクトにおけるルーティングの型安全性という明確な強みを持つ。特にSearch Paramsの型安全な管理はReact Router等では得られない体験であり、URLベースの状態管理を多用するアプリケーションで大きな価値がある。

Server Functionsの`createServerFn`は、tRPCのようなRPC的アプローチをフレームワーク組み込みで実現しており、別途APIレイヤーを構築する手間を省ける点が魅力的である。

### プロジェクトへの適用可否

- **推奨するケース**: TypeScriptの型安全性を最大限に活用したいSPAまたはSSRアプリケーション。URL Search Paramsを多用するダッシュボード・管理画面系のプロジェクト。TanStack Query既存ユーザー
- **慎重に検討すべきケース**: 大規模なエコシステム・コミュニティサポートが必要な場合（Next.jsに比べると小規模）。静的サイト生成が主体のプロジェクト（Next.jsのSSG/ISRが優れる）。安定版リリースを待ちたい場合（2026年3月時点でRC段階）

TanStack Startは2026年3月時点でv1 RC（Release Candidate）段階であり、APIは安定しているが正式なv1.0リリースには至っていない。エコシステムの成熟度ではNext.jsに及ばないが、型安全性・透明性・開発体験の面で独自の価値を提供している。既存のTanStack Router / TanStack Queryユーザーであれば、段階的にStartの機能を導入できるため、移行コストも低い。

## 参考リンク

1. [TanStack Router - Overview](https://tanstack.com/router/latest/docs/overview)
2. [TanStack Start - Overview](https://tanstack.com/start/latest/docs/framework/react/overview)
3. [GitHub - TanStack/router](https://github.com/TanStack/router)
4. [File-Based Routing | TanStack Router Docs](https://tanstack.com/router/latest/docs/routing/file-based-routing)
5. [Code-Based Routing | TanStack Router Docs](https://tanstack.com/router/latest/docs/routing/code-based-routing)
6. [Search Params | TanStack Router Docs](https://tanstack.com/router/latest/docs/framework/react/guide/search-params)
7. [Validate Search Parameters with Schemas | TanStack Router Docs](https://tanstack.com/router/latest/docs/how-to/validate-search-params)
8. [Data Loading | TanStack Router Docs](https://tanstack.com/router/latest/docs/guide/data-loading)
9. [Server Functions | TanStack Start React Docs](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
10. [What is Vinxi, and how does it compare to Vike? - DEV Community](https://dev.to/this-is-learning/what-is-vinxi-and-how-does-it-compare-to-vike-4883)
11. [Why TanStack Start is Ditching Adapters | TanStack Blog](https://tanstack.com/blog/why-tanstack-start-is-ditching-adapters)
12. [Comparison | TanStack Start vs Next.js vs React Router](https://tanstack.com/start/latest/docs/framework/react/comparison)
13. [TanStack Start vs Next.js vs Remix: Which React Framework Should You Choose in 2025?](https://makersden.io/blog/tanstack-starts-vs-nextjs-vs-remix)
14. [TanStack Start vs Next.js | TanStack Start React Docs](https://tanstack.com/start/latest/docs/framework/react/start-vs-nextjs)

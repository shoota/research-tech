---
id: nextjs15-app-router
title: Next.js 15 App Router 設計パターン
sidebar_position: 5
tags: [nextjs, app-router, react, rsc, ssr]
last_update:
  date: 2026-03-06
---

## 概要

Next.js 15 の App Router が提供するアーキテクチャ、ルーティングパターン、キャッシュ戦略、Server Components / Server Actions との統合について調査した。

## 背景・動機

Next.js 15 は React Server Components（RSC）を基盤としたフルスタックフレームワークとして成熟し、App Router がデフォルトの推奨アーキテクチャとなっている。Parallel Routes、Intercepting Routes、PPR（Partial Prerendering）など高度なルーティング・レンダリング機能が追加され、設計パターンの選択肢が大幅に広がった。プロジェクトで Next.js を採用・移行する際の判断材料として、主要な設計パターンとベストプラクティスを整理する。

## 調査内容

### 1. App Router のアーキテクチャ

#### ファイルベースルーティング

App Router は `app/` ディレクトリ配下のファイル構造がそのままルーティングに対応する。各ルートセグメントには以下の特殊ファイルを配置できる[[1]](#参考リンク)。

| ファイル | 役割 |
|---|---|
| `page.tsx` | ルートの UI（このファイルがあるとルートとしてアクセス可能） |
| `layout.tsx` | 子ルートを包むレイアウト（再レンダリングされない） |
| `loading.tsx` | Suspense フォールバック UI |
| `error.tsx` | Error Boundary |
| `not-found.tsx` | 404 UI |
| `route.ts` | API エンドポイント（Route Handler） |
| `template.tsx` | 遷移ごとに再マウントされるレイアウト |

#### レイアウトシステム

レイアウトはネストされ、親から子へ階層的に適用される。ナビゲーション時にレイアウトは状態を保持したまま再利用され、変更があったセグメントのみが再レンダリングされる（Partial Rendering）。

```tsx title="app/dashboard/layout.tsx"
// dashboard 配下の全ページに共通のレイアウト
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dashboard">
      <nav>
        {/* サイドバーナビゲーション */}
        <a href="/dashboard/analytics">Analytics</a>
        <a href="/dashboard/settings">Settings</a>
      </nav>
      <main>{children}</main>
    </div>
  )
}
```

#### Route Groups

`(folderName)` の形式でディレクトリを作ると、URL 構造に影響を与えずにルートをグループ化できる。認証が必要なページと不要なページでレイアウトを分けるといった用途に使える。

```
app/
  (auth)/
    login/page.tsx      → /login
    register/page.tsx   → /register
  (dashboard)/
    layout.tsx          → 認証済みレイアウト
    analytics/page.tsx  → /analytics
    settings/page.tsx   → /settings
```

### 2. Parallel Routes（@slot 記法）

Parallel Routes は同一レイアウト内で複数のページを同時または条件付きでレンダリングする仕組みである[[2]](#参考リンク)。`@folder` 記法で「スロット」を定義し、親レイアウトに props として渡される。

```
app/
  @analytics/
    page.tsx
  @team/
    page.tsx
  layout.tsx
  page.tsx
```

```tsx title="app/layout.tsx"
// @analytics と @team が並列にレンダリングされる
export default function Layout({
  children,
  analytics,
  team,
}: {
  children: React.ReactNode
  analytics: React.ReactNode
  team: React.ReactNode
}) {
  return (
    <>
      {children}
      {team}
      {analytics}
    </>
  )
}
```

スロットは URL セグメントではないため、`/@analytics/views` の URL は `/views` となる。

#### default.js

ナビゲーション後にスロットが現在の URL にマッチしない場合、`default.js` がフォールバックとして表示される。`default.js` がなければ 404 になる[[2]](#参考リンク)。

#### 条件付きルーティング

ユーザーのロールに応じて異なるダッシュボードを出し分けるパターンに活用できる。

```tsx title="app/dashboard/layout.tsx"
import { checkUserRole } from '@/lib/auth'

export default function Layout({
  user,
  admin,
}: {
  user: React.ReactNode
  admin: React.ReactNode
}) {
  const role = checkUserRole()
  return role === 'admin' ? admin : user
}
```

### 3. Intercepting Routes（(..) 記法）

Intercepting Routes は、現在のレイアウト内で別ルートのコンテンツを表示する仕組みである。ユーザーのコンテキストを維持したまま、モーダルやオーバーレイでコンテンツを表示するのに適している[[3]](#参考リンク)。

| 記法 | マッチ対象 |
|---|---|
| `(.)` | 同一レベルのセグメント |
| `(..)` | 1 つ上のレベル |
| `(..)(..)` | 2 つ上のレベル |
| `(...)` | ルート `app` ディレクトリから |

`(..)` はファイルシステムではなくルートセグメントに基づく。`@slot` フォルダはセグメントとしてカウントされない[[3]](#参考リンク)。

#### モーダルパターン（Parallel Routes + Intercepting Routes）

写真ギャラリーでフィード上にモーダルを表示し、URL も `/photo/123` に更新する典型的なパターン。

```
app/
  @modal/
    default.tsx          → null を返す
    (.)photo/[id]/
      page.tsx           → モーダル内で写真表示
  photo/[id]/
    page.tsx             → 直接アクセス時のフルページ
  layout.tsx
  page.tsx
```

```tsx title="app/@modal/(.)photo/[id]/page.tsx"
import { Modal } from '@/app/ui/modal'
import { PhotoDetail } from '@/app/ui/photo-detail'

// クライアントサイドナビゲーション時はモーダルとして表示
export default async function PhotoModal({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Modal>
      <PhotoDetail id={id} />
    </Modal>
  )
}
```

```tsx title="app/ui/modal.tsx"
'use client'

import { useRouter } from 'next/navigation'

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <div className="modal-overlay">
      <button onClick={() => router.back()}>閉じる</button>
      <div className="modal-content">{children}</div>
    </div>
  )
}
```

このパターンにより以下を実現できる:

- モーダル内容を URL で共有可能
- リフレッシュ時にコンテキストを保持
- ブラウザバックでモーダルを閉じる
- フォワードナビゲーションでモーダルを再表示

### 4. PPR（Partial Prerendering）

PPR は静的コンテンツと動的コンテンツを同一ルート内で組み合わせるレンダリング戦略である[[4]](#参考リンク)。

#### 仕組み

ビルド時にルートのコンポーネントツリーをレンダリングし、ネットワークリクエストやリクエストデータへのアクセスが不要なコンポーネントは自動的に静的シェルに含まれる。動的コンテンツは `<Suspense>` で囲み、リクエスト時にストリーミングされる[[4]](#参考リンク)。

```
[静的シェル（即座に配信）]
├── ヘッダー（静的）
├── ナビゲーション（静的）
├── メインコンテンツ（use cache でキャッシュ可能）
└── <Suspense fallback={<Loading />}>
    └── パーソナライズドコンテンツ（リクエスト時にストリーミング）
```

#### 設定方法

Next.js 15 では `ppr: 'incremental'` でルートごとにオプトインする。Next.js 16 以降では `cacheComponents: true` で有効化する[[4]](#参考リンク)[[5]](#参考リンク)。

```ts title="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Next.js 15 の場合
  experimental: {
    ppr: 'incremental',
  },
}

export default nextConfig
```

#### コード例

```tsx title="app/blog/page.tsx"
import { Suspense } from 'react'
import { cookies } from 'next/headers'

// 静的シェルに含まれる部分
export default function BlogPage() {
  return (
    <>
      <header>
        <h1>ブログ</h1>
        <nav>Home | About</nav>
      </header>

      {/* キャッシュされた動的コンテンツ */}
      <Suspense fallback={<p>記事を読み込み中...</p>}>
        <BlogPosts />
      </Suspense>

      {/* リクエスト時に動的にレンダリング */}
      <Suspense fallback={<p>設定を読み込み中...</p>}>
        <UserPreferences />
      </Suspense>
    </>
  )
}

// 全ユーザーに同じ内容を配信（1時間キャッシュ）
async function BlogPosts() {
  'use cache'
  cacheLife('hours')

  const res = await fetch('https://api.example.com/posts')
  const posts = await res.json()

  return (
    <ul>
      {posts.map((post: any) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}

// ユーザーごとにパーソナライズ
async function UserPreferences() {
  const theme = (await cookies()).get('theme')?.value || 'light'
  return <p>テーマ: {theme}</p>
}
```

### 5. Route Handlers

Route Handlers は Web 標準の Request / Response API を使ったカスタムリクエストハンドラである[[6]](#参考リンク)。`app/` ディレクトリ内の `route.ts` ファイルで定義する。

```tsx title="app/api/users/route.ts"
import { NextRequest, NextResponse } from 'next/server'

// GET: ユーザー一覧を返す
export async function GET() {
  const users = await db.query('SELECT * FROM users')
  return NextResponse.json(users)
}

// POST: ユーザーを作成する
export async function POST(request: NextRequest) {
  const body = await request.json()

  // バリデーション
  if (!body.name || !body.email) {
    return NextResponse.json(
      { error: 'name と email は必須です' },
      { status: 400 }
    )
  }

  const user = await db.insert('users', body)
  return NextResponse.json(user, { status: 201 })
}
```

#### 対応 HTTP メソッド

`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` に対応。

#### キャッシュ動作

Route Handlers はデフォルトでキャッシュされない。`GET` メソッドのみ `dynamic = 'force-static'` でキャッシュを有効化できる[[6]](#参考リンク)。

#### 動的パラメータ

Next.js 15 では `params` が Promise になった。アクセス前に `await` が必要である。

```tsx title="app/api/users/[id]/route.ts"
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/users/[id]'>
) {
  const { id } = await ctx.params
  const user = await db.findUser(id)
  return NextResponse.json(user)
}
```

### 6. Middleware

Middleware はリクエストが完了する前にコードを実行する仕組みで、プロジェクトルートの `middleware.ts` に定義する[[7]](#参考リンク)。

```tsx title="middleware.ts"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 認証トークンの検証
  const token = request.cookies.get('auth-token')?.value

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // レスポンスヘッダーの追加
  const response = NextResponse.next()
  response.headers.set('x-custom-header', 'my-value')
  return response
}

// マッチャーで適用範囲を制限
export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
```

#### ベストプラクティス

- **軽量に保つ**: 認証チェック、リダイレクト、ヘッダー操作など軽い処理に限定する[[7]](#参考リンク)
- **マッチャーを活用**: `config.matcher` で対象ルートを明示し、不要なルートでの実行を避ける
- **エラーハンドリング**: トークン検証失敗などの想定外のシナリオに対応する
- **典型的な用途**: 認証ゲート、A/B テストルーティング、URL リダイレクト/リライト、CSP/CORS ヘッダー設定

### 7. キャッシュ戦略

Next.js App Router には 4 層のキャッシュメカニズムがある[[8]](#参考リンク)。

| メカニズム | 対象 | 場所 | 持続期間 |
|---|---|---|---|
| Request Memoization | 関数の戻り値 | サーバー | リクエストライフサイクル |
| Data Cache | データ | サーバー | 永続（再検証可能） |
| Full Route Cache | HTML + RSC Payload | サーバー | 永続（デプロイで消去） |
| Router Cache | RSC Payload | クライアント | セッション or 時間ベース |

#### Next.js 15 での変更点

Next.js 15 では fetch リクエストがデフォルトでキャッシュされなくなった。明示的にキャッシュをオプトインする必要がある[[9]](#参考リンク)。

```tsx
// キャッシュを明示的に有効化
fetch('https://api.example.com/data', { cache: 'force-cache' })

// 時間ベースの再検証
fetch('https://api.example.com/data', { next: { revalidate: 3600 } })

// タグベースのキャッシュ
fetch('https://api.example.com/posts', { next: { tags: ['posts'] } })
```

#### `use cache` ディレクティブ

Next.js 15 で導入された新しいキャッシュプリミティブ。`fetch` オプション、`unstable_cache`、手動キャッシュラッパーを統合する[[5]](#参考リンク)。

```tsx title="app/components/product-list.tsx"
import { cacheLife, cacheTag } from 'next/cache'

async function ProductList() {
  'use cache'
  cacheLife('hours')   // キャッシュの有効期間を設定
  cacheTag('products') // タグでキャッシュを管理

  const products = await db.query('SELECT * FROM products')
  return (
    <ul>
      {products.map((p: any) => (
        <li key={p.id}>{p.name}: {p.price}円</li>
      ))}
    </ul>
  )
}
```

#### オンデマンド再検証

```tsx title="app/actions/product.ts"
'use server'

import { revalidateTag } from 'next/cache'

export async function updateProduct(id: string, data: FormData) {
  await db.update('products', id, data)
  // タグに紐づくキャッシュを無効化
  revalidateTag('products')
}
```

#### キャッシュの相互作用

- Data Cache を再検証すると Full Route Cache も無効化される
- Full Route Cache の無効化は Data Cache に影響しない
- `revalidatePath` / `revalidateTag` を Server Action 内で使うと Router Cache も無効化される
- Route Handler 内での `revalidateTag` は Router Cache を即座には無効化しない[[8]](#参考リンク)

### 8. Server Components / Server Actions との統合

#### Server Components

App Router ではすべてのコンポーネントがデフォルトで Server Component である。Server Component はサーバー上でレンダリングされ、クライアントに JavaScript を送信しない[[10]](#参考リンク)。

```tsx title="app/posts/page.tsx"
// Server Component（デフォルト）
// - データベースに直接アクセス可能
// - 環境変数（シークレット）を安全に使用可能
// - クライアントバンドルに含まれない
export default async function PostsPage() {
  const posts = await db.query('SELECT * FROM posts ORDER BY created_at DESC')

  return (
    <div>
      <h1>記事一覧</h1>
      {posts.map((post: any) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </div>
  )
}
```

#### Client Components

インタラクティブな UI には `'use client'` ディレクティブを使う。Server Component 内で小さなクライアントアイランドとしてインポートするのが推奨パターンである。

```tsx title="app/components/like-button.tsx"
'use client'

import { useState } from 'react'

// Client Component: state やイベントハンドラを使用
export function LikeButton({ postId }: { postId: string }) {
  const [liked, setLiked] = useState(false)

  return (
    <button onClick={() => setLiked(!liked)}>
      {liked ? '♥ いいね済み' : '♡ いいね'}
    </button>
  )
}
```

```tsx title="app/posts/[id]/page.tsx"
import { LikeButton } from '@/app/components/like-button'

// Server Component から Client Component をインポート
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await db.findPost(id)

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      {/* クライアントアイランド */}
      <LikeButton postId={id} />
    </article>
  )
}
```

#### Server Actions

Server Actions は `'use server'` ディレクティブで定義するサーバーサイド関数で、クライアントから直接呼び出せる[[11]](#参考リンク)。

```tsx title="app/actions/post.ts"
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// バリデーションスキーマ
const PostSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1),
})

export async function createPost(formData: FormData) {
  // 入力バリデーション
  const parsed = PostSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // データベースに保存
  await db.insert('posts', parsed.data)

  // キャッシュを再検証
  revalidatePath('/posts')
  return { success: true }
}
```

```tsx title="app/posts/new/page.tsx"
import { createPost } from '@/app/actions/post'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="タイトル" required />
      <textarea name="content" placeholder="本文" required />
      <button type="submit">投稿</button>
    </form>
  )
}
```

#### Server Actions のベストプラクティス

- **単一責任**: 各 Action は 1 つの操作に集中させる[[11]](#参考リンク)
- **バリデーション**: Zod などで入力を必ず検証する
- **ファイル分離**: `actions/` ディレクトリにドメインごとに整理する（`actions/user.ts`, `actions/post.ts`）
- **エラーハンドリング**: try-catch で API 失敗を適切に処理する
- **読み取り操作**: データの読み取りには Server Actions ではなく Server Component の async/await を使う

## 検証結果

### ディレクトリ構成パターン

調査した情報を基に、実践的なプロジェクト構成を以下に示す。

```
app/
  (marketing)/            # Route Group: マーケティングページ
    layout.tsx
    page.tsx              # / （トップページ）
    about/page.tsx        # /about
  (app)/                  # Route Group: アプリケーション
    layout.tsx            # 認証済みレイアウト
    dashboard/
      @analytics/         # Parallel Route
        page.tsx
        loading.tsx
      @team/              # Parallel Route
        page.tsx
        loading.tsx
      layout.tsx
      page.tsx
    settings/page.tsx
  @modal/                 # モーダル用スロット
    default.tsx
    (.)photo/[id]/page.tsx
  api/
    users/route.ts        # Route Handler
    posts/route.ts
  actions/                # Server Actions
    user.ts
    post.ts
  components/             # 共有コンポーネント
    ui/                   # Client Components
    server/               # Server Components
middleware.ts
```

### キャッシュ戦略の選択フロー

調査結果から、データの特性に応じたキャッシュ戦略の選択基準を整理した。

| データ特性 | 推奨戦略 | 例 |
|---|---|---|
| 完全に静的 | ビルド時レンダリング | 利用規約、About ページ |
| 低頻度更新 | `use cache` + `cacheLife('days')` | ブログ記事、商品一覧 |
| 中頻度更新 | `use cache` + `revalidateTag` | CMS コンテンツ |
| リアルタイム | `<Suspense>` でストリーミング | 在庫数、通知 |
| ユーザー固有 | `<Suspense>` + cookies/headers | ダッシュボード |

### Server Component と Client Component の使い分け

| 要件 | 選択 | 理由 |
|---|---|---|
| データ取得 | Server Component | DB/API に直接アクセス、バンドルサイズ削減 |
| シークレット使用 | Server Component | クライアントに漏洩しない |
| 状態管理（useState） | Client Component | React hooks はクライアントのみ |
| イベントハンドラ | Client Component | onClick 等はブラウザ API |
| ブラウザ API | Client Component | window, localStorage 等 |
| フォーム送信 | Server Action | `<form action={serverAction}>` |

## まとめ

Next.js 15 の App Router は、Server Components をベースとした「サーバーファースト」のアーキテクチャを採用しており、従来の Pages Router と比較して大きなパラダイムシフトとなっている。

**主な利点:**

- **Parallel Routes / Intercepting Routes** により、ダッシュボードやモーダルといった複雑な UI パターンをルーティングレベルで宣言的に実現できる
- **PPR（Partial Prerendering）** により、静的・動的コンテンツの混在がルート単位ではなくコンポーネント単位で可能になり、パフォーマンスと柔軟性を両立できる
- **キャッシュ戦略** が 4 層に分かれており、データの特性に応じた細かい制御が可能。Next.js 15 ではデフォルトが「キャッシュなし」に変更され、より明示的で予測可能になった
- **Server Actions** により、API エンドポイントを別途用意せずにサーバーサイドのミューテーションを実現でき、コードの凝集度が向上する

**注意点:**

- PPR は Next.js 15 時点では experimental であり、プロダクション利用には `cacheComponents`（Next.js 16+）の安定化を待つのが安全
- キャッシュの 4 層構造とその相互作用は複雑であり、チーム内での理解共有が重要
- Parallel Routes / Intercepting Routes は強力だが、ディレクトリ構造が複雑になりやすいため、使いどころを見極める必要がある

プロジェクトへの適用としては、新規プロジェクトでは App Router を標準採用し、段階的に PPR や Parallel Routes を導入するのが現実的である。

## 参考リンク

1. [Getting Started: Project Structure | Next.js](https://nextjs.org/docs/app/getting-started/project-structure)
2. [File-system conventions: Parallel Routes | Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes)
3. [File-system conventions: Intercepting Routes | Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)
4. [Getting Started: Partial Prerendering | Next.js](https://nextjs.org/docs/15/app/getting-started/partial-prerendering)
5. [Getting Started: Cache Components | Next.js](https://nextjs.org/docs/app/getting-started/cache-components)
6. [Getting Started: Route Handlers | Next.js](https://nextjs.org/docs/app/getting-started/route-handlers)
7. [Next.js Middleware Explained: Best Practices and Examples](https://pagepro.co/blog/next-js-middleware-what-is-it-and-when-to-use-it/)
8. [Guides: Caching | Next.js](https://nextjs.org/docs/app/guides/caching)
9. [Next.js Caching Evolution: From v14 to v15](https://dev.to/ahr_dev/nextjs-caching-evolution-from-v14-to-v15-and-the-cache-components-era-5goo)
10. [Getting Started: Server and Client Components | Next.js](https://nextjs.org/docs/app/getting-started/server-and-client-components)
11. [Exploring Next.js 15 and Server Actions: Features and Best Practices](https://dev.to/brayancodes/exploring-nextjs-15-and-server-actions-features-and-best-practices-1393)

---
id: nextjs15-app-router
title: Next.js 15/16 App Router 設計パターン
sidebar_position: 5
tags: [nextjs, app-router, react, rsc, ssr, nextjs16, opennext, vinext]
last_update:
  date: 2026-03-06
---

## 概要

Next.js 15/16 の App Router が提供するアーキテクチャ、ルーティングパターン、キャッシュ戦略、Server Components / Server Actions との統合について調査した。また、Next.js 16 での主要な変更点、および Next.js のセルフホスティングや代替実装として注目される OpenNext・vinext についても整理した。

## 背景・動機

Next.js 15 は React Server Components（RSC）を基盤としたフルスタックフレームワークとして成熟し、App Router がデフォルトの推奨アーキテクチャとなっている。Parallel Routes、Intercepting Routes、PPR（Partial Prerendering）など高度なルーティング・レンダリング機能が追加され、設計パターンの選択肢が大幅に広がった。2025年10月にリリースされた Next.js 16 では Cache Components の導入、Turbopack のデフォルト化、middleware から proxy への名称変更など、さらなるアーキテクチャの進化が行われた。また、Vercel 以外の環境での Next.js 運用を可能にする OpenNext や、Cloudflare が開発した Vite ベースの互換実装 vinext も登場している。プロジェクトで Next.js を採用・移行する際の判断材料として、主要な設計パターンとベストプラクティスを整理する。

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

- PPR は Next.js 16 で Cache Components として再設計され、`cacheComponents: true` で有効化する形に進化した
- キャッシュの 4 層構造とその相互作用は複雑であり、チーム内での理解共有が重要
- Parallel Routes / Intercepting Routes は強力だが、ディレクトリ構造が複雑になりやすいため、使いどころを見極める必要がある

プロジェクトへの適用としては、新規プロジェクトでは App Router を標準採用し、段階的に Cache Components や Parallel Routes を導入するのが現実的である。

### 9. Next.js 16 の主要な変更点

Next.js 16 は 2025年10月にリリースされ、キャッシュモデルの刷新、ビルドツールの進化、アーキテクチャの明確化が行われた[[12]](#参考リンク)。

#### Cache Components

Cache Components は Next.js 16 の中心的な新機能で、`"use cache"` ディレクティブを軸にキャッシュを明示的かつ柔軟に制御する仕組みである[[12]](#参考リンク)。

- 従来の App Router における暗黙的なキャッシュとは異なり、**完全にオプトイン方式**
- PPR（Partial Prerendering）の完成形として位置づけられ、`experimental.ppr` フラグは削除された
- `cacheComponents: true` で有効化する

```ts title="next.config.ts"
const nextConfig = {
  // Cache Components を有効化
  cacheComponents: true,
}

export default nextConfig
```

#### Turbopack デフォルト化

Turbopack が全アプリケーションのデフォルトバンドラーとなった[[12]](#参考リンク)。

- **2〜5倍高速な**プロダクションビルド
- **最大10倍高速な** Fast Refresh
- ファイルシステムキャッシュ（beta）により、dev サーバー再起動時のコンパイル時間が大幅短縮
- webpack を使い続ける場合は `next dev --webpack` / `next build --webpack` で明示的に指定

```ts title="next.config.ts"
const nextConfig = {
  experimental: {
    // ファイルシステムキャッシュ（beta）を有効化
    turbopackFileSystemCacheForDev: true,
  },
}

export default nextConfig
```

#### `proxy.ts`（旧 `middleware.ts`）

`middleware.ts` は `proxy.ts` にリネームされ、ネットワーク境界とルーティングの役割が明確になった[[12]](#参考リンク)。

- ランタイムは Node.js に統一（Edge Runtime は非サポート）
- `middleware.ts` は非推奨だがまだ動作する（将来のバージョンで削除予定）

```ts title="proxy.ts"
export default function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}
```

#### 新しいキャッシュ API

キャッシュ制御がより明示的になった[[12]](#参考リンク)。

| API | 用途 |
|---|---|
| `revalidateTag(tag, profile)` | SWR 動作でタグ付きキャッシュを再検証（第2引数に `cacheLife` プロファイルが必須に） |
| `updateTag(tag)` | Server Actions 専用。キャッシュを即座に期限切れにし、最新データを読み取る（read-your-writes） |
| `refresh()` | Server Actions 専用。キャッシュされていないデータのみをリフレッシュ |

```tsx title="app/actions/product.ts"
'use server'

import { revalidateTag, updateTag } from 'next/cache'

// SWR 動作: キャッシュを返しつつバックグラウンドで再検証
export async function refreshProducts() {
  revalidateTag('products', 'max')
}

// read-your-writes: ユーザーに即座に変更を反映
export async function updateProduct(id: string, data: FormData) {
  await db.update('products', id, data)
  updateTag(`product-${id}`)
}
```

#### React Compiler（stable）

React Compiler のビルトインサポートが安定版となった。コンポーネントを自動的にメモ化し、`useMemo` / `useCallback` の手動記述が不要になる[[12]](#参考リンク)。

```ts title="next.config.ts"
const nextConfig = {
  // React Compiler を有効化（デフォルトは無効）
  reactCompiler: true,
}

export default nextConfig
```

#### React 19.2 の新機能

Next.js 16 は React 19.2 を同梱し、以下の機能が利用可能になった[[12]](#参考リンク)。

- **View Transitions**: ナビゲーションや状態遷移時に要素をアニメーションする API
- **`useEffectEvent`**: Effect から非リアクティブなロジックを抽出するフック
- **`<Activity>`**: `display: none` で UI を隠しつつ状態を維持するコンポーネント

#### ルーティングの最適化

- **レイアウト重複排除**: 共通レイアウトを持つ複数の URL をプリフェッチする際、レイアウトが1回だけダウンロードされるようになった
- **差分プリフェッチ**: キャッシュにない部分のみをプリフェッチし、ネットワーク転送量を削減

#### 破壊的変更

| 変更 | 詳細 |
|---|---|
| Node.js 20.9+ 必須 | Node.js 18 はサポート外 |
| 同期 API の完全削除 | `params`, `searchParams`, `cookies()`, `headers()` 等は `await` 必須 |
| AMP サポート削除 | `useAmp` 等すべての AMP API が削除 |
| `next lint` コマンド削除 | ESLint / Biome を直接使用 |
| Parallel Routes の `default.js` 必須化 | すべてのスロットに明示的な `default.js` が必要 |
| `experimental.ppr` 削除 | `cacheComponents` に移行 |
| `middleware.ts` 非推奨 | `proxy.ts` に移行 |

### 10. Next.js のセルフホスティングと代替実装

#### OpenNext

OpenNext は、Next.js を Vercel 以外の環境でセルフホストするためのオープンソースアダプターである[[13]](#参考リンク)。

**課題**: Next.js は Remix や Astro とは異なり、セルフホスティングの公式サポートが限定的で、Vercel 以外の環境で全機能を動かすのが困難だった。

**仕組み**: Next.js のビルド出力を各プラットフォーム向けに変換する。

| プラットフォーム | メンテナー |
|---|---|
| AWS（Lambda） | SST コミュニティ |
| Cloudflare Workers | Cloudflare チーム |
| Netlify | Netlify チーム |

**特徴**:

- Next.js の全機能サポートを目指している
- NHS England、Udacity、Gymshark UK など多数の本番環境で稼働中
- SST、Cloudflare、Netlify の各チームが協力してメンテナンス

```bash
# AWS へのデプロイ例（SST 経由）
npx sst deploy
```

**Next.js 16 との関連**: Next.js 16 では Build Adapters API（alpha）が導入され、カスタムアダプターがビルドプロセスにフックできるようになった。これにより OpenNext のようなプロジェクトがより公式にサポートされる方向に進んでいる[[12]](#参考リンク)。

#### vinext

vinext は Cloudflare が 2026年2月に公開した、**Next.js の API サーフェスを Vite で再実装した**プロジェクトである[[14]](#参考リンク)。

**コンセプト**: 既存の Next.js アプリケーションをコード変更なしで移行可能な「ドロップインリプレースメント」を目指す。

| 比較項目 | vinext | Next.js 16 |
|---|---|---|
| ビルド時間 | 1.67秒 | 7.38秒 |
| バンドルサイズ | 72.9KB | 168.9KB |
| 基盤技術 | Vite 8 / Rolldown | Turbopack |

**対応する Next.js API**:

- Next.js 16 API の約 94% に対応
- App Router / Pages Router（ネストレイアウト、loading、error boundary）
- React Server Components（`use client` / `use server`）
- Server Actions
- ISR・キャッシュ
- Middleware / Proxy
- 33個の `next/*` モジュールを自動シム

**Traffic-aware Pre-Rendering（TPR）**: vinext 独自の実験的機能で、実際のトラフィックデータに基づいてページを事前レンダリングする。100,000ページのうちトラフィックの90%をカバーする約200ページのみを事前生成し、残りはオンデマンド SSR で処理する[[14]](#参考リンク)。

**導入方法**:

```bash
# 自動 CLI 移行
npx vinext init

# デプロイ（Cloudflare Workers）
vinext deploy
```

**注意点**: vinext は実験的ソフトウェアであり、2026年3月時点では本番環境での利用は慎重に検討する必要がある。AI（Claude）を活用して1週間で開発されたという経緯もあり、エッジケースでの互換性が未検証の部分がある。

#### OpenNext vs vinext の比較

| 観点 | OpenNext | vinext |
|---|---|---|
| アプローチ | Next.js のビルド出力を変換 | Next.js API を Vite で再実装 |
| Next.js 本体への依存 | あり（Next.js でビルド後に変換） | なし（独自ビルド） |
| 成熟度 | 本番稼働実績多数 | 実験的（2026年2月公開） |
| デプロイ先 | AWS / Cloudflare / Netlify | Cloudflare Workers（他も Nitro 経由で対応） |
| 互換性 | Next.js 全機能を目標 | Next.js API の約94% |
| ユースケース | Vercel 以外で Next.js をそのまま使いたい | Vite エコシステムで Next.js 互換の開発体験が欲しい |

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
12. [Next.js 16 | Next.js](https://nextjs.org/blog/next-16)
13. [OpenNext](https://opennext.js.org/)
14. [vinext — The Next.js API surface, reimplemented on Vite](https://vinext.io/)

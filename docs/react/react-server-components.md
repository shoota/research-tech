---
id: react-server-components
title: React Server Components / Server Actions 実践パターン
sidebar_position: 3
tags: [react, rsc, server-components, server-actions]
last_update:
  date: 2026-03-06
---

## 概要

React Server Components（RSC）と Server Actions の仕組み、メンタルモデル、および Next.js App Router を前提とした実践的な設計パターンを調査した。Server/Client Component の使い分け、データフェッチ戦略、フォーム処理、Composition パターン、パフォーマンス特性、制約と注意点を包括的にまとめる。

## 背景・動機

React 19 で Server Components と Server Actions が安定版となり、Next.js App Router がこれらの機能をフルサポートしている。従来の CSR や SSR とは異なるメンタルモデルが必要であり、Server/Client の境界設計を誤るとバンドルサイズの肥大化やパフォーマンス低下を招く。プロジェクトへの適用に向けて、正しい設計パターンと制約を整理する必要がある。

## 調査内容

### 1. RSC のメンタルモデル

#### 従来の SSR との違い

従来の SSR では、サーバーで HTML を生成した後、クライアント側で全コンポーネントを hydrate する。すべてのコンポーネントのコードがクライアントバンドルに含まれる[[1]](#参考リンク)。

RSC はこのモデルを根本的に変える。Server Component はサーバー上でのみ実行され、そのコードはクライアントに一切送信されない。レンダリング結果は RSC Payload と呼ばれるコンパクトなバイナリ形式でシリアライズされ、クライアントに送られる[[2]](#参考リンク)。

#### レンダリングフロー

1. **サーバー実行**: Server Component がサーバー上で実行され、データベースアクセスや API 呼び出しを直接行う
2. **シリアライズ**: レンダリング結果が RSC Payload にシリアライズされる。Client Component のプレースホルダーと JS ファイルへの参照も含まれる
3. **HTML 生成**: RSC Payload と Client Component のコードから HTML がプリレンダリングされる
4. **クライアント受信**: ブラウザは HTML を即座に表示し、RSC Payload で Server/Client Component ツリーを reconcile する
5. **Hydration**: Client Component にイベントハンドラがアタッチされ、インタラクティブになる

#### Server Component vs Client Component の使い分け

| 用途 | Server Component | Client Component |
|------|:---:|:---:|
| データフェッチ（DB、API）| ○ | - |
| シークレット（API キー等）へのアクセス | ○ | - |
| バンドルサイズの削減 | ○ | - |
| ストリーミング | ○ | - |
| state（useState, useReducer）| - | ○ |
| イベントハンドラ（onClick 等）| - | ○ |
| ライフサイクル（useEffect）| - | ○ |
| ブラウザ API（localStorage, window 等）| - | ○ |

Next.js App Router ではデフォルトですべてのコンポーネントが Server Component として扱われる。Client Component にするにはファイル先頭に `'use client'` ディレクティブを記述する[[2]](#参考リンク)。

### 2. データフェッチ戦略

#### サーバーでの直接フェッチ

Server Component は async/await を使って直接データを取得できる。

```tsx title="app/posts/page.tsx"
// Server Component（デフォルト）
import { getPost } from '@/lib/data'

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // サーバー上で直接データ取得。API エンドポイント不要
  const post = await getPost(id)

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
```

#### キャッシュ戦略

Next.js ではデフォルトで fetch リクエストはキャッシュされない。個別にキャッシュを有効化する[[3]](#参考リンク)。

```tsx title="app/page.tsx"
// 明示的にキャッシュを有効化
const data = await fetch('https://api.example.com/data', {
  cache: 'force-cache',
})

// 時間ベースの再検証（3600秒後に再検証）
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 3600 },
})

// タグベースのキャッシュ（オンデマンド再検証用）
const data = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] },
})
```

#### use cache ディレクティブによるキャッシュ

fetch 以外の処理（DB クエリ等）もキャッシュ可能。`cacheTag` でタグ付けし、オンデマンドで再検証できる[[3]](#参考リンク)。

```tsx title="app/lib/data.ts"
import { cacheTag } from 'next/cache'

export async function getProducts() {
  'use cache'
  cacheTag('products')

  // DB クエリの結果もキャッシュされる
  const products = await db.query('SELECT * FROM products')
  return products
}
```

#### 再検証（Revalidation）

キャッシュされたデータを更新する方法は複数ある[[3]](#参考リンク)。

```tsx title="app/lib/actions.ts"
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

// パスベースの再検証: 指定パスのキャッシュを無効化
export async function updatePost() {
  await db.posts.update(/* ... */)
  revalidatePath('/posts')
}

// タグベースの再検証: 指定タグのキャッシュを無効化
// 第2引数 'max' は profile オプションで、stale-while-revalidate セマンティクスを有効化する
export async function updateUser() {
  await db.users.update(/* ... */)
  revalidateTag('user', 'max')
}
```

#### React.cache によるリクエスト内メモ化

同一リクエスト内で同じデータ取得関数が複数回呼ばれる場合、`React.cache` で重複を排除できる[[2]](#参考リンク)。

```tsx title="app/lib/user.ts"
import { cache } from 'react'

// 同一リクエスト内では結果がメモ化される
export const getUser = cache(async () => {
  const res = await fetch('https://api.example.com/user')
  return res.json()
})
```

### 3. Server Actions の仕組みとフォーム処理パターン

#### Server Actions とは

Server Actions は `'use server'` ディレクティブでマークされた非同期関数で、クライアントからサーバーへのネットワークリクエストを通じて呼び出される。フォームの `action` プロパティに渡された場合、自動的に `FormData` オブジェクトを受け取る[[4]](#参考リンク)。

なお React 19 以降の用語では、`'use server'` でマークされた関数全体を **Server Function** と呼び、そのうち action コンテキストで使われるものを **Server Action** と呼ぶ[[4]](#参考リンク)。

#### 基本的なフォーム処理

```tsx title="app/actions.ts"
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  // FormData から値を取得
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  // バリデーション
  if (!title || !content) {
    return { error: 'タイトルと内容は必須です' }
  }

  // データベースに保存
  await db.posts.create({ title, content })

  // キャッシュ再検証とリダイレクト
  revalidatePath('/posts')
  redirect('/posts')
}
```

```tsx title="app/ui/post-form.tsx"
import { createPost } from '@/app/actions'

// Server Component からフォームを直接レンダリング
// Progressive Enhancement: JS 無効でも動作する
export function PostForm() {
  return (
    <form action={createPost}>
      <input type="text" name="title" placeholder="タイトル" />
      <textarea name="content" placeholder="内容" />
      <button type="submit">投稿</button>
    </form>
  )
}
```

#### useActionState によるフォーム状態管理

`useActionState` フックを使うと、送信中状態やエラー状態を宣言的に管理できる[[4]](#参考リンク)。

```tsx title="app/ui/create-post-form.tsx"
'use client'

import { useActionState } from 'react'
import { createPost } from '@/app/actions'

// 初期状態の型定義
type FormState = {
  error: string | null
  success: boolean
}

const initialState: FormState = { error: null, success: false }

export function CreatePostForm() {
  // state: サーバーからの戻り値, submitAction: フォームに渡す関数, isPending: 送信中フラグ
  const [state, submitAction, isPending] = useActionState(
    createPost,
    initialState
  )

  return (
    <form action={submitAction}>
      <input type="text" name="title" disabled={isPending} />
      <textarea name="content" disabled={isPending} />

      {state.error && <p className="error">{state.error}</p>}

      <button type="submit" disabled={isPending}>
        {isPending ? '送信中...' : '投稿'}
      </button>
    </form>
  )
}
```

#### useOptimistic による楽観的更新

ユーザー体験を向上させるため、サーバーレスポンスを待たずに UI を更新できる。

```tsx title="app/ui/like-button.tsx"
'use client'

import { useOptimistic } from 'react'
import { toggleLike } from '@/app/actions'

export function LikeButton({ likes, isLiked }: { likes: number; isLiked: boolean }) {
  // 楽観的状態: サーバー応答前に即座に UI を更新
  const [optimisticLikes, setOptimisticLikes] = useOptimistic(
    { likes, isLiked },
    (current, _newLike: boolean) => ({
      likes: current.isLiked ? current.likes - 1 : current.likes + 1,
      isLiked: !current.isLiked,
    })
  )

  async function handleLike() {
    setOptimisticLikes(!optimisticLikes.isLiked)
    await toggleLike()
  }

  return (
    <button onClick={handleLike}>
      {optimisticLikes.isLiked ? '♥' : '♡'} {optimisticLikes.likes}
    </button>
  )
}
```

#### イベントハンドラからの呼び出し

フォーム以外でも、イベントハンドラから Server Function を呼び出せる[[5]](#参考リンク)。

```tsx title="app/ui/like-button.tsx"
'use client'

import { incrementLike } from '@/app/actions'
import { useState } from 'react'

export default function LikeButton({ initialLikes }: { initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes)

  return (
    <button
      onClick={async () => {
        // Server Function をイベントハンドラから直接呼び出し
        const updatedLikes = await incrementLike()
        setLikes(updatedLikes)
      }}
    >
      いいね ({likes})
    </button>
  )
}
```

### 4. Composition パターン（Server/Client の境界設計）

#### 原則: use client はリーフに押し下げる

`'use client'` をラッパーやレイアウトに付けると、その子コンポーネントもすべて Client Component になってしまう。インタラクティブなボタンやフォーム入力など、末端のコンポーネントにのみ付与するのが原則[[1]](#参考リンク)。

```tsx title="app/layout.tsx"
// Layout は Server Component のまま
import Search from './search' // Client Component
import Logo from './logo'     // Server Component

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav>
        <Logo />
        {/* Search だけが Client Component。Layout や Logo はサーバーに留まる */}
        <Search />
      </nav>
      <main>{children}</main>
    </>
  )
}
```

```tsx title="app/search.tsx"
'use client'

// インタラクティブなコンポーネントだけに use client を付与
export default function Search() {
  // useState, イベントハンドラなどを使用
  return <input type="search" onChange={/* ... */} />
}
```

#### children パターン（Server Component を Client Component 内に配置）

Client Component の `children` として Server Component を渡すことで、サーバーレンダリングされた UI をクライアントコンポーネント内にネストできる[[2]](#参考リンク)。

```tsx title="app/ui/modal.tsx"
'use client'

// Client Component はスロットとして children を受け取る
export default function Modal({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <button onClick={() => setIsOpen(true)}>開く</button>
      {isOpen && <div className="modal">{children}</div>}
    </>
  )
}
```

```tsx title="app/page.tsx"
import Modal from './ui/modal'
import Cart from './ui/cart' // Server Component（DB からカート情報を取得）

export default function Page() {
  return (
    <Modal>
      {/* Cart は Server Component としてサーバーで事前レンダリングされる */}
      <Cart />
    </Modal>
  )
}
```

#### Context Provider パターン

React Context は Server Component では使えないが、Client Component の Provider で包むことで Server Component の子ツリーにもコンテキストを提供できる[[2]](#参考リンク)。

```tsx title="app/theme-provider.tsx"
'use client'

import { createContext } from 'react'

export const ThemeContext = createContext('light')

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
}
```

```tsx title="app/layout.tsx"
import ThemeProvider from './theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {/* Provider は可能な限り深い位置に配置し、静的部分の最適化を妨げない */}
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

#### Promise を Context で渡すパターン

Server Component でデータフェッチを開始し、その Promise を Client Component の Context 経由で渡すことで、ウォーターフォールを回避しながらクライアント側でもデータを利用できる[[2]](#参考リンク)。

```tsx title="app/layout.tsx"
import UserProvider from './user-provider'
import { getUser } from './lib/user'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // await しない。Promise をそのまま渡す
  const userPromise = getUser()

  return (
    <html>
      <body>
        <UserProvider userPromise={userPromise}>{children}</UserProvider>
      </body>
    </html>
  )
}
```

```tsx title="app/ui/profile.tsx"
'use client'

import { use, useContext } from 'react'
import { UserContext } from '../user-provider'

export function Profile() {
  const userPromise = useContext(UserContext)
  // use() で Promise を解決。Suspense と組み合わせる
  const user = use(userPromise!)

  return <p>ようこそ、{user.name}さん</p>
}
```

#### サードパーティコンポーネントのラップ

`'use client'` ディレクティブを持たないサードパーティのクライアント向けコンポーネントは、薄いラッパーで re-export する[[2]](#参考リンク)。

```tsx title="app/carousel.tsx"
'use client'

// サードパーティコンポーネントをクライアント境界でラップ
import { Carousel } from 'acme-carousel'
export default Carousel
```

### 5. パフォーマンス特性

#### ストリーミング SSR

Suspense 境界と組み合わせることで、HTML をチャンク単位でクライアントに送信できる。ユーザーはページ全体のレンダリング完了を待たずにコンテンツを閲覧開始できる[[6]](#参考リンク)。

```tsx title="app/dashboard/page.tsx"
import { Suspense } from 'react'
import { Analytics } from './analytics'
import { RecentPosts } from './recent-posts'

export default function Dashboard() {
  return (
    <div>
      <h1>ダッシュボード</h1>

      {/* 重要なコンテンツは先に表示される */}
      <Suspense fallback={<p>投稿を読み込み中...</p>}>
        <RecentPosts />
      </Suspense>

      {/* 重要度の低いコンテンツは後からストリーミング */}
      <Suspense fallback={<p>分析データを読み込み中...</p>}>
        <Analytics />
      </Suspense>
    </div>
  )
}
```

#### Selective Hydration

React 18 以降、Suspense と組み合わせることで Selective Hydration が有効になる。ページ全体の JS ダウンロード完了を待たずに hydration を開始でき、ユーザーが操作しようとしている部分を優先的に hydrate する[[6]](#参考リンク)。

実際のパフォーマンス改善事例では、hydration 時間が 150ms から 15ms に短縮されたという報告がある[[7]](#参考リンク)。

#### バンドルサイズの削減

Server Component のコードはクライアントに送信されないため、データ取得ロジックやバリデーションライブラリ、重い依存関係をサーバー側に閉じ込めることでバンドルサイズを大幅に削減できる。

### 6. 制約と注意点

#### シリアライズ可能性

Server Component から Client Component に渡す props は、React がシリアライズ可能な値に限られる[[2]](#参考リンク)。

**渡せるもの:**
- プリミティブ値（string, number, boolean, null, undefined）
- シリアライズ可能なオブジェクトと配列
- Date, Map, Set
- Server Function（`'use server'` でマーク済み）
- JSX（React 要素）
- Promise

**渡せないもの:**
- 関数（Server Function を除く）
- クラスインスタンス
- DOM ノード
- Symbol

#### use client ディレクティブの注意点

- `'use client'` はファイルの先頭（import より前）に記述する
- ファイル単位でクライアント境界を宣言する。関数単位では使えない
- `'use client'` ファイルから import されたモジュールもすべてクライアントバンドルに含まれる
- Server Component は Client Component を import できるが、Client Component は Server Component を import できない（children として渡すことは可能）

#### 環境汚染の防止

サーバー専用のコードがクライアントに漏れることを防ぐため、`server-only` パッケージを使用する[[2]](#参考リンク)。

```tsx title="lib/data.ts"
import 'server-only'

// このモジュールを Client Component から import するとビルドエラーになる
export async function getData() {
  const res = await fetch('https://external-service.com/data', {
    headers: {
      authorization: process.env.API_KEY!, // シークレットが含まれる
    },
  })
  return res.json()
}
```

#### セキュリティ

- Server Actions は自動的に POST メソッドで呼び出され、CSRF 保護が組み込まれている
- ただし、Server Function の引数は常にバリデーションすべき。クライアントから送られる値は信頼できない
- エラーメッセージに機密情報を含めない
- 認証・認可チェックを Server Function 内で必ず行う

## 検証結果

### Server Component でのデータフェッチ + Client Component でのインタラクション

最も基本的かつ推奨されるパターン。Server Component がデータ取得を行い、シリアライズ可能な props として Client Component に渡す。

```tsx title="app/posts/[id]/page.tsx"
// Server Component: データ取得を担当
import { getPost } from '@/lib/data'
import { LikeButton } from '@/app/ui/like-button'
import { CommentForm } from '@/app/ui/comment-form'

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPost(id)

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      <p>投稿日: {post.createdAt.toLocaleDateString('ja-JP')}</p>

      {/* インタラクティブな部分だけ Client Component */}
      <LikeButton postId={id} initialLikes={post.likes} />
      <CommentForm postId={id} />
    </article>
  )
}
```

### Server Action + useActionState によるフォーム処理

バリデーションエラーのハンドリングと送信中状態の管理を統合したパターン。

```tsx title="app/actions/comment.ts"
'use server'

import { revalidatePath } from 'next/cache'

type CommentState = {
  error: string | null
  success: boolean
}

export async function addComment(
  prevState: CommentState,
  formData: FormData
): Promise<CommentState> {
  const postId = formData.get('postId') as string
  const body = formData.get('body') as string

  // サーバー側バリデーション
  if (!body || body.trim().length === 0) {
    return { error: 'コメント内容を入力してください', success: false }
  }

  if (body.length > 1000) {
    return { error: 'コメントは1000文字以内で入力してください', success: false }
  }

  try {
    await db.comments.create({ postId, body: body.trim() })
    revalidatePath(`/posts/${postId}`)
    return { error: null, success: true }
  } catch (e) {
    return { error: '保存に失敗しました。再度お試しください。', success: false }
  }
}
```

```tsx title="app/ui/comment-form.tsx"
'use client'

import { useActionState, useRef, useEffect } from 'react'
import { addComment } from '@/app/actions/comment'

export function CommentForm({ postId }: { postId: string }) {
  const [state, submitAction, isPending] = useActionState(addComment, {
    error: null,
    success: false,
  })
  const formRef = useRef<HTMLFormElement>(null)

  // 投稿成功時にフォームをリセット
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
    }
  }, [state.success])

  return (
    <form ref={formRef} action={submitAction}>
      <input type="hidden" name="postId" value={postId} />
      <textarea
        name="body"
        placeholder="コメントを入力..."
        disabled={isPending}
        rows={3}
      />
      {state.error && <p style={{ color: 'red' }}>{state.error}</p>}
      {state.success && <p style={{ color: 'green' }}>投稿しました</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? '送信中...' : 'コメント投稿'}
      </button>
    </form>
  )
}
```

### Suspense によるストリーミング

重要度に応じた段階的な表示を実現する。

```tsx title="app/dashboard/page.tsx"
import { Suspense } from 'react'

// 各コンポーネントは独立した async Server Component
async function UserProfile() {
  const user = await getUser() // 50ms
  return <div>{user.name}</div>
}

async function RecentOrders() {
  const orders = await getRecentOrders() // 200ms
  return (
    <ul>
      {orders.map((order) => (
        <li key={order.id}>{order.title}</li>
      ))}
    </ul>
  )
}

async function Recommendations() {
  const items = await getRecommendations() // 500ms
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  )
}

export default function Dashboard() {
  return (
    <div>
      {/* 高速に返るものは Suspense なしで即表示 */}
      <Suspense fallback={<p>プロフィール読み込み中...</p>}>
        <UserProfile />
      </Suspense>

      {/* 中程度のレイテンシ */}
      <Suspense fallback={<p>注文履歴読み込み中...</p>}>
        <RecentOrders />
      </Suspense>

      {/* 低優先度。最後にストリーミングされる */}
      <Suspense fallback={<p>おすすめ読み込み中...</p>}>
        <Recommendations />
      </Suspense>
    </div>
  )
}
```

## まとめ

### 設計原則

1. **デフォルトは Server Component**: クライアント側のインタラクションが必要な場合にのみ `'use client'` を付与する
2. **use client はリーフに**: レイアウトやコンテナではなく、ボタンやフォーム入力など末端のコンポーネントに付与する
3. **children パターンの活用**: Client Component 内に Server Component をネストする場合は props（特に children）として渡す
4. **データフェッチはサーバーで**: API Route を介さず、Server Component 内で直接データを取得する
5. **Suspense で段階的表示**: データ取得の遅いコンポーネントを Suspense で包み、ストリーミング表示する

### プロジェクトへの適用可否

RSC と Server Actions は Next.js App Router を使うプロジェクトでは標準的なパターンとなっている。以下の条件に当てはまるプロジェクトで特に効果が高い。

- データ取得が多くインタラクティブ要素が少ないページ（ブログ、ダッシュボード、EC の商品一覧など）
- バンドルサイズの削減が求められるプロジェクト
- SEO とパフォーマンスの両立が必要なケース

既存プロジェクトへの導入は段階的に行い、データ量が多くインタラクションが少ないページから着手するのが推奨される。

## 参考リンク

1. [Making Sense of React Server Components - Josh W. Comeau](https://www.joshwcomeau.com/react/server-components/)
2. [Server and Client Components - Next.js](https://nextjs.org/docs/app/getting-started/server-and-client-components)
3. [Caching and Revalidating - Next.js](https://nextjs.org/docs/app/getting-started/caching-and-revalidating)
4. [Server Functions - React](https://react.dev/reference/rsc/server-functions)
5. [Updating Data (Server Actions and Mutations) - Next.js](https://nextjs.org/docs/app/getting-started/updating-data)
6. [New Suspense SSR Architecture in React 18 - React Working Group](https://github.com/reactwg/react-18/discussions/37)
7. [150ms to 15ms: Optimizing React Hydration with Progressive Enhancement](https://medium.com/better-dev-nextjs-react/150ms-to-15ms-optimizing-react-hydration-with-progressive-enhancement-92f87e974689)

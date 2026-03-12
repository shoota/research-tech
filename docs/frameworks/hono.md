---
id: hono
title: Hono - Web Standards ベースの超軽量マルチランタイムWebフレームワーク
sidebar_position: 3
tags: [hono, web-framework, edge-computing, cloudflare-workers, multi-runtime, typescript]
last_update:
  date: 2026-03-12
---

# Hono - Web Standards ベースの超軽量マルチランタイムWebフレームワーク

## 概要

Hono（炎）は、Web Standards の上に構築された軽量・高速な Web フレームワークである。Cloudflare Workers、Deno、Bun、Node.js をはじめ、あらゆる JavaScript ランタイムで動作するマルチランタイム対応と、gzip 約 4.5KB という超軽量サイズ、そしてファーストクラスの TypeScript サポートが特徴。2021年12月に Yusuke Wada 氏が開発を開始し、日本発の OSS としてグローバルに急成長している。

:::info 関連ドキュメント
- [vinext - Next.js API を Vite 上に再実装した実験的フレームワーク](../frameworks/vinext) - Cloudflare Workers 上のフレームワーク比較として
- [Astro 5 - コンテンツファーストのWebフレームワーク](../frameworks/astro5) - Islands Architecture の比較（HonoX も同アーキテクチャを採用）
:::

## 背景・動機

エッジコンピューティングの普及により、Cloudflare Workers や Deno Deploy 等のエッジランタイムで動作する軽量フレームワークの需要が高まっている。Express や Fastify は Node.js に強く依存しており、エッジ環境での利用が困難である。Hono は Web Standards（Fetch API、Request/Response）をベースにすることで、ランタイムに依存しない設計を実現し、この課題を解決している。

## 調査内容

### 技術的位置づけと競合比較

Hono はサーバーサイド Web フレームワークとして、Express や Fastify と同じレイヤーに位置するが、設計思想が根本的に異なる[[1]](#参考リンク)。

| 項目 | Express | Fastify | Hono |
|------|---------|---------|------|
| パッケージサイズ（min） | 572KB | 中程度 | **14KB以下**（hono/tiny） |
| gzip サイズ | - | - | **約4.5KB** |
| マルチランタイム | Node.js のみ | Node.js のみ | **全JSランタイム対応** |
| TypeScript サポート | 限定的 | 良好 | **ファーストクラス** |
| エッジ対応 | 非対応 | 非対応 | **ネイティブ対応** |

Cloudflare Workers 上のベンチマークでは、Hono は 402,820 ops/sec を記録し、sunder（297,036 ops/sec）や itty-router（212,598 ops/sec）を大きく上回る[[2]](#参考リンク)。

### 対応ランタイム・プラットフォーム

Hono は以下のランタイム・プラットフォームで動作する[[3]](#参考リンク)。

- **Cloudflare Workers / Pages** - `export default app` でそのまま動作。`c.env` で KV, R2, D1 等の Bindings にアクセス
- **Deno** - `Deno.serve(app.fetch)` で起動。Deno Deploy 対応
- **Bun** - `export default app` でそのまま動作。ホットリロード対応
- **Node.js** - `@hono/node-server` の `serve(app)` を使用。Node.js 18.14.1+
- **AWS Lambda** - `hono/aws-lambda` の `handle(app)` を使用。API Gateway / Function URL 対応
- **その他** - Fastly Compute, Vercel, Netlify, Azure Functions, Google Cloud Run, Service Workers

### コア API

#### Hono クラス

```typescript title="app.ts"
import { Hono } from 'hono'

// 型パラメータで環境変数と変数の型を定義
type Bindings = { DATABASE_URL: string }
type Variables = { user: { id: string; name: string } }

const app = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

// HTTP メソッドハンドラ
app.get('/hello', (c) => c.text('Hello Hono!'))
app.post('/posts', (c) => c.json({ created: true }, 201))

// 全メソッドにマッチ
app.all('/api/*', (c) => c.json({ method: c.req.method }))

// ミドルウェア登録
app.use('/*', async (c, next) => {
  console.log(`${c.req.method} ${c.req.path}`)
  await next()
})

// エラーハンドリング
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

// カスタム 404
app.notFound((c) => c.json({ error: 'Not Found' }, 404))
```

#### Context オブジェクト

各リクエストごとにインスタンス化され、レスポンス生成やリクエスト情報へのアクセスを提供する[[4]](#参考リンク)。

```typescript title="context-example.ts"
app.get('/users/:id', (c) => {
  // リクエスト情報
  const id = c.req.param('id')       // パスパラメータ
  const q = c.req.query('search')     // クエリパラメータ
  const ua = c.req.header('User-Agent') // ヘッダー

  // レスポンス生成
  return c.json({ id, q, ua })  // application/json
  // c.text('hello')             // text/plain
  // c.html('<h1>hello</h1>')    // text/html
  // c.redirect('/other')        // 302リダイレクト
})

// リクエストスコープの変数共有
app.use('/admin/*', async (c, next) => {
  c.set('user', { id: '1', name: 'admin' })
  await next()
})
app.get('/admin/profile', (c) => {
  const user = c.get('user') // 型安全にアクセス
  return c.json(user)
})
```

### ルーティング

パスパラメータ、正規表現制約、ワイルドカード、オプショナルパラメータに対応する[[5]](#参考リンク)。

```typescript title="routing-example.ts"
// 基本的なパスパラメータ
app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }))

// 正規表現制約
app.get('/posts/:date{[0-9]+}/:title{[a-z]+}', (c) => {
  const { date, title } = c.req.param()
  return c.json({ date, title })
})

// オプショナルパラメータ
app.get('/api/animals/:type?', (c) => {
  const type = c.req.param('type') ?? 'all'
  return c.json({ type })
})

// ワイルドカード
app.get('/static/*', (c) => c.text('Static file'))

// グルーピング（サブアプリ）
const usersApp = new Hono()
usersApp.get('/', (c) => c.json([]))
usersApp.get('/:id', (c) => c.json({ id: c.req.param('id') }))
app.route('/users', usersApp)

// ベースパス
const api = new Hono().basePath('/api/v1')
```

### ルーター実装

Hono は用途に応じて5種類のルーターを提供する[[6]](#参考リンク)。

| ルーター | 特徴 | 用途 |
|---------|------|------|
| **SmartRouter** | RegExpRouter と TrieRouter を動的に切替 | デフォルト（自動最適化） |
| **RegExpRouter** | 全ルートを1つの正規表現にコンパイル。最速 | パフォーマンス最優先 |
| **TrieRouter** | トライ木アルゴリズム。全パターン対応 | 汎用的な用途 |
| **LinearRouter** | ルート登録が高速 | ワンショット環境（Cloudflare Workers等） |
| **PatternRouter** | 15KB 未満の超小型実装 | リソース制限環境 |

### ミドルウェア

オニオン構造で、`next()` の前がリクエスト処理、後がレスポンス処理となる[[7]](#参考リンク)。

```typescript title="middleware-example.ts"
// カスタムミドルウェア（レスポンスタイム計測）
app.use(async (c, next) => {
  const start = performance.now()
  await next()
  const ms = performance.now() - start
  c.res.headers.set('X-Response-Time', `${ms.toFixed(0)}ms`)
})
```

**主要な組み込みミドルウェア:**

| カテゴリ | ミドルウェア |
|---------|-------------|
| 認証 | Basic Auth, Bearer Auth, JWT Auth |
| セキュリティ | CORS, CSRF Protection, Secure Headers |
| パフォーマンス | Cache, Compress, ETag |
| ログ・監視 | Logger, Timing, Request ID |
| その他 | Body Limit, Cookie, Session, JSX Renderer |

```typescript title="builtin-middleware.ts"
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { bearerAuth } from 'hono/bearer-auth'

// 組み込みミドルウェアの使用例
app.use('/*', logger())
app.use('/api/*', cors({ origin: 'https://example.com' }))
app.use('/admin/*', bearerAuth({ token: 'my-secret-token' }))
```

### RPC - 型安全な API クライアント

サーバーの型定義をクライアントと共有し、型安全な API 通信を実現する Hono 独自の機能[[8]](#参考リンク)。

```typescript title="server.ts"
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

// ルート定義（チェーンメソッドで型を保持）
const route = app
  .get('/posts', (c) => c.json([{ id: 1, title: 'Hello' }]))
  .post(
    '/posts',
    zValidator('json', z.object({
      title: z.string(),
      body: z.string(),
    })),
    (c) => {
      const data = c.req.valid('json')
      return c.json({ ok: true, post: data }, 201)
    }
  )

// 型をエクスポート
export type AppType = typeof route
```

```typescript title="client.ts"
import { hc } from 'hono/client'
import type { AppType } from './server'

// 型安全なクライアント生成
const client = hc<AppType>('http://localhost:8787/')

// パス・メソッド・リクエストボディ・レスポンスすべてが型安全
const res = await client.posts.$post({
  json: { title: 'Hello', body: 'World' },
})
if (res.ok) {
  const data = await res.json() // { ok: boolean, post: { title: string, body: string } }
}

// URL生成
const url = client.posts.$url() // URL オブジェクト
```

### テスト

`app.request()` メソッドにより、サーバーを起動せずにリクエスト/レスポンスをテストできる[[9]](#参考リンク)。

```typescript title="app.test.ts"
import { describe, it, expect } from 'vitest'

describe('Posts API', () => {
  it('GET /posts は投稿一覧を返す', async () => {
    const res = await app.request('/posts')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })

  it('POST /posts は新しい投稿を作成する', async () => {
    const res = await app.request('/posts', {
      method: 'POST',
      body: JSON.stringify({ title: 'New', body: 'Content' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
  })

  it('環境変数をモックできる', async () => {
    const res = await app.request('/posts', {}, { DATABASE_URL: 'mock://db' })
    expect(res.status).toBe(200)
  })
})
```

### ベストプラクティス

公式ドキュメントで推奨されているパターン[[10]](#参考リンク):

1. **コントローラーパターンを避ける** - ハンドラーを分離するとパスパラメータの型推論が失われる。ルート定義に直接ハンドラーを書く
2. **Factory パターンを活用** - 分離が必要な場合は `hono/factory` の `createHandlers()` を使用
3. **大規模アプリの構成** - 機能ごとに `new Hono()` を作成し、`app.route()` で結合
4. **RPC 型の共有** - チェーンメソッドでルートを定義して正確な型推論を得る

### エコシステム

#### サードパーティミドルウェア

豊富なサードパーティミドルウェアがエコシステムを形成している[[11]](#参考リンク)。

| カテゴリ | 主なパッケージ |
|---------|--------------|
| **認証** | Auth.js, Clerk Auth, Firebase Auth, OIDC Auth |
| **バリデーション** | Zod Validator, Valibot Validator, TypeBox Validator, ArkType Validator |
| **OpenAPI** | Zod OpenAPI, Swagger UI, Scalar, Hono OpenAPI |
| **監視** | OpenTelemetry, Prometheus Metrics, Sentry |
| **サーバー連携** | GraphQL Server, tRPC Server |

#### Hono Stacks

Hono + Zod + Zod Validator + hc（RPC クライアント）の組み合わせで、フルスタックアプリケーションを型安全に構築するコンセプト[[12]](#参考リンク)。

#### HonoX

Hono + Vite ベースのメタフレームワーク。ファイルベースルーティング、高速 SSR、Islands アーキテクチャ（選択的ハイドレーション）に対応する。現在 alpha ステージ（v0.1.52）、GitHub Stars 約 2,800[[13]](#参考リンク)。

### Hono RPC vs tRPC

Hono RPC と tRPC はどちらも End-to-End の型安全性を提供するが、アプローチが異なる[[19]](#参考リンク)。

| 項目 | Hono RPC | tRPC |
|------|----------|------|
| アーキテクチャ | REST 互換。HTTP メソッド・ステータスコードをそのまま使用 | プロシージャベース。独自のプロトコル層 |
| 型安全性の実現 | `typeof route` で型を推論・エクスポート | Router 定義から型を推論 |
| ステータスコード型 | ステータスコードごとの型分岐が可能 | ステータスコードの型区別なし |
| クライアント統合 | 独自の `hc` クライアント | TanStack Query との深い統合 |
| パフォーマンス | Bun 環境で 253,646 req/s | Express + tRPC で 25,079 req/s |
| IDE パフォーマンス | 50-100 エンドポイントで影響あり | 比較的安定 |

**選択基準:**
- **大規模 React アプリ + TanStack Query** → tRPC（サブスクリプション・バッチリクエスト・楽観的更新が強力）
- **エッジデプロイ + REST 互換 + マルチランタイム** → Hono RPC（OpenAPI 統合も容易）

**Hono RPC の IDE パフォーマンス問題の回避策:**

```typescript title="大規模アプリでの分割パターン"
// 機能ごとにサブアプリを分割し、型推論の負荷を軽減
const usersApp = new Hono()
  .get('/', (c) => c.json([]))
  .post('/', zValidator('json', createUserSchema), (c) => c.json({ ok: true }))

const postsApp = new Hono()
  .get('/', (c) => c.json([]))
  .get('/:id', (c) => c.json({ id: c.req.param('id') }))

// メインアプリで結合
const app = new Hono()
  .route('/users', usersApp)
  .route('/posts', postsApp)

export type AppType = typeof app
```

### Express からの移行

Express から Hono への移行は、API の互換性がないため段階的に行うのが推奨される[[20]](#参考リンク)。

**主な変更点:**

```typescript title="Express → Hono の対応関係"
// Express: (req, res, next) パターン
app.get('/users/:id', (req, res) => {
  const id = req.params.id
  const q = req.query.search
  res.json({ id, q })
})

// Hono: Context ベース
app.get('/users/:id', (c) => {
  const id = c.req.param('id')
  const q = c.req.query('search')
  return c.json({ id, q })
})
```

**移行時の注意点:**
- Express ミドルウェアは直接使用不可（Hono 版への書き直しが必要）
- `req.body` は `c.req.json()` / `c.req.parseBody()` に変更（非同期）
- レスポンスは `return` で返す（`res.send()` / `res.json()` ではない）

**パフォーマンス改善の実測値:**
- リクエスト/秒: **961% 向上**
- メモリ使用量: **59% 削減**
- コールドスタート: **87% 高速化**

**段階的移行アプローチ:**
1. 新規 API エンドポイントを Hono で実装
2. ミドルウェアを Hono 版に移行
3. 既存エンドポイントを段階的に移行
4. Node.js アダプターからエッジランタイムへ移行（必要に応じて）

### Hono + OpenAPI / Swagger

`@hono/zod-openapi` を使うことで、バリデーションと OpenAPI スキーマ生成を統合できる[[21]](#参考リンク)。

```typescript title="openapi-example.ts"
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

const app = new OpenAPIHono()

// ルート定義（スキーマとドキュメントを同時に定義）
const route = createRoute({
  method: 'get',
  path: '/users/{id}',
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'ユーザーID', example: '123' }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({
        id: z.string(),
        name: z.string(),
      })}},
      description: 'ユーザー情報',
    },
    404: { description: 'ユーザーが見つからない' },
  },
})

app.openapi(route, (c) => {
  const { id } = c.req.valid('param')
  return c.json({ id, name: 'Hono User' })
})

// OpenAPI ドキュメントエンドポイント
app.doc('/doc', { openapi: '3.0.0', info: { title: 'My API', version: '1.0.0' } })

// Swagger UI
import { swaggerUI } from '@hono/swagger-ui'
app.get('/ui', swaggerUI({ url: '/doc' }))
```

### セキュリティ機能

Hono は組み込みミドルウェアで主要なセキュリティ機能を提供する[[22]](#参考リンク)。

```typescript title="security-example.ts"
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { secureHeaders } from 'hono/secure-headers'
import { jwt } from 'hono/jwt'
import { rateLimiter } from 'hono-rate-limiter'

const app = new Hono()

// Secure Headers（XSS, Clickjacking 等の対策）
app.use('/*', secureHeaders())

// CORS（厳密なオリジン制御）
app.use('/api/*', cors({
  origin: ['https://app.example.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// CSRF Protection
app.use('/api/*', csrf({ origin: 'https://app.example.com' }))

// JWT 認証
app.use('/api/protected/*', jwt({ secret: 'my-secret' }))

// Rate Limiting（サードパーティ）
app.use('/api/*', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15分
  limit: 100,
  keyGenerator: (c) => c.req.header('CF-Connecting-IP') ?? 'unknown',
}))
```

### プロダクション採用事例

Hono の採用はエッジ環境を中心に急速に拡大している[[16]](#参考リンク)[[23]](#参考リンク)。

| 企業・プロジェクト | 用途 | ランタイム |
|-------------------|------|-----------|
| **Cloudflare** | D1 内部 API、Workers Logs、KV/Queues 内部 API | Cloudflare Workers |
| **Unkey** | API キー管理プラットフォーム | Cloudflare Workers |
| **Nodecraft** | ゲームサーバーホスティング API | Cloudflare Workers |
| **Portkey AI** | AI ゲートウェイ | Node.js |
| **OpenStatus** | オープンソース監視プラットフォーム | Cloudflare Workers |
| **CyberAgent** | 社内プロジェクト | 複数ランタイム |

AI/LLM 関連での新規採用も目立ち、MCP サーバーや API ゲートウェイとしての利用が増加している。

### トレンドと採用状況

**数値指標（2026年3月時点）**[[14]](#参考リンク):
- GitHub Stars: **約 29,300**
- npm 週間ダウンロード: **約 930万**
- npm 月間成長率: **26.6%**（競合フレームワークの中で最速）

**State of JavaScript 2025** では、バックエンドフレームワーク部門で満足度トップクラスの新規エントリーとして記録されている[[15]](#参考リンク)。

### コミュニティ

**作者**: Yusuke Wada（yusukebe）- Cloudflare Developer Advocate。「Hono はあくまでオープンソースプロダクトであり、Cloudflare の製品ではない」と明言[[16]](#参考リンク)。

**主要コントリビューター**: Taku Amano 氏が RegExpRouter、SmartRouter、LinearRouter、PatternRouter を開発。200名以上のコントリビューターが参加。

**日本発 OSS としての特徴**: 「炎（Hono）」という日本語名。2024年6月に東京で初の Hono Conference を開催（100名参加）。JSConf JP 2023 で登壇。国際的に広く使われるグローバル OSS に成長しつつ、日本のエンジニアコミュニティとも強い繋がりを持つ[[17]](#参考リンク)。

### 最新動向（v4.8〜v4.12）

#### v4.12.0（2026年初頭）[[18]](#参考リンク)
- `hc` クライアントに `$path()` メソッド追加
- Basic Auth に `onAuthSuccess` コールバック追加
- `getConnInfo` が AWS Lambda、Cloudflare Pages、Netlify に対応
- `ApplyGlobalResponse` 型ヘルパー追加
- ルーターとコンテキストのパフォーマンス改善

#### v4.8.0
- `hono/tiny` パッケージが約800バイト削減、約11KB（gzip: 4.5KB）に
- ルートヘルパー関数の追加
- 静的サイト生成の強化

## 検証結果

### 基本的な Hono アプリケーション（Cloudflare Workers）

```typescript title="src/index.ts"
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

// 型付き環境変数
type Env = {
  Bindings: {
    DB: D1Database
  }
}

const app = new Hono<Env>()

// ミドルウェアの適用
app.use('/*', logger())
app.use('/api/*', cors())

// スキーマ定義
const createPostSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1),
})

// ルート定義（チェーンで型を保持）
const route = app
  .get('/api/posts', async (c) => {
    const db = c.env.DB
    const posts = await db.prepare('SELECT * FROM posts').all()
    return c.json(posts.results)
  })
  .post('/api/posts', zValidator('json', createPostSchema), async (c) => {
    const { title, body } = c.req.valid('json')
    const db = c.env.DB
    await db.prepare('INSERT INTO posts (title, body) VALUES (?, ?)').bind(title, body).run()
    return c.json({ ok: true }, 201)
  })
  .get('/api/posts/:id', async (c) => {
    const id = c.req.param('id')
    const db = c.env.DB
    const post = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first()
    if (!post) return c.notFound()
    return c.json(post)
  })

// 型エクスポート（RPC用）
export type AppType = typeof route
export default app
```

### RPC クライアント側の利用例

```typescript title="client/api.ts"
import { hc } from 'hono/client'
import type { AppType } from '../src/index'

// 型安全な API クライアント
const client = hc<AppType>('https://api.example.com/')

// GET /api/posts - レスポンス型が自動推論される
const posts = await client.api.posts.$get()
const data = await posts.json()

// POST /api/posts - リクエストボディの型チェック
const res = await client.api.posts.$post({
  json: { title: 'Hono入門', body: 'Honoは高速です' },
})

// GET /api/posts/:id - パスパラメータも型安全
const post = await client.api.posts[':id'].$get({
  param: { id: '1' },
})
```

### テストコード

```typescript title="src/index.test.ts"
import { describe, it, expect } from 'vitest'
import app from './index'

describe('Posts API', () => {
  const mockDB = {
    prepare: () => ({
      all: () => Promise.resolve({ results: [{ id: 1, title: 'Test' }] }),
      bind: () => ({
        run: () => Promise.resolve(),
        first: () => Promise.resolve({ id: 1, title: 'Test', body: 'Content' }),
      }),
    }),
  }

  it('GET /api/posts', async () => {
    const res = await app.request('/api/posts', {}, { DB: mockDB })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
  })

  it('POST /api/posts with invalid body returns 400', async () => {
    const res = await app.request('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ title: '' }), // バリデーションエラー
      headers: { 'Content-Type': 'application/json' },
    }, { DB: mockDB })
    expect(res.status).toBe(400)
  })
})
```

## まとめ

Hono は「エッジコンピューティング時代の Express」と呼べるフレームワークである。主な強みは以下の通り:

- **超軽量・高速**: gzip 4.5KB で Express の数倍のパフォーマンス
- **マルチランタイム**: 一度書けばどのランタイムでも動作する移植性
- **型安全**: TypeScript ファーストクラスサポートと RPC による End-to-End 型安全性
- **豊富なエコシステム**: 認証・バリデーション・OpenAPI 等の充実したミドルウェア群
- **活発なコミュニティ**: npm 週間 930万DL、GitHub Stars 29,300超

一方で留意点もある:

- Node.js 固有の機能（ストリーム、ファイルシステム等）は直接使えず、アダプター経由が必要
- Express ミドルウェアは直接使用不可。Hono 版への書き直しが必要
- RPC の型推論は 50-100 エンドポイント規模で IDE パフォーマンスに影響する場合がある（アプリ分割で回避可能）
- HonoX はまだ alpha で、フルスタックフレームワークとしては成熟途上

Cloudflare Workers や Deno Deploy 等のエッジ環境での API 開発には最適な選択肢であり、Node.js 環境でも Express からの移行先として有力（実測で req/s 961% 向上、メモリ 59% 削減）。TypeScript との親和性と RPC 機能により、フロントエンドとバックエンドの型安全な統合が求められるプロジェクトに適している。OpenAPI 統合、セキュリティミドルウェア、AI/LLM 関連での採用拡大も注目すべきポイントである。

## 参考リンク

1. [Hono vs Fastify - Better Stack Community](https://betterstack.com/community/guides/scaling-nodejs/hono-vs-fastify/)
2. [Hono - Benchmarks](https://hono.dev/docs/concepts/benchmarks)
3. [Hono - Getting Started](https://hono.dev/docs/getting-started/basic)
4. [Hono - Context API](https://hono.dev/docs/api/context)
5. [Hono - Routing](https://hono.dev/docs/api/routing)
6. [Hono - Routers](https://hono.dev/docs/concepts/routers)
7. [Hono - Middleware](https://hono.dev/docs/concepts/middleware)
8. [Hono - RPC](https://hono.dev/docs/guides/rpc)
9. [Hono - Testing](https://hono.dev/docs/guides/testing)
10. [Hono - Best Practices](https://hono.dev/docs/guides/best-practices)
11. [Hono - Third-party Middleware](https://hono.dev/docs/middleware/third-party)
12. [Hono - Stacks](https://hono.dev/docs/concepts/stacks)
13. [HonoX - GitHub](https://github.com/honojs/honox)
14. [npm trends - Hono](https://npmtrends.com/hono)
15. [State of JavaScript 2025 - Backend Frameworks](https://2025.stateofjs.com/en-US/libraries/back-end-frameworks/)
16. [The story of web framework Hono - Cloudflare Blog](https://blog.cloudflare.com/the-story-of-web-framework-hono-from-the-creator-of-hono/)
17. [Findy Engineer Lab - yusukebe インタビュー](https://findy-code.io/engineer-lab/yusukebe)
18. [Hono Releases - GitHub](https://github.com/honojs/hono/releases)
19. [tRPC vs Hono RPC 比較](https://hono.dev/docs/guides/rpc)
20. [Express to Hono Migration](https://betterstack.com/community/guides/scaling-nodejs/hono-vs-fastify/)
21. [@hono/zod-openapi - npm](https://www.npmjs.com/package/@hono/zod-openapi)
22. [Hono - Security Middleware](https://hono.dev/docs/middleware/builtin/secure-headers)
23. [Hono Adopters](https://github.com/honojs/hono/discussions)

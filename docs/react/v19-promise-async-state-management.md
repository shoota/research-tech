---
id: react-v19-promise-async-state-management
title: React v19のPromiseとAsync Reactによる状態管理の変革
description: "React v19のuseフック、Actions、useActionState、useOptimisticなど新プリミティブによる非同期データ取得と状態管理パラダイムの変化を調査。"
sidebar_position: 1
last_update:
  date: 2026-03-05
---

# React v19のPromiseとAsync Reactによる状態管理の変革

## 概要

React v19で導入された `use` フック、Actions、`useActionState`、`useOptimistic`、`useTransition` の非同期拡張、およびServer Componentsの正式サポートにより、非同期データ取得と状態管理のパラダイムがどのように変化したかを調査した[[1]](#参考リンク)。

## 背景・動機

React v16〜v18の時代、非同期データ取得は `useEffect` + `useState` パターンが主流だった。しかしこのアプローチにはウォーターフォール問題、レースコンディション、煩雑なローディング/エラー状態管理といった根本的な課題があった。React v19はこれらの課題を「Promiseをファーストクラス市民として扱う」という設計思想で解決しようとしている。本調査ではv19の新プリミティブ群がもたらす具体的な変化を整理する。

## 調査内容

### 1. React v19以前（v16〜v18）の非同期データ取得と状態管理

#### useEffect + useState パターンの課題

v16〜v18において標準的だったデータ取得パターンは以下のようなものだった。

```tsx title="従来のパターン: useEffect + useState"
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchUser(userId)
      .then((data) => {
        if (!cancelled) {
          setUser(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true; // レースコンディション対策のクリーンアップ
    };
  }, [userId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <div>{user?.name}</div>;
}
```

このパターンには以下の問題がある。

**ウォーターフォール問題**: 親コンポーネントがデータ取得→レンダリング→子コンポーネントがデータ取得、という直列実行になる。ネットワークが遅い場合、並列取得と比較して大幅に遅くなる。

```tsx title="ウォーターフォールの例"
// 親がレンダリングされてから子のuseEffectが走る = 直列実行
function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser().then(setUser);
  }, []);

  if (!user) return <Spinner />;
  return <Orders userId={user.id} />; // ここで初めてOrdersのuseEffectが走る
}

function Orders({ userId }: { userId: string }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetchOrders(userId).then(setOrders);
  }, [userId]);

  // ...
}
```

**レースコンディション**: `userId` が高速に変更された場合、古いリクエストの結果が新しいリクエストの結果を上書きする可能性がある。`cancelled` フラグや `AbortController` による手動対策が必要。

**ボイラープレートの多さ**: 1つのデータ取得に対して `data`, `loading`, `error` の3つの `useState` とクリーンアップロジックが必要になり、コンポーネントが肥大化する。

#### React v18のSuspenseの初期サポート

React v18では `Suspense` が限定的にサポートされていたが、主に `React.lazy()` によるコード分割用途に留まっていた。データ取得でのSuspense利用は「実験的」とされ、Relay等の特定フレームワーク経由でのみ推奨されていた[[6]](#参考リンク)。

---

### 2. React v19の新しいプリミティブ

#### `use` フック: Promiseとコンテキストを読み取る新API

`use` はReact v19で導入された新しいAPIで、Promise やコンテキストをレンダリング中に読み取ることができる[[2]](#参考リンク)。最大の特徴は、**従来のフックルールに縛られず、条件分岐やループ内でも呼び出せる**点にある[[2]](#参考リンク)。

```tsx title="use() によるデータ取得"
import { use, Suspense } from 'react';

function Comments({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  // Promiseが解決されるまでSuspenseにサスペンドする
  const comments = use(commentsPromise);
  return (
    <ul>
      {comments.map(comment => (
        <li key={comment.id}>{comment.text}</li>
      ))}
    </ul>
  );
}

function Page({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  return (
    <Suspense fallback={<div>コメントを読み込み中...</div>}>
      <Comments commentsPromise={commentsPromise} />
    </Suspense>
  );
}
```

条件分岐内での利用例:

```tsx title="条件分岐内でのuse()"
import { use } from 'react';
import ThemeContext from './ThemeContext';

function Heading({ children }: { children: React.ReactNode }) {
  if (children == null) {
    return null; // 早期リターン
  }

  // useContextではこの位置（条件分岐の後）では使えないが、use()は可能
  const theme = use(ThemeContext);
  return <h1 style={{ color: theme.color }}>{children}</h1>;
}
```

**重要な制約**: `use` に渡すPromiseはレンダリング中に生成してはならない。Server ComponentからClient Componentに渡されたPromise、またはSuspense対応ライブラリから取得したPromiseを使用する必要がある[[2]](#参考リンク)。

#### Actions: 非同期処理を宣言的に扱う仕組み

React v19では「Action」という概念が導入された[[1]](#参考リンク)。Actionとは、`useTransition` 内の非同期関数、`<form>` の `action` 属性に渡す関数などを指す。Actionsは以下を自動的に提供する[[10]](#参考リンク):

- **Pending状態**: リクエスト開始時に自動的にtrueになり、最終的な状態更新がコミットされたらfalseにリセットされる
- **楽観的更新**: `useOptimistic` との統合で、リクエスト中にユーザーに即座にフィードバックを提供
- **エラーハンドリング**: リクエスト失敗時にError Boundaryを表示し、楽観的更新を自動的にロールバック

```tsx title="form の action 属性を使った例"
<form action={submitAction}>
  <input type="text" name="name" />
  <button type="submit">送信</button>
</form>
```

```tsx title="useFormStatus でフォーム状態を取得"
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>送信</button>;
}
```

#### `useActionState`: サーバーアクションの状態管理

`useActionState` はActionの結果（状態、Pending状態、エラー）を一括管理するフック[[3]](#参考リンク)。従来の `isLoading`, `hasError`, `isSuccess` といった複数の `useState` を1つに集約する。

```tsx title="useActionState の使用例"
import { useActionState } from 'react';

function ChangeName({ name, setName }: { name: string; setName: (n: string) => void }) {
  const [error, submitAction, isPending] = useActionState(
    async (previousState: string | null, formData: FormData) => {
      const error = await updateName(formData.get("name") as string);
      if (error) {
        return error;
      }
      redirect("/path");
      return null;
    },
    null, // 初期状態
  );

  return (
    <form action={submitAction}>
      <input type="text" name="name" />
      <button type="submit" disabled={isPending}>更新</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

#### `useOptimistic`: 楽観的更新のサポート

`useOptimistic` は、非同期処理の完了を待たずにUIを即座に更新し、処理が完了またはエラーになった時点で実際の値に切り替えるフック[[4]](#参考リンク)。

```tsx title="useOptimistic の使用例"
import { useOptimistic } from 'react';

function ChangeName({ currentName, onUpdateName }: {
  currentName: string;
  onUpdateName: (name: string) => void;
}) {
  const [optimisticName, setOptimisticName] = useOptimistic(currentName);

  const submitAction = async (formData: FormData) => {
    const newName = formData.get("name") as string;
    setOptimisticName(newName); // 即座にUIを更新
    const updatedName = await updateName(newName); // サーバーに送信
    onUpdateName(updatedName); // 実際の値で更新
  };

  return (
    <form action={submitAction}>
      <p>あなたの名前: {optimisticName}</p>
      <label>
        名前を変更:
        <input
          type="text"
          name="name"
          disabled={currentName !== optimisticName}
        />
      </label>
    </form>
  );
}
```

#### `useTransition` の拡張: 非同期関数のサポート

React v18の `useTransition` は同期的なコールバックしか受け付けなかったが、v19では非同期関数を渡せるようになった[[5]](#参考リンク) [[16]](#参考リンク)。これにより `isPending` の手動管理が不要になる。

```tsx title="v18以前: 手動でのPending状態管理"
function UpdateName() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async () => {
    setIsPending(true);
    const error = await updateName(name);
    setIsPending(false);
    if (error) {
      setError(error);
      return;
    }
    redirect("/path");
  };

  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={handleSubmit} disabled={isPending}>更新</button>
      {error && <p>{error}</p>}
    </div>
  );
}
```

```tsx title="v19: useTransition による自動管理"
function UpdateName() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      const error = await updateName(name);
      if (error) {
        setError(error);
        return;
      }
      redirect("/path");
    });
  };

  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={handleSubmit} disabled={isPending}>更新</button>
      {error && <p>{error}</p>}
    </div>
  );
}
```

`isPending` は非同期処理の開始時に自動的に `true` になり、完了時に `false` にリセットされる[[5]](#参考リンク) [[12]](#参考リンク)。`setIsPending(true)` / `setIsPending(false)` の手動呼び出しが不要になった。

---

### 3. Suspenseの進化

#### React v19でのSuspenseの正式サポート

React v19ではSuspenseが「遅延ロードの補助」から「非同期レンダリングの中核的な調整メカニズム」へと昇格した[[6]](#参考リンク) [[13]](#参考リンク)。Suspenseはローディング機能ではなく、レンダリング調整メカニズムである。コンポーネントが「まだレンダリングの準備ができていない」とReactに伝えると、Reactはそのツリー部分のレンダリングを一時停止し、データが利用可能になるまでfallback UIを表示する[[6]](#参考リンク)。

#### Suspenseと`use()`の組み合わせパターン

```tsx title="Suspense + use() + ErrorBoundary の完全パターン"
import { use, Suspense } from 'react';

// リソースを事前に生成（Render-as-you-Fetch パターン）
let userPromise: Promise<User>;
let ordersPromise: Promise<Order[]>;

function createResources() {
  userPromise = fetchUser();
  // チェーンによりウォーターフォールを回避しつつ依存関係を表現
  ordersPromise = userPromise.then(user => fetchOrders(user.id));
}

function UserProfile() {
  const user = use(userPromise);
  return <h2>{user.name}</h2>;
}

function OrderList() {
  const orders = use(ordersPromise);
  return (
    <ul>
      {orders.map(order => (
        <li key={order.id}>{order.title}</li>
      ))}
    </ul>
  );
}

function Dashboard() {
  return (
    <ErrorBoundary fallback={<p>エラーが発生しました</p>}>
      <Suspense fallback={<ProfileSkeleton />}>
        <UserProfile />
      </Suspense>
      <Suspense fallback={<OrderSkeleton />}>
        <OrderList />
      </Suspense>
    </ErrorBoundary>
  );
}
```

このパターンでは:

- `UserProfile` と `OrderList` は「ハッピーパス」のロジックだけに集中
- ローディング状態は `Suspense` 境界が宣言的に処理
- エラー状態は `ErrorBoundary` が宣言的に処理
- 各コンポーネントは `loading`, `error` の `useState` を持たない

#### Suspense境界でのエラーハンドリング（ErrorBoundary連携）

React v19ではエラーハンドリングも改善された[[1]](#参考リンク)。v18以前ではエラーが二重にスローされていたが（元のエラー + 自動回復失敗時のエラー）、v19では重複が排除された[[1]](#参考リンク)。

```tsx title="ErrorBoundary クラスコンポーネント"
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  handleRetry = () => {
    this.setState({ error: null });
    createResources(); // リソースを再生成してリトライ
  };

  render() {
    if (this.state.error) {
      return (
        <div>
          <p>エラーが発生しました: {this.state.error.message}</p>
          <button onClick={this.handleRetry}>リトライ</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

`Suspense` 内で `use()` に渡したPromiseがrejectされると、そのエラーは最も近い `ErrorBoundary` に伝播する[[11]](#参考リンク)。これにより、各コンポーネント内での `try-catch` や `error` state が不要になる。

---

### 4. Server Components と非同期

#### async Server Componentsでのデータ取得

Server Componentsはサーバー上で実行され、async/awaitを直接使用できる[[7]](#参考リンク)。Client Componentsではasync/awaitは使えない（`use` フックを代わりに使う）[[2]](#参考リンク)。

```tsx title="async Server Component"
// Server Component: async/await が直接使用可能
export default async function UserPage({ params }: { params: { id: string } }) {
  const user = await fetchUser(params.id);       // サーバーで実行
  const orders = await fetchOrders(user.id);      // サーバーで実行

  return (
    <div>
      <h1>{user.name}</h1>
      <OrderList orders={orders} />
    </div>
  );
}
```

Server Componentsの利点:

- データベースやAPIへの直接アクセスが可能
- ブラウザに送信するJavaScriptが削減される
- ストリーミングによるチャンク送信で初回インタラクションまでの時間が短縮

#### Server Actions の仕組み

`"use server"` ディレクティブで定義された非同期関数は、Client Componentから直接呼び出すことができる[[9]](#参考リンク)。フレームワークがサーバー関数への参照を自動生成し、クライアントで呼び出されるとReactがサーバーにリクエストを送信して関数を実行する[[8]](#参考リンク)。

```tsx title="Server Action の定義と使用"
// server-actions.ts
"use server";

export async function updateUserName(formData: FormData) {
  const name = formData.get("name") as string;
  await db.user.update({ where: { id: currentUser.id }, data: { name } });
  revalidatePath("/profile");
}
```

```tsx title="Client Component から Server Action を呼び出し"
"use client";

import { useActionState } from 'react';
import { updateUserName } from './server-actions';

function ProfileForm() {
  const [error, submitAction, isPending] = useActionState(updateUserName, null);

  return (
    <form action={submitAction}>
      <input type="text" name="name" />
      <button disabled={isPending}>更新</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

#### クライアント/サーバーの境界でのPromise受け渡し

Server ComponentからClient ComponentへPromiseを渡すパターンは、React v19の重要な設計パターンである[[2]](#参考リンク) [[15]](#参考リンク)。

```tsx title="Server Component から Client Component へ Promise を渡す"
// Server Component
export default function Page() {
  // Promiseを作成するが、awaitしない
  const commentsPromise = fetchComments();

  return (
    <Suspense fallback={<CommentsSkeleton />}>
      {/* PromiseをClient Componentにpropsとして渡す */}
      <Comments commentsPromise={commentsPromise} />
    </Suspense>
  );
}
```

```tsx title="Client Component で use() で Promise を解決"
"use client";

import { use } from 'react';

function Comments({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  const comments = use(commentsPromise);
  return (
    <ul>
      {comments.map(c => <li key={c.id}>{c.text}</li>)}
    </ul>
  );
}
```

この設計の利点:

- Server ComponentのレンダリングがPromiseの解決を待たずに進行する（ノンブロッキング）
- Server Componentから渡されたPromiseは再レンダリング時も安定している（Client Component内で生成したPromiseは毎回再生成される）
- Suspense境界で自然にローディング状態を表示できる

---

### 5. 従来のuseEffect+useStateパターンとの具体的な比較

#### コード量の削減

| 観点 | useEffect + useState | React v19 (use + Suspense) |
|---|---|---|
| データ用state | `useState` 必要 | 不要（`use` が直接返す） |
| ローディング用state | `useState` 必要 | 不要（`Suspense` が処理） |
| エラー用state | `useState` 必要 | 不要（`ErrorBoundary` が処理） |
| クリーンアップ | `cancelled` フラグ or `AbortController` | 不要 |
| useEffect | 必要 | 不要 |
| コンポーネントの責務 | データ取得 + 状態管理 + 表示 | 表示のみ |

従来のパターンでは1つのデータ取得に対して約15〜25行のボイラープレートが必要だったが、`use` + `Suspense` パターンでは3〜5行で同等の機能を実現できる。

#### レースコンディションの解消

従来方式では、`userId` が高速に切り替わった場合に古いリクエストの結果が表示される問題があり、`cancelled` フラグや `AbortController` による手動対策が必須だった。

React v19の `use` フックでは、Promiseの参照自体がpropsとして渡されるため、propsが変わればReactが自動的に新しいPromiseを使用する[[2]](#参考リンク) [[17]](#参考リンク)。古いPromiseの結果は無視され、レースコンディションが構造的に発生しない。

#### ウォーターフォールの回避

```tsx title="従来: Fetch-on-Render（ウォーターフォール）"
// 1. Dashboardがマウント → fetchUser() 開始
// 2. fetchUser() 完了 → Ordersがマウント → fetchOrders() 開始
// 3. fetchOrders() 完了 → 表示
// → 合計時間 = fetchUser() + fetchOrders()（直列）
```

```tsx title="v19: Render-as-you-Fetch（並列/チェーン）"
// リソース生成時点でPromiseチェーンにより依存関係を表現
function createResources() {
  userPromise = fetchUser();
  ordersPromise = userPromise.then(user => fetchOrders(user.id));
}
// → fetchOrders はfetchUser完了後すぐに開始（レンダリングを待たない）

// 独立したデータは完全に並列化できる
function createResources() {
  userPromise = fetchUser();
  notificationsPromise = fetchNotifications(); // userと独立して並列実行
}
```

Render-as-you-Fetchパターンでは、データ取得がコンポーネントのレンダリングから切り離されるため、レンダリングの階層構造に起因するウォーターフォールが構造的に発生しない[[11]](#参考リンク) [[14]](#参考リンク)。

---

## 検証結果

### 各APIの成熟度（2025年12月時点のReact v19安定版基準）

| API | 状態 | 備考 |
|---|---|---|
| `use` (Promise) | 安定版 | Client Componentでの利用も安定版として提供 |
| `use` (Context) | 安定版 | `useContext` の代替として使用可能 |
| `useActionState` | 安定版 | 旧 `useFormState` から改名[[1]](#参考リンク) |
| `useOptimistic` | 安定版 | |
| `useTransition` (async) | 安定版 | v18から非同期対応が拡張 |
| `useFormStatus` | 安定版 (react-dom) | |
| Server Components | 安定版 | フレームワーク（Next.js等）経由での利用が推奨 |
| Server Actions | 安定版 | `"use server"` ディレクティブ |

### 制約・注意点

- `use` に渡すPromiseは**レンダリング中に生成してはいけない**。親コンポーネントやServer Component、キャッシュ層で事前に生成する必要がある[[2]](#参考リンク)
- Client Componentは `async` 関数として定義できない。非同期処理は `use` フック経由で行う[[2]](#参考リンク)
- Server ComponentsとServer Actionsは、Next.js等のフレームワークとの統合が前提[[7]](#参考リンク)
- `useActionState` は `react` パッケージから、`useFormStatus` は `react-dom` パッケージからインポートする[[3]](#参考リンク)

## まとめ

React v19は、非同期データ取得と状態管理の方法を根本から変革した。`use` フックとSuspenseの組み合わせにより、コンポーネントは「データが存在する前提のハッピーパス」だけを記述すればよくなり、ローディングとエラーの処理は宣言的な境界コンポーネントに委譲できるようになった。

`useTransition` の非同期拡張、`useActionState`、`useOptimistic` はフォーム送信やミューテーション操作のボイラープレートを大幅に削減し、Server ComponentsとServer Actionsはサーバーサイドのデータ取得を自然にReactのコンポーネントモデルに統合した。

プロジェクトへの適用を考える上では、既存の `useEffect` + `useState` パターンを段階的に `use` + `Suspense` パターンへ移行していくのが現実的である。特にデータ取得のボイラープレート削減とレースコンディションの構造的な解消は、コードの保守性と信頼性に直結する改善である。

## 参考リンク

1. [React v19 公式リリースブログ](https://react.dev/blog/2024/12/05/react-19)
2. [use - React 公式リファレンス](https://react.dev/reference/react/use)
3. [useActionState - React 公式リファレンス](https://react.dev/reference/react/useActionState)
4. [useOptimistic - React 公式リファレンス](https://react.dev/reference/react/useOptimistic)
5. [useTransition - React 公式リファレンス](https://react.dev/reference/react/useTransition)
6. [Suspense - React 公式リファレンス](https://react.dev/reference/react/Suspense)
7. [Server Components - React 公式リファレンス](https://react.dev/reference/rsc/server-components)
8. [Server Functions - React 公式リファレンス](https://react.dev/reference/rsc/server-functions)
9. ['use server' directive - React 公式リファレンス](https://react.dev/reference/rsc/use-server)
10. [The Complete Developer Guide to React 19: Async Handling - Callstack](https://www.callstack.com/blog/the-complete-developer-guide-to-react-19-part-1-async-handling)
11. [The Modern React Data Fetching Handbook: Suspense, use(), and ErrorBoundary Explained - freeCodeCamp](https://www.freecodecamp.org/news/the-modern-react-data-fetching-handbook-suspense-use-and-errorboundary-explained/)
12. [Smooth Async Transitions in React 19 - AppSignal Blog](https://blog.appsignal.com/2025/08/27/smooth-async-transitions-in-react-19.html)
13. [React 19 Suspense Deep Dive - DEV Community](https://dev.to/a1guy/react-19-suspense-deep-dive-data-fetching-streaming-and-error-handling-like-a-pro-3k74)
14. [React 19 use Hook Deep Dive - DEV Community](https://dev.to/a1guy/react-19-use-hook-deep-dive-using-promises-directly-in-your-components-1plp)
15. [Mastering React 19: Server Components & Server Actions - Scalable Path](https://www.scalablepath.com/react/react-19-server-components-server-actions)
16. [Getting started with startTransition in React 19 - LogRocket](https://blog.logrocket.com/getting-started-react-19-starttransition/)
17. [Fixing Race Conditions in React with useEffect - Max Rozen](https://maxrozen.com/race-conditions-fetching-data-react-with-useeffect)

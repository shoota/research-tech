---
id: react19-async-graphql
title: React v19の非同期機能がGraphQL通信にもたらす利用価値
sidebar_position: 2
last_update:
  date: 2026-03-05
---

# React v19の非同期機能がGraphQL通信にもたらす利用価値

## 概要

React v19で導入された非同期関連の新機能（`use()`フック、`useOptimistic`、`useTransition`の拡張、Server Components、Actions）が、GraphQLクライアント（Apollo Client、urql、Relay）との統合においてどのような価値をもたらすかを調査した。

:::info 関連ドキュメント
- [Apollo Client v4 + graphql-codegen + Nxモノレポ設定ガイド](../graphql/apollo-client-v4-codegen-monorepo)
:::

## 背景・動機

React v19は2024年12月に正式リリースされ[[1]](#参考リンク)、非同期処理・データ取得に関する多くの新APIが安定版として提供された。GraphQLクライアントライブラリはこれらのAPIへの対応を進めており、従来のローディング/エラー状態管理のパターンから、Suspense・Error Boundaryベースの宣言的パターンへの移行が加速している。この移行がGraphQL通信のDXとUXにどう影響するかを整理する。

## 調査内容

### 1. GraphQLクライアントの現状とReact v19対応状況

#### Apollo Client

Apollo Clientは**v3.8**でSuspense統合を導入し[[6]](#参考リンク)、**v3.11**でReact 19の公式サポートを追加した[[7]](#参考リンク)。`package.json`のpeerDependenciesは `^17.0.0 || ^18.0.0 || >=19.0.0-rc` となっており、React 19を正式にサポートしている[[8]](#参考リンク)。

v3.11ではReact 19 RCバージョンに対するテストスイート全体の実行が行われ、React Compilerとの互換性改善のために`useQuery`と`useSubscription`の内部がReactのルールに準拠するよう書き直された[[7]](#参考リンク)。

提供されるSuspense系フックは以下の3つ:

- **`useSuspenseQuery`**: GraphQLリクエストを発行し、データ取得完了までコンポーネントをsuspendさせる[[5]](#参考リンク)。`useQuery`と異なりloading状態の管理が不要で、コンポーネントがレンダリングされる時点でdataが常に利用可能
- **`useBackgroundQuery` / `useReadQuery`**: リクエストウォーターフォールを防ぐためのペア。親コンポーネントで`useBackgroundQuery`によりフェッチを開始し、`queryRef`を子コンポーネントに渡して`useReadQuery`でsuspendする[[4]](#参考リンク)
- **`useLoadableQuery`**: ユーザーインタラクション（ボタンクリックなど）をトリガーにクエリを開始する。レンダー時ではなく明示的なタイミングでフェッチを制御[[4]](#参考リンク)

#### urql

urqlは**v5.0.1**（2025年10月頃リリース）でReact 19を正式にサポートしている[[10]](#参考リンク)。peer dependencyのrangeがReact 19に拡張され、React 19の内部警告に対するfalse-positive回避処理もアップデートされた[[9]](#参考リンク)。

urqlのSuspense対応は以前`@urql/exchange-suspense`パッケージで提供されていたが、このパッケージは5年以上更新されていない。現在のurql v5系ではコアの`useQuery`フックに`suspense: true`オプションを渡すことでSuspenseモードを有効化できる[[9]](#参考リンク)。

#### Relay

RelayはMeta（Facebook）が開発するGraphQLクライアントで、Concurrent Mode・Suspenseとの統合を最も早期から推進してきた[[11]](#参考リンク)。Relay HooksはReact Concurrent ModeおよびSuspenseと連携するよう設計されている[[11]](#参考リンク)。

ただし、**React Server Components（RSC）への対応は依然として課題**が残る。RelayはRelayEnvironmentをReact Contextで配布する設計のため、Contextが使えないRSC環境との互換性問題がある[[12]](#参考リンク)。GitHub Issue #4599ではReactの`cache` APIを活用する代替案が議論されており、コミュニティメンバーによるOSSライブラリ（relay-rsc）やPoCが公開されているが、公式の安定したRSCサポートはまだ実現していない[[12]](#参考リンク)。

### 2. React v19の`use()`フックとGraphQLクライアントの統合

#### `use()`の基本動作

React 19で導入された`use()`は、render内でPromiseやContextを読み取るための新しいAPI[[17]](#参考リンク)。従来のフックと異なり、条件分岐や早期リターンの後でも呼び出せる[[17]](#参考リンク)。

```tsx title="基本的なuse()の使い方"
import { use, Suspense } from 'react';

function Comments({ commentsPromise }) {
  // Promiseが解決されるまでコンポーネントをsuspend
  const comments = use(commentsPromise);
  return comments.map(comment => <p key={comment.id}>{comment}</p>);
}

function Page({ commentsPromise }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Comments commentsPromise={commentsPromise} />
    </Suspense>
  );
}
```

#### Suspenseベースのデータ取得パターン

Apollo Clientの`useSuspenseQuery`はこのSuspenseメカニズムを内部で活用している[[4]](#参考リンク) [[5]](#参考リンク)。コンポーネントがsuspendされると最も近い`<Suspense>`境界のfallbackが表示され、データ到着後に自動で再レンダリングされる[[3]](#参考リンク)。

```tsx title="Apollo Client useSuspenseQueryパターン"
// コンポーネントは常にdataが利用可能な前提で書ける
function UserProfile() {
  const { data } = useSuspenseQuery(GET_USER);
  return <h1>{data.user.name}</h1>;
}

// 親コンポーネントでSuspense境界を設定
function App() {
  return (
    <Suspense fallback={<Skeleton />}>
      <UserProfile />
    </Suspense>
  );
}
```

#### `use()`でPromiseを直接読み取るパターン

`use()`はGraphQLクライアントが返すPromiseを直接扱える。Server ComponentsやSSRの文脈では、GraphQLクライアントのフックを使わずに`graphql-request`などで取得したPromiseを`use()`に渡すパターンが有効。

```tsx title="use()とGraphQLクエリの直接統合"
// Server ComponentでGraphQLクエリのPromiseを生成
async function fetchUser() {
  const response = await fetch('/graphql', {
    method: 'POST',
    body: JSON.stringify({ query: '{ user { name } }' }),
  });
  return response.json();
}

// Client Componentでuse()で読み取り
function UserName({ userPromise }) {
  const { data } = use(userPromise);
  return <span>{data.user.name}</span>;
}
```

#### キャッシュとの連携

Apollo Clientの`useSuspenseQuery`は内部キャッシュと完全に統合されている[[5]](#参考リンク)。`returnPartialData`オプションを使えば、キャッシュに部分的なデータがある場合はsuspendせずにすぐ表示し、不足分をバックグラウンドで取得できる[[5]](#参考リンク)。`use()`を直接使う場合はキャッシュ管理が別途必要となるため、既存のGraphQLクライアントのSuspense対応フックを使う方が実用的。

### 3. Server ComponentsとGraphQL

#### Server ComponentsからGraphQLを直接呼び出すパターン

React Server Componentsでは、サーバー上でGraphQLエンドポイントに直接リクエストを送り、レンダリング結果をHTMLとしてクライアントに送信できる[[13]](#参考リンク) [[15]](#参考リンク)。この場合、GraphQLクライアントライブラリを経由せず`fetch()`や`graphql-request`を直接利用する。

利点:
- クライアントバンドルにGraphQLクライアントライブラリを含めない（バンドルサイズ削減）
- サーバー間通信のためネットワークレイテンシが低い
- 認証情報をサーバー側で安全に扱える

注意点:
- リクエストごとにクライアントインスタンスを生成し、キャッシュの共有・データリークを防ぐ必要がある[[16]](#参考リンク)
- Apollo Clientの`registerApolloClient`と`getClient`ヘルパーを使い、Server Componentsでスコープされたクライアントインスタンスを利用するパターンが推奨される[[16]](#参考リンク)

#### RSC + GraphQL + Suspenseの組み合わせ

Server Componentsで取得したデータのPromiseをClient Componentに渡し、`use()`やSuspenseで段階的にレンダリングする構成が可能。

- Server Componentが複数のGraphQLクエリを並行して発行
- 各クエリのPromiseをClient Componentにpropsで渡す
- Client Component側で`use()`を使い、Suspense境界ごとに段階的に表示

DataLoaderパターン（重複排除・バッチ処理）をサーバーサイドで適用すれば、N+1問題を回避しつつストリーミングレンダリングが実現できる[[13]](#参考リンク)。

#### サーバーサイドでのデータプリフェッチ

Server Componentsの`async/await`構文で直接データを取得する方法が最もシンプル[[20]](#参考リンク)。変更頻度の低いデータをServer Componentsで取得し、インタラクティブなデータ更新はClient ComponentsのGraphQLクライアントに任せる分離パターンが推奨される[[20]](#参考リンク)。

### 4. `useOptimistic`とGraphQL Mutation

#### React v19の`useOptimistic`の仕組み

`useOptimistic`は非同期操作中に楽観的なUI更新を行うためのフック[[2]](#参考リンク)。基本的な使い方:

```tsx title="useOptimisticの基本構文"
const [optimisticState, setOptimistic] = useOptimistic(actualState, reducer?);
```

- `actualState`: 非同期操作が完了した時点の実際の状態
- `reducer`: `(currentState, action) => nextState` 形式で楽観的更新のロジックを定義
- `optimisticState`: 非同期操作中は楽観的に更新された値、完了後は`actualState`に戻る
- エラー時は自動的に元の状態にロールバック

`startTransition`内で`setOptimistic`を呼ぶ必要がある。

#### `useOptimistic` + GraphQL Mutationの具体的なユースケース

**ユースケース1: いいねボタン**

```tsx title="いいね機能の楽観的更新"
function LikeButton({ post }) {
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [optimisticIsLiked, setOptimisticIsLiked] = useOptimistic(isLiked);

  function handleClick() {
    startTransition(async () => {
      const newValue = !optimisticIsLiked;
      setOptimisticIsLiked(newValue);
      // GraphQL Mutationを実行
      const result = await toggleLikeMutation({ variables: { postId: post.id } });
      setIsLiked(result.data.toggleLike.isLiked);
    });
  }

  return <button onClick={handleClick}>{optimisticIsLiked ? 'Liked' : 'Like'}</button>;
}
```

**ユースケース2: リストへのアイテム追加**

```tsx title="Todoリストの楽観的追加"
const [optimisticTodos, addOptimisticTodo] = useOptimistic(
  todos,
  (currentTodos, newTodo) => [
    ...currentTodos,
    { ...newTodo, pending: true }
  ]
);

function handleAddTodo(text) {
  startTransition(async () => {
    addOptimisticTodo({ id: crypto.randomUUID(), text });
    // GraphQL Mutation実行
    await createTodoMutation({ variables: { text } });
  });
}
```

#### Apollo Clientの既存楽観的更新との比較

Apollo Clientは`useMutation`の`optimisticResponse`オプションで楽観的更新を提供している[[19]](#参考リンク)。これはキャッシュレイヤーに楽観的なレスポンスを一時保存し、ミューテーション完了後に実際のレスポンスで上書きする仕組み[[19]](#参考リンク)。

React 19の`useOptimistic`はReact状態レベルでの楽観的更新であり[[2]](#参考リンク)、GraphQLクライアントのキャッシュとは独立して動作する。Apollo Clientを使う場合は、キャッシュの正規化・自動更新の恩恵を受けるために`optimisticResponse`の方が適している場面が多い[[19]](#参考リンク)。一方、キャッシュを使わないシンプルな構成や、Server Actionsと組み合わせる場合は`useOptimistic`が有効。

### 5. `useTransition`とGraphQL

#### データ再取得時のUI遷移制御

React 19では`useTransition`が拡張され、async関数をトランジション内で使えるようになった[[1]](#参考リンク)。GraphQLクエリの再取得をトランジションで包むと、新しいデータのロード中も現在のUIを表示し続けられる。

Apollo Clientの`useSuspenseQuery`と`startTransition`の組み合わせが典型的なパターン[[4]](#参考リンク):

- `refetch()`をstartTransition内で呼ぶと、Suspense fallbackに戻らず現在のデータを表示したまま新しいデータを待つ
- `isPending`で「バックグラウンドで更新中」の表示（スピナーやオーバーレイ）を出せる

#### ページネーション・フィルタリングでの活用

ページネーションやフィルタリングの変更時にstartTransitionを使うことで、ユーザーが操作するたびにローディング画面に戻ることを防げる。

- カーソルベースのページネーションで「次のページ」をクリックした際、現在のリストを表示したまま次のページのデータを取得
- フィルタ変更時に現在の検索結果を維持しつつ新しい結果を取得
- `isPending`を使ってUIを半透明にするなど、更新中であることを示すvisual cueを提供

Relay HooksはReact Concurrent ModeおよびSuspenseとの連携を前提に設計されており、`useTransition`との統合が最も自然に行える[[11]](#参考リンク)。

### 6. React v19以前との比較

#### 従来のuseQueryパターン vs Suspenseパターン

**従来のパターン（useQuery）:**

```tsx title="従来のuseQueryパターン"
function UserProfile() {
  const { loading, error, data } = useQuery(GET_USER);

  if (loading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;

  return <h1>{data.user.name}</h1>;
}
```

**Suspenseパターン（useSuspenseQuery）:**

```tsx title="Suspenseパターン"
function UserProfile() {
  const { data } = useSuspenseQuery(GET_USER);
  // loading/errorのチェック不要。dataは常に利用可能
  return <h1>{data.user.name}</h1>;
}

// 親コンポーネントでローディングとエラーを宣言的に管理
function App() {
  return (
    <ErrorBoundary fallback={<ErrorMessage />}>
      <Suspense fallback={<Skeleton />}>
        <UserProfile />
      </Suspense>
    </ErrorBoundary>
  );
}
```

#### ローディング/エラー状態管理の簡素化

| 観点 | useQuery（従来） | useSuspenseQuery（React 19） |
|------|------------------|------|
| ローディング表示 | コンポーネント内で`loading`フラグを条件分岐 | `<Suspense>`のfallbackで宣言的に定義 |
| エラーハンドリング | コンポーネント内で`error`を条件分岐 | Error Boundaryに委任 |
| データの型安全性 | `data`がundefinedの可能性あり（型ガード必要） | `data`は常に定義済み（TypedDocumentNode利用時） |
| 複数クエリの並行処理 | 各クエリのloading/errorを個別管理 | Suspense境界の配置でグループ化 |
| リクエストウォーターフォール | 手動で回避が必要 | `useBackgroundQuery`で自然に解消 |

#### コンポーネント設計への影響

Suspenseパターンはコンポーネントの関心の分離を促進する:

- **データ取得コンポーネント**: ビジネスロジックとUI表示のみに集中。ローディング/エラー状態の分岐が不要
- **レイアウトコンポーネント**: `<Suspense>`と`<ErrorBoundary>`の配置でローディング/エラーUIの粒度を制御
- **コンポーネントの再利用性向上**: ローディング/エラー処理がコンポーネント外部に移動するため、データ表示部分のロジックがシンプルになる

## 検証結果

コード検証は本調査では行わないが、調査から得られた実践的な知見を以下にまとめる。

### GraphQLクライアント選定の指針

| クライアント | React 19対応 | Suspense対応 | RSC対応 | 特徴 |
|---|---|---|---|---|
| Apollo Client 3.11+ | 公式サポート | useSuspenseQuery等3フック | registerApolloClient | 最も包括的なSuspense統合 |
| urql 5.0+ | 公式サポート | suspense: trueオプション | 限定的 | 軽量・Exchange拡張可能 |
| Relay | Concurrent Mode前提 | ネイティブ対応 | 実験的（コミュニティ主導） | Fragment Colocation・コンパイラ最適化 |

### React v19新機能とGraphQLの組み合わせマトリクス

| React v19機能 | GraphQLでの活用場面 | 推奨クライアント |
|---|---|---|
| `use()` | Server ComponentからのPromise受け渡し | クライアント非依存（fetch直接利用） |
| `useSuspenseQuery`系 | Client Componentでのデータ取得 | Apollo Client |
| `useOptimistic` | Mutation結果の即座反映 | 軽量構成 or Server Actions連携 |
| `useTransition` | ページネーション・フィルタリング | Apollo Client / Relay |
| Server Components | 初期データ取得・SEO | fetch/graphql-request直接利用 |
| Server Actions | Mutation実行 | フレームワーク依存（Next.js等） |

## まとめ

React v19の非同期機能はGraphQL通信に以下の価値をもたらす:

1. **宣言的なローディング/エラー管理**: `useSuspenseQuery` + Suspense/Error Boundaryにより、コンポーネント内のif分岐が激減し、ビジネスロジックに集中できる設計が自然に実現される

2. **Server Componentsによるアーキテクチャの選択肢拡大**: 初期データはServer Componentsでサーバーサイドから直接GraphQLを呼び出し、インタラクティブな部分はClient ComponentsのGraphQLクライアントに委ねるハイブリッド構成が現実的になった

3. **楽観的更新の標準化**: `useOptimistic`によりReact標準の楽観的更新パターンが提供された。ただしApollo Clientのようなキャッシュ正規化を伴う楽観的更新が必要な場合は、クライアント固有の`optimisticResponse`の方が適している

4. **UIトランジションの改善**: `useTransition`によりデータ再取得時のUXが大幅に向上。ページネーションやフィルタリングで「ローディング画面に戻る」問題が解消される

5. **Relayの課題**: RSC対応が公式には未完了。コミュニティ主導のソリューションはあるが、production-readyとは言いがたい

GraphQLクライアントの中では**Apollo Client 3.11+がReact v19との統合において最も成熟**しており、Suspense系フック3種・React Compiler対応・RSCサポートが揃っている。軽量な構成を求める場合はurql 5.0+も選択肢となる。

## 参考リンク

1. [React v19 公式ブログ](https://react.dev/blog/2024/12/05/react-19)
2. [React useOptimistic リファレンス](https://react.dev/reference/react/useOptimistic)
3. [React Suspense リファレンス](https://react.dev/reference/react/Suspense)
4. [Apollo Client Suspense ドキュメント](https://www.apollographql.com/docs/react/data/suspense)
5. [Apollo Client useSuspenseQuery API](https://www.apollographql.com/docs/react/api/react/useSuspenseQuery)
6. [Apollo Client 3.8 Suspense統合の発表](https://www.apollographql.com/blog/wait-for-it-announcing-apollo-client-3-8-with-react-suspense-integration)
7. [Apollo Client 3.11 の新機能](https://www.apollographql.com/blog/whats-new-in-apollo-client-3-11)
8. [Apollo Client CHANGELOG](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md)
9. [urql GitHub リポジトリ](https://github.com/urql-graphql/urql)
10. [urql React 19 対応ディスカッション](https://github.com/urql-graphql/urql/discussions/3732)
11. [Relay 公式サイト](https://relay.dev/)
12. [Relay RSC対応 Issue #4599](https://github.com/facebook/relay/issues/4599)
13. [GraphQL in the World of React Server Components (GitNation)](https://gitnation.com/contents/graphql-in-the-world-of-react-server-components)
14. [GraphQL Code Generator RSC対応ディスカッション](https://github.com/dotansimha/graphql-code-generator/discussions/9481)
15. [Grafbase: Working with GraphQL and Next.js React Server Components](https://grafbase.com/guides/working-with-graphql-and-nextjs-13-react-server-components)
16. [Apollo Client Next.js 13 統合ガイド](https://www.apollographql.com/blog/how-to-use-apollo-client-with-next-js-13)
17. [React 19 use Hook Deep Dive (DEV Community)](https://dev.to/a1guy/react-19-use-hook-deep-dive-using-promises-directly-in-your-components-1plp)
18. [React Server Components と GraphQL のアナロジー (Quramy)](https://quramy.medium.com/react-server-components-%E3%81%A8-graphql-%E3%81%AE%E3%82%A2%E3%83%8A%E3%83%AD%E3%82%B8%E3%83%BC-89b3f5f41a01)
19. [Apollo Client 楽観的更新ドキュメント](https://www.apollographql.com/docs/react/performance/optimistic-ui)
20. [Do I Need GraphQL Now that We Have React Server Components?](https://hackteam.io/blog/do-need-graphql-now-react-server-components/)

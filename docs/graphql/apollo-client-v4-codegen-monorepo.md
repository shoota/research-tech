---
id: apollo-client-v4-codegen-monorepo
title: Apollo Client v4 + graphql-codegen + Nxモノレポ設定ガイド
sidebar_position: 1
tags: [graphql, apollo-client, codegen, monorepo, nx, typescript]
last_update:
  date: 2026-03-07
---

# Apollo Client v4 + graphql-codegen + Nxモノレポ設定ガイド

## 概要

Apollo Client v4（2025年9月リリース）の主要な変更点と、graphql-codegen を用いた型安全な GraphQL 開発のセットアップ方法を調査した。とくに Nx モノレポ環境における GraphQL document の分散配置（Colocation）パターンに焦点を当て、複数のプリセットを比較検証した。

:::info 関連ドキュメント
- [React v19の非同期機能がGraphQL通信にもたらす利用価値](../react/react19-async-graphql)
- [モノレポ戦略 - Turborepo / Nx によるスケーラブルな開発基盤](../dev-tools/monorepo/monorepo-strategy)
:::

## 背景・動機

- Apollo Client v3 からの移行にあたり、v4 の Breaking Changes と新しい API を把握する必要がある
- graphql-codegen のプリセット選定（client preset vs near-operation-file vs monorepo-client）がモノレポでの開発体験に大きく影響する
- GraphQL document をコンポーネント近傍に分散配置（Colocation）する方法が、大規模なモノレポでのスケーラビリティに重要

## 調査内容

### 1. Apollo Client v4 の主要変更

#### バンドルサイズ削減

Apollo Client v4 では、ローカル状態管理（`@client` ディレクティブ）やデフォルト HTTP Link などの機能がオプトイン化され、使わない機能はバンドルに含まれなくなった[[1]](#参考リンク)。モダンブラウザ（2023年以降）と Node.js 20+ 向けのトランスパイルにより、**20-30% のバンドルサイズ削減**が実現されている。

#### import パスの変更

React 関連の export が `@apollo/client/react` に分離された。これが最大の Breaking Change の一つ[[3]](#参考リンク)。

```tsx title="v3 → v4 import 変更"
// v3
import { useQuery, ApolloClient, InMemoryCache } from "@apollo/client";

// v4: React hooks は /react から
import { useQuery } from "@apollo/client/react";
import { ApolloClient, InMemoryCache } from "@apollo/client";
```

#### dataState プロパティ

`loading` / `data` の組み合わせに代わり、`dataState` が4つの明確な状態を提供する[[1]](#参考リンク)。

```tsx title="dataState の利用例"
import { useQuery } from "@apollo/client/react";

const { data, dataState } = useQuery(USER_QUERY, {
  variables: { id: userId }, // 型による変数の強制
});

switch (dataState) {
  case "empty":
    return <Skeleton />;
  case "partial":
  case "streaming":
    return <PartialProfile user={data?.user} />;
  case "complete":
    return <Profile user={data.user} />;
}
```

#### RxJS への移行

内部の Observable 実装が `zen-observable` から RxJS に変更された。RxJS はピア依存として追加が必要[[3]](#参考リンク)。

```bash
npm install @apollo/client@latest graphql rxjs
```

カスタム Link で `map` / `filter` 等を使っていた場合、RxJS のオペレーターに書き換えが必要。

#### エラーハンドリングの改善

モノリシックな `ApolloError` が廃止され、より具体的なエラークラスに分離された[[1]](#参考リンク)。

```tsx title="v4 のエラーハンドリング"
import {
  CombinedGraphQLErrors,
  ServerError,
  LinkError,
} from "@apollo/client";

// 静的メソッド .is() で型の絞り込みが可能
if (CombinedGraphQLErrors.is(error)) {
  error.errors.forEach((e) => console.log(e.message));
} else if (ServerError.is(error)) {
  console.log("Server error:", error.statusCode);
}
```

#### Link のクラスベース化

Link 作成関数がクラスコンストラクタに変更された。

```tsx title="Link の変更"
// v3
import { createHttpLink } from "@apollo/client";
const link = createHttpLink({ uri: "/graphql" });

// v4
import { HttpLink } from "@apollo/client/link/http";
const link = new HttpLink({ uri: "/graphql" });
```

#### 自動マイグレーション

公式 codemod で機械的な変更の約90%を自動化できる[[3]](#参考リンク)。

```bash
npx @apollo/client-codemod-migrate-3-to-4 src
```

### 2. graphql-codegen の最新セットアップ

#### Apollo Client 向けの推奨構成

Apollo の公式ドキュメントでは、**client preset を使用しないこと**を推奨している[[2]](#参考リンク)。client preset は追加のランタイムコードを生成してバンドルサイズを増加させ、Apollo Client と互換性のない機能を含むためである。

推奨は `typescript` + `typescript-operations` プラグインの直接使用。

```bash
npm install -D @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations
```

#### 基本的な codegen.ts 設定

```tsx title="codegen.ts"
import { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  schema: "http://localhost:4000/graphql",
  documents: ["src/**/*.{ts,tsx}"],
  ignoreNoDocuments: true,
  generates: {
    "./src/types/__generated__/graphql.ts": {
      plugins: ["typescript", "typescript-operations"],
      config: {
        // フィールドを optional にしない（Apollo Client の型安全性向上）
        avoidOptionals: {
          field: true,
          inputValue: false,
        },
        // 未知のスカラーは unknown 型に
        defaultScalarType: "unknown",
        // __typename を常に必須に
        nonOptionalTypename: true,
        skipTypeNameForRoot: true,
      },
    },
  },
};

export default config;
```

#### typed-document-node の追加（推奨）

`typed-document-node` プラグインを追加すると、GraphQL document にプリコンパイルされた型情報が付与され、`useQuery` 等で自動的に型推論が効く[[2]](#参考リンク)。

```bash
npm install -D @graphql-codegen/typed-document-node
```

```tsx title="codegen.ts（typed-document-node 追加）"
generates: {
  "./src/types/__generated__/graphql.ts": {
    plugins: [
      "typescript",
      "typescript-operations",
      "typed-document-node",  // 追加
    ],
  },
},
```

```tsx title="型推論が自動的に効く使用例"
import { useQuery } from "@apollo/client/react";
import { GetUserDocument } from "./__generated__/graphql";

// data の型が自動的に GetUserQuery に推論される
const { data, dataState } = useQuery(GetUserDocument);
```

### 3. Nxモノレポでの GraphQL document 分散配置

#### アーキテクチャパターン

Nx モノレポでは、GraphQL 関連のコードを以下の3層に分離するパターンが推奨されている[[4]](#参考リンク)。

```
monorepo/
+-- apps/
|   +-- api/                          # Apollo Server
|   \-- web/                          # フロントエンドアプリ
+-- libs/
|   +-- shared/
|   |   \-- graphql-schema/           # 層1: スキーマ型（共有）
|   |       +-- src/
|   |       |   +-- schema.graphql
|   |       |   \-- __generated__/
|   |       |       \-- types.ts      # スキーマから生成された基本型
|   |       \-- codegen.ts
|   +-- features/
|   |   +-- user/                     # 層2: 機能ライブラリ（分散document）
|   |   |   +-- src/
|   |   |   |   +-- components/
|   |   |   |   |   +-- UserProfile.tsx
|   |   |   |   |   \-- UserProfile.graphql  # Colocation
|   |   |   |   +-- operations.graphql
|   |   |   |   \-- __generated__/
|   |   |   |       \-- operations.ts
|   |   |   \-- codegen.ts
|   |   \-- post/                     # 別の機能ライブラリ
|   |       +-- src/
|   |       |   +-- components/
|   |       |   |   +-- PostList.tsx
|   |       |   |   \-- PostList.graphql
|   |       |   \-- __generated__/
|   |       |       \-- operations.ts
|   |       \-- codegen.ts
|   \-- ui/
|       \-- fragments/                # 層3: 共有Fragment（オプション）
|           +-- src/
|           |   \-- user-fragment.graphql
|           \-- codegen.ts
\-- nx.json
```

#### 方法1: near-operation-file preset（推奨）

GraphQL operation ファイルの隣に型定義ファイルを生成するプリセット。Apollo Client との相性が最も良い[[5]](#参考リンク)。

```bash
npm install -D @graphql-codegen/near-operation-file-preset
```

```tsx title="libs/features/user/codegen.ts"
import { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../../shared/graphql-schema/src/schema.graphql",
  documents: ["src/**/*.graphql"],
  generates: {
    // 1. 基本型（スキーマ型を参照）
    "src/__generated__/base-types.ts": {
      plugins: ["typescript"],
    },
    // 2. 各 .graphql ファイルの隣に型を生成
    "src/": {
      preset: "near-operation-file",
      presetConfig: {
        extension: ".generated.ts",
        baseTypesPath: "__generated__/base-types.ts",
        folder: "__generated__",
      },
      plugins: ["typescript-operations", "typed-document-node"],
    },
  },
};

export default config;
```

この設定で以下のようなファイルが自動生成される。

```
libs/features/user/src/
+-- components/
|   +-- UserProfile.tsx
|   +-- UserProfile.graphql
|   \-- __generated__/
|       \-- UserProfile.generated.ts   ← 自動生成
+-- operations.graphql
+-- __generated__/
|   +-- base-types.ts                  ← スキーマ型
|   \-- operations.generated.ts        ← 自動生成
```

コンポーネントからの利用例:

```tsx title="libs/features/user/src/components/UserProfile.tsx"
import { useQuery } from "@apollo/client/react";
import { GetUserProfileDocument } from "./__generated__/UserProfile.generated";

export function UserProfile({ userId }: { userId: string }) {
  const { data, dataState } = useQuery(GetUserProfileDocument, {
    variables: { id: userId },
  });

  if (dataState !== "complete") return <Skeleton />;

  return (
    <div>
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
    </div>
  );
}
```

#### 方法2: monorepo-client preset

`@graphql-codegen/client-preset` をモノレポ向けに拡張したプリセット。スキーマ型と operation 型を異なるパッケージに分離できる[[6]](#参考リンク)。

```bash
npm install -D graphql-codegen-preset-monorepo-client
```

```tsx title="libs/shared/graphql-schema/codegen.ts（スキーマパッケージ）"
import { schemaPreset } from "graphql-codegen-preset-monorepo-client";

const config = {
  schema: "src/schema.graphql",
  generates: {
    "src/__generated__/": {
      preset: schemaPreset,
      // 列挙型、スカラー型、入力型のみ生成
    },
  },
};

export default config;
```

```tsx title="libs/features/user/codegen.ts（フィーチャーパッケージ）"
import { packagePreset } from "graphql-codegen-preset-monorepo-client";

const config = {
  schema: "../../shared/graphql-schema/src/schema.graphql",
  documents: ["src/**/*.{ts,tsx}"],
  generates: {
    "src/__generated__/": {
      preset: packagePreset,
      presetConfig: {
        // スキーマ型の参照先（npm パッケージ名 or 相対パス）
        schemaTypesPath: "@myorg/graphql-schema",
      },
    },
  },
};

export default config;
```

**注意**: monorepo-client preset は client preset ベースのため、Fragment Masking のランタイムコードが含まれる。Apollo Client 公式はこれを推奨していない点に留意。

#### 方法3: プロジェクトごとの codegen.ts + Nx target（実践的）

最もシンプルかつ Nx のキャッシュ機構と相性が良い方法[[4]](#参考リンク)。

各ライブラリの `project.json` に codegen ターゲットを定義:

```json title="libs/features/user/project.json"
{
  "targets": {
    "codegen": {
      "command": "npx graphql-codegen --config {projectRoot}/codegen.ts"
    }
  }
}
```

`nx.json` でキャッシュと依存関係を一元管理:

```json title="nx.json（抜粋）"
{
  "targetDefaults": {
    "codegen": {
      "cache": true,
      "outputs": ["{projectRoot}/src/__generated__"],
      "inputs": [
        "{workspaceRoot}/libs/shared/graphql-schema/src/**/*.graphql",
        "{projectRoot}/**/*.graphql"
      ],
      "dependsOn": ["^codegen"]
    }
  }
}
```

一括実行:

```bash
# 全プロジェクトの codegen を依存順に実行（キャッシュ付き）
npx nx run-many -t codegen

# 特定プロジェクトのみ
npx nx run features-user:codegen
```

### 4. Fragment Colocation パターン

コンポーネントのデータ要件を GraphQL Fragment として同じファイル/ディレクトリに配置するパターン[[7]](#参考リンク)。

```graphql title="libs/features/user/src/components/UserAvatar.graphql"
fragment UserAvatarFields on User {
  id
  avatarUrl
  displayName
}
```

```graphql title="libs/features/user/src/components/UserProfile.graphql"
#import "./UserAvatar.graphql"

query GetUserProfile($id: ID!) {
  user(id: $id) {
    ...UserAvatarFields
    email
    bio
    createdAt
  }
}
```

```tsx title="libs/features/user/src/components/UserAvatar.tsx"
import { UserAvatarFieldsFragment } from "./__generated__/UserAvatar.generated";

interface Props {
  user: UserAvatarFieldsFragment;
}

export function UserAvatar({ user }: Props) {
  return <img src={user.avatarUrl} alt={user.displayName} />;
}
```

### 5. プリセット比較まとめ

| 項目 | near-operation-file | monorepo-client | Nx target + 個別設定 |
|------|-------------------|-----------------|---------------------|
| Apollo Client 互換性 | 高（推奨） | 中（client preset ベース） | 高 |
| ランタイムコード | なし | あり（Fragment Masking） | なし |
| 型の分散配置 | operation ファイルの隣 | `__generated__` ディレクトリ | 自由に設定可能 |
| Nx キャッシュ連携 | 設定次第 | 設定次第 | 最適 |
| セットアップ複雑度 | 中 | 中 | 低（最もシンプル） |
| Fragment Colocation | 対応 | 対応 | 対応 |

## 検証結果

### 推奨セットアップ（Nx + near-operation-file + Apollo Client v4）

以下の組み合わせが、型安全性・バンドルサイズ・開発体験のバランスが最も良い。

```bash title="必要なパッケージ"
# Apollo Client v4
npm install @apollo/client graphql rxjs

# graphql-codegen
npm install -D @graphql-codegen/cli \
  @graphql-codegen/typescript \
  @graphql-codegen/typescript-operations \
  @graphql-codegen/typed-document-node \
  @graphql-codegen/near-operation-file-preset
```

```tsx title="libs/shared/graphql-schema/codegen.ts"
import { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "src/schema.graphql",
  generates: {
    "src/__generated__/types.ts": {
      plugins: ["typescript"],
      config: {
        avoidOptionals: { field: true, inputValue: false },
        defaultScalarType: "unknown",
        nonOptionalTypename: true,
      },
    },
  },
};

export default config;
```

```tsx title="libs/features/user/codegen.ts"
import { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../../shared/graphql-schema/src/schema.graphql",
  documents: ["src/**/*.graphql"],
  generates: {
    "src/": {
      preset: "near-operation-file",
      presetConfig: {
        extension: ".generated.ts",
        baseTypesPath: "~@myorg/graphql-schema/__generated__/types",
        folder: "__generated__",
      },
      plugins: ["typescript-operations", "typed-document-node"],
      config: {
        avoidOptionals: { field: true, inputValue: false },
      },
    },
  },
};

export default config;
```

```tsx title="apps/web/src/app/App.tsx（クライアント初期化）"
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { HttpLink } from "@apollo/client/link/http";
import { ApolloProvider } from "@apollo/client/react";

const client = new ApolloClient({
  link: new HttpLink({ uri: "/graphql" }),
  cache: new InMemoryCache(),
});

export function App() {
  return (
    <ApolloProvider client={client}>
      <RouterOutlet />
    </ApolloProvider>
  );
}
```

```json title="nx.json（codegen キャッシュ設定）"
{
  "targetDefaults": {
    "codegen": {
      "cache": true,
      "outputs": ["{projectRoot}/src/__generated__"],
      "inputs": [
        "{workspaceRoot}/libs/shared/graphql-schema/src/**/*.graphql",
        "{projectRoot}/**/*.graphql"
      ],
      "dependsOn": ["^codegen"]
    }
  }
}
```

## まとめ

### Apollo Client v4

- バンドルサイズ20-30%削減、`dataState` による明確な状態管理、エラーハンドリングの改善が主な利点
- RxJS がピア依存として必要になる点、React hooks の import パス変更は要注意
- 公式 codemod で v3 → v4 の機械的な移行は90%自動化可能

### graphql-codegen + モノレポ

- Apollo Client アプリでは **client preset を避け**、`typescript` + `typescript-operations` + `typed-document-node` の組み合わせが推奨
- GraphQL document の分散配置には **near-operation-file preset** が最適。コンポーネントの隣に `.graphql` ファイルと生成された型ファイルが配置され、コードナビゲーションが直感的
- Nx の `targetDefaults` でキャッシュと依存順序を設定すれば、`nx run-many -t codegen` で全ライブラリの型生成を効率的に実行可能

### 実プロジェクトへの適用指針

- **小〜中規模**: 方法3（プロジェクトごとの codegen.ts + Nx target）で十分。シンプルで理解しやすい
- **大規模（Fragment 共有が多い）**: 方法1（near-operation-file preset）を採用し、Fragment Colocation を徹底する
- **既存の client preset 利用**: monorepo-client preset への段階的移行を検討するが、Apollo 公式の推奨ではない点に留意

## 参考リンク

1. [Apollo Client 4.0: A Leaner and Cleaner GraphQL Client with No Compromises](https://www.apollographql.com/blog/announcing-apollo-client-4-0)
2. [GraphQL Codegen - Apollo GraphQL Docs](https://www.apollographql.com/docs/react/development-testing/graphql-codegen)
3. [Migrating to Apollo Client 4.0 - Apollo GraphQL Docs](https://www.apollographql.com/docs/react/migrating/apollo-client-4-migration)
4. [Using Apollo GraphQL in an Nx Workspace | Nx Blog](https://nx.dev/blog/using-apollo-graphql-in-an-nx-workspace)
5. [Near Operation File Preset - GraphQL Codegen](https://the-guild.dev/graphql/codegen/plugins/presets/near-operation-file-preset)
6. [graphql-codegen-preset-monorepo-client - GitHub](https://github.com/Ambroos/graphql-codegen-preset-monorepo-client)
7. [Generated Files Colocation - GraphQL Codegen](https://the-guild.dev/graphql/codegen/docs/advanced/generated-files-colocation)
8. [Apollo GraphQL Client 4.0 Released - InfoQ](https://www.infoq.com/news/2025/09/apollo-client-4-released/)

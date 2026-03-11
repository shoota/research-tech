---
id: monorepo-strategy
title: モノレポ戦略 - Turborepo / Nx によるスケーラブルな開発基盤
sidebar_position: 1
tags: [monorepo, turborepo, nx, pnpm, build-system]
last_update:
  date: 2026-03-06
---

# モノレポ戦略 - Turborepo / Nx によるスケーラブルな開発基盤

## 概要

モノレポ（Monorepo）は、複数のプロジェクトやパッケージを単一のリポジトリで管理する開発戦略である。本ドキュメントでは、モノレポの基本的なメリット・デメリットを整理したうえで、代表的なモノレポツールである Turborepo と Nx の仕組み・設計思想・機能比較を調査し、pnpm workspaces や Changesets との組み合わせによる実践的な導入パターンをまとめた。

:::info 関連ドキュメント
- [Apollo Client v4 + graphql-codegen + Nxモノレポ設定ガイド](../../graphql/apollo-client-v4-codegen-monorepo)
- [Knip - JavaScript/TypeScript プロジェクトの未使用コード検出ツール](../knip)
:::

## 背景・動機

フロントエンド開発において、共通 UI コンポーネントライブラリ、ユーティリティ関数、設定ファイル（ESLint / TypeScript）などを複数のアプリケーション間で共有するケースが増えている。ポリレポ（各プロジェクトごとに独立したリポジトリ）では、依存関係の同期やバージョン管理が煩雑になりやすい。モノレポを採用し適切なツールで管理することで、コード共有・CI/CD・バージョニングを効率化できる可能性がある。Turborepo と Nx はそれぞれ異なるアプローチでモノレポの課題を解決しており、プロジェクトの規模や要件に応じた選定が重要となる。

## 調査内容

### モノレポのメリット・デメリット

#### メリット

- **コード共有の容易さ**: 共通パッケージを同一リポジトリ内で直接参照できるため、npm への公開やバージョン同期が不要になる
- **アトミックな変更**: 複数パッケージにまたがる変更を単一のコミット・PR で実施できる
- **統一された CI/CD**: ビルド・テスト・デプロイのパイプラインを一元管理できる
- **依存関係の可視化**: パッケージ間の依存グラフが明確になり、影響範囲を把握しやすい
- **開発環境の統一**: ESLint、TypeScript、Prettier などの設定をリポジトリ全体で共有できる

#### デメリット

- **リポジトリの肥大化**: プロジェクトが増えるにつれ、git clone やチェックアウトが遅くなる可能性がある
- **CI の複雑化**: 全パッケージをビルド・テストすると時間がかかるため、変更検知やキャッシュ戦略が必須になる
- **権限管理の難しさ**: リポジトリ単位の権限制御では、パッケージごとのアクセス制限が困難
- **ツールの学習コスト**: モノレポ管理ツール固有の設定・概念の理解が必要
- **コンフリクトのリスク**: 多人数開発では lock ファイルのコンフリクトが頻発しやすい

### Turborepo の仕組み

Turborepo は Vercel が開発するモノレポ向けの高速タスクランナーである[[1]](#参考リンク)。シンプルな設定で導入でき、既存のモノレポに10分以内で追加できることを特徴としている。2023年以降、コアをGoからRustへ移行しパフォーマンスを向上させている[[5]](#参考リンク)。

#### タスクグラフと依存関係

Turborepo は `turbo.json` に定義されたタスク構成に基づき、パッケージ間の依存グラフを構築する。独立したタスクは自動的に並列実行され、依存関係がある場合のみ順序が保証される[[2]](#参考リンク)。

```json title="turbo.json"
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

`dependsOn` には3種類の依存関係を指定できる[[2]](#参考リンク):

- **`^build`（キャレット接頭辞）**: パッケージの依存先の `build` タスクを先に実行する
- **`build`（接頭辞なし）**: 同一パッケージ内の `build` タスクを先に実行する
- **`utils#build`（パッケージ名指定）**: 特定パッケージの特定タスクに依存する

#### キャッシュシステム

Turborepo はタスクの入力（ソースコード、依存関係、環境変数など）からハッシュを計算し、同一のハッシュであれば過去のビルド成果物を再利用する[[3]](#参考リンク)。`outputs` に指定されたファイル・ディレクトリがキャッシュ対象となる。

```json title="turbo.json（キャッシュ設定例）"
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"],
      "inputs": ["src/**", "package.json", "tsconfig.json"]
    },
    "spell-check": {
      "inputs": ["**/*.md", "**/*.mdx"]
    },
    "deploy": {
      "cache": false
    }
  }
}
```

#### Remote Caching

Remote Caching はビルド成果物をクラウド上の共有ストアに保存し、チームメンバーや CI パイプライン間でキャッシュを共有する仕組みである[[3]](#参考リンク)。Vercel が提供するマネージドの Remote Cache に無料で接続できるほか、Turborepo の Remote Caching API 仕様に準拠した任意の HTTP サーバーをセルフホストすることも可能である[[3]](#参考リンク)。

```bash
# Vercel Remote Cache との連携
npx turbo login
npx turbo link
```

### Nx の仕組み

Nx は Nrwl（現 Nx）が開発するモノレポ管理プラットフォームで、単なるタスクランナーを超えた「Build Intelligence Platform」として位置づけられている[[4]](#参考リンク)。タスク実行の高速化に加え、コード生成、モジュール境界の管理、プラグインエコシステムなど包括的な機能を提供する。

#### Computation Caching

Nx はキャッシュ可能なタスクを実行する前に、computation hash（計算ハッシュ）を算出する。ハッシュの計算要素には以下が含まれる[[6]](#参考リンク):

- プロジェクトおよびその依存プロジェクトのソースファイル
- グローバル設定
- 外部依存パッケージのバージョン
- ランタイムの値（Node.js バージョンなど）
- CLI コマンドのフラグ

キャッシュには以下の3要素が保存される[[6]](#参考リンク):

1. **ターミナル出力**: ログ・警告・エラーメッセージ
2. **タスク成果物**: `outputs` プロパティで定義されたファイル
3. **ハッシュ値**: computation hash そのもの

```json title="nx.json（キャッシュ設定例）"
{
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    },
    "test": {
      "inputs": ["default", "^production", "{workspaceRoot}/jest.preset.js"],
      "cache": true
    }
  },
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": ["default", "!{projectRoot}/**/*.spec.ts"],
    "sharedGlobals": ["{workspaceRoot}/tsconfig.base.json"]
  }
}
```

#### Remote Cache

Nx v20.8（2025年4月）以降、セルフホスト型のリモートキャッシュが再び無料化された[[7]](#参考リンク)。Nx v21 以降では Nx Remote Cache Plugins を通じてリモートキャッシュを構成する方式が推奨されている。また、Nx Cloud を利用すれば、マネージドのリモートキャッシュに加え、分散タスク実行（Nx Agents）も利用できる[[8]](#参考リンク)。

#### タスクオーケストレーション

Nx はプロジェクト間の依存グラフを解析し、タスクの実行順序を最適化する。Nx Agents は複数マシンにタスクを分散実行するシステムで、過去の実行時間に基づいてタスクを割り当てる[[8]](#参考リンク)。

```bash
# 影響を受けたプロジェクトのみビルド
npx nx affected -t build

# プロジェクトグラフの可視化
npx nx graph
```

#### プラグインシステム

Nx のプラグインは「VSCode の拡張機能」に例えられる設計思想を持ち[[4]](#参考リンク)、ツールごとのタスク推論やキャッシュ設定を自動化する:

- **`@nx/react`**: React アプリケーションのセットアップとビルド設定
- **`@nx/next`**: Next.js 固有のビルド・サーブ設定
- **`@nx/jest`** / **`@nx/vitest`**: テストランナーの統合
- **`@nx/eslint`**: リンティング設定の自動推論
- **`@nx/cypress`** / **`@nx/playwright`**: E2E テストの統合

プラグインは `nx.json` に登録する:

```json title="nx.json（プラグイン設定例）"
{
  "plugins": [
    "@nx/eslint/plugin",
    "@nx/jest/plugin",
    {
      "plugin": "@nx/next/plugin",
      "options": {
        "buildTargetName": "build",
        "devTargetName": "dev"
      }
    }
  ]
}
```

### Turborepo vs Nx 比較

| 観点 | Turborepo | Nx |
|------|-----------|-----|
| **設計思想** | 高速タスクランナー | Build Intelligence Platform |
| **セットアップ** | 既存モノレポに即座に導入可能 | ジェネレーターによるスキャフォールド推奨 |
| **設定ファイル** | `turbo.json` のみ | `nx.json` + `project.json` |
| **コード生成** | なし | ジェネレーター内蔵 |
| **モジュール境界** | なし | ESLint ルールで強制可能 |
| **プラグイン** | なし（シンプルな設計） | 豊富なプラグインエコシステム |
| **言語サポート** | JavaScript / TypeScript 専用 | 多言語対応（Java, .NET, Go, Python 等）[[5]](#参考リンク) |
| **小規模プロジェクト性能** | 約3倍高速（2-5パッケージ）[[5]](#参考リンク) | 初期オーバーヘッドあり |
| **大規模プロジェクト性能** | 一定以上で性能低下 | 7倍以上高速（大規模モノレポ）[[5]](#参考リンク) |
| **Remote Cache** | Vercel 無料提供 | Nx Cloud（有料） / セルフホスト（無料）[[7]](#参考リンク) |
| **CI 分散実行** | なし | Nx Agents による分散実行[[8]](#参考リンク) |
| **コア実装** | Rust（Go から移行済み） | Rust 移行中（2025年〜）[[5]](#参考リンク) |

#### 選定の指針

- **Turborepo が適するケース**: 小〜中規模のモノレポ、シンプルなタスク実行の高速化が目的、Vercel エコシステムとの統合、最小限の学習コストで導入したい場合
- **Nx が適するケース**: 大規模モノレポ、コード生成やモジュール境界管理が必要、多言語対応が求められる、CI の分散実行で大幅な高速化を目指す場合

### pnpm workspaces / npm workspaces との関係

Turborepo と Nx はいずれもパッケージマネージャーのワークスペース機能の上に構築されている。ワークスペース機能がパッケージの依存解決とリンクを担い、Turborepo / Nx がタスク実行の最適化・キャッシュを担うという役割分担になる。

#### pnpm workspaces

pnpm は content-addressable ストアを採用し、共有依存関係へのハードリンクを作成することで、ディスク使用量を60〜80%削減し、インストール時間を3〜5倍高速化する[[9]](#参考リンク)。

```yaml title="pnpm-workspace.yaml"
packages:
  - "apps/*"
  - "packages/*"
```

```json title="package.json（内部パッケージ参照）"
{
  "dependencies": {
    "@myorg/ui": "workspace:*",
    "@myorg/utils": "workspace:*"
  }
}
```

`workspace:*` プロトコルにより、常にローカルバージョンが参照される。npm publish 時には実際のバージョン番号に自動置換される[[9]](#参考リンク)。

#### npm workspaces

npm 7 以降で利用可能。`package.json` の `workspaces` フィールドで設定する:

```json title="package.json（ルート）"
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

pnpm と比較すると、依存関係のホイスティング方式が異なり、phantom dependencies（暗黙的な依存関係）が発生しやすい点に注意が必要である。

### Changesets によるバージョニング戦略

Changesets は、モノレポ内のパッケージのバージョン管理とチェンジログ生成を自動化するツールである[[10]](#参考リンク)。

#### 基本ワークフロー

```bash
# 1. Changesets CLI のインストール
pnpm add -Dw @changesets/cli

# 2. 初期化
pnpm changeset init

# 3. 変更の記録（対話形式でパッケージ・バージョン種別を選択）
pnpm changeset

# 4. バージョンの更新とチェンジログ生成
pnpm changeset version

# 5. パッケージの公開
pnpm changeset publish
```

#### 設定ファイル

```json title=".changeset/config.json"
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [["@myorg/ui", "@myorg/theme"]],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

- **`fixed`**: 常に同じバージョンで公開するパッケージグループ
- **`linked`**: バージョンを連動させるパッケージグループ（いずれかが更新されると全体のバージョンが上がる）
- **`updateInternalDependencies`**: 内部依存の更新時のバージョンバンプ種別

#### CI での自動化

GitHub Actions で Changesets Bot を利用し、PR にチェンジセットの追加を促す運用が一般的である:

```yaml title=".github/workflows/release.yml"
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
          version: pnpm changeset version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 大規模フロントエンドでの実践パターン

#### ディレクトリ構成例

```text
my-monorepo/
+-- apps/
|   +-- web/              # メインの Web アプリケーション
|   +-- admin/            # 管理画面
|   \-- docs/             # ドキュメントサイト
+-- packages/
|   +-- ui/               # 共通 UI コンポーネント
|   +-- utils/            # ユーティリティ関数
|   +-- config-eslint/    # 共有 ESLint 設定
|   +-- config-typescript/ # 共有 TypeScript 設定
|   \-- api-client/       # API クライアント
+-- turbo.json            # または nx.json
+-- pnpm-workspace.yaml
\-- package.json
```

#### 共有パッケージの設計

```json title="packages/ui/package.json"
{
  "name": "@myorg/ui",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    },
    "./button": {
      "import": "./src/components/Button.tsx",
      "types": "./src/components/Button.tsx"
    }
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  }
}
```

Internal Packages パターン（Turborepo 推奨）では、ビルドステップを省略し、ソースコードを直接エクスポートする。アプリケーション側のバンドラー（Next.js の `transpilePackages` など）がトランスパイルを担う。

#### TypeScript 設定の共有

```json title="packages/config-typescript/tsconfig.base.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

```json title="apps/web/tsconfig.json"
{
  "extends": "@myorg/config-typescript/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

## 検証結果

### Turborepo のセットアップ

既存の pnpm workspace プロジェクトに Turborepo を追加する手順:

```bash
# 1. Turborepo をルートにインストール
pnpm add -Dw turbo

# 2. turbo.json を作成
cat > turbo.json << 'EOF'
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
EOF

# 3. .gitignore に Turborepo キャッシュを追加
echo ".turbo" >> .gitignore

# 4. タスクの実行
pnpm turbo build     # 全パッケージのビルド
pnpm turbo lint test # lint と test を並列実行
```

初回ビルド後は、変更のないパッケージに対してキャッシュが適用され、2回目以降のビルドが大幅に高速化される。`--filter` オプションで特定パッケージのみを対象にできる:

```bash
# web アプリとその依存パッケージのみビルド
pnpm turbo build --filter=web...

# 特定パッケージのみ
pnpm turbo test --filter=@myorg/ui
```

### Nx のセットアップ

既存のワークスペースに Nx を追加する手順:

```bash
# 1. Nx をインストール
pnpm add -Dw nx @nx/js

# 2. 初期化
npx nx init

# 3. プロジェクトグラフの確認
npx nx graph

# 4. タスクの実行
npx nx run-many -t build        # 全プロジェクトのビルド
npx nx affected -t test         # 変更の影響を受けたプロジェクトのみテスト
npx nx run web:build            # 特定プロジェクトのビルド
```

Nx のジェネレーターを使ったコード生成:

```bash
# React ライブラリの新規作成
npx nx g @nx/react:library ui --directory=packages/ui

# React コンポーネントの生成
npx nx g @nx/react:component Button --project=ui
```

## まとめ

### 所感

- **Turborepo** はシンプルさが最大の強み。既存の pnpm workspaces プロジェクトに `turbo.json` を1ファイル追加するだけで、ビルドキャッシュと並列実行の恩恵を受けられる。設定の学習コストが低く、小〜中規模のモノレポには最適解といえる
- **Nx** は大規模プロジェクトでの真価を発揮する。プラグインによるコード生成、モジュール境界の管理、CI の分散実行など、組織的なスケーラビリティを支える機能が充実している。ただし、設定の複雑さと学習コストは Turborepo より高い
- **pnpm workspaces** はどちらのツールとも組み合わせて使う基盤レイヤーであり、モノレポ導入の第一歩として推奨できる
- **Changesets** はパッケージ公開が必要な場合のバージョニング自動化に不可欠。Turborepo / Nx いずれとも組み合わせ可能

### プロジェクトへの適用可否

| シナリオ | 推奨ツール |
|---------|-----------|
| 2〜5パッケージの小規模モノレポ | pnpm workspaces + Turborepo |
| 10パッケージ以上の中〜大規模モノレポ | pnpm workspaces + Nx |
| Vercel / Next.js 中心の開発 | Turborepo（エコシステム親和性が高い） |
| 多言語（JS + Go + Python 等）のモノレポ | Nx（多言語サポート） |
| npm パッケージの公開が必要 | 上記 + Changesets |
| まず試してみたい | pnpm workspaces + Turborepo（導入コスト最小） |

## 参考リンク

1. [Turborepo 公式ドキュメント](https://turborepo.dev/docs)
2. [Configuring tasks - Turborepo](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks)
3. [Remote Caching - Turborepo](https://turborepo.dev/docs/core-concepts/remote-caching)
4. [Mental Model - Nx](https://nx.dev/docs/concepts/mental-model)
5. [Turborepo, Nx, and Lerna: The Truth about Monorepo Tooling in 2026 - DEV Community](https://dev.to/dataformathub/turborepo-nx-and-lerna-the-truth-about-monorepo-tooling-in-2026-71)
6. [How Caching Works - Nx](https://nx.dev/docs/concepts/how-caching-works)
7. [Exploring of Nx Self-Hosted Cache - Emily Xiong](https://emilyxiong.medium.com/exploring-of-nx-self-hosted-cache-5bc39bd2ed7f)
8. [Distribute Task Execution (Nx Agents) - Nx](https://nx.dev/docs/features/ci-features/distribute-task-execution)
9. [Complete Monorepo Guide: pnpm + Workspace + Changesets (2025)](https://jsdev.space/complete-monorepo-guide/)
10. [Using Changesets with pnpm - pnpm](https://pnpm.io/using-changesets)
11. [Nx vs. Turborepo: Integrated Ecosystem or High-Speed Task Runner? - DEV Community](https://dev.to/thedavestack/nx-vs-turborepo-integrated-ecosystem-or-high-speed-task-runner-the-key-decision-for-your-monorepo-279)
12. [Wrapping Up 2025 - Nx Blog](https://nx.dev/blog/wrapping-up-2025)

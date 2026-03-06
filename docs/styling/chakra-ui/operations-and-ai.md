---
id: chakra-ui-operations-and-ai
title: "Chakra UI v3 の運用ガイド — AI連携・カスタマイズ・落とし穴"
sidebar_position: 2
tags: [Chakra UI, React, AI連携, MCP, 運用]
last_update:
  date: 2026-03-06
---

# Chakra UI v3 の運用ガイド — AI連携・カスタマイズ・落とし穴

:::info 関連ドキュメント
- [Chakra UI v3 の設計思想とアーキテクチャ](/docs/styling/chakra-ui/chakra-ui-design-and-architecture) — レシピシステム、テーマ、エコシステム
- [shadcn/ui の運用ガイド](/docs/styling/shadcn-ui/shadcn-ui-operations-and-pitfalls) — shadcn/ui の AI連携・運用との比較
:::

## 概要

Chakra UI v3 を実プロジェクトで運用する際に必要な AI 連携環境（MCP Server、AI Rules、llms.txt）、v2 からの移行戦略、運用上の落とし穴とリスクについて調査した。特に AI ツールとの連携は Chakra UI が公式に注力している領域であり、shadcn/ui の AI 対応と比較しながら整理する。

## 背景・動機

Chakra UI v3 は完全な書き直しであり、v2 からの移行は「単なるアップグレード」ではなく「アーキテクチャの変更」に近い[[1]](#参考リンク)。加えて、多くの LLM が v2 のコードで学習されているため、AI ツールが v3 の正しいコードを生成するには追加の設定が必要になる[[2]](#参考リンク)。運用フェーズで直面する課題を事前に把握するため調査を行う。

## 調査内容

### 1. AI 連携環境の整備

Chakra UI は AI ツールとの連携を公式にサポートしており、3 つの仕組みを提供している[[2]](#参考リンク)。

#### llms.txt — LLM 向けドキュメント

Chakra UI は複数の粒度で LLM 向けドキュメントを提供している[[2]](#参考リンク)[[3]](#参考リンク):

| ファイル | 内容 | 用途 |
|---|---|---|
| `llms.txt` | メインドキュメント | 概要の把握 |
| `llms-full.txt` | v3 の完全なドキュメント | 包括的なナレッジベース |
| `llms-components.txt` | 全コンポーネントのドキュメント | コンポーネント API の参照 |
| `llms-component/[name].txt` | 個別コンポーネント | 特定コンポーネントのみ必要な場合 |
| `llms-styling.txt` | スタイリング関連 | スタイルプロップス・レシピの参照 |
| `llms-theming.txt` | テーマ関連 | トークン・テーマ設定の参照 |
| `llms-v3-migration.txt` | v2→v3 移行ガイド | 移行コードの生成 |

この粒度の細かさは shadcn/ui の `llms.txt`（単一ファイル）と比較して優れている点であり、LLM のコンテキストウィンドウを効率的に使える。

**使用方法:**

```text
// Cursor の場合: Settings > Rules for AI にファイルを追加
// ChatGPT の場合: サイドバーのナレッジベースにアップロード
// NotebookLM の場合: ソースとして追加
```

#### AI Rules — コーディングルール

`.cursorrules` や `.github/copilot-instructions.md` に配置する AI 向けコーディングルールを公式に提供している[[4]](#参考リンク)。主な内容:

- **インポートパス**: `@chakra-ui/react` と `components/ui/` の使い分け
- **v2→v3 の変換パターン**: `useToast()` → `toaster.create()`、`Modal` → `Dialog.Root` など
- **依存関係**: `@emotion/styled` と `framer-motion` の除去
- **コンポーネント構造**: 合成コンポーネントの正しい組み立て方

```markdown title=".cursorrules の例"
# Chakra UI v3 Rules

## Imports
- Use `@chakra-ui/react` for all Chakra components
- Use `components/ui/` for snippet-based compositions

## Component Patterns
- Use compound component pattern: `Component.Root`, `Component.Item`
- Use `disabled` instead of `isDisabled`
- Use `gap` instead of `spacing` in Stack
- Embed icons directly as children, not via `leftIcon`/`rightIcon` props

## Toast
- Use `toaster.create({ title, type })` instead of `useToast()`
- `type` replaces `status` ("success", "error", "warning", "info")
```

これは LLM が v2 コードを生成してしまう問題への直接的な対策であり、プロジェクトに配置するだけで AI の出力品質が向上する。

#### MCP Server — AI アシスタント統合

Chakra UI MCP Server は、AI アシスタントに Chakra UI v3 のコンポーネント情報を動的に提供するサーバーである[[5]](#参考リンク)[[6]](#参考リンク):

**提供するツール:**

| ツール | 機能 |
|---|---|
| `list_components` | 利用可能な全コンポーネントの一覧取得 |
| `get_component_props` | コンポーネントの Props・型・設定オプションの詳細取得 |
| `get_component_example` | コンポーネントの使用例・コードパターン取得 |
| `v2_to_v3_code_review` | v2 コードの v3 移行ガイダンス |
| デザイントークン関連 | トークンの一覧取得・カスタムトークン作成支援 |
| Chakra UI Pro 統合 | テンプレートの検索・取得（API キー必要） |

**セットアップ（VS Code + GitHub Copilot）:**

```json title=".vscode/mcp.json"
{
  "servers": {
    "chakra-ui": {
      "type": "npx",
      "command": "npx",
      "args": ["@chakra-ui/mcp-server"]
    }
  }
}
```

**対応 AI クライアント:**
- Claude Code / Claude Desktop（MCP ネイティブ対応）
- Cursor（MCP サーバー連携）
- GitHub Copilot（VS Code MCP 統合）

#### shadcn/ui の AI 連携との比較

| 観点 | Chakra UI v3 | shadcn/ui |
|---|---|---|
| **llms.txt** | 7種類の粒度別ファイル | 単一ファイル |
| **AI Rules** | `.cursorrules` テンプレート提供 | なし（llms.txt に含まれる） |
| **MCP Server** | コンポーネント情報 + v2→v3 移行支援 | レジストリ操作（検索・インストール） |
| **v0 連携** | なし | Vercel v0 との統合 |
| **課題** | LLM の v2 学習バイアス | 特になし（新しいため v3 以前がない） |

Chakra UI は「既存の LLM が v2 で学習されている」という固有の課題に対処するため、shadcn/ui 以上に AI 向けドキュメントの整備に注力している。一方、shadcn/ui は v0 との統合や MCP Server によるレジストリ操作など、AI によるコンポーネント**生成・インストール**の自動化に強みがある。

### 2. v2 からの移行戦略

#### 移行の規模感

v3 は v2 の完全な書き直しであり、移行は大規模な作業になる[[1]](#参考リンク)[[7]](#参考リンク):

- コンポーネント構造の変更（クローズド → 合成コンポーネント）
- Props の命名変更（`isDisabled` → `disabled` 等）
- テーマシステムの変更（`extendTheme` → `createSystem`）
- 依存関係の変更（`framer-motion` 除去）
- インポートパスの変更

#### codemod による自動移行

`@chakra-ui/codemod` パッケージが提供されており、一部の変更を自動化できる[[8]](#参考リンク):

```bash title="codemod の実行"
# codemod でコンポーネント名・Props の自動変換
npx @chakra-ui/codemod --src ./src
```

自動化される主な変更:
- コンポーネント名のリネーム
- Props 名の更新（`isDisabled` → `disabled`）
- インポートパスの更新
- 一部の合成コンポーネント構造への変換

ただし、テーマの移行やカスタムコンポーネントの構造変更は手動作業が必要。

#### 段階的移行の課題

v2 と v3 のプロバイダーを同時に使用する段階的移行は、公式には推奨されていない[[9]](#参考リンク)。v3 コンポーネントは v2 プロバイダーの下ではスタイルが適用されず、逆も同様であるため、実質的に一括移行が必要となる。

```text title="推奨される移行ステップ"
Phase 1: 準備
  - 別ブランチで移行作業を開始
  - @chakra-ui/codemod で自動変換可能な部分を処理
  - 依存関係の更新（framer-motion 除去、@emotion/styled 除去）

Phase 2: テーマ移行
  - extendTheme → createSystem + defineConfig に変換
  - カスタムトークンの再定義
  - セマンティックトークンの設定

Phase 3: コンポーネント移行
  - スニペットの追加（npx @chakra-ui/cli snippet add --all）
  - 各コンポーネントの合成パターンへの変換
  - カスタムコンポーネントの調整

Phase 4: テスト・検証
  - ビジュアルリグレッションテスト
  - アクセシビリティテスト
  - ダークモードの動作確認
```

### 3. 運用上の落とし穴・リスク

#### 3.1 ランタイム CSS-in-JS の制約

Chakra UI v3 は Emotion を維持しているため、以下の制約がある:

- **React Server Components**: すべてのコンポーネントに `use client` ディレクティブが必要。Server Components の恩恵（バンドルサイズ削減、初期ロード高速化）を受けにくい
- **ストリーミング SSR**: Emotion のスタイル挿入がストリーミングと相性が悪い場合がある
- **パフォーマンス**: ランタイムでスタイルを生成するため、大量のコンポーネントレンダリング時にオーバーヘッドが発生する

```tsx title="RSC での制約"
// Chakra UI のコンポーネントを使うページは必ず Client Component になる
"use client";

import { Box, Text, Button } from "@chakra-ui/react";

export function MyComponent() {
  return (
    <Box p="4">
      <Text>このコンポーネントはクライアントでのみレンダリングされる</Text>
      <Button>アクション</Button>
    </Box>
  );
}
```

**対策**: レイアウトやデータ取得は Server Components で行い、Chakra UI コンポーネントを使う部分のみ `use client` で分離する。

#### 3.2 v3 移行のドキュメント不足

v3 の移行ガイドは提供されているが、以下の点でカバレッジが不十分との報告がある[[7]](#参考リンク)[[9]](#参考リンク):

- 一部コンポーネントの名前変更がドキュメント化されていない
- `<Hide>` コンポーネントの削除と `<Show>` の挙動変更が記載されていない
- フォントサイズのデフォルト値変更が明記されていない
- `<Toast>` がフック方式からスニペット方式に変更された詳細が不十分

**対策**: `llms-v3-migration.txt` や MCP Server の `v2_to_v3_code_review` ツールを活用し、AI に移行パターンを確認させる。

#### 3.3 LLM が v2 コードを生成する問題

多くの LLM は v2 の Chakra UI コードで学習されているため、AI ツールが古い API を使ったコードを生成する[[2]](#参考リンク):

```tsx title="LLM が生成しがちな v2 コード（誤り）"
// NG: v2 の API
import { useToast } from "@chakra-ui/react";

const toast = useToast();
toast({ title: "保存しました", status: "success" });
```

```tsx title="正しい v3 コード"
// OK: v3 の API
import { toaster } from "components/ui/toaster";

toaster.create({ title: "保存しました", type: "success" });
```

**対策**: AI Rules（`.cursorrules`）をプロジェクトに配置し、v3 のパターンを明示する。MCP Server を設定すれば、AI がリアルタイムで正しい API を参照できる。

#### 3.4 合成コンポーネントの記述量増加

v3 のオープンコンポーネント設計はカスタマイズ性を高めるが、単純な使用でも記述量が増える:

```tsx title="v2 と v3 の記述量の比較"
// v2: 1 行
<Checkbox isChecked={true}>同意する</Checkbox>

// v3: 5 行
<Checkbox.Root checked={true}>
  <Checkbox.HiddenInput />
  <Checkbox.Control>
    <Checkbox.Indicator />
  </Checkbox.Control>
  <Checkbox.Label>同意する</Checkbox.Label>
</Checkbox.Root>
```

**対策**: Snippets を活用する。`npx @chakra-ui/cli snippet add checkbox` で生成されるラッパーコンポーネントを使えば、簡潔な API で利用できる:

```tsx title="Snippet を使った簡潔な記述"
import { Checkbox } from "components/ui/checkbox";

// Snippet が合成パターンをラップしている
<Checkbox checked={true}>同意する</Checkbox>
```

#### 3.5 テーマ移行の複雑さ

v2 の `extendTheme` から v3 の `createSystem` + `defineConfig` への移行は、テーマの構造自体が変わるため手動作業が多い:

```tsx title="v2 のテーマ（移行前）"
// v2: extendTheme でオーバーライド
import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  colors: {
    brand: { 500: "#0ea5e9" },
  },
  components: {
    Button: {
      baseStyle: { fontWeight: "bold" },
      variants: {
        brand: { bg: "brand.500", color: "white" },
      },
    },
  },
});
```

```tsx title="v3 のテーマ（移行後）"
// v3: createSystem + defineConfig で宣言的に定義
import { createSystem, defineConfig, defaultConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: { 500: { value: "#0ea5e9" } },
      },
    },
    recipes: {
      button: {
        base: { fontWeight: "bold" },
        variants: {
          variant: {
            brand: { bg: "brand.500", color: "white" },
          },
        },
      },
    },
  },
});

const system = createSystem(defaultConfig, config);
```

トークンの値が `"#0ea5e9"` から `{ value: "#0ea5e9" }` のオブジェクト形式に変わる点、コンポーネントスタイルが `components` からレシピシステムに移行する点は、手動での書き換えが必要。

#### 3.6 エコシステムの分散

Chakra UI のエコシステムは Zag.js / Ark UI / Panda CSS / Park UI と多数のプロジェクトに分散しており、どの組み合わせを選ぶべきか判断が難しい:

| 組み合わせ | スタイリング | 用途 |
|---|---|---|
| Chakra UI v3 | Emotion（ランタイム） | 既存の Chakra UI ユーザー、v2 からの移行 |
| Park UI | Panda CSS（ビルド時） | ゼロランタイムを求める新規プロジェクト |
| Ark UI + 独自スタイル | 任意 | 最大限の自由度が必要な場合 |

### 4. 採用判断

#### Chakra UI v3 を採用すべきケース

| 条件 | 理由 |
|---|---|
| v2 からの移行プロジェクト | API の連続性（合成パターンへの移行はあるが概念は継承） |
| スタイルプロップスを好むチーム | `<Box p="4" bg="brand.subtle">` のような直感的な記法 |
| デザイントークンの体系的な管理が必要 | セマンティックトークンの自動提供が強力 |
| ダークモード対応を効率的に行いたい | `_light` / `_dark` 条件の自動切り替え |
| AI ツールを活用して v3 コードを書きたい | MCP Server + AI Rules + llms.txt の公式サポート |

#### 採用を避けるべきケース

| 条件 | 理由 |
|---|---|
| RSC を最大限活用したい | Emotion のランタイムコストで `use client` が必須 |
| ゼロランタイムが要件 | shadcn/ui（Tailwind）や Mantine（CSS Modules）を検討 |
| Tailwind CSS を既に採用している | shadcn/ui の方が自然な選択 |
| v2 からの移行コストを負えない | v2 の維持も選択肢（ただしメンテナンス終了リスクあり） |
| バンドルサイズの最小化が最優先 | ランタイム CSS-in-JS のオーバーヘッドが存在 |

## 検証結果

### AI Rules の効果

`.cursorrules` に Chakra UI v3 のルールを配置した状態で AI にコードを生成させると、v3 の合成コンポーネントパターンや新しい Props 命名が正しく使用されることを確認した。ルールなしの場合、AI は高い確率で v2 の `isDisabled`、`useToast()` などの古い API を使用する。

### MCP Server の実用性

MCP Server を設定すると、AI アシスタントが `list_components` でコンポーネント一覧を取得し、`get_component_example` で正しい使用例を参照できる。v2 コードの v3 変換に特化した `v2_to_v3_code_review` ツールも実用的で、移行作業の効率化に寄与する。

### 移行の現実

大規模プロジェクト（100 以上のコンポーネントファイル）での v2→v3 移行は、codemod で 6-7 割は自動化できるが、テーマの再構築とカスタムコンポーネントの合成パターンへの変換に相当な工数がかかる。段階的移行が困難なため、スプリント計画に数週間を確保する必要がある[[7]](#参考リンク)。

## まとめ

**実践的な推奨事項:**

1. **AI 環境を先に整備する** — `.cursorrules` と MCP Server を最初にセットアップすることで、AI が v3 の正しいコードを生成するようになる
2. **llms.txt を活用する** — 粒度別のファイルを AI のナレッジベースに追加し、必要な分野のみ参照させる
3. **Snippets を活用する** — 合成コンポーネントの記述量増加を Snippets で緩和する。`components/ui/` ディレクトリを shadcn/ui と同様に管理する
4. **v2→v3 移行は一括で行う** — プロバイダーの共存が困難なため、別ブランチで一括移行し、codemod + AI 支援で効率化する
5. **RSC プロジェクトでは注意** — `use client` 境界を適切に設計し、データ取得やレイアウトは Server Components で行う
6. **将来の Panda CSS 移行を見据える** — レシピ API が Panda CSS と整合しているため、将来のゼロランタイム化への移行パスがある

## 参考リンク

1. [Migration to v3 — Chakra UI](https://chakra-ui.com/docs/get-started/migration)
2. [Making the docs AI-friendly — Chakra UI](https://chakra-ui.com/blog/making-docs-ai-friendly)
3. [LLMs.txt Documentation — Chakra UI](https://chakra-ui.com/docs/get-started/ai/llms)
4. [AI Rules — Chakra UI](https://chakra-ui.com/docs/get-started/ai/rules)
5. [MCP Server — Chakra UI](https://chakra-ui.com/docs/get-started/ai/mcp-server)
6. [Launching Chakra UI MCP Server — Chakra UI Blog](https://chakra-ui.com/blog/announcing-chakra-ui-mcp-server)
7. [My First Corporate Challenge: Migrating to Chakra UI v3 — Medium](https://medium.com/@ojaswanii/my-first-corporate-challenge-migrating-to-chakra-ui-v3-2d8b04affad9)
8. [Chakra UI v2 to v3 Migration Q&A — Segun Adebayo](https://www.linkedin.com/posts/thesegunadebayo_chakra-ui-v2-to-v3-migration-qa-step-by-step-activity-7284991488298516480-lzDY)
9. [Gradually upgrade from V2 to V3 — GitHub Discussion](https://github.com/chakra-ui/chakra-ui/discussions/9853)
10. [Exploring the Chakra UI MCP Server — LogRocket Blog](https://blog.logrocket.com/exploring-chakra-ui-mcp-server/)

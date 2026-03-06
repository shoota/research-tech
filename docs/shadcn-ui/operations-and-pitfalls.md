---
id: shadcn-ui-operations-and-pitfalls
title: "shadcn/ui の運用ガイド — AI連携・カスタマイズ・落とし穴"
sidebar_position: 3
last_update:
  date: 2026-03-06
---

:::info 関連ドキュメント
- [shadcn/ui の設計思想とアーキテクチャ](/docs/shadcn-ui/shadcn-ui-design-and-architecture) — デザインコンセプト、Radix/Base UI、テーマシステム
- [shadcn/ui と類似デザインシステムの比較](/docs/shadcn-ui/shadcn-ui-comparison-with-alternatives) — MUI, Chakra UI, Ant Design 等との比較
:::

## 概要

shadcn/ui を実プロジェクトで運用する際に必要となる AI 連携、コンポーネントのアップグレード・カスタマイズ戦略、そして採用時に知っておくべき落とし穴とリスクについて調査した。shadcn/ui は「コンポーネントライブラリ」ではなく「コード配布プラットフォーム」であるため、従来の npm パッケージとは異なる運用知識が求められる。

## 背景・動機

shadcn/ui は 2023 年の登場以来、React エコシステムで最も人気のあるコンポーネントコレクションの一つとなった。しかし、コードをコピーして所有する設計思想は、運用フェーズで独自の課題を生む。特に以下の点について実践的な知見が不足していた。

- AI ツール（v0、Claude、Copilot 等）との効果的な連携方法
- バージョニングが存在しないコンポーネントの更新戦略
- Radix UI・Tailwind CSS への依存がもたらすリスク
- 大規模チームでの管理・運用パターン

## 調査内容

### 1. AI に対する環境整備と v0 との連携

#### v0 とは何か

v0 は Vercel が提供するコード生成プラットフォームで、自然言語プロンプトから React コンポーネントを生成する[[3]](#参考リンク)。shadcn/ui のコンポーネントシステム（Radix UI + Tailwind CSS）をベースに生成するため、生成されたコードはそのまま shadcn/ui プロジェクトに統合できる。

**v0 のワークフロー:**

1. [ui.shadcn.com](https://ui.shadcn.com) の各コンポーネントページから「Open in v0」で v0 を開く
2. 自然言語でカスタマイズを指示（例: 「ダークモード対応のログインフォームを作って」）
3. 生成されたコードをプロジェクトにコピー＆ペースト
4. 必要に応じてローカルで調整

#### llms.txt と AI フレンドリーな設計

shadcn/ui は `llms.txt` ファイルを [ui.shadcn.com/llms.txt](https://ui.shadcn.com/llms.txt) で公開しており[[2]](#参考リンク)、LLM がライブラリの構造・コンポーネント API・使用方法を効率的に理解できるよう設計されている。このファイルには以下の情報が構造化されて含まれる。

- ライブラリの概要と設計思想
- 各コンポーネントのカテゴリ分類（Form & Input、Layout & Navigation 等）
- インストール手順とフレームワーク別の設定方法
- 高度な機能（ダークモード、フォーム連携、モノレポ対応）

#### MCP Server（Model Context Protocol）

2025年4月に初版、2025年8月に CLI 3.0 と共に改良版がリリースされた MCP Server により[[5]](#参考リンク)、AI アシスタントがレジストリからコンポーネントをブラウズ・検索・インストールできるようになった。

```bash title="MCP Serverの初期化"
# MCP Serverをセットアップ（ゼロコンフィグ）
npx shadcn@latest mcp init
```

対応する AI ツール:
- **Claude Code** / **Claude Desktop** — MCP 経由でレジストリ操作が可能
- **Cursor** — MCP サーバー連携で shadcn/ui コンポーネントの検索・インストール
- **VS Code (GitHub Copilot)** — MCP 統合による開発支援
- **Codex** — レジストリからの自動コンポーネント取得

#### AI コード生成の精度と実用性

shadcn/ui は以下の理由で AI コード生成との相性が良い。

- **一貫した API パターン**: CVA（Class Variance Authority）ベースのバリアント定義が統一的
- **Tailwind CSS のユーティリティクラス**: AI が学習しやすいスタイリング方式
- **Radix UI の宣言的 API**: アクセシブルなプリミティブの組み合わせが予測可能
- **豊富なドキュメント**: llms.txt + 公式ドキュメントが充実

ただし、生成されたコードは必ずレビューが必要。特にアクセシビリティ属性やエッジケースのハンドリングは AI が見落としやすい。

#### Registry 機能によるカスタムコンポーネント配布

CLI 3.0（2025年8月）で導入されたネームスペース付きレジストリにより[[4]](#参考リンク)[[5]](#参考リンク)、チーム独自のコンポーネントを配布できる。

```json title="components.json（レジストリ設定）"
{
  "registries": {
    // 社内レジストリ（認証付き）
    "@acme": {
      "url": "https://registry.company.com/{name}",
      "headers": {
        "Authorization": "Bearer ${REGISTRY_TOKEN}"
      }
    },
    // コミュニティレジストリ
    "@community": "https://community-ui.com/r/{name}.json"
  }
}
```

```bash title="ネームスペース付きインストール"
# 社内レジストリからコンポーネントを追加
npx shadcn@latest add @acme/auth-form

# レジストリの内容を確認
npx shadcn@latest list @acme

# インストール前にプレビュー
npx shadcn@latest view @acme/auth-form

# レジストリ内を検索
npx shadcn@latest search @acme -q "form"
```

レジストリは完全に分散型で、中央レジストラは存在しない。`registry.json` をルートエンドポイントに配置すれば、任意の URL でレジストリをホストできる。

---

### 2. コンポーネントのアップグレードとカスタマイズ

#### バージョニングの仕組み

shadcn/ui は npm パッケージとしてインストールされるライブラリではないため、semver によるバージョン管理は存在しない[[9]](#参考リンク)。コンポーネントは `npx shadcn@latest add <component>` でプロジェクトにコピーされた時点で「自分のコード」になる。

**影響:**
- `package.json` にバージョン固定ができない
- 自動アップデート（Dependabot 等）が使えない
- アップストリームの変更を追跡するには手動確認が必要

#### diff コマンドによるアップデート差分確認

```bash title="diff コマンドの使い方"
# 特定のコンポーネントの差分を確認
npx shadcn@latest diff button

# 全コンポーネントの差分を一括確認
npx shadcn@latest diff
```

`diff` コマンドはアップストリーム（shadcn/ui リポジトリ）と手元のコンポーネントの差分を表示する[[1]](#参考リンク)。ただし、**差分を自動的にマージする機能はない**。表示された変更を確認し、手動で取り込む必要がある[[9]](#参考リンク)。

#### コンポーネント更新時のマージ戦略

**戦略1: プロキシパターン（推奨）**

元のコンポーネントファイルを直接編集せず、ラッパーコンポーネントを作成する[[9]](#参考リンク)[[10]](#参考リンク)。これにより `--overwrite` フラグで安全にアップデートできる。

```tsx title="components/ui/tooltip.tsx（shadcn/uiのオリジナル — 編集しない）"
// このファイルは shadcn/ui からコピーされたまま維持
// npx shadcn@latest add tooltip --overwrite で安全に更新可能
```

```tsx title="components/app/app-tooltip.tsx（プロキシコンポーネント）"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// プロジェクト固有のデフォルト値やスタイルをラップ
export function AppTooltip({
  children,
  content,
  side = "top",
  delayDuration = 200,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delayDuration?: number;
}) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

**戦略2: 直接カスタマイズ + 手動マージ**

コンポーネントを直接編集する場合は、定期的に `diff` コマンドで差分を確認し、重要な修正（バグフィックス・アクセシビリティ改善）を手動でマージする。

#### カスタマイズのベストプラクティス

**Props の追加:**

```tsx title="components/ui/button.tsx（props拡張の例）"
// 既存の ButtonProps を拡張
interface ExtendedButtonProps extends ButtonProps {
  // ローディング状態を追加
  isLoading?: boolean;
  // 左アイコンを追加
  leftIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ExtendedButtonProps>(
  ({ className, variant, size, isLoading, leftIcon, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
      </button>
    );
  }
);
```

**バリアントの追加（CVA）:**

```tsx title="components/ui/button.tsx（バリアント追加の例）"
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  // ベーススタイル（全バリアント共通）
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent",
        // カスタムバリアントを追加
        gradient: "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        // カスタムサイズを追加
        xl: "h-14 rounded-lg px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

**コンポジションパターンでの拡張:**

```tsx title="components/app/icon-button.tsx（コンポジションによる拡張）"
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Button を合成して新しいコンポーネントを作る
// 元の Button ファイルを編集しないため、アップデートの影響を受けない
interface IconButtonProps extends ButtonProps {
  icon: React.ReactNode;
  label: string; // アクセシビリティ用のラベル
}

export function IconButton({ icon, label, className, ...props }: IconButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative", className)}
      aria-label={label}
      {...props}
    >
      {icon}
    </Button>
  );
}
```

#### モノレポでの共有パターン

shadcn/ui は公式にモノレポをサポートしており[[8]](#参考リンク)、Turborepo テンプレートが提供されている[[15]](#参考リンク)。

```text title="モノレポのディレクトリ構成例"
my-monorepo/
  apps/
    web/               # Next.js アプリケーション
      components.json  # apps/web 用の設定
    admin/             # 管理画面アプリ
      components.json
  packages/
    ui/                # 共有 UI パッケージ (@workspace/ui)
      components.json  # UI パッケージ用の設定
      src/
        components/    # shadcn/ui コンポーネント
        hooks/         # 共有フック
        lib/           # ユーティリティ
      package.json
    config/            # 共有設定（Tailwind, ESLint 等）
  turbo.json
  pnpm-workspace.yaml
```

**ポイント:**
- `@workspace/ui` パッケージに shadcn/ui コンポーネントを集約
- Tailwind v4 の設定・CSS 変数・グローバルスタイルは UI パッケージが所有
- 各アプリは UI パッケージをインポートして使用
- コンポーネントの更新は UI パッケージ 1 箇所で行えば全アプリに伝播

---

### 3. 運用上の落とし穴・採用時のリスク

#### 3.1 コンポーネント更新の手動管理コスト

shadcn/ui は npm パッケージではないため、Dependabot や Renovate による自動アップデートが効かない[[11]](#参考リンク)。`diff` コマンドで差分を確認できるが、マージは手動。20以上のコンポーネントを使っている場合、定期的な更新確認だけでも相当な工数がかかる。

**依存ライブラリのバージョン不整合リスク:** shadcn/ui のアップストリームが依存ライブラリ（Radix UI, cmdk, embla-carousel 等）のバージョンを上げた場合、手元のコンポーネントと `package.json` の依存バージョンが不整合を起こす可能性がある。

```bash title="典型的な問題の例"
# shadcn/ui のアップストリームが @radix-ui/react-dialog を 1.1.x に更新
# 手元のプロジェクトはまだ 1.0.x を使っている
# → diff で差分は検出できるが、依存の不整合は検出されない
npm ls @radix-ui/react-dialog
```

#### 3.2 Radix UI への強い依存

shadcn/ui のほとんどのインタラクティブコンポーネント（Dialog, Select, Dropdown, Popover 等）は Radix UI プリミティブに依存している。

**リスク:**
- Radix UI は元々 Modulz 社が開発し、現在は WorkOS が管理しているが、オープンソースへの積極的なメンテナンスは減少傾向にある[[12]](#参考リンク)
- 未修正のバグが報告されている（例: `setState` の過剰呼び出しによる「update depth exceeded」エラー）[[12]](#参考リンク)
- `useEffect` の依存配列の欠如による不要な再レンダリングの問題が報告された[[12]](#参考リンク)

**緩和策:**
- shadcn/ui はソースコードを所有する設計のため、Radix の実装を直接修正できる
- Base UI（Radix の元開発者が開発、v1.0.0 リリース済み）への段階的移行が可能
- React Aria や Aria Kit も代替候補として検討できる

#### 3.3 Tailwind CSS への強い依存（v3 → v4 移行の影響）

2025年2月に shadcn/ui は Tailwind v4 対応を発表したが[[6]](#参考リンク)、移行には以下の変更が必要だった。

**実際に発生した問題:**
- Radix UI の Select/Dropdown が Tailwind v4 環境で透明にレンダリングされる問題
- `tailwindcss-animate` が非推奨となり `tw-animate-css` への移行が必要[[6]](#参考リンク)
- HSL カラーから OKLCH カラーへの変換
- `@theme` ディレクティブへの設定移行
- `forwardRef` の削除（React 19 対応と同時進行）

```css title="Tailwind v4 移行で必要な変更の例"
/* Tailwind v3: tailwind.config.ts で定義していたカスタムカラー */
/* Tailwind v4: CSS の @theme ディレクティブに移行 */
@theme inline {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.205 0.042 265.755);
  --color-primary-foreground: oklch(0.985 0 0);
}
```

#### 3.4 テスト戦略の不在

shadcn/ui 自体はコンポーネントのテストを提供しない。テストは利用者の責任。

**推奨テスト構成:**

```tsx title="components/ui/__tests__/button.test.tsx"
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Button } from "../button";

describe("Button", () => {
  // 基本的なレンダリングテスト
  it("renders with correct text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  // バリアントのテスト
  it("applies destructive variant styles", () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("destructive");
  });

  // disabled 状態のテスト
  it("prevents click when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

**ビジュアルリグレッションテスト** も有効。Storybook + Lost Pixel や Chromatic の活用で、スタイルの意図しない変更を検出できる。

#### 3.5 アクセシビリティの担保は利用者責任

Radix UI は WCAG 準拠のプリミティブを提供するが、shadcn/ui のコピー後にカスタマイズする過程でアクセシビリティが損なわれるリスクがある。

**注意点:**
- `aria-label`, `aria-describedby` の付与は利用者が行う
- キーボードナビゲーションの動作確認は手動テストが必要
- カスタマイズ時に Radix UI が提供する `asChild` パターンを壊さないよう注意
- カラーコントラスト比は Tailwind のカスタムテーマ設定に依存

#### 3.6 デザインの均一化問題

shadcn/ui のデフォルトテーマをそのまま使うと、「shadcn/ui っぽいサイト」が量産される。

**対策:**
- `npx shadcn create`（2025年12月リリース）で初期段階からカラー・フォント・スペーシングをカスタマイズ[[7]](#参考リンク)
- CSS 変数を活用したテーマの独自化
- コンポーネントのアニメーション・トランジションをブランドに合わせて調整
- [tweakcn](https://tweakcn.com) 等のテーマカスタマイズツールの活用

#### 3.7 大規模チームでのコンポーネント管理の課題

- コンポーネントの「正しい使い方」をドキュメント化する必要がある（shadcn/ui は使用ガイドラインを提供しない）
- 複数の開発者が同じコンポーネントを異なる方法でカスタマイズするリスク
- コードレビューでの一貫性チェックの負荷増大
- CLI 3.0 のネームスペース付きレジストリで社内配布は改善されたが[[5]](#参考リンク)、ガバナンスは自前で構築する必要がある

#### 3.8 パフォーマンスの落とし穴

- Radix UI の一部コンポーネント（特に Select, Combobox）は内部で頻繁な `setState` を行い、不要な再レンダリングを引き起こす
- `TooltipProvider` を各 Tooltip に配置すると無駄なコンテキスト再生成が発生する（アプリのルートに 1 つ配置すべき）
- Tailwind CSS のユーティリティクラスは最終的に purgecss で最適化されるが、動的クラス生成（`bg-${color}-500` 等）は purge されず残る

```tsx title="パフォーマンス改善の例"
// NG: TooltipProvider が毎回生成される
function BadTooltip() {
  return (
    <TooltipProvider>
      <Tooltip>...</Tooltip>
    </TooltipProvider>
  );
}

// OK: アプリのルートで一度だけ Provider を配置
// layout.tsx や App.tsx で
function App() {
  return (
    <TooltipProvider delayDuration={0}>
      {/* アプリ全体 */}
    </TooltipProvider>
  );
}
```

#### 3.9 コンポーネント数の増加に伴うファイル管理

shadcn/ui から 30+ コンポーネントを追加すると、`components/ui/` ディレクトリが肥大化する。加えてプロキシパターンを採用すると、ファイル数はさらに倍増する。

**対策:**
- `components/ui/` は shadcn/ui オリジナルのみ格納
- `components/app/` にプロジェクト固有のラッパー・合成コンポーネントを配置
- バレルエクスポート（`index.ts`）で import パスを整理
- 不要なコンポーネントは追加しない（使わないなら入れない）

#### 3.10 shadcn/ui 単体ではカバーしきれない領域

以下の UI パターンは shadcn/ui の範囲外であり、別途ライブラリが必要。

| 領域 | 推奨ライブラリ |
|------|---------------|
| 複雑なデータテーブル | TanStack Table |
| リッチテキストエディタ | Tiptap, Plate |
| 日付ピッカー（高機能） | react-day-picker（shadcn/ui に組み込み済み） |
| チャート・グラフ | Recharts（shadcn/ui Charts として統合済み） |
| ドラッグ＆ドロップ | dnd-kit |
| 仮想スクロール | TanStack Virtual |
| ファイルアップロード | react-dropzone |

#### 3.11 ライセンスと商用利用

shadcn/ui は **MIT ライセンス** で公開されており、商用利用は問題ない[[14]](#参考リンク)。帰属表示（attribution）も不要とされている。ただし、MIT ライセンスのテキスト自体をコードから削除することはできない。サードパーティ製の shadcn/ui 拡張やテンプレートは独自のライセンスを持つ場合があるため、個別に確認が必要。

---

### 4. 採用判断のフレームワーク

#### 採用すべきプロジェクトの特徴

| 条件 | 理由 |
|------|------|
| React / Next.js ベースのプロジェクト | 最も成熟したエコシステム |
| Tailwind CSS を既に使用している | 追加の学習コストが少ない |
| ブランド独自のデザインが求められる | ソースコード所有でフルカスタマイズ可能 |
| チームに Tailwind / Radix の知識がある | 効果的なカスタマイズが可能 |
| プロトタイプから本番まで同じ技術で進めたい | v0 との連携で高速プロトタイピング可能 |
| AI ツールを活用した開発を行う | llms.txt, MCP Server, v0 との統合が充実 |

#### 採用を避けるべきケース

| 条件 | 理由 |
|------|------|
| Tailwind CSS に不慣れなチーム | 学習コストが高い |
| コンポーネントの手動管理を避けたい | npm パッケージ型（MUI, Chakra UI 等）の方が適切 |
| React 以外のフレームワークがメイン | Vue / Svelte 版はあるが成熟度が低い |
| バンドルサイズの最小化が最優先 | 各コンポーネントがソースに追加されるため |
| 厳格なアクセシビリティ要件がある | 追加の検証・テストが必要（Radix 依存） |
| デザインシステムが既に確立されている | 既存システムとの統合コストが高い |

#### 既存プロジェクトへの段階的導入戦略

```text title="段階的導入のステップ"
Phase 1: 基盤整備（1-2日）
  - Tailwind CSS の導入・設定
  - shadcn/ui CLI の初期化（npx shadcn@latest init）
  - CSS 変数・テーマの設定
  - components.json の設定

Phase 2: 基本コンポーネントの導入（1週間）
  - 影響範囲の小さいコンポーネントから開始
    - Button, Badge, Card, Separator
  - 既存の UI と共存させる（一括置換しない）
  - プロキシパターンの導入

Phase 3: フォーム・インタラクション系の導入（2-3週間）
  - Input, Select, Dialog, Sheet, Toast
  - React Hook Form / TanStack Form との統合
  - アクセシビリティテストの実施

Phase 4: 全体統一（継続的）
  - 旧コンポーネントの段階的置換
  - デザイントークンの統一
  - Storybook によるコンポーネントカタログ整備
  - テスト戦略の確立
```

## 検証結果

### diff コマンドの実用性

`npx shadcn@latest diff` は差分を表示するだけで、自動マージ機能はない。カスタマイズしたコンポーネントが多い場合、差分の読み解きと手動マージに時間がかかる。プロキシパターンを採用していれば `--overwrite` で安全に更新できるため、運用コストが大幅に下がる。

### MCP Server の動作

CLI 3.0 の MCP Server は `shadcn@latest mcp init` でセットアップでき、Claude Code や Cursor から自然言語でコンポーネントの検索・インストールが可能。複数のレジストリ（公式 + 社内）を同時に扱えるため、大規模組織での活用に適している。

### Tailwind v4 移行の実態

Tailwind v3 から v4 への移行は、shadcn/ui コンポーネントへの影響が大きい。特に CSS 変数の OKLCH 化、`@theme` ディレクティブへの移行、`tailwindcss-animate` から `tw-animate-css` への切り替えが必要。既存プロジェクトでは段階的に移行すべきで、v3 のまま維持する選択肢もある（shadcn/ui は v3 と v4 の両方をサポート）。

## まとめ

shadcn/ui の運用における最大の特徴は「所有するコードの責任を負う」ことに尽きる。これは自由度の高さと引き換えに、更新管理・テスト・アクセシビリティ担保のコストを自チームで負うことを意味する。

**実践的な推奨事項:**

1. **プロキシパターンを標準化する** — アップストリーム更新を安全に取り込む唯一の実用的な方法
2. **レジストリ機能を活用する** — 社内コンポーネントの配布には CLI 3.0 のネームスペース付きレジストリが有効
3. **テストは自前で書く** — Vitest + React Testing Library + ビジュアルリグレッションテストの三層構造が推奨
4. **Radix UI のリスクを認識する** — 現時点で即座のリスクは低いが、Base UI の動向を注視する
5. **AI 連携を積極的に活用する** — llms.txt, MCP Server, v0 の統合は shadcn/ui の大きな強み
6. **Tailwind v4 移行は計画的に** — 既存プロジェクトは v3 維持も選択肢。新規プロジェクトは v4 推奨

## 参考リンク

1. [shadcn/ui 公式ドキュメント](https://ui.shadcn.com/docs)
2. [shadcn/ui llms.txt](https://ui.shadcn.com/llms.txt)
3. [Open in v0 — shadcn/ui](https://ui.shadcn.com/docs/v0)
4. [shadcn/ui Registry](https://ui.shadcn.com/docs/registry)
5. [CLI 3.0 and MCP Server（August 2025）](https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp)
6. [Tailwind v4 移行ガイド — shadcn/ui](https://ui.shadcn.com/docs/tailwind-v4)
7. [npx shadcn create（December 2025）](https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create)
8. [Monorepo — shadcn/ui](https://ui.shadcn.com/docs/monorepo)
9. [Updating and Maintaining Components — Vercel Academy](https://vercel.com/academy/shadcn-ui/updating-and-maintaining-components)
10. [The Anatomy of shadcn/ui Components — Vercel Academy](https://vercel.com/academy/shadcn-ui/extending-shadcn-ui-with-custom-components)
11. [shadcn/ui Adoption Guide — LogRocket](https://blog.logrocket.com/shadcn-ui-adoption-guide/)
12. [Is Your Shadcn UI Project at Risk? A Deep Dive into Radix's Future — DEV Community](https://dev.to/mashuktamim/is-your-shadcn-ui-project-at-risk-a-deep-dive-into-radixs-future-45ei)
13. [shadcn/ui GitHub リポジトリ](https://github.com/shadcn-ui/ui)
14. [shadcn/ui ライセンス（MIT）](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)
15. [Turborepo + shadcn/ui ガイド](https://turborepo.dev/docs/guides/tools/shadcn-ui)

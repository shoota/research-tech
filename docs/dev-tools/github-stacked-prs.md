---
id: github-stacked-prs
title: GitHub Stacked PRs - 大規模変更を積み重ねてレビューする新しいワークフロー
description: "GitHub公式のStacked PRs機能（private preview）の全容・仕組み・メリットを、公式サイトの図や画像を引用しつつ解説。"
sidebar_position: 7
tags: [github, pull-request, code-review, stacked-prs, gh-cli, workflow]
last_update:
  date: 2026-04-17
---

# GitHub Stacked PRs - 大規模変更を積み重ねてレビューする新しいワークフロー

## 概要

GitHub Stacked PRs は、大規模な変更を複数の小さな PR に分割し、それらを **依存関係のあるスタック（積み重ね）として GitHub 上でネイティブに管理・レビュー・マージできる** 機能である。2026年4月時点で private preview として公開されており、従来 Phabricator・Graphite・Sapling などサードパーティが担ってきた「stacked diff」ワークフローを、GitHub の UI・API・CLI（`gh stack`）で一貫してサポートする[[1]](#参考リンク)[[2]](#参考リンク)。

## 背景・動機

大規模な機能開発では、1 本の PR が肥大化しがちである。公式ドキュメントは、大規模 PR の問題点を次のようにまとめている[[1]](#参考リンク)。

> Large pull requests are hard to review, slow to merge, and prone to conflicts. Reviewers lose context, feedback quality drops, and the whole team slows down.

（大きな PR はレビューが困難で、マージが遅れ、コンフリクトを招く。レビュアーは文脈を失い、フィードバックの質は落ち、チーム全体が停滞する）

この課題への対処として、Meta の Phabricator / Differential（2007年に Evan Priestley と Luke Shepard が開発）に起源を持つ「stacked diff」モデルが一部の高速開発組織（Google、Meta、Uber など）で広く使われてきた[[3]](#参考リンク)。GitHub は今回このモデルを**プラットフォームネイティブに取り込み**、プルリクエスト中心のレビュー文化を維持したまま同等の開発体験を提供する狙いを打ち出している[[4]](#参考リンク)。

## 調査内容

### Stacked PRs の 4 本柱

公式トップページでは、Stacked PRs の価値を 4 つのカードで要約している[[1]](#参考リンク)。

| 柱 | 概要 |
| --- | --- |
| **Stacked PRs, Native in GitHub** | 複数の PR を順序付きスタックとして整列させ、まとめてワンクリックでマージ可能。各 PR は独立した「レイヤー」としてレビューされ、最後に一緒にランディングする |
| **Simplified Stack Management** | スタック内 PR の移動、各レイヤーのステータス確認、カスケードリベース（連鎖リベース）を GitHub の UI から実行可能 |
| **Powerful CLI** | `gh stack` CLI により、スタックの作成、カスケードリベース、ブランチプッシュ、PR 作成、レイヤー間の移動をターミナルから完結 |
| **AI Agent Integration** | `npx skills add github/gh-stack` を実行することで、AI コーディングエージェントにスタック操作を教えられる。大きな差分をスタックに分割したり、最初からスタックで開発させたりできる |

### スタックとは何か

公式ドキュメントによれば、「スタック」は次のように定義される[[1]](#参考リンク)。

> A stack is a series of pull requests in the same repository where each PR targets the branch of the PR below it, forming an ordered chain that ultimately lands on your main branch.

すなわち、同一リポジトリ内の一連の PR からなり、**各 PR が「その下の PR のブランチ」を base として指す順序付きチェーン** で、最終的に `main` に向かって着地する構造である。公式サイトには、この関係を示した図が掲載されている。

```text
         ┌─────────────────────────┐
         │  PR #3 · frontend       │   ← top
         └───────────▲─────────────┘
                     │
         ┌───────────┴─────────────┐
         │  PR #2 · api-endpoints  │
         └───────────▲─────────────┘
                     │
         ┌───────────┴─────────────┐
         │  PR #1 · auth-layer     │   ← bottom
         └───────────▲─────────────┘
                     │
         ┌───────────┴─────────────┐
         │  main                   │
         └─────────────────────────┘
```

（公式サイト [GitHub Stacked PRs - Arranging PRs in a Stack](https://github.github.com/gh-stack/#arranging-prs-in-a-stack) の SVG 図を ASCII 化して引用）

### GitHub ネイティブ統合の実体

Stacked PRs が「ネイティブ」と呼ばれる所以は、GitHub プラットフォーム側の挙動がスタックをファーストクラスで理解する点にある[[1]](#参考リンク)。

- **Stack map**: PR ヘッダにスタック全体を表すナビゲータが表示され、レビュアーはレイヤー間をワンクリックで移動できる
- **ブランチ保護ルール**: 直接の base ブランチ（= スタックの下の PR）ではなく、**最終ターゲットブランチ（通常は `main`）に対して** 保護ルールが評価される
- **CI**: 各 PR の CI は、あたかもその PR が直接 `main` をターゲットにしているかのように実行される
- **マージキュー対応**: 各 PR は直接マージすることも、merge queue 経由でマージすることも可能

下図は PR ヘッダに表示される Stack navigator の UI である。

![The stack navigator in a pull request header](https://github.github.com/gh-stack/_astro/stack-navigator.DbHWHwGH_Z14GiHR.webp)

（出典: [GitHub Stacked PRs 公式サイト](https://github.github.com/gh-stack/)）

### マージ動作とカスケードリベース

公式ドキュメントは、スタックをマージする際の挙動を次のように説明している[[1]](#参考リンク)。

- 一部またはスタック全体をまとめてマージできる
- 下位の複数 PR（たとえば下から 2 段）を同時にマージしたい場合は、**該当レイヤーの CI が緑になるのを待って 1 手順でマージ** 可能
- マージ完了後は、**スタック内の残りの PR が自動的にリベース** され、最下位の未マージ PR が更新後の base ブランチを指すようになる

従来のサードパーティツールで最も煩雑だった「下位 PR をマージしたあと上位ブランチを手動で rebase して push し直す」という作業が、GitHub 側で完結するのが大きな違いである[[4]](#参考リンク)。

### `gh stack` CLI

CLI の利用は任意であり、UI・API・通常の Git ワークフローからも Stacked PRs を作成・管理できる[[1]](#参考リンク)。ただし、CLI を使うとローカル側のワークフローが大きく簡素化される。主要コマンドは以下の通り[[5]](#参考リンク)。

| コマンド | 役割 |
| --- | --- |
| `gh stack init` | カレントリポジトリでスタックを初期化する |
| `gh stack add` | 現在のスタックの上に新しいブランチを追加する |
| `gh stack view` | スタック全体の状態（ブランチ順序・PR リンク）を表示する |
| `gh stack checkout` | PR 番号またはブランチ名からスタックにチェックアウトする |
| `gh stack push` | スタック内の全ブランチをリモートへプッシュする |
| `gh stack submit` | 全ブランチのプッシュ、PR の作成/更新、スタック構造の GitHub 側への反映を一括で実行する |
| `gh stack sync` | fetch・rebase・push・PR 同期を 1 コマンドで実行する |
| `gh stack rebase` | リモートから pull し、スタック全体にカスケードリベースをかける |
| `gh stack up` / `down` / `top` / `bottom` | スタック内のレイヤー間を移動する |
| `gh stack unstack` | ローカルのトラッキングを外し、GitHub 側のスタックも解除する |
| `gh stack alias` | 短縮コマンド（例: `gs`）のエイリアスを作成する |

前提として **GitHub CLI (`gh`) v2.0 以上** と **Git 2.20 以上** が必要である[[5]](#参考リンク)。

## 検証結果

本機能は private preview のため、実際に動作確認するには [Waitlist](https://gh.io/stacksbeta) への登録が必要である。以下は公式 Quick Start に従った典型的なワークフロー例である[[5]](#参考リンク)。

### 1. CLI のインストールとエイリアス設定

```bash title="shell"
# gh-stack 拡張をインストール
gh extension install github/gh-stack

# `gs` という短縮エイリアスを登録（以降 `gh stack` を `gs` と書ける）
gh stack alias
```

### 2. スタックを初期化して最初のレイヤーを作る

```bash title="shell"
# main から分岐して auth-layer という 1 段目のブランチを作成
gs init auth-layer

# 通常どおりコードを書いてコミット
git add .
git commit -m "feat: add authentication layer"
```

### 3. 次のレイヤーを積む

```bash title="shell"
# auth-layer の上に api-endpoints ブランチを追加
gs add api-endpoints
git add .
git commit -m "feat: add API endpoints on top of auth layer"

# さらにその上に frontend ブランチを追加
gs add frontend
git add .
git commit -m "feat: wire frontend to new API"
```

この時点でローカルは `main ← auth-layer ← api-endpoints ← frontend` の 3 段スタックになっている。

### 4. まとめてプッシュ＆ PR 作成

```bash title="shell"
# 全ブランチを origin にプッシュ
gs push

# GitHub 上に PR を作成/更新し、正しい base で相互リンクさせる
gs submit
```

`gs submit` は、各 PR の base を 1 段下のブランチに自動設定し、スタック構造を GitHub 側に登録する[[5]](#参考リンク)。

### 5. レビュー中の変更取り込みとカスケードリベース

下位レイヤーにレビュー指摘が入り修正した場合、上位レイヤーはすべてその影響を受ける。スタックで最も煩雑なのがここだが、`gs rebase` が連鎖リベースを自動化する。

```bash title="shell"
# main の変更を取り込み、スタック全体を最新状態へ連鎖リベース
gs rebase
gs push
```

### 6. 下位 PR のマージと自動追従

下位 PR が承認されマージされると、GitHub 側でスタック残りの PR が自動的にリベースされ、最下位の未マージ PR の base が `main` に更新される[[1]](#参考リンク)。ローカル側は `gs sync` で同期できる。

```bash title="shell"
# リモートの最新状態に合わせてローカルスタックを同期
gs sync
```

## まとめ

- **GitHub Stacked PRs は、Phabricator 系の stacked diff モデルをプルリクエスト文化の中に持ち込むもの** である。Graphite など既存サードパーティの機能をほぼ包含しつつ、ブランチ保護・CI・マージキュー・UI ナビゲーションがプラットフォーム側で一貫する点が最大の差別化要因である[[4]](#参考リンク)。
- 恩恵は「大きな PR を分割しつつ、**レビュー待ちで手が止まらない**」という開発フロー改善に集約される。下位 PR を投げたまま上位レイヤーの実装を進められ、レビュー・マージ・リベースのオーバーヘッドを GitHub 側が吸収する[[2]](#参考リンク)。
- CLI は任意だが、ローカルのブランチ管理とリベースを大きく簡素化する。`gh stack` は `npx skills add github/gh-stack` で AI コーディングエージェントにも学習させられるため、Claude Code のようなエージェント主導の開発にも自然に組み込める[[1]](#参考リンク)。
- 一方で 2026年4月時点では **private preview** であり、本番導入には Waitlist 登録が必要。Graphite や Sapling など既存ツールからの移行パスや、組織での段階的ロールアウトは今後の運用知見の蓄積待ちである[[3]](#参考リンク)。
- モノレポや大規模サービスでの機能開発、AI エージェントが生成する大規模差分のレビュー、マイグレーション系タスクなど、**単一 PR に収めるとレビュー不能になる変更** を扱う場合に特に有効と考えられる。

## 参考リンク

1. [GitHub Stacked PRs - 公式サイト](https://github.github.com/gh-stack/)
2. [GitHub Stacked PRs - Quick Start](https://github.github.com/gh-stack/getting-started/quick-start/)
3. [GitHub recalls Phabricator with preview of Stacked PRs - The Register](https://www.theregister.com/2026/04/14/github_stacked_prs/)
4. [GitHub adds Stacked PRs to speed complex code reviews - InfoWorld](https://www.infoworld.com/article/4158575/github-adds-stacked-prs-to-speed-complex-code-reviews.html)
5. [GitHub Stacked PRs - CLI Reference](https://github.github.com/gh-stack/reference/cli/)
6. [Stacked PRs private preview waitlist](https://gh.io/stacksbeta)

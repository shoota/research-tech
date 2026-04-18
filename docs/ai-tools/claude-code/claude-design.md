---
id: claude-code-claude-design
title: "Claude Design — Anthropic Labs が提供するAIネイティブなデザイン環境"
description: "Anthropic Labs が 2026-04-17 に発表した Claude Design の概要、機能、Claude Code への handoff、対応出力形式、ユースケースを公式情報と各種報道から整理。"
sidebar_position: 3
tags: [claude-design, claude-code, anthropic-labs, design, opus-4-7]
last_update:
  date: 2026-04-19
---

## 概要

Claude Design は Anthropic が 2026-04-17 にリリースした実験的プロダクトで、自然言語のチャットからプロトタイプ・スライドデック・ピッチ資料・マーケティング用ワンページャー等のビジュアル成果物を生成・編集できる「AI ネイティブなデザイン環境」である[[1]](#参考リンク)[[2]](#参考リンク)。Anthropic Labs（同社の研究プレビュー部門）から提供され、Claude Opus 4.7 を基盤モデルとして利用する[[1]](#参考リンク)[[3]](#参考リンク)。

:::info 関連ドキュメント
- [Claude Code 組込みスラッシュコマンド完全ガイド](/docs/ai-tools/claude-code/agentic-coding-claude-code-slash-commands) — デザイン完成後の handoff 先となる Claude Code の操作リファレンス
- [Agentic Coding ツール・AIモデルの全体像](/docs/ai-tools/general/ai-general-tools-and-models-landscape) — Anthropic 製品群の中での位置づけ
:::

## 背景・動機

Anthropic はファウンデーションモデル提供企業から「フルスタックなプロダクト企業」へと事業領域を拡張しつつあり、Claude Design はその象徴的なリリースの一つと位置づけられている[[2]](#参考リンク)。同社は明確に「デザイン経験のないファウンダーやプロダクトマネージャー」を対象ユーザーに想定しており、アイデア段階のスケッチを素早くビジュアル化して関係者と共有できるツールを目指している[[4]](#参考リンク)。

Claude Code が「設計から実装」を担うのに対し、Claude Design は「アイデアからデザイン」のフェーズを担う。両プロダクトを連結させることで、Anthropic は「ラフな思いつきから出荷可能なプロダクトまで」のループを Claude 1 つで完結させる構図を狙っている[[2]](#参考リンク)。

リリース当日には Figma の株価が約 7% 下落しており、市場は Claude Design を Figma の競合候補と受け止めている[[2]](#参考リンク)。一方 Anthropic 自身は Canva との統合パートナーシップを公表しており、既存デザインツールとは「競合ではなく補完」の関係を強調している[[4]](#参考リンク)[[5]](#参考リンク)。

## 調査内容

### 提供形態と対象プラン

- 研究プレビュー（research preview）として提供開始[[1]](#参考リンク)
- 対応プラン: Claude **Pro / Max / Team / Enterprise**[[1]](#参考リンク)[[6]](#参考リンク)
- Enterprise 組織では管理者が設定から有効化する必要がある[[1]](#参考リンク)
- 機能は段階的にロールアウト中[[1]](#参考リンク)

### セットアップ方法

#### 個人プラン（Pro / Max）

ログイン後 [`claude.ai/design`](https://claude.ai/design) にアクセスすれば即座に利用可能。追加の有効化設定は不要[[6]](#参考リンク)。

#### Team / Enterprise プラン（管理者向け）

Enterprise プランではデフォルトでオフのため、組織管理者が以下の手順で有効化する[[8]](#参考リンク)。

1. **Organization settings → Capabilities** を開く
2. **Anthropic Labs** セクション内の **Claude Design** トグルをオンにする
3. 必要に応じて RBAC（ロールベースアクセス制御）でアクセスできるグループや部門を限定する

公式が推奨する段階的ロールアウト[[8]](#参考リンク):

| Phase | 対象 | 目的 |
|-------|---------|---------|
| 1 | デザイナー 2〜4 名 | デザインシステムの構築・公開 |
| 2 | デザインチーム全体 | 運用パターンの検証 |
| 3 | プロダクト・UX チーム | 業務フローへの組み込み |
| 4 | 全組織 | 全社展開・フィードバック収集 |

「広範な公開の前に、まず経験豊富なデザイナーが組織のデザインシステムをセットアップすることが最も重要」とされる[[8]](#参考リンク)。

#### デザインシステムのセットアップ

ロールアウトの前提となるデザインシステム公開は、4 ステップで完了する[[9]](#参考リンク)。

1. **組織の作成・切り替え** — Claude Design にアクセスし、対象組織を選択
2. **ブランド資産のアップロード** — コードベース・既存デザインファイル等を提供
3. **生成された UI キットの確認** — テストプロジェクトでブランド適用を検証
4. **チームへの公開** — `Published` トグルをオンにして利用可能化

生成される UI キットには以下が含まれる[[9]](#参考リンク)。

- **カラーパレット**: プライマリ / セカンダリ / アクセント
- **タイポグラフィ**: フォントファミリー・サイズ・ウェイト
- **コンポーネント**: ボタン・カード・ナビゲーション
- **レイアウトパターン**: 間隔・グリッドシステム

入力ソースとして次の形式が利用できる[[9]](#参考リンク)。

- コードベース（例: React コンポーネントライブラリのリポジトリをリンクまたはアップロード）
- プロトタイプ（スクリーンショット、Webflow など）
- スライドデック（PowerPoint / PDF）
- ロゴや色パレットなどの個別資産

公式の推奨は「仕様書だけではなく完成したランディングページなどの実例を含める」「単一ソースより複数資料を組み合わせる」「結果を見ながら反復的に資産を追加する」の 3 点[[9]](#参考リンク)。

### 基盤モデル

Claude Opus 4.7（Anthropic の最新ビジョンモデル）を採用しており、自然言語による指示から直接ビジュアル成果物を生成できる[[3]](#参考リンク)。Opus 4.7 は Claude Design リリースと同時期にアップデートされたモデルで、Anthropic Labs 系プロダクト群（Claude Design, Claude Cowork など）の基盤として位置づけられている[[2]](#参考リンク)。

### UI と基本ワークフロー

公式ヘルプセンターによる UI 構成は次の通り[[6]](#参考リンク)。

- **左ペイン**: チャット欄（リクエスト記述、全体的な変更指示）
- **右ペイン**: キャンバス（生成されたデザインのプレビュー・直接編集）

ワークフローは「プロジェクト作成 → コンテキスト追加（資料アップロード）→ 説明 → 反復処理 → 書き出し」の流れで、反復は次の 2 系統が用意されている[[6]](#参考リンク)。

| 反復方法 | 用途 |
|---------|---------|
| チャット | 全体構成の変更、テーマ変更、トーン調整 |
| インラインコメント | 特定要素のテキスト・色・配置などの細かい修正 |

### 入力できる素材

複数フォーマットを「コンテキスト」としてアップロードでき、Claude がデザイン生成時にそれらを参照する[[1]](#参考リンク)[[6]](#参考リンク)。

- スクリーンショット・画像・既存アセット
- コードベース（リポジトリ単位）と既存のデザインファイル
- スライドデック、Office 文書（DOCX / PPTX / XLSX）
- ウェブキャプチャ

特筆すべきは「コードベースを直接読み込むことでチームのデザインシステムを抽出し、色・タイポグラフィ・コンポーネントを自動適用する」機能で、社内のブランド規定に沿った成果物を最初から生成できる[[1]](#参考リンク)[[3]](#参考リンク)。

### 出力できる成果物と書き出し形式

| 出力先 | 内容 |
|---------|---------|
| 組織内 URL | チーム内共有用の閲覧・編集権限付きリンク[[1]](#参考リンク) |
| フォルダ保存 | プロジェクト単位での永続化[[1]](#参考リンク) |
| **Canva** | 統合エクスポートにより本格編集・公開フローへ移行[[1]](#参考リンク)[[5]](#参考リンク) |
| PDF / PPTX | 配布用静的ファイル[[1]](#参考リンク)[[6]](#参考リンク) |
| Standalone HTML / .zip | 単体配布可能な Web 成果物[[1]](#参考リンク)[[6]](#参考リンク) |
| **Claude Code への handoff bundle** | 実装フェーズへの直接引き継ぎ[[1]](#参考リンク)[[3]](#参考リンク) |

### Claude Code への handoff

Claude Design 上で完成したデザインは「handoff bundle」として Claude Code に直接渡せる。これにより、デザインカンプ → コード実装の往復を Anthropic 製品内で完結できる[[1]](#参考リンク)[[3]](#参考リンク)。具体的には、Claude Design が生成した HTML/コンポーネント定義・デザインシステム情報がパッケージ化され、Claude Code 側で実装プロンプトのコンテキストとして利用される構造である。

### サポートする成果物カテゴリ

公式・各種報道で言及されている主要なユースケース[[1]](#参考リンク)[[3]](#参考リンク)[[4]](#参考リンク):

- **インタラクティブプロトタイプ**: アプリ画面の動的モックアップ
- **ワイヤーフレーム**: UI 構造の早期検討
- **ピッチデック / スライドデック**: 投資家向けプレゼン資料
- **マーケティング資料**: ワンページャー、LP のドラフト
- **コード駆動プロトタイプ**: 音声・動画・3D・AI 要素を組み込んだ動作する成果物

### 代表的な利用パターン

公式チュートリアル[[10]](#参考リンク)[[11]](#参考リンク)で示されている主要な使い方を、推奨プロンプトとともに整理する。

#### 1. 機能プロトタイピング

「アイデアをエンジニアリングリソースを投入する前に触れる形にする」用途で、PM・PdM が単独で完結できる[[10]](#参考リンク)。

```text title="プロンプト例"
- SaaS の設定ページを作って。アカウント・請求・通知・連携の4セクション構成で。
- 5画面のオンボーディングフローを作って（サインアップ→プロフィール→ワークスペース選択→チュートリアル→完了）。
- 検索体験のプロトタイプ。フィルタ、ファセット結果、詳細パネル付き。
```

#### 2. デザインレビュー / ステークホルダー調整

同じ要件で複数案を生成し、並べて比較できる[[10]](#参考リンク)。

```text title="プロンプト例"
ダッシュボード画面を3案作って:
1. カードベースのレイアウト
2. サイドバー固定 + メインキャンバス
3. タブナビゲーション中心
```

#### 3. ユーザーフロー全体のマッピング

個別画面ではなくジャーニー全体をプロトタイプ化する[[10]](#参考リンク)。

```text title="プロンプト例"
無料プラン利用 → 制限到達 → 比較ページ → 決済 → 上位プラン開放
までのフルジャーニーを、画面遷移付きで作って。
```

#### 4. 内部ツール・管理パネル

スピード重視の社内ツール（管理ダッシュボード、コンテンツモデレーション機能等）に向く[[10]](#参考リンク)。

#### 5. プレゼンテーション / スライドデック

Anthropic 社内でも最も人気のあるユースケースで、「数時間ではなく数分で」プロフェッショナルなデックを作れるとされる[[11]](#参考リンク)。

```text title="プロンプト例"
- Q1 結果の10枚デック。売上・プロダクトアップデート・チームハイライトのセクションで構成。
- 役員会向け15枚のプロダクトロードマップ概要。
- 顧客商談の事前準備デック。ユースケース・競合ポジショニング・ネクストステップを含めて。
- 5枚のパートナー提案デック。先方ロゴと色をブランド適用して共同ブランディング。
- 全社All-Hands向け。Q2 OKR・採用計画・カルチャーアップデート。
```

スライド単位の修正は番号参照で指示する[[11]](#参考リンク)。

```text title="個別スライド編集"
On slide 3, change the headline to "Market Opportunity"
4枚目に競合比較表を追加して
2枚目のチャートを棒グラフから折れ線に変更
```

#### 6. デザインシステムを活用した一貫性のある量産

公開済みデザインシステムが適用されると、ブランド色・タイポグラフィ・承認済みアセットが自動使用される。社内資料量産に強い[[9]](#参考リンク)[[11]](#参考リンク)。

#### コードベース連携時のコツ

リポジトリをコンテキストに渡すと、生成物が「実コンポーネント」で構成されハンドオフ時の不整合が減るが、大規模リポジトリでは性能劣化が起きる[[10]](#参考リンク)。

- 必要なパッケージ・ディレクトリだけをリンクする
- `.git` や `node_modules/` を除外する
- コンポーネント構造・スタイリング/テーマ・フレームワークパターン・ファイル構成が読まれる前提で整理しておく

#### Claude Code への handoff 時のベストプラクティス

`Export → Hand off to Claude Code` 操作で、デザインファイル・チャット履歴・README がバンドル化される[[10]](#参考リンク)。

- プロトタイプ内の要素に明確な命名を付けておく
- 設計判断（なぜこの UI を選んだか）をチャットに残す
- 空状態・エラー状態・ローディング状態など**エッジケース**を事前にフラグしておく

#### 共有レベル

組織内共有時のアクセスレベルは 4 段階[[11]](#参考リンク)。

- プライベート
- 組織内（閲覧のみ）
- 組織内（コメント可。**デフォルト**）
- 組織内（編集可）

### 既知の制限事項

公式ヘルプセンターで明示されている既知の制約[[6]](#参考リンク):

- インラインコメントが消失する場合がある
- 大規模コードベースの取り込みでパフォーマンスが低下する
- コンパクトビューで保存エラーが発生することがある
- チャットエラー発生時は新規タブでのセッション再開が必要

## 検証結果

Claude Design は Web UI 中心のプロダクトで API・SDK は現時点で公開されていないため、コードによる再現検証は行えない。代わりに、ヘルプセンターのワークフロー記述[[6]](#参考リンク)を典型的な操作例として整理する。

### 例: 瞑想アプリのプロトタイプ生成

TechCrunch が紹介する公式デモシナリオ[[4]](#参考リンク):

```text title="チャット入力例"
落ち着いたタイポグラフィと自然色をベースにした、瞑想アプリの
ホーム画面とセッション画面のプロトタイプを作って。
```

生成後、以下のような追加リクエストで反復可能。

```text title="反復リクエスト例"
- ダークモード版を追加して
- セッション画面の「開始」ボタンをよりプロミネントに
- アクセントカラーをティール系に変更
```

成果物は HTML / PDF / Canva にエクスポート可能で、実装に進む場合は handoff bundle を介して Claude Code に引き継げる[[1]](#参考リンク)[[3]](#参考リンク)。

### 例: デザインシステムを取り込んだ社内ツールの生成

```text title="コンテキスト追加 + チャット入力"
[コードベース: github.com/your-org/design-system をアップロード]
[既存スライドテンプレート: brand-deck.pptx をアップロード]

社内向けの「四半期OKR報告」スライドを5枚構成で作って。
タイトル / OKR一覧 / 主要指標 / リスク / 来四半期計画 の順で。
```

ブランド色・タイポグラフィ・コンポーネントが自動適用され、社内の他資料と一貫したトーンで生成される[[1]](#参考リンク)[[3]](#参考リンク)。

## まとめ

Claude Design は「アイデアの可視化」と「デザインシステムの自動適用」を低コストで実現する、Anthropic 初の本格的なデザイン特化プロダクトである。Claude Code との handoff を前提に設計されている点が特徴的で、Anthropic 製品スタック内で「アイデア → デザイン → 実装」を一気通貫で扱う狙いが明確に表れている[[2]](#参考リンク)。

本プロジェクトへの適用可否としては以下のように考えられる:

- **適している場面**: 社内向けの企画書、エンジニア主導のプロトタイプ、デザイナー不在チームでの初期 UI モックアップ
- **慎重な場面**: 完成度の高いプロダクション UI 制作、既存 Figma 資産との細密な連携が必須なワークフロー（現時点で Figma 直接統合はなし）
- **将来的な期待**: Claude Code との handoff 精度が高まれば、デザインカンプを実装可能な React/Tailwind コードに直接落とし込むワークフローが Anthropic 単独で完結する

研究プレビュー段階のため API・自動化は未対応で、CI への組み込みや MCP 経由での操作はまだ将来の話となる。一方、Web UI ベースで即試せるため、Pro 以上のサブスクリプションを持つチームは早期に触ってフィードバックを返す価値が高い。

## 参考リンク

1. [Introducing Claude Design by Anthropic Labs - Anthropic](https://www.anthropic.com/news/claude-design-anthropic-labs)
2. [Anthropic just launched Claude Design, an AI tool that turns prompts into prototypes and challenges Figma - VentureBeat](https://venturebeat.com/technology/anthropic-just-launched-claude-design-an-ai-tool-that-turns-prompts-into-prototypes-and-challenges-figma)
3. [Anthropic launches Claude Design AI tool for paid plans - TestingCatalog](https://www.testingcatalog.com/anthropic-launches-claude-design-ai-tool-for-paid-plans/)
4. [Anthropic launches Claude Design, a new product for creating quick visuals - TechCrunch](https://techcrunch.com/2026/04/17/anthropic-launches-claude-design-a-new-product-for-creating-quick-visuals/)
5. [Anthropic launches Claude Design following Opus 4.7 model upgrade - 9to5Mac](https://9to5mac.com/2026/04/17/anthropic-launches-claude-design-for-mac-following-opus-4-7-model-upgrade/)
6. [Get started with Claude Design - Claude Help Center](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)
7. [Anthropic Launches Claude Design, Figma Stock Immediately Nosedives - Gizmodo](https://gizmodo.com/anthropic-launches-claude-design-figma-stock-immediately-nosedives-2000748071)
8. [Claude Design admin guide for Team and Enterprise plans - Claude Help Center](https://support.claude.com/en/articles/14604406-claude-design-admin-guide-for-team-and-enterprise-plans)
9. [Set up your design system in Claude Design - Claude Help Center](https://support.claude.com/en/articles/14604397-set-up-your-design-system-in-claude-design)
10. [Using Claude Design for prototypes and UX - Anthropic](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)
11. [Using Claude Design for presentations and slide decks - Anthropic](https://claude.com/resources/tutorials/using-claude-design-for-presentations-and-slide-decks)

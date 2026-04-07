---
id: typescript-language-server-tsgo
title: TypeScript Language Server の仕組みと tsgo（TS v7）での変革
sidebar_position: 1
description: TypeScript v5のtsserverアーキテクチャとTypeScript v7（tsgo）のネイティブLSP実装を比較し、パフォーマンス改善・アーキテクチャ変更を解説する調査ドキュメント
tags: [TypeScript, Language Server, LSP, tsserver, tsgo, Go, Corsa]
last_update:
  date: 2026-04-07
---

# TypeScript Language Server の仕組みと tsgo（TS v7）での変革

## 概要

TypeScript の Language Server（言語サービス）がどのような仕組みでエディタに型情報や補完を提供しているかを調査した。特に TypeScript v5 までの `tsserver` アーキテクチャと、TypeScript v7（コードネーム: Corsa）で Go にネイティブ移植された `tsgo` の Language Server 実装を比較し、プロトコル・パフォーマンス・並列処理の観点から変更点を整理する。

:::info 関連ドキュメント
- [AST（抽象構文木）の基礎と TypeScript における活用](/docs/dev-tools/compiler/compiler-ast) — TypeScript コンパイラの解析パイプライン（Scanner → Parser → Binder → Checker）の基礎
:::

## 背景・動機

TypeScript は長年、独自プロトコルの `tsserver` を通じてエディタに言語サービスを提供してきた。しかし以下の課題があった:

- **独自プロトコル**: tsserver は LSP（Language Server Protocol）ではなく独自の JSON プロトコルを使用しており、VS Code 以外のエディタでは追加のブリッジレイヤーが必要だった
- **シングルスレッド制約**: Node.js 上で動作するため、大規模コードベースでの型チェックやレスポンスに時間がかかっていた
- **メモリ使用量**: JavaScript VM のオーバーヘッドにより、大規模プロジェクトでメモリ消費が膨大になっていた

2024年3月に Microsoft は TypeScript コンパイラを Go でネイティブ移植する計画（Project Corsa）を発表し、2026年初頭に TypeScript 7.0 として正式リリースされた[[1]](#参考リンク)。

## 調査内容

### TypeScript v5: tsserver のアーキテクチャ

#### 通信プロトコル

tsserver は Node.js プロセスとして動作し、stdin/stdout 経由で JSON メッセージをやり取りする独自プロトコルを使用する[[2]](#参考リンク)。

```json title="tsserver リクエスト例"
// エディタ → tsserver（stdin）
{
  "seq": 1,
  "type": "request",
  "command": "completions",
  "arguments": {
    "file": "/path/to/file.ts",
    "line": 10,
    "offset": 15
  }
}
```

```json title="tsserver レスポンス例"
// tsserver → エディタ（stdout）
// Content-Length: <length>\r\n で始まるヘッダー付き
{
  "seq": 1,
  "type": "response",
  "command": "completions",
  "request_seq": 1,
  "success": true,
  "body": [
    { "name": "useState", "kind": "function", "sortText": "0" }
  ]
}
```

コマンド体系は `ts.server.protocol.CommandTypes` に定義されており、`open`, `completions`, `definition`, `references` などのコマンドがそれぞれ専用のリクエスト/レスポンスインターフェースに対応する[[2]](#参考リンク)。

#### プロジェクト管理システム

tsserver は3種類のプロジェクトタイプを管理する[[2]](#参考リンク):

| プロジェクトタイプ | 説明 | 優先度 |
|---|---|---|
| **Configured Project** | `tsconfig.json` / `jsconfig.json` で定義 | 最高 |
| **External Project** | ホスト（Visual Studio の .csproj 等）が直接指定 | 中 |
| **Inferred Project** | 設定ファイルなし。単一ファイルから依存を自動推論 | 最低 |

#### エディタとの接続構造

VS Code では、TypeScript の言語機能は組み込み拡張機能「TypeScript and JavaScript Language Features」が提供する。この拡張機能は **tsserver の独自プロトコルを直接使用** しており、LSP は使用しない。

```
┌─────────────┐    独自プロトコル     ┌──────────┐
│   VS Code   │ ◄──(stdin/stdout)──► │ tsserver │
│ (組み込み   │    JSON メッセージ    │ (Node.js)│
│  拡張機能)  │                      └──────────┘
└─────────────┘

┌─────────────┐    LSP              ┌──────────────────────┐    独自プロトコル    ┌──────────┐
│ Neovim 等   │ ◄──(JSON-RPC)────► │ typescript-language-  │ ◄──(stdin/stdout)─► │ tsserver │
│ 他エディタ  │                     │ server（ブリッジ）     │                     │ (Node.js)│
└─────────────┘                     └──────────────────────┘                     └──────────┘
```

VS Code 以外のエディタでは、`typescript-language-server` パッケージが LSP ↔ tsserver プロトコルの変換ブリッジとして機能する[[3]](#参考リンク)。このブリッジレイヤーの存在が、レイテンシの増加やメンテナンスコストの原因となっていた。

### TypeScript v7（tsgo）: ネイティブ LSP サーバー

#### アーキテクチャの根本的変化

TypeScript 7.0 では、tsserver の独自プロトコルを廃止し、**標準の LSP（Language Server Protocol）をネイティブサポート** する[[4]](#参考リンク)。Go で実装された `tsgo` バイナリが直接 LSP サーバーとして動作する。

```
┌─────────────┐    LSP（標準）       ┌──────────────┐
│   VS Code   │ ◄──(JSON-RPC)────► │ tsgo --lsp   │
│             │                     │ (Go ネイティブ)│
└─────────────┘                     └──────────────┘

┌─────────────┐    LSP（標準）       ┌──────────────┐
│ Neovim 等   │ ◄──(JSON-RPC)────► │ tsgo --lsp   │
│ 他エディタ  │                     │ (Go ネイティブ)│
└─────────────┘                     └──────────────┘
```

ブリッジレイヤーが不要になり、全エディタが同一のプロトコルで直接通信できるようになった。

#### LSP サーバーの内部構造

tsgo の LSP 実装は3つの並行メッセージループで構成される[[5]](#参考リンク):

1. **リーダーループ**: JSON-RPC メッセージの読み取り
2. **ディスパッチャーループ**: リクエストのルーティングと処理
3. **ライターループ**: レスポンスのクライアントへの書き戻し

```
┌───────────────────────────────────────────────────┐
│                  tsgo LSP Server                   │
│                                                    │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐    │
│  │ Reader   │→ │ Dispatcher   │→ │ Writer   │    │
│  │ Loop     │  │ Loop         │  │ Loop     │    │
│  └──────────┘  └──────┬───────┘  └──────────┘    │
│                        │                           │
│                 ┌──────▼───────┐                   │
│                 │   Session    │                   │
│                 │  (プロジェクト管理)│                │
│                 └──────┬───────┘                   │
│           ┌────────────┼────────────┐              │
│    ┌──────▼──────┐ ┌──▼────────┐ ┌─▼───────────┐ │
│    │ Configured  │ │ Inferred  │ │ Language    │ │
│    │ Project     │ │ Project   │ │ Service(ls) │ │
│    └─────────────┘ └───────────┘ └──────┬──────┘ │
│                                          │        │
│                                   ┌──────▼──────┐ │
│                                   │ CheckerPool │ │
│                                   │ (並列型チェック)│ │
│                                   └─────────────┘ │
└───────────────────────────────────────────────────┘
```

リクエスト処理の流れ[[5]](#参考リンク):

1. エディタが LSP リクエストを送信（例: `textDocument/completion`）
2. Server がリクエストを受信し、Session にルーティング
3. Session が対象ファイルの所属プロジェクトを解決
4. Language Service が型チェッカー（Checker）に問い合わせ
5. 結果を LSP レスポンス形式に変換して返却

#### 共有メモリ並列処理（CheckerPool）

tsgo の最大の技術的革新の一つが **CheckerPool** による並列型チェックである[[4]](#参考リンク)。

Go のゴルーチンを活用し、ファイル単位で型チェックを並列実行する:

- **CheckerPool**: 複数の Checker インスタンスをプールし、ファイルごとに並列で型チェックを実行
- **排他ロック**: スレッドセーフティを排他ロックで保証
- **キャッシュ共有**: 型キャッシュ、関係性キャッシュ、フロー型キャッシュを共有し、再計算を回避

TypeScript v5 の tsserver は Node.js のシングルスレッドで動作するため、型チェックは逐次処理だった。tsgo ではこの制約がなくなり、CPU コアを最大限活用できるようになった。

#### Strada API の廃止

TypeScript 7.0 では従来の Strada API（tsserver の内部 API）がサポートされない[[4]](#参考リンク)。これは既存のツールエコシステムに影響を与える重要な変更である:

- tsserver の API に依存するサードパーティツールは tsgo では動作しない
- LSP 経由の標準的なインターフェースへの移行が必要
- TypeScript 6.0 が JavaScript ベースの最後のリリースとして、移行期間のブリッジ役を果たす[[6]](#参考リンク)

### TS v5 vs TS v7: 総合比較

| 観点 | TypeScript v5（tsserver） | TypeScript v7（tsgo） |
|---|---|---|
| **実装言語** | JavaScript（Node.js） | Go（ネイティブバイナリ） |
| **プロトコル** | 独自 JSON プロトコル | 標準 LSP（JSON-RPC） |
| **実行モデル** | シングルスレッド | マルチスレッド（ゴルーチン） |
| **型チェック** | 逐次処理 | CheckerPool による並列処理 |
| **メモリ使用量** | 68MB（400k行） | 23MB（400k行）= 2.9倍削減 |
| **VS Code 接続** | 組み込み拡張が直接通信 | LSP 経由で接続 |
| **他エディタ対応** | ブリッジ（typescript-language-server）が必要 | 直接 LSP で接続可能 |
| **API** | Strada API（独自） | LSP 標準 |
| **インクリメンタルビルド** | `.tsbuildinfo` ベース | `.tsbuildinfo` ベース（改善版） |
| **プロジェクト参照** | サポート | サポート（改善版） |

### パフォーマンスベンチマーク

Microsoft TypeScript リポジトリ（約400k行）でのベンチマーク結果[[7]](#参考リンク):

| 処理 | tsc（v5） | tsgo（v7） | 高速化率 |
|---|---|---|---|
| **全体ビルド** | 0.284秒 | 0.026秒 | **10.8倍** |
| **型チェック** | 0.10秒 | 0.003秒 | **30倍** |
| **解析（Parse）** | 0.071秒 | 0.008秒 | **8.9倍** |
| **バインド（Bind）** | 0.058秒 | 0.009秒 | **6.4倍** |
| **メモリ使用量** | 68MB | 23MB | **2.9倍削減** |

プロジェクト規模別の高速化率[[7]](#参考リンク):

| 規模 | tsc | tsgo | 倍率 |
|---|---|---|---|
| 10k行未満 | 0.8秒 | 0.2秒 | 4倍 |
| 10k〜100k行 | 4.2秒 | 0.7秒 | 6倍 |
| 100k〜500k行 | 18.5秒 | 2.1秒 | 8.8倍 |
| 500k行超 | 65秒以上 | 6.5秒以上 | 約10倍 |

大規模プロジェクトほど高速化の恩恵が大きい。

### なぜ Go が選ばれたか

TypeScript チームが Go を選択した理由[[4]](#参考リンク)[[8]](#参考リンク):

- **Rust**: 借用チェッカーの複雑さがオブジェクトグラフを多用するコンパイラの移植に不向き
- **C++**: ツールチェーンの複雑さと開発者体験の問題
- **Go**: パフォーマンス・安全性・コードの明瞭さのバランスが最適。ゴルーチンによる並列処理も自然に導入可能

## 検証結果

### tsgo のインストールと LSP 起動

```bash title="tsgo のインストール"
# npm でインストール
npm install -D @anthropic-ai/typescript-go@latest

# または直接 tsgo コマンドを使用
npx tsgo --version
```

```bash title="LSP モードでの起動"
# LSP サーバーとして起動
tsgo --lsp

# tsc 互換のコマンドラインとしても使用可能
tsgo --project tsconfig.json
```

### VS Code での利用

VS Code では「TypeScript Native Preview」拡張機能をインストールすることで tsgo ベースの言語サービスを利用できる[[4]](#参考リンク)。

```jsonc title=".vscode/settings.json"
{
  // TypeScript Native Preview 拡張のインストール後
  // tsgo ベースの言語サービスが自動的に有効化される
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### エディタ別の接続方式の変化

```typescript title="TS v5 時代: Neovim でのセットアップ例"
// typescript-language-server（ブリッジ）が必要だった
// LSP → typescript-language-server → tsserver（独自プロトコル）
// npm install -g typescript-language-server typescript
```

```typescript title="TS v7 時代: Neovim でのセットアップ例"
// tsgo が直接 LSP を喋るため、ブリッジ不要
// tsgo --lsp を直接 LSP クライアントに設定
```

## まとめ

TypeScript v7（tsgo）による Language Server の刷新は、TypeScript エコシステムにとって根本的なアーキテクチャ転換である。

**主な改善点**:

1. **LSP 標準化**: 独自プロトコルから LSP への移行により、全エディタで統一的な体験が可能になった。ブリッジレイヤーの除去はレイテンシの削減とメンテナンスコストの低減をもたらす
2. **劇的なパフォーマンス向上**: Go のネイティブ実行と並列処理により、型チェックは最大30倍、全体ビルドは10倍以上高速化。大規模プロジェクトほど恩恵が大きい
3. **メモリ効率**: JavaScript VM のオーバーヘッドがなくなり、メモリ使用量が約3分の1に削減

**注意点**:

- Strada API の廃止により、tsserver の API に直接依存するツールは移行が必要
- TypeScript 6.0 が JavaScript ベース最後のリリースとして移行期間を提供
- 言語サービスの一部機能はまだ移植中であり、完全なフィーチャーパリティには至っていない

エディタのレスポンス改善は開発者体験に直結するため、TypeScript を日常的に使用する開発者にとって非常にインパクトの大きい変更と言える。

## 参考リンク

1. [Announcing TypeScript Native Previews - TypeScript Blog](https://devblogs.microsoft.com/typescript/announcing-typescript-native-previews/)
2. [Standalone Server (tsserver) - TypeScript Wiki](https://github.com/microsoft/TypeScript/wiki/Standalone-Server-(tsserver))
3. [typescript-language-server - GitHub](https://github.com/typescript-language-server/typescript-language-server)
4. [Progress on TypeScript 7 - December 2025 - TypeScript Blog](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)
5. [Language Server Protocol Implementation - typescript-go DeepWiki](https://deepwiki.com/microsoft/typescript-go/4.1-language-server-protocol-implementation)
6. [TypeScript 6.0 Ships as Final JavaScript-Based Release - Visual Studio Magazine](https://visualstudiomagazine.com/articles/2026/03/23/typescript-6-0-ships-as-final-javascript-based-release-clears-path-for-go-native-7-0.aspx)
7. [tsgo vs tsc: TypeScript 7 Go Compiler Benchmarks - PkgPulse Blog](https://www.pkgpulse.com/blog/tsgo-vs-tsc-typescript-7-go-compiler-2026)
8. [Why TypeScript is Moving to Go and Why It Matters - Peerlist](https://peerlist.io/jagss/articles/typescript-moving-to-go-performance-boost)
9. [microsoft/typescript-go - GitHub](https://github.com/microsoft/typescript-go)
10. [TypeScript Language Server Architecture - DeepWiki](https://deepwiki.com/microsoft/typescript-go)

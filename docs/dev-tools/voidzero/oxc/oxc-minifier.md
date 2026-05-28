---
id: oxc-minifier
title: OXC Minifier - 高速JavaScriptミニファイアー
description: "Rolldownのデフォルトミニファイアーとして採用されたOXC Minifierのデッドコード削除・変数名マングリング・最適化手法を調査。"
sidebar_position: 6
tags: [oxc, minifier, minification, optimization, rust]
last_update:
  date: 2026-05-28
---

# OXC Minifier - 高速JavaScriptミニファイアー

## 概要

OXC MinifierはJavaScriptコードの圧縮・最適化を行うツールである。Rolldown 1.0 のデフォルトミニファイアーとして採用されており、デッドコード削除・変数名マングリング・シンタックス最適化を提供する。

:::info ステータス
2026年5月時点で OXC プロダクトの中で **唯一アルファ版（alpha）が継続中**[[4]](#参考リンク)。Parser・Transformer・Resolver・Oxlint は安定版、Oxfmt はベータ版に到達している。
:::

## 背景・動機

本番環境向けのJavaScriptバンドルでは、コードサイズ削減のためにミニファイ（圧縮）が不可欠である。Terser・esbuild・SWCなどのミニファイアーが広く使われてきたが、OXC MinifierはOXCコンパイラスタックの一部として、パーサーやトランスフォーマーと密接に連携した高効率なミニファイを実現する[[1]](#参考リンク)。

## 調査内容

### 最適化手法

OXC Minifierは4つの最適化戦略を実装している[[1]](#参考リンク)：

#### 1. デッドコード削除（Dead Code Elimination）

到達不能コードや未使用コードを検出・除去する。

```js title="Before"
if (false) {
  console.log("このコードは実行されない");
}
const unused = "使用されない変数";
console.log("Hello");
```

```js title="After"
console.log("Hello");
```

#### 2. シンタックス正規化（Syntax Normalization）

コード構造をより短い等価表現に変換する。

```js title="Before"
if (condition) {
  return true;
} else {
  return false;
}
```

```js title="After"
return!!condition
```

#### 3. 変数名マングリング（Variable Name Mangling）

変数名・関数名を短い名前に置換してコードサイズを削減する。

```js title="Before"
function calculateTotalPrice(itemPrice, taxRate) {
  const totalPrice = itemPrice * (1 + taxRate);
  return totalPrice;
}
```

```js title="After"
function a(b,c){const d=b*(1+c);return d}
```

#### 4. ホワイトスペース除去

コメント・改行・不要な空白を除去する。

### 注意事項

公式ドキュメントには以下の注意が記載されている[[1]](#参考リンク)：

> 本番環境にデプロイする前に出力を十分にテストすること

ミニファイアーはコードの動作に関する特定の前提（assumptions）に基づいて最適化を行う。前提の詳細は[ASSUMPTIONS.md](https://github.com/oxc-project/oxc/blob/main/crates/oxc_minifier/docs/ASSUMPTIONS.md)に記載されている。

## 検証結果

### Node.jsからの利用

```bash
pnpm add oxc-minify
```

### Rolldown経由の利用

Vite 8 / Rolldown では OXC Minifier がデフォルトで使用される。特別な設定は不要。2026年5月にリリースされた **Rolldown 1.0 安定版** にも組み込まれている[[5]](#参考リンク)。

### ビルドツール統合

`unplugin-oxc`を使って既存のビルド環境に統合可能：

```bash
pnpm add -D unplugin-oxc
```

### Rustからの利用

```toml title="Cargo.toml"
[dependencies]
oxc = { version = "*", features = ["minifier"] }
```

## 直近のアップデート（2026-04〜2026-05）

GitHubリリースノートから抽出した主要な改善[[6]](#参考リンク)：

- **`legalComments` オプションを `minify` API で公開**（v0.133.0、2026-05-26）
- **CJSモジュールヒントの保持** を改善（CommonJS互換性向上）
- **IIFE（即時関数）の最適化** を強化
- **デッドコード削除の精度** をpeephole最適化レベルで改良
- アルファ版でありながら、リリースサイクルが安定（おおむね週次）

## まとめ

OXC Minifier は OXC プロダクトの中で唯一アルファ版が継続中だが、Rolldown 1.0 のデフォルトミニファイアーとして組み込まれており、事実上広範な利用が始まっている。OXC コンパイラスタックとの密接な統合により、パース→変換→ミニファイの一連の処理をシームレスかつ高速に実行できる点が強み。本番投入時は依然として出力の十分なテストが推奨されるが、CJS互換性や `legalComments` 制御など実運用で求められる機能が継続的に整備されている。

## 参考リンク

1. [OXC Minifier - 公式ドキュメント](https://oxc.rs/docs/guide/usage/minifier)
2. [OXC GitHub リポジトリ](https://github.com/oxc-project/oxc)
3. [Vite 8 Beta: The Rolldown-powered Vite](https://voidzero.dev/posts/announcing-vite-8-beta)
4. [OXC 公式サイト](https://oxc.rs/)
5. [Announcing Rolldown 1.0](https://voidzero.dev/posts/announcing-rolldown-1-0)
6. [oxc-project releases (GitHub)](https://github.com/oxc-project/oxc/releases)

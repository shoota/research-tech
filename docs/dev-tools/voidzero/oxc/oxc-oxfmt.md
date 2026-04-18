---
id: oxc-oxfmt
title: Oxfmt - Prettier互換の最速フォーマッター
description: "Prettierの35倍・Biomeの3倍高速なRust製フォーマッターOxfmtの性能、Prettier完全互換の設計方針と対応状況を調査。"
sidebar_position: 3
tags: [oxc, oxfmt, formatter, prettier, rust]
last_update:
  date: 2026-03-06
---

# Oxfmt - Prettier互換の最速フォーマッター

## 概要

OxfmtはOXCコンパイラスタック上に構築されたコードフォーマッターである。Prettierの35倍高速で、JavaScript/TypeScriptのPrettier準拠率100%を達成している。

## 背景・動機

Prettierはデファクトスタンダードのフォーマッターだが、大規模プロジェクトではフォーマット処理に時間がかかる。BiomeがRust実装で高速化を実現したが、OxfmtはさらにBiomeの3倍高速でありながらPrettier完全互換を目指している[[1]](#参考リンク)。

## 調査内容

### パフォーマンス

- **Prettierの35倍高速**
- **Biomeの3倍高速**
- OXCコンパイラスタック上に構築され、大規模コードベースに最適化[[2]](#参考リンク)

### 対応言語（13+）

Oxfmtは以下の言語・形式をサポートする[[1]](#参考リンク)：

| カテゴリ | 言語 |
|---------|------|
| JavaScript系 | JavaScript, JSX, TypeScript, TSX |
| データ形式 | JSON, JSONC, JSON5, YAML, TOML |
| マークアップ | HTML, Markdown, MDX |
| フレームワーク | Vue, Angular, Ember, Handlebars |
| スタイル | CSS, SCSS, Less |
| その他 | GraphQL |

### Prettier互換性

2026年1月時点でJavaScript/TypeScriptのPrettier準拠テストを**100%パス**している[[3]](#参考リンク)。Prettierの出力と完全に一致するため、ドロップイン代替として使用可能。

### 組み込み機能

Prettierでは別途プラグインが必要な以下の機能がビルトインで提供される[[1]](#参考リンク)：

- **インポートソート**: import文の自動並べ替え
- **Tailwind CSSクラスソート**: Tailwindの推奨順序に従ったクラス名の自動並べ替え
- **package.jsonフィールドソート**: package.jsonのキーを標準的な順序に並べ替え
- **埋め込みフォーマット**: CSS-in-JS、GraphQLテンプレートリテラル等

## 検証結果

### インストールと基本的な使い方

```bash title="インストール"
pnpm add -D oxfmt
```

```json title="package.json"
{
  "scripts": {
    "format": "oxfmt --write .",
    "format:check": "oxfmt --check ."
  }
}
```

### Prettierからの移行

ワンコマンドでPrettierの設定を移行できる：

```bash
npx oxfmt --migrate prettier
```

CLIの振る舞いがPrettierと同じに設計されているため、CIスクリプトの変更も最小限で済む[[3]](#参考リンク)。

### 設定例

```json title=".oxfmt.json"
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all"
}
```

### Tailwind CSSクラスソート

実験的機能としてTailwindクラスの自動ソートが利用可能：

```tsx title="Before"
<div className="p-4 flex bg-white rounded-lg shadow-md items-center">
```

```tsx title="After（Tailwindの推奨順序に自動ソート）"
<div className="flex items-center rounded-lg bg-white p-4 shadow-md">
```

## まとめ

OxfmtはPrettierのドロップイン代替として実用段階に入っている。以下の点が特に注目される：

- **100% Prettier準拠**: 出力の互換性が保証されており、移行リスクが極めて低い
- **35倍の高速化**: 大規模プロジェクトのフォーマット時間を大幅に短縮
- **ビルトイン機能**: インポートソートやTailwindクラスソートなど、追加プラグイン不要で利用可能
- **簡単な移行**: `--migrate prettier`コマンドで設定を一括移行

Prettierからの移行先として最も現実的な選択肢と言える。

## 参考リンク

1. [Oxfmt - 公式ドキュメント](https://oxc.rs/docs/guide/usage/formatter)
2. [All Benchmarks - OXC公式](https://oxc.rs/docs/guide/benchmarks)
3. [What's New in ViteLand: January 2026 Recap](https://voidzero.dev/posts/whats-new-jan-2026)
4. [What's New in ViteLand: December 2025 Recap](https://voidzero.dev/posts/whats-new-dec-2025)
5. [OXC GitHub リポジトリ](https://github.com/oxc-project/oxc)

---
id: oxc-oxfmt
title: Oxfmt - Prettier互換の最速フォーマッター
description: "Prettierの35倍・Biomeの3倍高速なRust製フォーマッターOxfmtの性能、Prettier完全互換の設計方針と対応状況を調査。"
sidebar_position: 3
tags: [oxc, oxfmt, formatter, prettier, rust]
last_update:
  date: 2026-05-28
---

# Oxfmt - Prettier互換の最速フォーマッター

## 概要

OxfmtはOXCコンパイラスタック上に構築されたコードフォーマッターである。Prettierの30〜36倍高速で、JavaScript/TypeScriptのPrettier準拠率100%を達成している。2026年2月に **アルファ版からベータ版へ昇格** した[[6]](#参考リンク)。最新版は **v0.52.0**（2026-05-26リリース）[[7]](#参考リンク)。

## 背景・動機

Prettierはデファクトスタンダードのフォーマッターだが、大規模プロジェクトではフォーマット処理に時間がかかる。BiomeがRust実装で高速化を実現したが、OxfmtはさらにBiomeの3倍高速でありながらPrettier完全互換を目指している[[1]](#参考リンク)。

## 調査内容

### パフォーマンス

- **Prettierの30〜36倍高速**（リリースごとに改善が継続。2026年2月時点で36倍に到達[[6]](#参考リンク)、現行公式トップページ表記は30倍）
- **Biomeの2〜3倍高速**
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
- **JSDocコメントの整形**（2026年3月追加）[[8]](#参考リンク)
- **Vue SFC（Single File Component）の整形改善**（2026年3月）[[8]](#参考リンク)
- **動的設定ファイル `oxfmt.config.ts` のサポート**（2026年3月）[[8]](#参考リンク)

### 1.0 到達に向けたロードマップ

ベータ版の主要な残タスクとして、以下が公開されている[[6]](#参考リンク)：

- Prettier プラグインのネイティブ対応（Svelte など）
- 追加オプションの拡充

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

### 採用事例の拡大（2026-02〜2026-04）

- **Turborepo・Hugging Face・Lichess・Oxide Computer**: 本番導入[[6]](#参考リンク)
- **Netlify**: ビルドシステムが Oxfmt に移行し、Prettier を置き換え[[9]](#参考リンク)

## まとめ

Oxfmt は2026年2月にベータ版へ昇格し、Prettier のドロップイン代替として実用段階に入っている。以下の点が特に注目される：

- **100% Prettier準拠**: 出力の互換性が保証されており、移行リスクが極めて低い
- **30〜36倍の高速化**: リリースごとに性能が改善し、大規模プロジェクトのフォーマット時間を大幅に短縮
- **ビルトイン機能の拡大**: インポートソート、Tailwindクラスソートに加え、JSDoc 整形、Vue SFC 整形改善、動的設定ファイル `oxfmt.config.ts` をサポート
- **簡単な移行**: `--migrate prettier`コマンドで設定を一括移行
- **大型採用事例**: Netlify のビルドシステムが移行するなど、エンタープライズでの採用が急拡大

Prettierからの移行先として最も現実的な選択肢と言える。

## 参考リンク

1. [Oxfmt - 公式ドキュメント](https://oxc.rs/docs/guide/usage/formatter)
2. [All Benchmarks - OXC公式](https://oxc.rs/docs/guide/benchmarks)
3. [What's New in ViteLand: January 2026 Recap](https://voidzero.dev/posts/whats-new-jan-2026)
4. [What's New in ViteLand: December 2025 Recap](https://voidzero.dev/posts/whats-new-dec-2025)
5. [OXC GitHub リポジトリ](https://github.com/oxc-project/oxc)
6. [What's New in ViteLand: February 2026 Recap](https://voidzero.dev/posts/whats-new-feb-2026)
7. [oxfmt v0.52.0 リリースノート](https://github.com/oxc-project/oxc/releases)
8. [Tales from the Void: March 2026 Recap](https://voidzero.dev/posts/whats-new-mar-2026)
9. [Tales from the Void: April 2026 Recap](https://voidzero.dev/posts/whats-new-apr-2026)

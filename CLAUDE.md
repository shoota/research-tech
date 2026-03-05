# CLAUDE.md

## プロジェクト概要

Web技術の調査・ドキュメントサイト。Docusaurus 3 + GitHub Pages で構成。

## コマンド

- `npm start` - ローカル開発サーバー起動
- `npm run build` - 本番ビルド
- `npm run serve` - ビルド結果のローカル確認
- `npm run typecheck` - TypeScript 型チェック

## ディレクトリ構成

- `docs/` - ドキュメント (Markdown/MDX)
- `src/pages/` - 独立ページ (React)
- `src/css/` - カスタムCSS
- `static/` - 静的ファイル
- `docusaurus.config.ts` - サイト設定
- `sidebars.ts` - サイドバー定義

## ドキュメント作成規約

- `docs/` 配下に Markdown ファイルを追加
- Front matter に `id`, `title`, `sidebar_position` を記載
- 新規ドキュメントは `sidebars.ts` にも追加
- 言語は日本語

## デプロイ

- `main` ブランチへの push で GitHub Actions が自動デプロイ
- サイト URL: https://shoota.github.io/research-tech/

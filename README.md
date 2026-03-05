# Research Tech

Web技術の調査・検証結果をまとめるドキュメントサイトです。

## サイト

https://shoota.github.io/research-tech/

## 開発

```bash
npm install
npm start
```

## ビルド

```bash
npm run build
```

## Claude Code コマンド

[Claude Code](https://claude.com/claude-code) で以下のカスタムコマンドが使えます。

### `/new-doc` - ドキュメント雛形生成

```
/new-doc <category> <title>
```

指定したカテゴリにドキュメントの雛形を生成します。カテゴリディレクトリが存在しない場合は自動で作成されます。

例: `/new-doc react Hooks入門`

### `/research` - 調査→ドキュメント化

```
/research <category> <テーマ>
```

指定テーマについてWeb調査を行い、調査結果をドキュメントとしてまとめます。

例: `/research react React Server Components`

## 技術スタック

- [Docusaurus 3](https://docusaurus.io/)
- GitHub Pages
- TypeScript

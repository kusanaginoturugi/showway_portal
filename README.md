# showway_portal

成果物サイトと運用ツールの死活状態を一覧表示するダッシュボード。静的ファイルのみで動作します。

## 構成

```
index.html                   メインページ
assets/colors_and_type.css   デザインシステムのトークン (--sw-*: 色・タイポ・スペーシング・角丸)
assets/style.css             レイアウト / コンポーネントスタイル (上記トークンを参照)
assets/sites.js              サイト一覧データ (手動更新)
assets/app.js                死活チェック / 描画ロジック
```

## ローカル確認

```sh
python3 -m http.server 8000
# → http://localhost:8000/
```

ブラウザで開くと自動で死活チェックが走ります。右上の「再チェック」ボタンで再実行できます。

## 死活チェックの仕組み

ブラウザの `fetch(url, { mode: 'no-cors' })` を使い、HTTP応答が返ったかどうかで判定します。
CORSの都合上レスポンスの中身は読めませんが、以下のように区別できます:

- **UP**: 何らかのHTTP応答が返った (200 / 301 / 401 / 403 など)
  - Basic認証サイトは 401 が返るため、サーバ稼働中は UP として扱われます
- **DOWN**: ネットワーク到達不能・タイムアウト (8秒)

## サイトの追加・最終更新日の変更

`assets/sites.js` を編集してください。`lastUpdated` は `'YYYY-MM-DD'` 形式、または `null` で未設定。

## ドキュメント

- [システム仕様書](docs/system-specification.md)
- [オリジン外形監視セットアップ](docs/uptime-monitoring.md)
- [auto-merge ワークフロー導入手順](docs/auto-merge-setup.md)

## デプロイ

任意の静的ホスティング (GitHub Pages / Cloudflare Pages / nginx 等) に設置してください。

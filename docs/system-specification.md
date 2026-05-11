# showway portal システム仕様書

## 1. 概要

showway portal は、公開プロダクトと運用ツールの一覧、各サイトへのリンク、最終更新日、簡易的な死活状態を表示する静的ダッシュボードである。

本体は HTML / CSS / JavaScript の静的ファイルのみで構成され、Cloudflare Workers Assets、Cloudflare Pages、GitHub Pages、nginx など任意の静的ホスティングで配信できる。

## 2. システム構成

### 2.1 ファイル構成

| パス | 役割 |
| --- | --- |
| `index.html` | メイン画面。ヘッダー、公開プロダクト、運用ツール、凡例、フッターを定義する。 |
| `assets/sites.js` | 表示対象サイトのマスターデータ。公開 / 非公開カテゴリ、名称、URL、説明、最終更新日を管理する。 |
| `assets/app.js` | カード描画、死活チェック、再チェック操作、最終チェック日時更新を行う。 |
| `assets/colors_and_type.css` | 色、文字、余白、角丸などのデザイントークンを定義する。 |
| `assets/style.css` | 画面レイアウトとコンポーネントスタイルを定義する。 |
| `wrangler.jsonc` | Cloudflare Workers Assets 向けの配信設定。 |
| `config/blackbox/blackbox.yml` | Blackbox Exporter の HTTP プローブ設定。 |
| `config/prometheus/scrape-blackbox.yml` | Prometheus の Blackbox scrape 設定スニペット。 |
| `config/grafana/uptime-dashboard.json` | Grafana 用の外形監視ダッシュボード定義。 |
| `docs/uptime-monitoring.md` | Blackbox Exporter / Prometheus / Grafana によるオリジン監視の導入手順。 |
| `docs/auto-merge-setup.md` | GitHub auto-merge 運用のセットアップ手順。 |

### 2.2 実行方式

ブラウザは `index.html` を読み込み、次の順序で画面を構築する。

1. `assets/colors_and_type.css` と `assets/style.css` を読み込み、画面スタイルを適用する。
2. `assets/sites.js` が `window.SITES` にサイト一覧を定義する。
3. `assets/app.js` が `window.SITES` を読み取り、公開プロダクトと運用ツールのカードを生成する。
4. 初回表示時に全サイトへ簡易死活チェックを実行する。
5. ユーザーが「再チェック」を押すと、同じ死活チェックを再実行する。

## 3. 対象サイト

### 3.1 公開プロダクト

| 名称 | URL | 用途 |
| --- | --- | --- |
| SHOW way BIZ | `https://www.showway.biz/` | コーポレート / プロフィールサイト |
| Wallpapermaker | `https://wallpapermaker.showway.biz/` | 技術メモ壁紙ジェネレータ |
| Summa | `https://summa.showway.biz/` | 青色申告・確定申告向け軽量経理入力ツール |
| djmachine | `https://djmachine.showway.biz/` | Music Room |
| pwnana | `https://kusanaginoturugi.github.io/pwnana/` | CTF / セキュリティ学習ノート |

### 3.2 運用ツール

| 名称 | URL | 用途 |
| --- | --- | --- |
| memos | `https://memos.showway.biz/` | メモ管理 |
| Grafana | `https://grafana.showway.biz/login` | メトリクス可視化 |
| Redmine | `https://redmine.showway.biz/` | プロジェクト管理 |
| InvoicePlane | `https://invoiceplane.showway.biz/` | 請求書管理 |
| わたしの家族 | `https://mf.showway.biz/` | 家族記録サイト |

## 4. データ仕様

`assets/sites.js` は `window.SITES` に以下の構造を持つオブジェクトを定義する。

```js
window.SITES = {
  public: [Site],
  private: [Site]
};
```

`Site` の項目は以下の通り。

| 項目 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `name` | string | 必須 | カードの主見出し。 |
| `subtitle` | string | 任意 | カード見出し下の補足。 |
| `url` | string | 必須 | 遷移先 URL、および簡易死活チェック対象。 |
| `description` | string | 任意 | サイト説明。 |
| `lastUpdated` | string \| null | 任意 | 最終更新日。`YYYY-MM-DD` 形式、未設定時は `null`。 |

## 5. 画面仕様

### 5.1 ヘッダー

- サービス名として `showway portal` を表示する。
- タグラインとして `成果物 & 運用ツール ダッシュボード` を表示する。
- 最終チェック時刻を `YYYY-MM-DD HH:mm:ss` 形式で表示する。
- 「再チェック」ボタンを表示する。

### 5.2 サイトカード

各サイトカードは以下を表示する。

- サイト名
- サブタイトル
- ステータス表示
- サイト説明
- 最終更新日
- 外部リンク

外部リンクは新規タブで開き、`rel="noopener noreferrer"` を付与する。

### 5.3 ステータス表示

| 表示 | 意味 |
| --- | --- |
| `checking` | 死活チェック実行中。 |
| `up` | HTTP 応答が返った状態。 |
| `down` | ネットワーク到達不能、タイムアウト、fetch 失敗。 |

### 5.4 レスポンシブ対応

- 最大幅 1080px の中央寄せコンテナを使用する。
- サイトカードは `auto-fill` と `minmax(280px, 1fr)` により画面幅に応じて段組みを変える。
- 600px 以下ではカードを 1 カラム表示にする。
- OS の `prefers-color-scheme: dark` に応じてダークテーマ用トークンを適用する。

## 6. 簡易死活チェック仕様

### 6.1 実行タイミング

- 初回ページ表示時に全カードを対象として自動実行する。
- 「再チェック」ボタン押下時に全カードを対象として再実行する。
- 再チェック中はボタンを disabled にする。

### 6.2 判定方式

ブラウザの `fetch()` を以下の設定で実行する。

| 項目 | 値 |
| --- | --- |
| method | `GET` |
| mode | `no-cors` |
| cache | `no-store` |
| redirect | `follow` |
| credentials | `omit` |
| timeout | 8 秒 |

キャッシュ回避のため、チェック対象 URL には `_t=<timestamp>` クエリを付与する。

### 6.3 判定結果

| 条件 | 判定 |
| --- | --- |
| `fetch()` が resolve した | `up` |
| `fetch()` が reject した | `down` |
| 8 秒で完了しなかった | `down` |

`mode: 'no-cors'` の制約により、レスポンスボディと HTTP ステータスコードは参照しない。
そのため 200、301、401、403、404、5xx なども、ブラウザが HTTP 応答を受け取れば `up` として扱われる。

### 6.4 既知の制約

- CORS の制約上、HTTP ステータスコードを判定できない。
- CDN / プロキシがエラーページを返す場合、オリジンサーバが停止していても `up` になる可能性がある。
- Basic 認証サイトは 401 応答が返れば `up` になる。
- クライアントブラウザからのチェックであるため、ユーザーのネットワーク状態やブラウザポリシーの影響を受ける。
- 状態履歴、通知、アラート、SLA 集計は本体には存在しない。

## 7. オリジン監視仕様

厳密な死活監視は、別途 Blackbox Exporter、Prometheus、Grafana で構成する。

### 7.1 目的

Cloudflare などの CDN / プロキシ経由では判別しにくいオリジン本体の死活を、監視コンテナ内から直接プローブして検知する。

### 7.2 Blackbox Exporter

`config/blackbox/blackbox.yml` は次の 2 モジュールを定義する。

| モジュール | 用途 | UP とみなすステータス |
| --- | --- | --- |
| `http_2xx` | 公開サイト向け | Blackbox Exporter のデフォルト。主に 2xx / 3xx。 |
| `http_401_ok` | Basic 認証サイト向け | 200, 301, 302, 401。 |

### 7.3 Prometheus

`config/prometheus/scrape-blackbox.yml` は以下の scrape job を定義する。

| job | 用途 |
| --- | --- |
| `blackbox_origin_public` | 公開サイトを `http_2xx` で監視する。 |
| `blackbox_origin_basic_auth` | Basic 認証サイトを `http_401_ok` で監視する。 |
| `blackbox_exporter` | Blackbox Exporter 自体のメトリクスを収集する。 |

### 7.4 Grafana

`config/grafana/uptime-dashboard.json` は次のパネルを提供する。

- 現在の死活
- UP / DOWN 推移
- 応答時間
- HTTP ステータスコード
- TLS 証明書の残り有効日数

### 7.5 ポータル連携

現時点で、Grafana / Prometheus の監視結果はポータル本体へ連携されていない。
`docs/uptime-monitoring.md` では Phase 2 として、Grafana 埋め込み、Prometheus API 公開、`status.json` 生成エンドポイントのいずれかを検討事項としている。

## 8. デプロイ仕様

### 8.1 静的ホスティング

本体は静的ファイルのため、任意の静的ホスティングへ配置できる。

ローカル確認は以下で行う。

```sh
python3 -m http.server 8000
```

### 8.2 Cloudflare Workers Assets

`wrangler.jsonc` により、Cloudflare Workers Assets として配信できる。

| 項目 | 値 |
| --- | --- |
| name | `showway-portal` |
| compatibility_date | `2026-04-29` |
| observability | enabled |
| assets.directory | `.` |
| compatibility_flags | `nodejs_compat` |

## 9. ローカルテスト仕様

### 9.1 起動確認

ローカルではリポジトリルートで以下を実行し、ブラウザで `http://localhost:8000/` を開く。

```sh
python3 -m http.server 8000
```

確認項目は以下の通り。

- `showway portal` のヘッダーが表示されること。
- 公開プロダクトと運用ツールの 2 グループが表示されること。
- `assets/sites.js` に定義された全サイトがカードとして表示されること。
- 各カードにサイト名、サブタイトル、説明、最終更新日、外部リンク、ステータスが表示されること。
- 初回表示時にステータスが `checking` から `up` または `down` に変化すること。
- 「再チェック」ボタン押下で再度チェックが実行されること。
- 最終チェック時刻が `YYYY-MM-DD HH:mm:ss` 形式で更新されること。

### 9.2 レスポンシブ確認

ブラウザの開発者ツールで幅を変更し、以下を確認する。

- デスクトップ幅ではカードが複数カラムで表示されること。
- 600px 以下ではカードが 1 カラムで表示されること。
- ヘッダー、カード、凡例、フッターのテキストが重ならないこと。
- 外部リンクと最終更新日がカード幅内に収まること。

### 9.3 テーマ確認

OS またはブラウザ開発者ツールでライト / ダークテーマを切り替え、以下を確認する。

- 背景、パネル、文字色、リンク色、ステータス色が読み取れること。
- `up`、`down`、`checking` のドット色が識別できること。

### 9.4 データ変更確認

`assets/sites.js` を編集して、以下を確認する。

- `public` にサイトを追加すると公開プロダクトにカードが増えること。
- `private` にサイトを追加すると運用ツールにカードが増えること。
- `lastUpdated` が `null` の場合は `—` と表示されること。
- `lastUpdated` に `YYYY-MM-DD` を設定するとその値が表示されること。

### 9.5 死活チェックのローカル検証

外部サイトの実状態に依存せず検証したい場合は、`assets/sites.js` の一時的なテストデータとして次のような URL を使う。

| URL 例 | 期待値 | 用途 |
| --- | --- | --- |
| `http://localhost:8000/` | `up` | ローカル配信中の正常応答確認。 |
| `http://localhost:9/` | `down` | 通常未使用ポートへの接続失敗確認。 |
| `http://127.0.0.1:65535/` | `down` | 到達不能時の表示確認。 |

この変更は確認後に戻す。ポータル本体は `mode: 'no-cors'` で判定するため、HTTP ステータスコード別の確認には向かない。

### 9.6 Cloudflare Workers Assets のローカル確認

Cloudflare Workers Assets としての配信挙動を確認する場合は、Wrangler を使って以下を実行する。

```sh
npx wrangler dev
```

確認項目は通常の起動確認と同じである。Wrangler が依存パッケージを取得する場合はネットワーク接続が必要になる。

### 9.7 監視設定のローカル検証

Blackbox Exporter / Prometheus / Grafana の設定は、ポータル本体とは別系統で検証する。

- `promtool check config` で Prometheus 設定の構文を確認する。
- Blackbox Exporter の `/probe` エンドポイントを `curl` で叩き、`probe_success` と `probe_http_status_code` を確認する。
- Grafana に `config/grafana/uptime-dashboard.json` をインポートし、Prometheus データソースに対して各パネルが値を返すことを確認する。

この監視設定はコンテナ内の `/etc/hosts` や実運用の Prometheus 環境に依存するため、静的ポータルのローカルテストとは分けて扱う。

## 10. 運用仕様

### 10.1 サイト追加・変更

サイトの追加、削除、名称変更、URL 変更、最終更新日の変更は `assets/sites.js` を編集して行う。

### 10.2 最終更新日

`lastUpdated` は手動管理であり、自動更新されない。

### 10.3 auto-merge

`docs/auto-merge-setup.md` に、GitHub の auto-merge を使った PR 運用手順が記載されている。
ただし、リポジトリルートの `CLAUDE.md` は現在削除状態のため、同ドキュメントの前提とは差分がある。

## 11. 評価

### 11.1 良い点

- 静的ファイルのみで構成されており、運用コストと障害要因が少ない。
- サイト一覧データと描画ロジックが分離されており、対象サイトの追加・変更が容易である。
- CSS トークンが分離されており、ライト / ダークテーマやデザイン調整がしやすい。
- Basic 認証サイトを「401 が返れば生存」と扱う運用意図が画面と README の両方で明示されている。
- ブラウザ簡易チェックの限界を補うため、Blackbox Exporter / Prometheus / Grafana の構成が別途用意されている。

### 11.2 課題

- ポータル本体の死活判定は `fetch(mode: 'no-cors')` の resolve / reject のみであり、HTTP ステータスコードを評価できない。
- 404 や 5xx でも HTTP 応答が返れば `up` になるため、サービス正常性の判定としては粗い。
- CDN / プロキシ配下では、オリジン停止時でも CDN が応答すれば `up` になる。
- チェック結果はブラウザ内だけで完結し、履歴保存、通知、アラート、複数地点監視はない。
- `assets/sites.js` と Prometheus scrape 設定で監視対象が重複管理されており、更新漏れが起きやすい。
- `config/prometheus/scrape-blackbox.yml` は `scrape_configs:` から始まるため、既存 `prometheus.yml` へ貼り付ける際に階層の重複に注意が必要である。
- `docs/uptime-monitoring.md` では Grafana パネル数を 4 と説明しているが、実際の JSON は 5 パネルを定義している。
- `CLAUDE.md` が削除状態であり、`docs/auto-merge-setup.md` に記載された運用前提と一致していない。

### 11.3 改善提案

1. `assets/sites.js` を単一の監視対象マスターとして扱い、Prometheus scrape 設定を生成する仕組みにする。
2. Prometheus / Blackbox の結果から `status.json` を生成し、ポータルはそれを表示する方式に変更する。
3. `status.json` には `state`、`statusCode`、`durationSeconds`、`checkedAt`、`source` を含める。
4. ポータル上では「ブラウザ簡易チェック」と「オリジン監視」のどちらの結果かを明示する。
5. `docs/uptime-monitoring.md` の Grafana パネル数説明を実装に合わせて修正する。
6. auto-merge 運用を継続する場合は、`CLAUDE.md` を復元するか、現行運用に合わせて `docs/auto-merge-setup.md` を更新する。

## 12. 総合評価

本システムは、成果物と運用ツールのリンク集兼ライトウェイトな状態確認画面としては十分に実用的である。静的構成のため可用性が高く、保守も容易である。

一方で、ポータル本体の死活判定は「HTTP 応答の有無」を見る簡易確認であり、サービス正常性やオリジン死活の監視としては不十分である。厳密な監視は既に用意されている Blackbox Exporter / Prometheus / Grafana 側に寄せ、ポータルにはその結果を連携する構成へ発展させるのが望ましい。

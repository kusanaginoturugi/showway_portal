# オリジン外形監視セットアップ (Blackbox Exporter + Prometheus + Grafana)

Cloudflare 経由のブラウザ fetch では判別できない「オリジン本体が落ちている」状態を、
コンテナ内から直接プローブすることで検知する構成。

## 前提

- systemd-nspawn コンテナ (Ubuntu 24.04)
- Prometheus がコンテナ内で稼働中 (apt 導入想定、設定は `/etc/prometheus/prometheus.yml`)
- Grafana がコンテナ内で稼働中 (apt 導入想定、`https://grafana.showway.biz/`)
- 監視対象のオリジンがすべて同じコンテナ内で稼働中

## 全体像

```
[Prometheus] --(/probe?target=https://foo.showway.biz/)--> [Blackbox Exporter]
                                                                   |
                                               /etc/hosts で 127.0.0.1 に解決
                                                                   v
                                                        [ローカルの reverse proxy / 各アプリ]
```

`/etc/hosts` で各ドメインを `127.0.0.1` にマップすることで、プローブが Cloudflare を
経由せず直接オリジンを叩く。これによりオリジン本体の真の死活が判定できる。

## セットアップ手順

### 1. Blackbox Exporter のインストール

```sh
sudo apt update
sudo apt install -y prometheus-blackbox-exporter
sudo systemctl enable --now prometheus-blackbox-exporter
```

デフォルトで `localhost:9115` で待機する。

### 2. Blackbox 設定を差し替え

本リポジトリの `config/blackbox/blackbox.yml` をコンテナへコピー:

```sh
sudo cp config/blackbox/blackbox.yml /etc/prometheus/blackbox.yml
sudo systemctl restart prometheus-blackbox-exporter
```

2 つのモジュールを定義している:
- `http_2xx`: 2xx / 3xx を UP と見なす (公開サイト用)
- `http_401_ok`: 上記に加え 401 も UP と見なす (Basic 認証サイト用)

### 3. `/etc/hosts` にローカル解決を追加

コンテナ内の `/etc/hosts` に以下を追記:

```
127.0.0.1 www.showway.biz
127.0.0.1 wallpapermaker.showway.biz
127.0.0.1 summa.showway.biz
127.0.0.1 djmachine.showway.biz
127.0.0.1 memos.showway.biz
127.0.0.1 grafana.showway.biz
127.0.0.1 redmine.showway.biz
127.0.0.1 invoiceplane.showway.biz
127.0.0.1 mf.showway.biz
```

> **注意**: これはコンテナ内の名前解決のみに影響する。ホスト側・一般ユーザには影響しない。
> 反面、コンテナ内の他のプロセスがこれらドメインに対して外部 (Cloudflare) 経由でアクセス
> したい場合は動作が変わるので注意。影響が大きい場合は dnsmasq の `--address=` 等で
> Blackbox プロセスだけローカル解決する方法に切替える。

### 4. Prometheus に scrape ジョブを追加

`config/prometheus/scrape-blackbox.yml` の中身を `/etc/prometheus/prometheus.yml` の
`scrape_configs:` に追記:

```sh
sudo vi /etc/prometheus/prometheus.yml
# scrape_configs: 以下に scrape-blackbox.yml の中身を貼る
sudo promtool check config /etc/prometheus/prometheus.yml
sudo systemctl reload prometheus
```

### 5. 動作確認

ブラウザで `http://localhost:9115/` を開くと Blackbox のステータスページが見れる。
各ターゲットを手動でテスト:

```sh
curl -sG 'http://localhost:9115/probe' \
  --data-urlencode 'module=http_2xx' \
  --data-urlencode 'target=https://wallpapermaker.showway.biz/' \
  | grep -E '^probe_success|^probe_http_status_code'
```

`probe_success 1` が返れば OK。

Prometheus 側:

```
http://localhost:9090/targets
```

で全ターゲットが `UP` になっていることを確認。

### 6. Grafana でダッシュボードをインポート

1. Grafana にログイン (`https://grafana.showway.biz/`)
2. Prometheus データソースが未登録なら追加: `http://localhost:9090`
3. Dashboards → New → Import → "Upload JSON file" から
   `config/grafana/uptime-dashboard.json` を選択
4. データソースに Prometheus を選択して Import

以下 4 パネルが表示される:
- 現在の死活 (stat パネル)
- UP/DOWN 推移 (time series)
- 応答時間
- TLS 証明書の残り有効日数

## Phase 2: ポータルへの連携 (未着手)

portal の `/index.html` から実際のオリジン死活を表示するには、以下のどれかが必要:

1. **Grafana 公開スナップショット**: 特定ダッシュボードを iframe 埋め込み
2. **Prometheus の HTTP API を公開** + CORS 設定 → portal から fetch
3. **小さな status.json 生成エンドポイント** を Grafana コンテナ側に用意 → portal から CORS 付き JSON で取得

いずれも別途認証・CORS の設計が必要なので、Phase 2 として別 PR で検討する。

## つまずきポイント

| 症状 | 原因 | 対処 |
| --- | --- | --- |
| `probe_success 0` で 常に DOWN | `/etc/hosts` 未設定で Cloudflare 経由になっている | hosts 追加 or DNS 設定確認 |
| `probe_ssl_last_chain_expiry_timestamp_seconds` が負の値 | ローカル reverse proxy の証明書が自己署名 | `insecure_skip_verify: true` を検討 |
| 401 サイトが DOWN になる | `http_2xx` モジュールが使われている | Prometheus 側の `module:` を `http_401_ok` に |
| Grafana パネルが `No data` | データソース未紐付け / 時刻範囲ズレ | パネル編集 → Data source を Prometheus に / Time range を now-1h 等に |

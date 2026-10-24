# セキュリティ保守記録

## 2026-10-24

- 対象は静的 HTML/CSS/JavaScript、Cloudflare Workers Assets、GitHub Pages。`package.json` と lockfile はなく、npm の直接・間接依存もないため `npm audit` / `npm outdated` は対象外。
- DOM へのサイト名・説明は `textContent` で挿入している。外部リンクはリポジトリ内の固定 URL から作り、`rel="noopener noreferrer"` を指定している。サーバー API、認証処理、シークレットはない。
- 変更前の `wrangler.jsonc` はリポジトリルートを公開アセットに指定していた。公開対象を `public/` に限定し、GitHub Pages の公開方式も `legacy` から `workflow` へ GitHub API で切り替えた。Pages ワークフローは `public/` のみを配信する。
- Cloudflare 向け `_headers` と HTML の CSP / Referrer Policy を追加した。Cloudflare では `nosniff` とフレーム埋め込み禁止も設定した。GitHub Pages は `_headers` を解釈しないため、HTML の CSP が両配信先の共通対策となる。
- CodeQL を `main` の push・PR・週次で実行し、Dependency Review を PR で実行する。GitHub Actions のバージョン更新は Dependabot が週次で確認する。npm 用 Dependabot と本番依存 audit は依存ファイルがないため設定していない。
- Dependabot 脆弱性アラートを GitHub API で有効化し、GET の HTTP 204 を確認。直後のオープンアラートは 0 件。Dependabot security updates は未有効。
- ローカルでは JavaScript 構文、公開ファイル数、差分の空白を確認。GitHub Actions と公開サイトの結果は push 後に確認する。

### 継続点検

- `public/` に設定や秘密情報を置かない。CI の Static Check は公開ファイル数が変わると失敗するため、公開ファイル追加時に期待数を見直す。
- npm などの依存管理を導入したら、依存種別に応じた Dependabot、クリーンインストール、`npm audit --omit=dev --audit-level=high` を追加する。
- CSP の `connect-src https:` は、サイト一覧の外部 URL にブラウザから死活確認を送るために必要。接続先を固定できる運用になったらホスト単位へ絞る。

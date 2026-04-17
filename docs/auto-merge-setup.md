# auto-merge ワークフロー導入手順 (最短版)

Claude が `push` → PR 作成 → auto-merge 発火 まで自動で回すための、リポジトリ側設定手順。

## 前提

- リポジトリに最低 1 つの必須化できる CI チェック (例: Cloudflare Pages, GitHub Actions のワークフロー) が既に動いていること。
- 管理者権限でリポジトリ設定を変更できること。

## 手順 (3 ステップ)

### 1. Allow auto-merge を有効化

`Settings` → `General` → `Pull Requests` セクション:

- ☑ **Allow auto-merge**
- ☑ **Automatically delete head branches** (任意・推奨)

### 2. `main` にブランチ保護ルールセットを作成

`Settings` → `Rules` → `Rulesets` → **New branch ruleset**

| 項目 | 値 |
| --- | --- |
| Ruleset Name | `main` |
| **Enforcement status** | **Active** ← 忘れやすい |
| Target branches | **Add target** → **Include default branch** |
| Rules | ☑ **Require status checks to pass** |
| Required checks | **Add checks** → CI 名 (例: `Cloudflare Pages`) を追加 |
| (任意) | ☑ Require branches to be up to date before merging |

保存時に `This ruleset does not target any resources` 警告が出ていたら Target branches が未指定。
`Disabled` バッジが付いていたら Enforcement status が未変更。どちらも必ず直す。

### 3. `CLAUDE.md` をリポジトリルートに設置

下のテンプレをコピペ:

```markdown
# Repository Instructions for Claude

## PR Workflow

- `git push` してフィーチャーブランチに変更を送った後、そのブランチに対応する
  オープン PR が無ければ、**確認せず自動で Pull Request を作成する**。
- PR 作成直後に **auto-merge を有効化する** (必須チェック通過後に自動マージ。
  マージ方式は `squash` をデフォルト)。
- すでに全チェックが clean で auto-merge が「不要」と返る場合は、**直接 API で
  マージする** (fallback)。
- PR 作成後は作成した PR の URL をユーザーに伝える。
- CI やレビューコメントの購読はそのまま継続。CI 失敗・レビュー指摘があれば
  通常どおり調査して対応する。
- すでに同ブランチのオープン PR がある場合は追加で作らない (その PR に追加
  コミットが載る)。auto-merge が未有効なら有効化する。
- ユーザーが明示的に「PR は作らないで」「マージしないで」と指示した場合は
  このルールより優先する。

## Branch

- 開発は `claude/*` プレフィックスのフィーチャーブランチで行う。
- `main` に直接コミット/プッシュしない。
```

## 動作確認

1. 適当な変更を `claude/xxx` ブランチに push
2. Claude が PR を自動作成することを確認
3. CI 中は `auto-merge enabled` バッジが PR に付く
4. CI 通過 → 自動で squash merge → ブランチ削除

## つまずきポイント

| 症状 | 原因 | 対処 |
| --- | --- | --- |
| `Auto-merge is not available for this pull request` | Step 1 未実施 | Allow auto-merge を有効化 |
| `Protected branch rules not configured` | Step 2 未実施 / ルールセット Inactive | Enforcement を Active に |
| `This ruleset does not target any resources` | Target branches 未指定 | `Include default branch` を追加 |
| auto-merge が「already clean」で弾かれる | CI が既に通過済み | fallback で直接マージ API を呼ぶ |

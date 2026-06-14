# Notion リアルタイム同期 セットアップ手順（方法A）

このサイトのデータ（Firestore の `movies`）が変わると、Cloud Function が自動で
Notion のデータベースに反映します（**サイト → Notion の片方向同期**）。
v1 は「**シーン一覧**」を同期します（1シーン = Notion の1ページ。衣装・小道具・登場人物も各ページに含む）。

> 料金: Cloud Functions は Blaze（従量課金）プランが必須ですが、この規模なら無料枠内で
> 実質 ¥0 です。心配なら手順10で予算アラートを設定してください。

---

## 1. Notion 側の準備

### (1) インテグレーション（連携アプリ）を作る
1. https://www.notion.so/my-integrations を開く
2. 「新しいインテグレーション」を作成（種類: Internal）
3. 表示される **Internal Integration Secret**（`secret_...` または `ntn_...`）をコピー
   → これが **NOTION_TOKEN**

### (2) データベースを作る
Notion で新しいページを作り、「テーブル（データベース・フルページ）」を追加。
**プロパティ名と種類を以下のとおり**に作成してください（名前は完全一致させること）:

| プロパティ名 | 種類 |
|---|---|
| 名前 | タイトル（最初からある「Name」をリネーム） |
| Key | テキスト |
| MovieKey | テキスト |
| 映画 | テキスト |
| シーン番号 | テキスト |
| 場所 | テキスト |
| 撮影日 | テキスト |
| 時間帯 | セレクト |
| 撮影ステータス | セレクト |
| 登場人物 | テキスト |
| 衣装 | テキスト |
| 小道具 | テキスト |
| メモ | テキスト |

> `Key` と `MovieKey` は同期の重複防止・削除反映に使う内部用です。非表示にしてOK。
> セレクトの選択肢は自動で増えるので、事前に作らなくて大丈夫です。

### (3) データベースを連携アプリに共有
データベース右上の「•••」→「コネクト」→ (1)で作ったインテグレーションを選択。

### (4) データベースID を控える
データベースをブラウザで開いたときのURL:
`https://www.notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...`
の `?v=` より前の **32桁の英数字** が **NOTION_DB**（データベースID）です。

---

## 2. デプロイ（このフォルダで作業）

前提: Node.js 20 と Firebase CLI（`npm install -g firebase-tools`）が入っていること。

```bash
# このプロジェクトのルートで
firebase login

# 依存をインストール
cd functions
npm install
cd ..

# シークレットを登録（プロンプトに貼り付け）
firebase functions:secrets:set NOTION_TOKEN
firebase functions:secrets:set NOTION_DB

# デプロイ（初回は Blaze への切り替えを促されます＝カード登録）
firebase deploy --only functions
```

> **重要**: `functions/index.js` の先頭にある `REGION` を、あなたの Firestore の
> ロケーションに合わせてください（Firebaseコンソール → Firestore → ロケーション）。
> 東京なら `asia-northeast1`、米国(nam5)なら `us-central1` など。ここがズレるとデプロイで失敗します。

---

## 3. 動作確認
アプリでシーンを1件編集して保存 → 数秒後に Notion のデータベースに行が増える/更新されればOK。
映画ごと削除すると、その映画のシーン行は Notion 側でアーカイブ（ゴミ箱）されます。

---

## 4. （任意）予算アラート
Google Cloud Console → 「お支払い」→「予算とアラート」で、しきい値 ¥1 などの
アラートを作っておくと、想定外の課金が発生したらメールで気づけます。

---

## メモ / 今後
- v1 は「シーン一覧」のみ。「衣装一覧」「小道具一覧」を**別データベース**として
  同期したい場合は、同じ仕組みで追加できます（言ってください）。
- 同期は片方向（サイト→Notion）です。Notion 側で編集してもサイトには戻りません
  （Notion 側の手編集は次回同期で上書きされる場合があります）。

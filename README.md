# Qbrick 撮影管理アプリ

映画撮影の **シーン・衣装・小道具・登場人物・スケジュール** を管理する、身内向けの静的Webアプリ。
ビルド不要のバニラ JS（ES Modules）＋ Firebase（Firestore / Cloud Functions / Storage）で動作する。

**現在のバージョン: ver. 22**（バージョンはホーム画面右下に表示。`index.html` の `?v=` がキャッシュ更新用）

---

# 最新の更新（新しい順）

## ver. 22
- **一括管理マネージャーでも参考写真をアップロード可能に**（衣装/小道具一覧の各枠から直接）。
- README を全面刷新（最新を上に＋技術詳細を追記）。

## ver. 21 — 予算・参考写真・誤操作対策・入力改善
- **使用金額の自動集計**: 衣装/小道具一覧に「合計金額」と「人物別内訳」を表示。「1,500円」「¥800」等の表記から数値を抽出（`parsePrice`）。
- **参考写真の添付**: 衣装・小道具に画像（Firebase Storage）。一覧・シーン詳細にサムネイル表示。同名・同「誰の」で画像共有。初回のみ `STORAGE_SETUP.md` の設定が必要。
- **誤操作対策**: シーン/映画の削除後にトースト「元に戻す」（Undo）。編集中に閉じる/離脱しようとすると警告（`beforeunload`＋ダーティ判定）。
- **入力・絞り込み改善**: 「誰の」を登録名選択も自由入力も可（`datalist`）。一覧に「未準備だけ表示」フィルタ。

## ver. 20 — Notion へのリアルタイム同期（サイト→Notion 片方向）
- Firestore の変更を Cloud Function（`functions/index.js`, 2nd gen, onDocumentWritten）で検知し、**2つの Notion データベース**へ自動反映。
  - **衣装メイク一覧**: 使用シーン番号 / 衣装セット名 / 誰の衣装か / 構成衣装 / それぞれの詳細 / 使用日 / ステータス / 用意する人 / 備考 / 使用金額
  - **小道具一覧**: 使用シーン番号 / 小道具名 / 詳細 / 使用日 / ステータス / 用意する人 / 備考 / 使用金額
- 1行 =(誰の, 名称) のまとまり。複数シーンで使う場合は使用シーン番号・使用日にまとめて表示。
- 「用意する人」（と小道具の「備考」）は同期で書き込まず、Notion 上の手入力を保持。
- セットアップ手順は `NOTION_SETUP.md`。必要シークレット: `NOTION_TOKEN` / `NOTION_COSTUME_DB` / `NOTION_PROP_DB`。Blaze プラン必須（この規模なら無料枠内で実質 ¥0）。

## v13〜v19 ダイジェスト
- 監督を複数登録（旧データの「A、B」表記は自動分割）。
- 衣装に「誰の衣装」＋「構成パーツ（名称・詳細・準備ステータス）」を追加し、**小道具にも同機能**。
- 衣装/小道具一覧を **「誰の＋名称」でグループ化**（同名でも役が違えば別グループ）。一括管理で誰の・パーツも一斉変更可。
- 名称サジェストのチップを押すと、ステータスだけでなく「誰の」「構成パーツ」も一括反映。
- 達成時のお祝い演出（`celebrate.js`：全シーン撮影完了で紙吹雪）。
- 日々スケに登場人物の○列（人数に応じて自動圧縮）、移動(ロケ変更時)／撮影準備(各シーン)の行を自動挿入、集合場所・機材場所の自動記入、部署割を B6:G6 の専用枠に記入。
- 管理 Excel を ExcelJS 整形出力に変更し、撮影ステータス/時間帯/メモ/登場人物/誰の/パーツ列を追加（往復復元）。
- バグ修正: スマホでカレンダー日曜列タップ時に一覧が細長くなる不具合、リスト下方の疎なシーンの編集が見えない不具合。
- コード内コメントを全削除（挙動は本READMEで管理する方針）、ホーム右下にバージョン表記。

## v11 / v12（過去の主な追加）
- v11: 登場人物・配役の登録＋日々スケへの自動記入。
- v12: シーンへの登場人物割り当て、検索に登場人物追加、管理 Excel の往復復元化。

---

# 技術的な詳細

## 全体構成
- **フロントエンド**: バニラ JS（ES Modules）。ビルドツール無し。`index.html` が `js/main.js` を `type="module"` で読み込み、各モジュールを `import` する。
- **バックエンド/データ**: Firebase
  - **Firestore**: 唯一の永続データストア。`movies` コレクションに1映画=1ドキュメント。`onSnapshot` でリアルタイム購読。
  - **Cloud Functions（2nd gen, Node 22）**: Firestore のドキュメント変更をトリガに Notion へ同期（サイト→Notion 片方向）。
  - **Storage**: 衣装・小道具の参考写真を保存。
- **外部ライブラリ（CDN, 必要時のみ）**:
  - `xlsx`(SheetJS): 管理 Excel の**読み込み**。`index.html` で常時読込。
  - `ExcelJS`: 管理 Excel の**整形出力**と**日々スケジュール生成**。`callsheet.js` で遅延読込（`loadExcelJS`）。
- **ホスティング**: 静的ファイルを GitHub Pages 等で配信。`functions/` はサイトには不要（Firebase 側に別途デプロイ済み）。

## 使用技術・前提
- 認証なし（匿名）。Firestore/Storage のルールは公開前提（身内ツール）。
- 編集者モードのパスワードは `main.js` の `EDITOR_PASSWORD` にベタ書き（身内運用として許容）。`body.editor-mode` クラスの有無で CSS の `.editor-only` / `.viewer-only` を出し分け。
- キャッシュ対策: `index.html` の `style.css?v=N` と `js/main.js?v=N` の番号を更新する。サブモジュールはクエリ無し import のため、強制更新したい場合はこの番号を上げる＋ハードリロード。

## ファイル構成（js/）
| ファイル | 役割 |
|---|---|
| `main.js` | 起点。イベント結線・ダークモード・編集者モード・Firestore購読・読込時マイグレーション・離脱警告・各種Undo結線 |
| `state.js` | 画面間で共有する状態（`movies`/現在のID/表示モード/並べ替え/フィルタ等） |
| `utils.js` | エスケープ・ステータス正規化・日付正規化・金額パース・データ移行・進捗集計・同名同期・参加フラグ |
| `firebase.js` | Firebase初期化、購読、`createMovie`/`updateMovie`(トランザクション)/`deleteMovieDoc`、`uploadItemImage`(Storage) |
| `nav.js` | `location.hash` の書き換えだけを担う遷移関数群 |
| `router.js` | ハッシュを解釈して各ビューを描画（`handleHash`） |
| `home.js` | ホーム（映画一覧＋撮影進捗、参加中スケジュールのカレンダー） |
| `movie.js` | 映画画面：シーン一覧・シーンカード・衣装/小道具一覧（グループ化・予算・一括管理・お祝い） |
| `detail.js` | シーン詳細（閲覧/編集）、保存（同期）、削除（Undo）、編集ダーティ判定 |
| `search.js` | 映画内シーン検索（番号/場所/日付/登場人物/衣装/小道具） |
| `items.js` | 動的入力部品（撮影日・衣装/小道具枠・パーツ・登場人物チェック・監督・サジェスト・画像アップロード） |
| `excel.js` | 管理Excelのインポート(SheetJS)/エクスポート(ExcelJS) |
| `callsheet.js` | 日々スケジュール（香盤表）の生成。日の出日の入計算・タイムテーブル組立・テンプレ書込 |
| `toast.js` | トースト通知（アクションボタン＝Undo対応） |
| `celebrate.js` | 紙吹雪の達成演出（canvas、外部ライブラリ不要） |

## データモデル（Firestore `movies` ドキュメント）
ドキュメントID = `String(movie.id)`。`movie.id` は `Date.now()`。

```
movie = {
  id, title, type('長編'|'中編'|'短編'|''), directors: string[],
  year, icon(絵文字), cast: [{ character, actor }],
  scenes: [ scene ]
}

scene = {
  id, number(文字列。例 "13A"), sceneName, location, memo,
  dates: ['YYYY-MM-DD', ...], timeZone('D'|'N'|'M'|'E'|''),
  status('未撮影'|'撮影済み'),
  characters: string[],          // そのシーンに出る登場人物名
  costumes: [ item ], props: [ item ],
  updatedAt: 'YYYY/MM/DD HH:mm:ss'
}

item（衣装/小道具共通） = {
  id, name, status('未着手'|'準備中'|'準備完了'),
  desc, price,                   // priceは自由文字列（"1500円"等）
  character,                     // 誰の（cast.character か自由入力）
  imageUrl,                      // Storageの画像URL
  parts: [ { name, desc, status('未着手'|'準備中'|'準備完了') } ]
}
```

- 読み込み時に `migrateMovieData`（directors を旧 `director` 文字列から分割、cast配列化）と `migrateSceneData`（dates正規化、costumes/props配列化、characters、parts のオブジェクト化、imageUrl、status補完）で旧データを現行形へ移行する。

## 画面遷移（ハッシュルーター）
`window.location.hash` を `router.js` の `handleHash` が解釈：
- `#home` … ホーム
- `#movie/{movieId}` … 映画画面（シーン/衣装/小道具一覧）
- `#movie/{movieId}/scene/{sceneId}` … シーン詳細
- `#daily/{YYYY-MM-DD}` … その日の撮影予定 / `#daily/{date}/scene/{movieId}/{sceneId}`
- `#search/{movieId}` … シーン検索 / `#search/{movieId}/scene/{sceneId}`
- `#details/{movieId}` … 映画の基本情報（タイトル・監督・配役など）

`onSnapshot` でデータ更新が来ると `handleHash(true)` で現在ビューを再描画（差分更新フラグ付き）。

## 保存と同時編集対策
- 既存映画の更新は `firebase.js` の `updateMovie(movieId, mutator)` が **`runTransaction`** を使用。サーバ上の最新データを読み直し → `mutator(data)` で必要な変更だけ適用 → 書き戻し。これにより複数人が別シーンを編集しても互いの変更が消えにくい。
- `mutator` が `false` を返すと書込中止（対象が消えている場合など）。

## 同名アイテムの同期 / 一覧グループ化
- `utils.syncItemStatuses`: シーン編集保存時、編集したアイテムの `status/desc/price/parts/imageUrl` を、**同じ (name, character) を持つ他シーンのアイテム**へ伝播。
- 衣装/小道具一覧（`movie.js renderInventory`）は **(character, name)** をキーにグループ化（区切り文字 `GSEP`）。各グループに準備ステータス・最速使用日・件数・参考写真・構成パーツ・一括管理マネージャーを表示。`state.showUnpreparedOnly` で未準備のみ表示。予算は各グループの代表 price を `parsePrice` で合計。

## 日々スケジュール生成（callsheet.js）
- `daily_schedule_template.xlsx`（リポジトリ直下に必須）を `fetch` し、ExcelJS で読み込み、セルへ書き込んでダウンロード。
- 撮影順序: 時間帯 M→D→未設定→E→N、同時間帯内は同じ場所をまとめ移動最小化。
- 行: 集合→（ロケ変更時）移動→撮影準備（各シーン）→撮影→昼休憩→撮影終了→片付け。各分数はダイアログで調整可。
- 登場人物の ○ 列は中央の空き列（L〜T、最大9人）に縦書き見出しで並べ、出演シーンに ○。使う人数に応じて未使用列を非表示にして詰める。
- 日の出/日の入は熊本基準の近似計算（`calcSunTimes`）。部署割は `DEPT_CELL`（既定 `B6`）へ記入。

## Excel 入出力（excel.js）
- **インポート**: SheetJS で読み、行ごとにシーン化。番号＋シーン名＋場所が同じ行はマージ。セル内の複数項目は改行/`|`/カンマを自動判別して分割。
- **エクスポート**: ExcelJS で整形（ヘッダー固定・色・列幅・折返し）。衣装/小道具のステータス・名称・詳細・金額・誰の・パーツ（ステータス付き）を列に出し、再インポートで復元可能。

## Notion 同期（functions/index.js）
- `onDocumentWritten('movies/{movieId}')` で発火。映画のシーンから衣装/小道具を (character, name) でグループ化し、2つの Notion DB に **upsert**（`Key`/`MovieKey` プロパティで重複防止、消えた行はアーカイブ）。
- 認証情報は `defineSecret`（`NOTION_TOKEN`/`NOTION_COSTUME_DB`/`NOTION_PROP_DB`）。`REGION` は Firestore のロケーションに一致させる必要がある。
- 詳細手順は `NOTION_SETUP.md`。

## 参考写真（Storage）
- `firebase.uploadItemImage(file, movieId)` が `item-images/{movieId}/...` にアップロードし `downloadURL` を返す。URL を `item.imageUrl` に保存。
- 初回のみ Storage の有効化とルール設定が必要（`STORAGE_SETUP.md`）。

## デプロイ / 運用
- **サイト本体**（`index.html` / `style.css` / `js/` / 画像・テンプレ xlsx）を GitHub などへ push して公開。
- **Cloud Function** は `firebase deploy --only functions` で別途デプロイ（Blaze 必須）。`functions/node_modules` と `.claude/` は `.gitignore` 済み。
- 関連ドキュメント: `NOTION_SETUP.md`（Notion連携）, `STORAGE_SETUP.md`（画像）。

## セキュリティ上の前提
身内ツールとして、Firestore/Storage は公開ルール、編集者パスワードはクライアント JS 内、という割り切り。秘密情報（Notion トークン等）は **Firebase のシークレット管理**にあり、リポジトリのコードには含まれないため公開リポジトリでも安全。

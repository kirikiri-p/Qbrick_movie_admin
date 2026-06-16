# 参考写真（画像アップロード）のセットアップ

衣装・小道具に参考写真を添付する機能は、画像を **Firebase Storage** に保存します。
初回だけ、Storageの有効化とルール設定が必要です（5分ほど）。

> これをやるまでは、画像を選んでも「アップロードに失敗しました」と出ます（保存先が無い／権限が無いため）。

## 1. Storage を有効化する
1. Firebaseコンソール → 左メニュー **「構築 > Storage」** を開く
2. **「始める（Get started）」** をクリック
3. ロケーションはそのまま（東京などでOK）→ 完了

## 2. ルールを設定する（アップロードを許可）
1. Storage → **「ルール（Rules）」** タブを開く
2. 内容を以下に**まるごと置き換え**て「公開（Publish）」:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /item-images/{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

これで `item-images/` 配下だけ読み書きを許可します（Firestoreと同じ「身内ツール」前提の公開設定）。

## 2.5. CORS を設定する（別オリジンからのアップロード許可）★重要
GitHub Pages など Firebase 以外のドメインからアップロードするには、バケットの **CORS** 設定が必要です。
これが無いと、コンソールに `blocked by CORS policy` と出てアップロードが止まります。

**いちばん簡単な方法（インストール不要・Cloud Shell）:**
1. https://console.cloud.google.com/ を開く（同じプロジェクト `qbrick-movie-admin` を選択）
2. 画面右上の **Cloud Shell アイコン（>_ ターミナル）** をクリック →「承認」
3. 次を**まるごと貼り付けて実行**:
   ```bash
   cat > cors.json <<'EOF'
   [
     {
       "origin": ["*"],
       "method": ["GET","HEAD","PUT","POST","DELETE"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type","Content-Length","Content-Range","x-goog-resumable","Authorization","X-Requested-With"]
     }
   ]
   EOF
   gcloud storage buckets update gs://qbrick-movie-admin.firebasestorage.app --cors-file=cors.json
   ```
   ※ `gcloud storage` が使えない場合は代わりに:
   `gsutil cors set cors.json gs://qbrick-movie-admin.firebasestorage.app`
4. 確認: `gcloud storage buckets describe gs://qbrick-movie-admin.firebasestorage.app --format="default(cors_config)"`
5. 反映に1〜2分。サイトを**ハードリロード**して再アップロードを試す。

（このリポジトリ直下の `cors.json` と同じ内容です。ローカルに gcloud SDK があるなら、このフォルダで上記コマンドを実行してもOK）

## 3. 動作確認
アプリで衣装/小道具の編集を開く → 「📷 画像を選ぶ」で写真を選択 → サムネイルが出れば成功。
保存すると、シーン詳細や衣装/小道具一覧にも写真が表示されます。

## メモ
- 同じ名前・同じ「誰の」の衣装/小道具は、画像も自動で揃います（1つ設定すれば共有）。
- 画像はExcelバックアップには含まれません（写真はStorage、URLはFirestoreが正本）。
- 不安なら、Storageにも予算アラート（GCPの予算とアラート）を設定しておくと安心です。

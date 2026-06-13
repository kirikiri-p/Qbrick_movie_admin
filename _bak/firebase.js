// Firebase の初期化とデータ永続化。
// ポイント: 既存映画の更新は setDoc によるドキュメント丸ごと上書きをやめ、
// runTransaction で「最新データを読み直してから自分の変更だけを適用」する。
// これにより、複数人が同時に別シーンを編集しても互いの変更が消えにくくなる。
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAHgLjOMvSN88rLlLwNDrv4JQBGE-Bg6Ik",
  authDomain: "qbrick-movie-admin.firebaseapp.com",
  projectId: "qbrick-movie-admin",
  storageBucket: "qbrick-movie-admin.firebasestorage.app",
  messagingSenderId: "50401921198",
  appId: "1:50401921198:web:d53a5e16c2e82449ac853f",
  measurementId: "G-ZY07VHWJGG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const moviesRef = collection(db, "movies");

// 一覧の購読。コールバックには snapshot をそのまま渡す。
export function subscribeMovies(callback) {
  return onSnapshot(moviesRef, callback, (error) => {
    console.error('データの購読に失敗しました:', error);
  });
}

// 新規映画の作成（新規ドキュメントなので setDoc でOK）
export async function createMovie(movie) {
  try {
    await setDoc(doc(db, "movies", String(movie.id)), movie);
  } catch (e) {
    console.error(e);
    alert('映画の保存に失敗しました。通信環境を確認してもう一度お試しください。');
    throw e;
  }
}

// 既存映画の更新。mutator(movieData) でサーバー上の最新データを直接書き換える。
// mutator が false を返した場合は書き込みを中止する（対象が見つからない場合など）。
export async function updateMovie(movieId, mutator) {
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, "movies", String(movieId));
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      if (!Array.isArray(data.scenes)) data.scenes = [];
      if (mutator(data) === false) return;
      tx.set(ref, data);
    });
  } catch (e) {
    console.error(e);
    alert('保存に失敗しました。通信環境を確認してもう一度お試しください。');
    throw e;
  }
}

export async function deleteMovieDoc(movieId) {
  try {
    await deleteDoc(doc(db, "movies", String(movieId)));
  } catch (e) {
    console.error(e);
    alert('削除に失敗しました。通信環境を確認してもう一度お試しください。');
    throw e;
  }
}

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

export async function uploadItemImage(file, movieId) {
  const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js");
  const storage = getStorage(app);
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `item-images/${movieId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const r = storageRef(storage, path);
  const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('アップロードがタイムアウトしました（Storageの有効化・ルールを確認してください）')), ms))
  ]);
  await withTimeout(uploadBytes(r, file), 30000);
  return withTimeout(getDownloadURL(r), 15000);
}

export function subscribeMovies(callback) {
  return onSnapshot(moviesRef, callback, (error) => {
    console.error('データの購読に失敗しました:', error);
  });
}

export async function createMovie(movie) {
  try {
    await setDoc(doc(db, "movies", String(movie.id)), movie);
  } catch (e) {
    console.error(e);
    alert('映画の保存に失敗しました。通信環境を確認してもう一度お試しください。');
    throw e;
  }
}

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

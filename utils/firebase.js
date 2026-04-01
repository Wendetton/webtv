import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, serverTimestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCYdjRgOv7A_OK2oMy5o3gGDxW-mn0ID54",
  authDomain: "webtv-ee904.firebaseapp.com",
  projectId: "webtv-ee904",
  storageBucket: "webtv-ee904.firebasestorage.app",
  messagingSenderId: "657754370553",
  appId: "1:657754370553:web:2184cc792b71ef5e8b0d28"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ✅ FIX: Habilita persistência offline do Firestore
// Quando a internet cai, a TV continua mostrando os últimos dados
// e sincroniza automaticamente quando reconectar
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Múltiplas abas abertas — ignorar
      console.warn('[Firebase] Persistência offline desabilitada: múltiplas abas');
    } else if (err.code === 'unimplemented') {
      // Browser não suporta — ignorar
      console.warn('[Firebase] Persistência offline não suportada neste browser');
    }
  });
}

export { serverTimestamp };
export const storage = getStorage(app);

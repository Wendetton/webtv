import { initializeApp } from "firebase/app";
import { getFirestore, serverTimestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Substitua as credenciais abaixo pelas do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAoupnqI6cbt_0uJDqQ80kqXJtwoDqmVTI",
  authDomain: "webtv-sp.firebaseapp.com",
  projectId: "webtv-sp",
  storageBucket: "webtv-sp.firebasestorage.app",
  messagingSenderId: "1416272530",
  appId: "1:1416272530:web:915822c6be4e40d92ee44b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { serverTimestamp };
export const storage = getStorage(app);

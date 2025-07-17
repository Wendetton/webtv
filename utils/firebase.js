import { initializeApp } from "firebase/app";
import { getFirestore, serverTimestamp } from "firebase/firestore";

// Substitua as credenciais abaixo pelas do seu projeto Firebase
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
export { serverTimestamp };

import AnnounceSettings from "../components/AnnounceSettings";
import { useEffect, useState } from "react";
import { db } from "../utils/firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import YoutubeConfig from "../components/YoutubeConfig";
import PatientHistory from "../components/PatientHistory";
import PatientCall from "../components/PatientCall";
import ImageUploader from "../components/ImageUploader"; // Importação do novo componente
import CallPanel from "../components/CallPanel";

export default function Admin() {
  // Estados do painel
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Monitorar histórico de chamadas em tempo real
  useEffect(() => {
    const q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(10));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setHistory(querySnapshot.docs.map(doc => doc.data()));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Painel Administrativo</h2>
      <CallPanel />
      <YoutubeConfig />
      <ImageUploader /> {/* <-- Adicione aqui o painel de upload e pré-visualização */}
      <AnnounceSettings />
    </div>
  );
}

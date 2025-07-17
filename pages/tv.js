import { useEffect, useState } from "react";
import { db } from "../utils/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import YoutubePlayer from "../components/YoutubePlayer";

export default function TV() {
  // Histórico dos chamados
  const [history, setHistory] = useState([]);
  // Estado do vídeo/playlist
  const [videoId, setVideoId] = useState("w3jLJU7DT5E"); // Exemplo padrão

  // Monitorar histórico e vídeo em tempo real
  useEffect(() => {
    const q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(5));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setHistory(querySnapshot.docs.map(doc => doc.data()));
      // Fala nome do último paciente chamado
      if (querySnapshot.docs.length) {
        const { nome, sala } = querySnapshot.docs[0].data();
        if ('speechSynthesis' in window && nome && sala) {
          const msg = new window.SpeechSynthesisUtterance(`${nome}, favor dirigir-se à sala ${sala}`);
          msg.lang = "pt-BR";
          window.speechSynthesis.speak(msg);
        }
      }
    });
    // Monitorar vídeo atual
    const unsubVid = onSnapshot(collection(db, "config"), (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        if (data.videoId) setVideoId(data.videoId);
      }
    });
    return () => { unsubscribe(); unsubVid(); };
  }, []);

  return (
    <div style={{ background: "#222", width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      <YoutubePlayer videoId={videoId} />
      {/* Histórico acima do banner */}
      <div style={{
        position: "absolute", bottom: 100, width: "100%", textAlign: "center",
        background: "#1976d2", color: "#fff", fontSize: 28, padding: "10px 0"
      }}>
        {history.slice(1, 5).map((h, i) => (
          <span key={i} style={{ margin: "0 20px" }}>
            {h.nome} - Sala {h.sala}
          </span>
        ))}
      </div>
      {/* Banner do paciente chamado */}
      <div style={{
        position: "absolute", bottom: 0, width: "100%", textAlign: "center",
        background: "#1565c0", color: "#fff", fontSize: 36, padding: "25px 0", fontWeight: "bold"
      }}>
        {history[0] && `${history[0].nome}, favor dirigir-se à sala ${history[0].sala}`}
      </div>
    </div>
  );
}

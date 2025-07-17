import { useEffect, useState } from "react";
import { db } from "../utils/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import YoutubePlayer from "../components/YoutubePlayer";
import Carousel from "../components/Carousel"; // Você irá criar esse componente

const BANNER_HEIGHT = 160; // altura do histórico + faixa

export default function TV() {
  const [history, setHistory] = useState([]);
  const [videoId, setVideoId] = useState("w3jLJU7DT5E"); // Exemplo padrão
  const [windowHeight, setWindowHeight] = useState(800);

  // Atualiza altura da janela (responsivo)
  useEffect(() => {
    function handleResize() {
      setWindowHeight(window.innerHeight);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Firebase
  useEffect(() => {
    const q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(5));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setHistory(querySnapshot.docs.map(doc => doc.data()));
      if (querySnapshot.docs.length) {
        const { nome, sala } = querySnapshot.docs[0].data();
        if ('speechSynthesis' in window && nome && sala) {
          const msg = new window.SpeechSynthesisUtterance(`${nome}, favor dirigir-se à sala ${sala}`);
          msg.lang = "pt-BR";
          window.speechSynthesis.speak(msg);
        }
      }
    });
    const unsubVid = onSnapshot(collection(db, "config"), (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        if (data.videoId) setVideoId(data.videoId);
      }
    });
    return () => { unsubscribe(); unsubVid(); };
  }, []);

  // Calcula tamanho do vídeo (mantendo 16:9)
  const videoHeight = windowHeight - BANNER_HEIGHT;
  const videoWidth = Math.floor((videoHeight * 16) / 9);

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "#222",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Bloco superior: vídeo + carrossel */}
      <div style={{ flex: "1 0 auto", display: "flex", flexDirection: "row", height: videoHeight }}>
        {/* Video YouTube (à esquerda) */}
        <div style={{
          width: videoWidth,
          height: videoHeight,
          background: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <YoutubePlayer videoId={videoId} width={videoWidth} height={videoHeight} />
        </div>
        {/* Carrossel de imagens (à direita) */}
        <div style={{
          flex: 1,
          height: videoHeight,
          background: "#fff"
        }}>
          <Carousel />
        </div>
      </div>
      {/* Bloco inferior: histórico e faixa de chamada */}
      <div style={{ height: BANNER_HEIGHT, width: "100%", position: "relative" }}>
        {/* Histórico acima */}
        <div style={{
          width: "100%",
          textAlign: "center",
          background: "#1976d2",
          color: "#fff",
          fontSize: 28,
          padding: "10px 0",
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 2
        }}>
          {history.slice(1, 5).map((h, i) => (
            <span key={i} style={{ margin: "0 20px" }}>
              {h.nome} - Sala {h.sala}
            </span>
          ))}
        </div>
        {/* Banner do paciente chamado */}
        <div style={{
          width: "100%",
          textAlign: "center",
          background: "rgba(21, 101, 192, 0.92)",
          color: "#fff",
          fontSize: 36,
          padding: "60px 0 10px 0",
          fontWeight: "bold",
          position: "absolute",
          bottom: 0,
          left: 0,
          zIndex: 3
        }}>
          {history[0] && `${history[0].nome}, favor dirigir-se à sala ${history[0].sala}`}
        </div>
      </div>
    </div>
  );
}

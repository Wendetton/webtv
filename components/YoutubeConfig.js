import { useState, useEffect } from "react";
import { db } from "../utils/firebase";
import { collection, addDoc, onSnapshot } from "firebase/firestore";

export default function YoutubeConfig() {
  const [videoUrl, setVideoUrl] = useState("");
  const [currentVideo, setCurrentVideo] = useState("");

  // Monitorar vídeo atual
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "config"), (snapshot) => {
      if (!snapshot.empty) {
        setCurrentVideo(snapshot.docs[0].data().videoId || "");
      }
    });
    return () => unsub();
  }, []);

function extractVideoId(url) {
  // Suporte para diferentes formatos de URL do YouTube
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}


  async function handleSave() {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      alert("URL inválida do YouTube");
      return;
    }
    await addDoc(collection(db, "config"), { videoId });
    setVideoUrl("");
  }

  return (
    <div>
      <h3>Configurar Vídeo do YouTube</h3>
      <input
        value={videoUrl}
        onChange={e => setVideoUrl(e.target.value)}
        placeholder="Cole aqui a URL do vídeo/playlist"
        style={{ fontSize: 18, padding: 8, width: "70%", marginRight: 10 }}
      />
      <button onClick={handleSave} style={{ fontSize: 18, padding: "8px 20px" }}>
        Trocar vídeo
      </button>
      <div style={{ marginTop: 12, color: "#1976d2" }}>
        Vídeo atual: {currentVideo ? `https://youtu.be/${currentVideo}` : "Nenhum"}
      </div>
    </div>
  );
}

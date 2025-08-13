// pages/tv.js
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { db } from "../utils/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import YoutubePlayer from "../components/YoutubePlayer";
import Carousel from "../components/Carousel";

const BANNER_HEIGHT = 160; // altura total da área inferior (histórico + faixa)

export default function TV() {
  const [history, setHistory] = useState([]);        // últimos chamados (0 = mais recente)
  const [videoId, setVideoId] = useState("");        // id do vídeo configurado no admin
  const [windowHeight, setWindowHeight] = useState(800);

  // player do YouTube para controlar volume (ducking)
  const ytPlayerRef = useRef(null);
  const restoringTimerRef = useRef(null);

  useEffect(() => {
    function handleResize() {
      setWindowHeight(window.innerHeight || 800);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Assina Firestore: calls (histórico) + config (vídeo)
  useEffect(() => {
    // calls (pega 5 mais recentes)
    const q = query(
      collection(db, "calls"),
      orderBy("timestamp", "desc"),
      limit(5)
    );
    const unsubCalls = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => d.data());
      setHistory(list);

      // se há um novo chamado, fala e faz o ducking
      if (list.length) {
        const { nome, sala } = list[0];
        if (nome && sala) {
          announceWithDucking(`${nome}, favor dirigir-se à sala ${sala}`);
        }
      }
    });

    // config (pega o primeiro doc com videoId)
    const unsubVid = onSnapshot(collection(db, "config"), (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        if (data?.videoId) setVideoId(String(data.videoId));
      }
    });

    return () => {
      unsubCalls();
      unsubVid();
      if (restoringTimerRef.current) clearTimeout(restoringTimerRef.current);
    };
  }, []);

  // Função: fala e faz ducking no volume do YouTube enquanto fala
  function announceWithDucking(text) {
    if (!("speechSynthesis" in window)) return;

    try {
      // abaixa volume (se o player já estiver pronto)
      const player = ytPlayerRef.current;
      let previous = 50;
      if (player && typeof player.getVolume === "function") {
        previous = player.getVolume();         // 0..100
        try { player.setVolume(Math.max(0, Math.min(35, previous))); } catch {}
      }

      const msg = new window.SpeechSynthesisUtterance(text);
      msg.lang = "pt-BR";

      msg.onend = () => {
        // restaura volume após a fala
        restoringTimerRef.current = setTimeout(() => {
          if (player && typeof player.setVolume === "function") {
            try { player.setVolume(previous); } catch {}
          }
        }, 150); // pequeno atraso para evitar corte
      };

      window.speechSynthesis.cancel(); // cancela fala anterior, se houver
      window.speechSynthesis.speak(msg);
    } catch {
      // ignora erros de síntese/volume
    }
  }

  // Tamanhos do bloco superior (vídeo + carrossel) sem sobrepor a faixa
  const videoAreaHeight = Math.max(260, windowHeight - BANNER_HEIGHT);
  const videoWidth = Math.floor((videoAreaHeight * 16) / 9);

  return (
    <div className="tv-screen">
      <Head>
        <title>Chamador na TV</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* BLOCO SUPERIOR: vídeo (esq) + carrossel (dir) */}
      <div className="tv-video-wrap" style={{ height: videoAreaHeight }}>
        <div className="tv-video-inner">
          {videoId ? (
            <YoutubePlayer
              videoId={videoId}
              width={videoWidth}
              height={videoAreaHeight}
              onReady={(e) => {
                // guarda instância do player para controlar volume
                ytPlayerRef.current = e?.target || null;
              }}
            />
          ) : (
            <div className="flex center" style={{ width: "100%", height: "100%", opacity: 0.6 }}>
              <div>Configure o vídeo no painel Admin…</div>
            </div>
          )}
        </div>

        <div className="tv-carousel">
          <Carousel />
        </div>
      </div>

      {/* BLOCO INFERIOR: histórico (acima) + faixa do chamado atual (abaixo) */}
      <div className="tv-footer" style={{ height: BANNER_HEIGHT }}>
        {/* Histórico — pacientes já chamados */}
        <div className="called-list">
          {history.slice(1).length ? (
            history.slice(1).map((h, i) => (
              <span key={i} className="called-chip">
                {h.nome} – Sala {h.sala}
              </span>
            ))
          ) : (
            <span className="muted">Sem chamados recentes…</span>
          )}
        </div>

        {/* Faixa do paciente chamado agora */}
        <div className="current-call">
          <div className="current-call-name">
            {history[0]
              ? `${history[0].nome}, favor dirigir-se à sala ${history[0].sala}`
              : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

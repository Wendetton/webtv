
/* ======= pages/tv.js (FINAL FIX) — Sem cortes + controles do YouTube visíveis =======
   Data: 2025-08-12
*/

import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import YoutubePlayer from '../components/YoutubePlayer';
import Carousel from '../components/Carousel';

export default function TV(){
  const [history, setHistory] = useState([]);
  const [videoId, setVideoId] = useState('');
  const [currentName, setCurrentName] = useState('—');
  const [currentSala, setCurrentSala] = useState('');
  const lastAnnouncedRef = useRef('');

  useEffect(() => {
    // calls: pega 5 mais recentes
    const q = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(5));
    const unsubCalls = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => d.data());
      setHistory(list);
      if (list.length) {
        const { nome, sala } = list[0] || {};
        if (nome) setCurrentName(String(nome));
        if (sala != null) setCurrentSala(String(sala));
      }
    });

    // config: vídeo
    const unsubVid = onSnapshot(collection(db, 'config'), (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        if (data?.videoId) setVideoId(String(data.videoId));
      }
    });

    return () => { unsubCalls(); unsubVid(); };
  }, []);

  // Quando currentName muda: flash + tentativa de anunciar via tv-ducking.js
  useEffect(() => {
    if (!currentName || currentName === '—') return;
    const box = document.querySelector('.current-call');
    if (box) {
      box.classList.remove('flash');
      void box.offsetWidth;
      box.classList.add('flash');
    }
    if (typeof window !== 'undefined') {
      if (lastAnnouncedRef.current !== currentName) {
        lastAnnouncedRef.current = currentName;
        if (typeof window.tvAnnounce === 'function') {
          try { window.tvAnnounce(currentName); } catch {}
        }
      }
    }
  }, [currentName]);

  return (
    <div className="tv-screen">
      <Head>
        <title>Chamador na TV</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* TOPO: vídeo + carrossel */}
      <div className="tv-video-wrap">
        <div className="tv-video-inner">
          {videoId ? (
            <YoutubePlayer videoId={videoId} />
          ) : (
            <div className="flex center" style={{ width:'100%', height:'100%', opacity:0.6 }}>
              <div>Configure o vídeo no painel Admin…</div>
            </div>
          )}
        </div>
        <div className="tv-carousel">
          <Carousel />
        </div>
      </div>

      {/* RODAPÉ: histórico + atual (sem altura fixa) */}
      <div className="tv-footer">
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

        <div className="current-call">
          <div className="label">Chamando agora</div>
          <div id="current-call-name">{currentName || '—'}</div>
          <div className="sub">{currentSala ? `Sala ${currentSala}` : ''}</div>
        </div>
      </div>

      {/* Script que faz o ducking de áudio e anúncio */}
      <Script src="/tv-ducking.js" strategy="afterInteractive" />
    </div>
  );
}

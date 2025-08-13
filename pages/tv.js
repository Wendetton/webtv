
/* ======= pages/tv.js (UPDATED) — Bigger name + flashing + ducking via tv-ducking.js =======
   Data: 2025-08-12
   Mudanças principais:
   - O elemento do nome atual tem id="current-call-name" (o script /public/tv-ducking.js observa isso).
   - Ao chegar um novo chamado (coleção 'calls'), atualiza o nome, ativa flash visual e
     tenta chamar window.tvAnnounce(nome) (se o script estiver carregado), garantindo ducking.
   - Exibe 'Sala X' logo abaixo do nome (maior e visível).
*/

import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import YoutubePlayer from '../components/YoutubePlayer';
import Carousel from '../components/Carousel';

const BANNER_HEIGHT = 180;

export default function TV(){
  const [history, setHistory] = useState([]);
  const [videoId, setVideoId] = useState('');
  const [windowHeight, setWindowHeight] = useState(800);

  const [currentName, setCurrentName] = useState('—');
  const [currentSala, setCurrentSala] = useState('');
  const lastAnnouncedRef = useRef('');

  useEffect(() => {
    function handleResize(){ setWindowHeight(window.innerHeight || 800); }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Quando currentName muda: aplica flash e tenta anunciar (ducking via tv-ducking.js)
  useEffect(() => {
    if (!currentName || currentName === '—') return;
    const container = document.querySelector('.current-call');
    if (container) {
      container.classList.remove('flash');
      // força reflow
      void container.offsetWidth;
      container.classList.add('flash');
    }
    if (typeof window !== 'undefined') {
      if (lastAnnouncedRef.current !== currentName) {
        lastAnnouncedRef.current = currentName;
        // Se o script tv-ducking.js estiver carregado, ele expõe window.tvAnnounce
        if (typeof window.tvAnnounce === 'function') {
          try { window.tvAnnounce(currentName); } catch {}
        }
      }
    }
  }, [currentName]);

  const videoAreaHeight = Math.max(260, windowHeight - BANNER_HEIGHT);
  const videoWidth = Math.floor((videoAreaHeight * 16) / 9);

  return (
    <div className="tv-screen">
      <Head>
        <title>Chamador na TV</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="tv-video-wrap" style={{ height: videoAreaHeight }}>
        <div className="tv-video-inner">
          {videoId ? (
            <YoutubePlayer
              videoId={videoId}
              width={videoWidth}
              height={videoAreaHeight}
            />
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

      <div className="tv-footer" style={{ height: BANNER_HEIGHT }}>
        {/* Já chamados */}
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

        {/* Atual */}
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

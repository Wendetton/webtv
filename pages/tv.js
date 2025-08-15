// pages/tv.js — anuncia em REchamar (calls com recall:true) e não polui histórico
import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import YoutubePlayer from '../components/YoutubePlayer';
import Carousel from '../components/Carousel';

function applyAccent(color){
  try { document.documentElement.style.setProperty('--tv-accent', color || '#44b2e7'); } catch {}
}

function speakWithRetry(nome, sala, attempts = 8, delay = 350) {
  if (!nome) return;
  const call = () => {
    try {
      if (typeof window !== 'undefined' && typeof window.tvAnnounce === 'function') {
        window.tvAnnounce(String(nome), sala != null ? String(sala) : '');
        return true;
      }
    } catch {}
    return false;
  };
  if (call()) return;
  if (attempts > 1) {
    setTimeout(() => speakWithRetry(nome, sala, attempts - 1, delay), delay);
  }
}

export default function TV(){
  const [history, setHistory] = useState([]);
  const [videoId, setVideoId] = useState('');
  const [currentName, setCurrentName] = useState('—');
  const [currentSala, setCurrentSala] = useState('');
  const initializedCallsRef = useRef(false);

  // Assina chamadas (pega 5) — atualiza UI e anuncia ADDED
  useEffect(() => {
    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(5));
    const unsub = onSnapshot(qCalls, (snap) => {
      // lista da TV: EXCLUI recall e test
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const list = raw.filter(x => !x.test && !x.recall);
      setHistory(list);
      if (list.length) {
        const { nome, sala } = list[0] || {};
        if (nome) setCurrentName(String(nome));
        if (sala != null) setCurrentSala(String(sala));
      }

      // anuncio: qualquer ADDED (inclusive recall) depois da 1ª carga
      if (initializedCallsRef.current) {
        const changes = snap.docChanges();
        for (const ch of changes) {
          if (ch.type === 'added') {
            const d = ch.doc.data();
            if (!d?.test) {
              const row = document.querySelector('.current-call');
              if (row){ row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
              speakWithRetry(d.nome, d.sala);
            }
          }
        }
      } else {
        initializedCallsRef.current = true;
      }
    });
    return () => unsub();
  }, []);

  // Configurações (config/main -> fallback 1º doc)
  useEffect(() => {
    let usedMain = false;
    const unsubMain = onSnapshot(doc(db,'config','main'), (snap) => {
      if (snap.exists()) {
        usedMain = true;
        applyConfig(snap.data());
      }
    });
    const unsubColForSettings = onSnapshot(collection(db,'config'), (snap) => {
      if (usedMain) return;
      if (!snap.empty) {
        applyConfig(snap.docs[0].data());
      }
    });
    function applyConfig(data){
      if (!data) return;
      const cfg = {
        announceMode: data.announceMode || 'auto',
        announceTemplate: data.announceTemplate || 'Atenção: paciente {{nome}}. Dirija-se à sala {{salaTxt}}.',
        duckVolume: Number.isFinite(data.duckVolume) ? Number(data.duckVolume) : 20,
        restoreVolume: Number.isFinite(data.restoreVolume) ? Number(data.restoreVolume) : 60,
        leadMs: Number.isFinite(data.leadMs) ? Number(data.leadMs) : 450,
        accentColor: data.accentColor || '#44b2e7',
      };
      applyAccent(cfg.accentColor);
      if (typeof window !== 'undefined') {
        window.tvConfig = { ...cfg };
      }
    }
    return () => { unsubMain(); unsubColForSettings(); };
  }, []);

  // videoId (de qualquer doc da coleção config)
  useEffect(() => {
    const unsubVid = onSnapshot(collection(db,'config'), (snap) => {
      let vid = '';
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!vid && data && data.videoId) {
          vid = String(data.videoId);
        }
      });
      setVideoId(vid);
    });
    return () => unsubVid();
  }, []);

  return (
    <div className="tv-screen">
      <Head>
        <title>Chamador na TV</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

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

      <div className="tv-footer">
        {/* 2 últimos (exclui atual) */}
        <div className="called-list">
          {history.slice(1, 3).length ? (
            history.slice(1, 3).map((h, i) => (
              <span key={i} className="called-chip">
                {h.nome} — Consultório {h.sala}
              </span>
            ))
          ) : (
            <span className="muted">Sem chamados recentes…</span>
          )}
        </div>

        <div className="current-call">
          <div className="label">Chamando agora</div>
          <div id="current-call-name">{currentName || '—'}</div>
          <div className="sub">{currentSala ? `Consultório ${currentSala}` : ''}</div>
        </div>
      </div>

      <Script src="/tv-ducking.js" strategy="afterInteractive" />
    </div>
  );
}

// pages/tv.js — anuncia também em REchamar (compara pelo ID do chamado)
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

export default function TV(){
  const [history, setHistory] = useState([]);
  const [videoId, setVideoId] = useState('');
  const [currentName, setCurrentName] = useState('—');
  const [currentSala, setCurrentSala] = useState('');
  const [currentKey, setCurrentKey] = useState(''); // <- chave única do chamado (id)
  const lastAnnouncedKeyRef = useRef('');           // <- último id anunciado

  // Assina chamadas (pega 5, filtra test)
  useEffect(() => {
    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(5));
    const unsub = onSnapshot(qCalls, (snap) => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const list = raw.filter(x => !x.test); // ignora testes
      setHistory(list);
      if (list.length) {
        const top = list[0];
        const { nome, sala } = top || {};
        if (nome) setCurrentName(String(nome));
        if (sala != null) setCurrentSala(String(sala));
        setCurrentKey(String(top.id)); // <- muda a chave quando é REchamado (novo doc)
      }
    });
    return () => unsub();
  }, []);

  // Assina configurações (config/main -> fallback 1º doc)
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

  // Assina o videoId separadamente (pega de qualquer doc em 'config')
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

  // Quando a CHAVE do chamado muda (novo doc), anuncia — mesmo se o nome for igual
  useEffect(() => {
    if (!currentKey) return;
    const row = document.querySelector('.current-call');
    if (row){ row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }

    if (typeof window !== 'undefined') {
      if (lastAnnouncedKeyRef.current !== currentKey) {
        lastAnnouncedKeyRef.current = currentKey;
        if (typeof window.tvAnnounce === 'function') {
          try { window.tvAnnounce(currentName, currentSala); } catch {}
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]); // <- dispara pelo ID, não pelo nome

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

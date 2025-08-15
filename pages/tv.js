// pages/tv.js — modo ocioso: fundo branco ocupa todo o box “Chamando agora”
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
  if (attempts > 1) setTimeout(() => speakWithRetry(nome, sala, attempts - 1, delay), delay);
}

export default function TV(){
  const [history, setHistory] = useState([]);
  const [videoId, setVideoId] = useState('');
  const [currentName, setCurrentName] = useState('—');
  const [currentSala, setCurrentSala] = useState('');
  const [forcedIdle, setForcedIdle] = useState(false);
  const initCallsRef = useRef(false);
  const initAnnounceRef = useRef(false);
  const lastNonceRef = useRef('');

  const isIdle = forcedIdle || history.length === 0;

  // Histórico e “Chamando agora”
  useEffect(() => {
    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(5));
    const unsub = onSnapshot(qCalls, (snap) => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const list = raw.filter(x => !x.test && !x.recall);
      setHistory(list);

      if (list.length) {
        const { nome, sala } = list[0] || {};
        setCurrentName(nome ? String(nome) : '—');
        setCurrentSala(sala != null ? String(sala) : '');
      } else {
        setCurrentName('');
        setCurrentSala('');
      }

      if (!initCallsRef.current) initCallsRef.current = true;
    });
    return () => unsub();
  }, []);

  // Gatilho universal de anúncio + modo ocioso (config/announce)
  useEffect(() => {
    const unsub = onSnapshot(doc(db,'config','announce'), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      const nonce = String(d.nonce || '');

      if (!initAnnounceRef.current) {
        initAnnounceRef.current = true;
        lastNonceRef.current = nonce;
      } else {
        if (nonce && nonce !== lastNonceRef.current) {
          lastNonceRef.current = nonce;
          if (d.idle === false) setForcedIdle(false);
          speakWithRetry(d.nome, d.sala);
          const row = document.querySelector('.current-call');
          if (row){ row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
        }
      }

      if (typeof d.idle === 'boolean') {
        setForcedIdle(Boolean(d.idle));
        if (d.idle) { setCurrentName(''); setCurrentSala(''); }
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
    const unsubCol = onSnapshot(collection(db,'config'), (snap) => {
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
      if (typeof window !== 'undefined') window.tvConfig = { ...cfg };
    }
    return () => { unsubMain(); unsubCol(); };
  }, []);

  // videoId (de qualquer doc da coleção config)
  useEffect(() => {
    const unsubVid = onSnapshot(collection(db,'config'), (snap) => {
      let vid = '';
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!vid && data && data.videoId) vid = String(data.videoId);
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

        <div className={`current-call ${isIdle ? 'idle idle-full' : ''}`}>
          {isIdle ? (
            <img className="idle-logo" src="/logo.png" alt="Logo da clínica" />
          ) : (
            <>
              <div className="label">Chamando agora</div>
              <div id="current-call-name">{currentName || '—'}</div>
              <div className="sub">{currentSala ? `Consultório ${currentSala}` : ''}</div>
            </>
          )}
        </div>
      </div>

      <Script src="/tv-ducking.js" strategy="afterInteractive" />

      {/* estilos: fundo branco ocupa TODO o box; logo centralizada e contida */}
      <style jsx global>{`
        .current-call.idle.idle-full {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          /* mantém cantos iguais ao estilo do box original */
          border-radius: inherit;
          /* reforça uma linha sutil para destacar do fundo da página */
          box-shadow: inset 0 0 0 1px rgba(0,0,0,.06), 0 10px 28px rgba(0,0,0,.08);
          transition: background .25s ease, box-shadow .25s ease;
        }
        .current-call.idle.idle-full .idle-logo {
          max-width: clamp(220px, 40%, 600px);
          max-height: 70%;
          object-fit: contain;
          filter: drop-shadow(0 6px 16px rgba(0,0,0,.12));
          opacity: 0; transform: scale(.98);
          animation: tvFadeIn 380ms ease forwards;
        }
        @keyframes tvFadeIn { to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

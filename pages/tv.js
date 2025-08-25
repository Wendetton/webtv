// pages/tv.js — box “Chamando agora” (1 ou 2 cartões em 30s), sai o mais antigo após 60s,
// volta à logo depois de idleSeconds; topo otimizado: YouTube 16:9 por ALTURA e carrossel horizontal.
import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import YoutubePlayer from '../components/YoutubePlayer';
import Carousel from '../components/Carousel';

const GROUP_WINDOW_MS = 30000; // 30s para virar "dupla"
const DUAL_KEEP_MS   = 60000;  // 60s para expulsar a mais antiga

function applyAccent(color){
  try { document.documentElement.style.setProperty('--tv-accent', color || '#44b2e7'); } catch {}
}

// ===== Fila de anúncios (fala um por vez)
function enqueueAudio(audioQueueRef, playingRef, nome, sala){
  if (!nome) return;
  audioQueueRef.current.push({nome, sala});
  playQueue(audioQueueRef, playingRef);
}
function playQueue(audioQueueRef, playingRef){
  if (playingRef.current) return;
  const next = audioQueueRef.current.shift();
  if (!next) return;
  playingRef.current = true;
  try {
    if (typeof window !== 'undefined' && typeof window.tvAnnounce === 'function') {
      window.tvAnnounce(String(next.nome||''), next.sala != null ? String(next.sala) : '');
    }
  } catch {}
  setTimeout(() => {
    playingRef.current = false;
    playQueue(audioQueueRef, playingRef);
  }, 4500);
}

export default function TV(){
  const [history, setHistory] = useState([]);  // últimos do Firestore (desc)
  const [videoId, setVideoId] = useState('');
  const [idleSeconds, setIdleSeconds] = useState(120);
  const [forcedIdle, setForcedIdle] = useState(false);
  const [lastCallAt, setLastCallAt] = useState(null);

  // relógio para reavaliar 60s/idle
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNowMs(Date.now()), 1000); return () => clearInterval(t); }, []);

  const initCallsRef = useRef(false);
  const initAnnounceRef = useRef(false);
  const lastNonceRef = useRef('');
  const audioQueueRef = useRef([]);
  const playingRef = useRef(false);

  // ===== Assina histórico
  useEffect(() => {
    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(6));
    const unsub = onSnapshot(qCalls, (snap) => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const list = raw.filter(x => !x.test && !x.recall);
      setHistory(list);

      if (list.length) {
        const t = list[0].timestamp;
        const ms = t && typeof t.toMillis === 'function' ? t.toMillis() : (t?.seconds ? t.seconds * 1000 : null);
        setLastCallAt(ms);
      } else {
        setLastCallAt(null);
      }

      if (!initCallsRef.current) initCallsRef.current = true;
    });
    return () => unsub();
  }, []);

  // ===== Gatilho universal de anúncio (config/announce)
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
          if (d.idle === false) setForcedIdle(false); // sair da logo
          enqueueAudio(audioQueueRef, playingRef, d.nome, d.sala);
          const row = document.querySelector('.current-call');
          if (row){ row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
        }
      }
      if (typeof d.idle === 'boolean') setForcedIdle(Boolean(d.idle));
    });
    return () => unsub();
  }, []);

  // ===== Configurações (idleSeconds, cores, etc.)
  useEffect(() => {
    let usedMain = false;
    const unsubMain = onSnapshot(doc(db,'config','main'), (snap) => {
      if (snap.exists()) { usedMain = true; applyConfig(snap.data()); }
    });
    const unsubCol = onSnapshot(collection(db,'config'), (snap) => {
      if (!usedMain && !snap.empty) applyConfig(snap.docs[0].data());
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
        idleSeconds: Number.isFinite(data.idleSeconds) ? Math.min(300, Math.max(60, Number(data.idleSeconds))) : 120,
      };
      applyAccent(cfg.accentColor);
      setIdleSeconds(cfg.idleSeconds);
      if (typeof window !== 'undefined') window.tvConfig = { ...cfg };
    }
    return () => { unsubMain(); unsubCol(); };
  }, []);

  // ===== videoId
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

  // ===== Derivações de UI
  const withinIdle = lastCallAt ? (nowMs - lastCallAt) < idleSeconds * 1000 : false;
  const isIdle = forcedIdle || !history.length || !withinIdle;

  // grupo atual (1 ou 2)
  let currentGroup = [];
  if (!isIdle && history.length) {
    const first = history[0];
    const firstMs = first.timestamp?.toMillis?.() || (first.timestamp?.seconds ? first.timestamp.seconds * 1000 : null);
    if (firstMs != null) {
      const second = history[1];
      if (second) {
        const secondMs = second.timestamp?.toMillis?.() || (second.timestamp?.seconds ? second.timestamp.seconds * 1000 : null);
        const isPair = secondMs != null && (firstMs - secondMs) <= GROUP_WINDOW_MS;
        const keepDual = isPair && (nowMs - secondMs) < DUAL_KEEP_MS;
        currentGroup = (isPair && keepDual) ? [first, second] : [first];
      } else {
        currentGroup = [first];
      }
    }
  }
  const currentIds = new Set(currentGroup.map(x => x.id));
  const recentItems = history.filter(h => !currentIds.has(h.id)).slice(0, 2);
  const single = currentGroup.length === 1 ? currentGroup[0] : null;

  return (
    <div className="tv-screen">
      <Head>
        <title>Chamador na TV</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* TOPO: vídeo (16:9 por altura) + carrossel horizontal */}
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

      {/* RODAPÉ: recentes + chamando agora */}
      <div className="tv-footer">
        <div className="called-list">
          {recentItems.length ? (
            recentItems.map((h, i) => (
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

              {currentGroup.length === 2 ? (
                <div className="now-cards cols-2">
                  {currentGroup.map((it) => (
                    <div key={it.id} className="now-card">
                      <div className="now-name">{String(it.nome || '—')}</div>
                      <div className="now-room">Consultório {String(it.sala || '')}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div id="current-call-name">{String(single?.nome || '—')}</div>
                  <div className="sub">{single?.sala ? `Consultório ${String(single.sala)}` : ''}</div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Script src="/tv-ducking.js" strategy="afterInteractive" />

      {/* Estilos globais (topo 16:9 + carrossel horizontal + idle/logo + cartões) */}
      <style jsx global>{`
        /* TOPO: vídeo à esquerda 16:9 por ALTURA, carrossel à direita */
        .tv-video-wrap{
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 14px;
          align-items: center;
        }
        .tv-video-inner{
          height: 100%;
          aspect-ratio: 16 / 9;
          width: auto;
          max-width: 100%;
          justify-self: start;
        }
        .tv-video-inner > *{ width: 100%; height: 100%; }
        .tv-carousel{ height: 100%; display: grid; }

        /* Idle: cartão branco ocupando todo o box */
        .current-call.idle.idle-full {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          border-radius: inherit;
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

        /* Dois cartões lado a lado (grandes) */
        .now-cards { display: grid; gap: 12px; margin-top: 8px; }
        .now-cards.cols-2 { grid-template-columns: 1fr 1fr; }
        .now-card{
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: clamp(10px, 1.6vw, 16px);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: clamp(90px, 12vw, 160px);
          box-shadow: 0 6px 20px rgba(0,0,0,.12);
          animation: tvFadeIn 260ms ease both;
        }
        .now-name { font-size: clamp(28px, 3.6vw, 56px); font-weight: 900; line-height: 1.1; text-align: center; letter-spacing: .3px; }
        .now-room { margin-top: 6px; font-size: clamp(14px, 1.3vw, 18px); opacity: .9; font-weight: 700; }

        @keyframes tvFadeIn { to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

// pages/tv.js - Versão ULTRA otimizada para Fire TV (apenas YouTube)
import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useRef, useState, memo } from 'react';
import { db } from '../utils/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import YoutubePlayer from '../components/YoutubePlayer';
import Carousel from '../components/Carousel';

const GROUP_WINDOW_MS = 30000;
const DUAL_KEEP_MS = 60000;

// Cores padrão baseadas na logo Oftalmocenter
const DEFAULT_COLORS = {
  bg: '#080c12',
  panel: '#0d1520',
  accent: '#5bb8d4',
  text: '#fefefe',
  room: '#3b7cb8',
};

function enqueueAudio(audioQueueRef, playingRef, nome, sala) {
  if (!nome) return;
  audioQueueRef.current.push({ nome, sala });
  playQueue(audioQueueRef, playingRef);
}

function playQueue(audioQueueRef, playingRef) {
  if (playingRef.current) return;
  const next = audioQueueRef.current.shift();
  if (!next) return;
  playingRef.current = true;
  try {
    if (typeof window !== 'undefined' && typeof window.tvAnnounce === 'function') {
      window.tvAnnounce(String(next.nome || ''), next.sala != null ? String(next.sala) : '');
    }
  } catch {}
  setTimeout(() => { playingRef.current = false; playQueue(audioQueueRef, playingRef); }, 4500);
}

// Componentes memoizados para evitar re-renders desnecessários (otimização Fire TV)
const MemoizedCarousel = memo(Carousel);
const MemoizedYoutube = memo(YoutubePlayer);

export default function TV() {
  const [history, setHistory] = useState([]);
  const [idleSeconds, setIdleSeconds] = useState(120);
  const [forcedIdle, setForcedIdle] = useState(false);
  const [lastCallAt, setLastCallAt] = useState(null);

  // YouTube
  const [videoId, setVideoId] = useState('');
  const [ytList, setYtList] = useState([]);

  // Configurações de personalização
  const [roomFontSize, setRoomFontSize] = useState(100);
  const [roomColor, setRoomColor] = useState(DEFAULT_COLORS.room);

  // Relógio - atualiza a cada 10 segundos (reduz re-renders para Fire TV)
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => { 
    const t = setInterval(() => setNowMs(Date.now()), 10000); 
    return () => clearInterval(t); 
  }, []);

  const initCallsRef = useRef(false);
  const initAnnounceRef = useRef(false);
  const lastNonceRef = useRef('');
  const audioQueueRef = useRef([]);
  const playingRef = useRef(false);

  // Historico
  useEffect(() => {
    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(6));
    const unsub = onSnapshot(qCalls, (snap) => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const list = raw.filter(x => !x.test);
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

  // Gatilho de anuncio
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'announce'), (snap) => {
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
          enqueueAudio(audioQueueRef, playingRef, d.nome, d.sala);
          const row = document.querySelector('.current-call');
          if (row) { row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
        }
      }
      if (typeof d.idle === 'boolean') setForcedIdle(Boolean(d.idle));
    });
    return () => unsub();
  }, []);

  // Config - consolidado em um único listener
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'main'), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data) return;
      
      const cfg = {
        announceTemplate: data.announceTemplate || 'Atenção: paciente {{nome}}. Dirija-se à sala {{salaTxt}}.',
        duckVolume: Number.isFinite(data.duckVolume) ? Number(data.duckVolume) : 20,
        restoreVolume: Number.isFinite(data.restoreVolume) ? Number(data.restoreVolume) : 60,
        leadMs: Number.isFinite(data.leadMs) ? Number(data.leadMs) : 450,
        idleSeconds: Number.isFinite(data.idleSeconds) ? Math.min(300, Math.max(60, Number(data.idleSeconds))) : 120,
        videoId: data.videoId || '',
        roomFontSize: Number.isFinite(data.roomFontSize) ? Number(data.roomFontSize) : 100,
        roomColor: data.roomColor || DEFAULT_COLORS.room,
        tvBgColor: data.tvBgColor || DEFAULT_COLORS.bg,
        tvPanelColor: data.tvPanelColor || DEFAULT_COLORS.panel,
        tvAccentColor: data.tvAccentColor || DEFAULT_COLORS.accent,
        tvTextColor: data.tvTextColor || DEFAULT_COLORS.text,
      };
      
      // Aplica cores via CSS variables
      const root = document.documentElement;
      root.style.setProperty('--tv-bg', cfg.tvBgColor);
      root.style.setProperty('--tv-panel', cfg.tvPanelColor);
      root.style.setProperty('--tv-accent', cfg.tvAccentColor);
      root.style.setProperty('--tv-text', cfg.tvTextColor);
      root.style.setProperty('--room-color', cfg.roomColor);
      root.style.setProperty('--room-font-scale', String(cfg.roomFontSize / 100));
      
      setIdleSeconds(cfg.idleSeconds);
      setVideoId(String(cfg.videoId || ''));
      setRoomFontSize(cfg.roomFontSize);
      setRoomColor(cfg.roomColor);
      
      if (typeof window !== 'undefined') window.tvConfig = { ...cfg };
    });
    return () => unsub();
  }, []);

  // Volume do YouTube
  useEffect(() => {
    const ref = doc(db, 'config', 'control');
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (!Number.isFinite(d.ytVolume)) return;
      const v = Math.max(0, Math.min(100, Math.round(d.ytVolume)));
      try {
        const ev = new CustomEvent('tv:ytVolume', { detail: { v } });
        window.dispatchEvent(ev);
      } catch {
        try {
          const ev = document.createEvent('CustomEvent');
          ev.initCustomEvent('tv:ytVolume', false, false, { v });
          window.dispatchEvent(ev);
        } catch {}
      }
    });
    return () => unsub();
  }, []);

  // YouTube playlist
  useEffect(() => {
    const q = query(collection(db, 'ytPlaylist'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .map(x => String(x.videoId || '').trim())
        .filter(Boolean);
      setYtList(list);
    });
    return () => unsub();
  }, []);

  // Derivações de UI
  const withinIdle = lastCallAt ? (nowMs - lastCallAt) < idleSeconds * 1000 : false;
  const isIdle = forcedIdle || !history.length || !withinIdle;

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

  const hasPlaylist = ytList && ytList.length > 0;
  const hasSingleVideo = !hasPlaylist && !!videoId;

  return (
    <div className="tv-screen">
      <Head>
        <title>Chamador na TV</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>

      {/* AREA PRINCIPAL: YouTube + Carrossel */}
      <div className="tv-main">
        <div className="tv-video">
          {hasPlaylist ? (
            <MemoizedYoutube playlist={ytList} />
          ) : hasSingleVideo ? (
            <MemoizedYoutube videoId={videoId} />
          ) : (
            <div className="tv-placeholder">
              <div>Configure um vídeo no Admin</div>
            </div>
          )}
        </div>
        <div className="tv-carousel">
          <MemoizedCarousel />
        </div>
      </div>

      {/* RODAPE: Chamadas */}
      <div className="tv-footer">
        <div className="called-list">
          {recentItems.length ? (
            recentItems.map((h, i) => (
              <span key={h.id || i} className="called-chip">
                {h.nome} <span className="muted">• Consultório {h.sala}</span>
              </span>
            ))
          ) : null}
        </div>

        <div className={`current-call ${isIdle ? 'idle idle-full' : ''}`}>
          {isIdle ? (
            <img src="/logo.png" alt="Logo" className="idle-logo" />
          ) : currentGroup.length > 1 ? (
            <>
              <div className="label">Chamando agora</div>
              <div className="now-cards cols-2">
                {currentGroup.map((p, i) => (
                  <div key={p.id || i} className="now-card">
                    <div className="now-name">{p.nome}</div>
                    <div 
                      className="now-room"
                      style={{ 
                        fontSize: `calc(clamp(16px, 2.5vh, 24px) * ${roomFontSize / 100})`,
                        color: roomColor 
                      }}
                    >
                      Consultório {p.sala}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : single ? (
            <div className="now-single">
              <div className="label">Chamando agora</div>
              <div id="current-call-name">{single.nome}</div>
              <div 
                className="sub"
                style={{ 
                  fontSize: `calc(clamp(20px, 4vh, 36px) * ${roomFontSize / 100})`,
                  color: roomColor 
                }}
              >
                Consultório {single.sala}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Script de voz */}
      <Script src="/tv-ducking.js" strategy="afterInteractive" />

      {/* ===== ESTILOS OTIMIZADOS PARA FIRE TV ===== */}
      <style jsx global>{`
        * { 
          box-sizing: border-box; 
          margin: 0; 
          padding: 0; 
        }
        
        html, body, #__next { 
          height: 100%; 
          width: 100%;
          overflow: hidden;
        }
        
        body { 
          font-family: system-ui, -apple-system, sans-serif;
          background: var(--tv-bg, ${DEFAULT_COLORS.bg});
          color: var(--tv-text, ${DEFAULT_COLORS.text});
        }

        :root {
          --tv-bg: ${DEFAULT_COLORS.bg};
          --tv-panel: ${DEFAULT_COLORS.panel};
          --tv-accent: ${DEFAULT_COLORS.accent};
          --tv-text: ${DEFAULT_COLORS.text};
          --tv-muted: #93a0b3;
          --room-color: ${DEFAULT_COLORS.room};
          --room-font-scale: 1;
          
          /* Alturas responsivas baseadas em vh */
          --footer-height: 42vh;
          --main-height: 58vh;
          --gap: 1.2vh;
          --padding: 1.2vh;
        }

        /* ===== OTIMIZAÇÕES GLOBAIS PARA FIRE TV ===== */
        * {
          /* Desabilita animações pesadas */
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* ===== TELA PRINCIPAL ===== */
        .tv-screen {
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--tv-bg);
          overflow: hidden;
          /* GPU acceleration */
          transform: translateZ(0);
        }

        /* ===== AREA PRINCIPAL (Video + Carrossel) ===== */
        .tv-main {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--gap);
          padding: var(--padding);
          min-height: 0;
        }

        /* Video container */
        .tv-video {
          position: relative;
          width: 100%;
          height: 100%;
          background: #000;
          border-radius: 12px;
          overflow: hidden;
          /* GPU layer */
          transform: translateZ(0);
          will-change: transform;
        }

        .tv-video > * {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        .tv-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--tv-muted);
          font-size: 2vh;
        }

        /* Carrossel */
        .tv-carousel {
          position: relative;
          width: 100%;
          height: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          overflow: hidden;
          /* GPU layer */
          transform: translateZ(0);
        }

        /* ===== RODAPE ===== */
        .tv-footer {
          height: var(--footer-height);
          background: var(--tv-panel);
          padding: var(--padding) calc(var(--padding) * 2);
          border-top: 2px solid var(--tv-accent);
          box-shadow: 0 -12px 24px rgba(0,0,0,0.35);
          display: flex;
          flex-direction: column;
          gap: var(--gap);
        }

        /* Lista de chamados recentes */
        .called-list {
          height: 7vh;
          min-height: 50px;
          display: flex;
          align-items: center;
          gap: 1.5vw;
          overflow-x: auto;
          scrollbar-width: none;
        }
        
        .called-list::-webkit-scrollbar { 
          display: none; 
        }

        .called-chip {
          display: inline-flex;
          align-items: center;
          padding: 1.2vh 2vw;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 999px;
          font-weight: 800;
          font-size: clamp(16px, 2.2vw, 26px);
          color: var(--tv-text);
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* Area de chamada atual */
        .current-call {
          flex: 1;
          border-radius: 16px;
          position: relative;
          overflow: hidden;
          background: radial-gradient(120% 120% at 50% 50%, rgba(92,184,92,0.18) 0%, rgba(92,184,92,0.06) 100%);
          outline: 2px solid var(--tv-accent);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2.5vh 3vw;
        }

        .current-call .label {
          font-size: clamp(14px, 2.2vh, 22px);
          color: var(--tv-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 900;
          margin-bottom: 1.5vh;
        }

        /* Modo IDLE (logo) */
        .current-call.idle.idle-full {
          background: #f5f5f5;
          outline: none;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06);
        }

        .current-call.idle.idle-full .idle-logo {
          max-width: 90%;
          max-height: 95%;
          object-fit: contain;
          filter: drop-shadow(0 8px 24px rgba(0,0,0,0.15));
        }

        /* Nome do paciente - SINGLE */
        .now-single {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          width: 100%;
        }

        #current-call-name {
          font-weight: 900;
          font-size: clamp(40px, 10vh, 100px);
          line-height: 1.15;
          color: var(--tv-text);
          text-shadow: 0 3px 18px rgba(0,0,0,0.55);
          word-break: break-word;
          padding: 0 2vw;
        }

        .current-call .sub {
          margin-top: 1.5vh;
          font-weight: 800;
        }

        /* Modo DUAL (2 pacientes) */
        .now-cards {
          display: grid;
          gap: 2vw;
          width: 100%;
          height: 100%;
        }
        
        .now-cards.cols-2 {
          grid-template-columns: 1fr 1fr;
        }

        .now-card {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 2.5vh 2vw;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        }

        .now-name {
          font-size: clamp(28px, 6vh, 56px);
          font-weight: 900;
          line-height: 1.15;
          text-align: center;
        }

        .now-room {
          margin-top: 1.5vh;
          font-weight: 700;
        }

        /* Animações SIMPLIFICADAS para Fire TV */
        @keyframes flashGlow {
          0% { box-shadow: 0 0 0 0 rgba(92,184,92,0.9); }
          100% { box-shadow: 0 0 24px 16px rgba(92,184,92,0.0); }
        }

        .current-call.flash {
          animation: flashGlow 0.8s ease-out 2;
        }

        /* Util */
        .muted { 
          color: var(--tv-muted); 
        }

        /* ===== RESPONSIVIDADE ===== */
        
        /* TV Vertical / Portrait */
        @media (orientation: portrait) {
          .tv-main {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr 1fr;
          }
          
          :root {
            --footer-height: 35vh;
          }
        }

        /* Telas pequenas */
        @media (max-height: 600px) {
          :root {
            --footer-height: 45vh;
            --padding: 1vh;
            --gap: 1vh;
          }
          
          #current-call-name {
            font-size: clamp(28px, 8vh, 56px);
          }
          
          .current-call .sub {
            font-size: clamp(16px, 3vh, 24px);
          }
        }

        /* Fire TV Stick / TV Box */
        @media (min-width: 1280px) and (min-height: 720px) {
          :root {
            --footer-height: 40vh;
          }
        }

        /* 4K TVs */
        @media (min-width: 3000px) {
          :root {
            --footer-height: 38vh;
            --padding: 1.5vh;
          }
        }
      `}</style>
    </div>
  );
}

// pages/tv.js — Fila de áudio + Rotação visual quando houver 2+ ativos em activeCalls
// Mantém idle com logo, idleSeconds configurável e chamados recentes
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
function speakCall(nome, sala){
  try {
    if (typeof window !== 'undefined' && typeof window.tvAnnounce === 'function') {
      window.tvAnnounce(String(nome||''), sala != null ? String(sala) : '');
      return true;
    }
  } catch {}
  return false;
}

export default function TV(){
  const [history, setHistory] = useState([]);
  const [videoId, setVideoId] = useState('');
  const [currentName, setCurrentName] = useState('—');
  const [currentSala, setCurrentSala] = useState('');
  const [forcedIdle, setForcedIdle] = useState(false);
  const [autoIdle, setAutoIdle] = useState(false);
  const [lastCallAt, setLastCallAt] = useState(null);
  const [idleSeconds, setIdleSeconds] = useState(120);
  const [activeList, setActiveList] = useState([]);      // ativos por consultório
  const [activeIndex, setActiveIndex] = useState(0);     // rotação do destaque

  const initCallsRef = useRef(false);
  const initAnnounceRef = useRef(false);
  const initActiveRef = useRef(false);

  const lastNonceRef = useRef('');
  const lastPingMapRef = useRef({});                     // { roomId: lastKey }
  const audioQueueRef = useRef([]);                      // [{nome, sala}]
  const playingRef = useRef(false);

  // ===== Histórico (para "recentes" e lastCallAt) =====
  useEffect(() => {
    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(5));
    const unsub = onSnapshot(qCalls, (snap) => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const list = raw.filter(x => !x.test && !x.recall);
      setHistory(list);

      if (list.length) {
        const top = list[0] || {};
        const { nome, sala, timestamp } = top;
        setCurrentName(nome ? String(nome) : '—');
        setCurrentSala(sala != null ? String(sala) : '');
        const ts = timestamp && typeof timestamp.toMillis === 'function'
          ? timestamp.toMillis()
          : (timestamp?.seconds ? timestamp.seconds * 1000 : null);
        setLastCallAt(ts);
      } else {
        setCurrentName('');
        setCurrentSala('');
        setLastCallAt(null);
      }

      if (!initCallsRef.current) initCallsRef.current = true;
    });
    return () => unsub();
  }, []);

  // ===== Ativos agora: assina activeCalls (1 doc por consultório) =====
  useEffect(() => {
    const unsub = onSnapshot(collection(db,'activeCalls'), (snap) => {
      const now = Date.now();
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // filtra expirados (usa idleSeconds como base)
      const filtered = arr.filter(it => {
        const t = it.since;
        const ms = t && typeof t.toMillis === 'function' ? t.toMillis() : (t?.seconds ? t.seconds*1000 : null);
        if (!ms) return true; // se não tiver since, mostramos mesmo assim
        return (now - ms) < idleSeconds * 1000;
      });
      // ordena por sala numérica (estável)
      filtered.sort((a,b)=> String(a.sala||a.id).localeCompare(String(b.sala||b.id), 'pt', {numeric:true}));
      setActiveList(filtered);

      // fila de áudio: anuncia somente novos pings / novos since
      const changes = snap.docChanges ? snap.docChanges() : [];
      if (!initActiveRef.current) {
        initActiveRef.current = true; // não anuncia no primeiro carregamento
        // ainda assim, registra os estados iniciais
        filtered.forEach(it => {
          const key = `${(it.since?.seconds||it.since?.toMillis?.()||'')}/${it.pingNonce||''}`;
          lastPingMapRef.current[String(it.sala||it.id)] = key;
        });
        return;
      }

      changes.forEach(ch => {
        if (ch.type === 'added' || ch.type === 'modified') {
          const d = ch.doc.data();
          const rid = String(d.sala || ch.doc.id);
          const key = `${(d.since?.seconds||d.since?.toMillis?.()||'')}/${d.pingNonce||''}`;
          if (!key) return;
          if (lastPingMapRef.current[rid] !== key) {
            lastPingMapRef.current[rid] = key;
            // entra na fila de áudio
            audioQueueRef.current.push({ nome: d.nome, sala: d.sala });
            playQueue();
          }
        }
      });
    });
    return () => unsub();
  }, [idleSeconds]);

  // ===== Rotação visual quando 2+ ativos =====
  useEffect(() => {
    setActiveIndex(0);
    if (activeList.length <= 1) return;
    const t = setInterval(() => {
      setActiveIndex(i => (i + 1) % activeList.length);
    }, 7000); // 7s por destaque
    return () => clearInterval(t);
  }, [activeList.length]);

  // ===== Fila de áudio (toca um por vez) =====
  function playQueue(){
    if (playingRef.current) return;
    const next = audioQueueRef.current.shift();
    if (!next) return;
    playingRef.current = true;
    // dispara anúncio (tvAnnounce faz ducking/restauração por chamada)
    speakCall(next.nome, next.sala);
    // espera um tempo razoável antes do próximo (ajuste fino se quiser)
    setTimeout(() => {
      playingRef.current = false;
      playQueue();
    }, 4500);
  }

  // ===== Gatilho universal de anúncio + modo ocioso (config/announce) =====
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
          // esse anúncio também entra na fila (caso venha de Teste/Manual)
          audioQueueRef.current.push({ nome: d.nome, sala: d.sala });
          playQueue();
        }
      }

      if (typeof d.idle === 'boolean') {
        setForcedIdle(Boolean(d.idle));
        if (d.idle) { setCurrentName(''); setCurrentSala(''); }
      }
    });
    return () => unsub();
  }, []);

  // ===== Configurações (config/main -> fallback 1º doc) — inclui idleSeconds =====
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
        idleSeconds: Number.isFinite(data.idleSeconds) ? Math.min(300, Math.max(60, Number(data.idleSeconds))) : 120,
      };
      applyAccent(cfg.accentColor);
      setIdleSeconds(cfg.idleSeconds);
      if (typeof window !== 'undefined') window.tvConfig = { ...cfg };
    }
    return () => { unsubMain(); unsubCol(); };
  }, []);

  // ===== videoId (de qualquer doc da coleção config) =====
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

  // ===== Lógica de IDLE =====
  // Idle se: forcedIdle OU (sem ativos E passou idleSeconds desde o último chamado) OU (nada no histórico)
  useEffect(() => {
    if (activeList.length > 0) { setAutoIdle(false); return; }
    const check = () => {
      if (!lastCallAt) { setAutoIdle(false); return; }
      setAutoIdle(Date.now() - lastCallAt >= idleSeconds * 1000);
    };
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [lastCallAt, idleSeconds, activeList.length]);

  const isIdle = forcedIdle || autoIdle || (activeList.length === 0 && history.length === 0);

  // quem aparece no destaque?
  const currentActive = activeList.length ? activeList[activeIndex] : null;
  const displayName = currentActive ? currentActive.nome : (currentName || '—');
  const displaySala = currentActive ? currentActive.sala : (currentSala || '');

  // chamados recentes (evita duplicar o que está no destaque)
  const recentItems = history
    .filter(h => !(currentActive && h.nome === currentActive.nome && String(h.sala) === String(currentActive.sala)))
    .slice(0, 2);

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
        {/* Chamados recentes */}
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

        {/* Destaque (Chamando agora) */}
        <div className={`current-call ${isIdle ? 'idle idle-full' : ''}`}>
          {isIdle ? (
            <img className="idle-logo" src="/logo.png" alt="Logo da clínica" />
          ) : (
            <>
              {/* Pílulas de consultório quando houver 2+ ativos */}
              {activeList.length > 1 && (
                <div style={{display:'flex', gap:8, marginBottom:8, flexWrap:'wrap'}}>
                  {activeList.map((it,idx)=>(
                    <span key={String(it.sala||it.id)} style={{
                      padding:'4px 8px',
                      borderRadius:999,
                      fontWeight:800,
                      fontSize:12,
                      background: idx===activeIndex ? 'var(--tv-accent)' : 'rgba(255,255,255,.15)',
                      color: idx===activeIndex ? '#00131b' : 'inherit',
                      border: '1px solid rgba(255,255,255,.12)'
                    }}>
                      C{String(it.sala||it.id)}
                    </span>
                  ))}
                </div>
              )}
              <div className="label">Chamando agora</div>
              <div id="current-call-name">{displayName}</div>
              <div className="sub">{displaySala ? `Consultório ${displaySala}` : ''}</div>
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
        @keyframes tvFadeIn { to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

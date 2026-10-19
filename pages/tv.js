// pages/tv.js — Sala de espera premium (TV Samsung 85" 4K via Fire TV + app OftalmoCenterTV)
// O layout antigo continua disponível em /tv-classico.
// A voz da chamada é a mesma de antes (fila de áudio abaixo + /tv-ducking.js); o Admin pode cortá-la com INTERROMPER AGORA.
// Para testar sem chamar ninguém de verdade: /tv?demo=1 (simula chamadas só nesta tela).

import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import AmbientPlayer from '../components/sala/AmbientPlayer';
import s from '../components/sala/sala.module.css';

const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap';

const GROUP_WINDOW_MS = 30000;
const DUAL_KEEP_MS = 60000;
const OVERLAY_MS = 9500;
const OVERLAY_MS_QUEUED = 7500;
const OVERLAY_EXIT_MS = 1400;
const PHRASE_MS = 14000;
const RECENT_PER_SIDE = 2;
const DEMO_IDLE_S = 20;

const PHRASES = [
  'Fique à vontade. Em instantes você será chamado.',
  'Cuidar da sua visão é o nosso propósito.',
  'Respire fundo e aproveite este momento de calma.',
  'Nossa equipe está à disposição para o que precisar.',
  'Obrigado pela confiança em nosso cuidado.',
];

const DEMO_NAMES = [
  ['Maria Helena Albuquerque', '1'], ['Carlos Eduardo Ferreira da Silva', '2'], ['Ana Beatriz Costa', '3'],
  ['João Pedro Martins', '1'], ['Luísa Andrade', '2'], ['Roberto Nogueira', '3'],
];

/* ===== Fila de áudio — igual à do layout anterior, mais o "geração" para o INTERROMPER ===== */
function enqueueAudio(audioQueueRef, playingRef, nome, sala, genRef) {
  if (!nome) return;
  audioQueueRef.current.push({ nome, sala });
  playQueue(audioQueueRef, playingRef, genRef);
}

function playQueue(audioQueueRef, playingRef, genRef) {
  if (playingRef.current) return;
  const myGen = genRef ? genRef.current : 0;
  const next = audioQueueRef.current.shift();
  if (!next) return;
  playingRef.current = true;

  const text = String(next.nome || '');
  const estimatedMs = Math.max(3000, text.length * 65 + 1500);
  let resolved = false;

  function advance() {
    if (resolved) return;
    resolved = true;
    // Depois de um INTERROMPER, avisos atrasados da fala antiga são ignorados
    if (genRef && genRef.current !== myGen) return;
    setTimeout(() => {
      if (genRef && genRef.current !== myGen) return;
      playingRef.current = false;
      playQueue(audioQueueRef, playingRef, genRef);
    }, 500);
  }

  const prevDone = window.tvTTSDone;
  window.tvTTSDone = function () {
    if (typeof prevDone === 'function') prevDone();
    advance();
  };

  setTimeout(advance, estimatedMs);

  try {
    if (typeof window !== 'undefined' && typeof window.tvAnnounce === 'function') {
      window.tvAnnounce(text, next.sala != null ? String(next.sala) : '');
    }
  } catch {}
}

/* ===== Utilitários ===== */
function tsMs(item) {
  if (!item) return null;
  if (Number.isFinite(item.ms)) return item.ms;
  const t = item.timestamp;
  if (t && typeof t.toMillis === 'function') return t.toMillis();
  if (t && t.seconds) return t.seconds * 1000;
  return null;
}

function hhmm(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function nameSize(nome, base) {
  const n = String(nome || '').length;
  if (n <= 16) return base;
  if (n <= 24) return base * 0.84;
  if (n <= 32) return base * 0.72;
  return base * 0.62;
}

function Words({ text, baseDelay = 0, step = 90 }) {
  return String(text || '').split(/\s+/).filter(Boolean).map((w, i) => (
    <span key={i} className={s.word} style={{ animationDelay: `${baseDelay + i * step}ms` }}>
      {w}{' '}
    </span>
  ));
}

/* ===== Blocos visuais ===== */
function Welcome() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % PHRASES.length), PHRASE_MS);
    return () => clearInterval(t);
  }, []);
  return (
    <div className={s.welcome}>
      <div className={s.iris} aria-hidden>
        <span /><span /><span />
      </div>
      <div className={s.eyebrow}>Sala de espera</div>
      <h1 className={s.welcomeTitle}>
        Seja <em>bem-vindo</em>
      </h1>
      <p key={i} className={s.phrase}>{PHRASES[i]}</p>
    </div>
  );
}

// De que lado o paciente deve ir, do ponto de vista de quem olha a TV
const ROOM_SIDE = { '1': 'left', '2': 'right', '3': 'right' };
function sideOf(sala) { return ROOM_SIDE[String(sala || '').trim()] || 'right'; }

// Seta em movimento contínuo para o lado do consultório (sem texto, entendimento imediato)
function DirArrow({ side, big }) {
  return (
    <span className={`${s.dirArrow} ${side === 'left' ? s.dirLeft : s.dirRight} ${big ? s.dirBig : ''}`} aria-hidden>
      <span className={s.dirTrack}>
        <svg viewBox="0 0 48 24" className={s.dirSvg}>
          <path d="M2 12 H40 M30 3 L42 12 L30 21" fill="none" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </span>
  );
}

// Pictograma de pedestre (estilo sinalização) caminhando para o lado do consultório.
// O desenho anda para a direita; para a esquerda é espelhado.
function Walker({ side, className }) {
  return (
    <span className={`${s.walker} ${side === 'left' ? s.walkerLeft : ''} ${className || ''}`} aria-hidden>
      <svg viewBox="0 0 40 80" className={s.walkerSvg}>
        <g className={s.walkerBody}>
          <line className={`${s.limb} ${s.armBack}`} x1="20" y1="22" x2="20" y2="40" />
          <line className={`${s.limb} ${s.legBack}`} x1="20" y1="46" x2="20" y2="74" />
          <line className={s.torso} x1="20" y1="20" x2="20" y2="46" />
          <line className={`${s.limb} ${s.legFront}`} x1="20" y1="46" x2="20" y2="74" />
          <line className={`${s.limb} ${s.armFront}`} x1="20" y1="22" x2="20" y2="40" />
          <circle className={s.head} cx="21" cy="9" r="7" />
        </g>
      </svg>
    </span>
  );
}

// Uma metade da tela: Consultório 1 (esquerda) ou Consultórios 2 e 3 (direita)
function Lane({ side, calls }) {
  const label = side === 'left' ? 'Consultório 1' : 'Consultórios 2 e 3';
  const sideCls = side === 'left' ? s.laneLeft : s.laneRight;
  const base = calls.length > 1 ? 7.2 : 10.5;
  return (
    <div className={`${s.lane} ${sideCls} ${calls.length ? s.laneActive : ''}`}>
      <div className={s.laneHead}>
        {side === 'left' && <span className={s.laneArrow}>←</span>}
        {label}
        {side === 'right' && <span className={s.laneArrow}>→</span>}
      </div>
      {calls.length ? (
        <div className={s.laneCalls}>
          {calls.map((p, i) => (
            <div key={p.id || i} className={s.laneCall} style={{ animationDelay: `${i * 180}ms` }}>
              <div className={s.eyebrow}><span className={s.liveDot} />Chamando agora</div>
              <div className={s.callName} style={{ fontSize: `${nameSize(p.nome, base)}vh` }}>
                <Words text={p.nome} baseDelay={120 + i * 180} />
              </div>
              <div className={s.roomLine}>
                {side === 'left' && <Walker side="left" />}
                {side === 'left' && <DirArrow side="left" />}
                <span className={s.roomPillLg}>Consultório <strong>{p.sala}</strong></span>
                {side === 'right' && <DirArrow side="right" />}
                {side === 'right' && <Walker side="right" />}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={s.laneIdle}>Em instantes você será chamado.</div>
      )}
    </div>
  );
}

function CallOverlay({ call, leaving }) {
  const side = sideOf(call.sala);
  const sideCls = side === 'left' ? s.overlayLeft : s.overlayRight;
  return (
    <div className={`${s.overlay} ${sideCls} ${leaving ? s.overlayOut : ''}`}>
      <div className={s.overlaySweep} aria-hidden />
      <div className={s.overlayEdge} aria-hidden />

      <div className={s.overlayInner}>
        <img className={s.overlayMark} src="/logo-simbolo-cores.png" alt="" />
        <div className={s.overlayEyebrow}>Paciente</div>
        <div className={s.overlayName} style={{ fontSize: `${nameSize(call.nome, 15)}vh` }}>
          <Words text={call.nome} baseDelay={350} step={120} />
        </div>
        <div className={s.overlayRule} />
        <div className={s.overlayRoom}>
          <span>Dirija-se ao</span>
          <strong>Consultório {call.sala}</strong>
        </div>
        <div className={s.overlayDirection}>
          <DirArrow side={side} big />
          <div className={s.overlayPath} aria-hidden>
            <span className={s.overlayFloor} />
            <Walker side="right" className={s.walkerStroll} />
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentSide({ side, items }) {
  return (
    <div className={`${s.recentSide} ${side === 'left' ? s.recentLeft : s.recentRight}`}>
      <div className={s.recentHead}>
        {side === 'left' ? '← Consultório 1' : 'Consultórios 2 e 3 →'}
      </div>
      {items.length ? (
        <ul className={s.recentList}>
          {items.map(h => (
            <li key={h.id} className={s.recentItem}>
              <span className={s.recentName}>{h.nome}</span>
              {side === 'right' && <span className={s.recentMeta}>Consultório {h.sala}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <div className={s.recentEmpty}>—</div>
      )}
    </div>
  );
}

// Só a animação discreta de "música tocando" (sem texto)
function NowPlaying({ title }) {
  if (title === null) return <div className={s.nowPlaying} />;
  return (
    <div className={s.nowPlaying}>
      <span className={s.eq} aria-hidden><i /><i /><i /><i /></span>
    </div>
  );
}

/* ===== Página ===== */
export default function TV() {
  const [demo, setDemo] = useState(false);
  const [demoTracks, setDemoTracks] = useState(null);
  const [history, setHistory] = useState([]);
  const [idleSeconds, setIdleSeconds] = useState(120);
  const [forcedIdle, setForcedIdle] = useState(false);
  const [nowMs, setNowMs] = useState(null); // só no navegador (evita divergência com o HTML do servidor)
  const [overlay, setOverlay] = useState(null);       // { key, nome, sala }
  const [overlayLeaving, setOverlayLeaving] = useState(false);
  const [trackTitle, setTrackTitle] = useState(null);

  const initAnnounceRef = useRef(false);
  const lastNonceRef = useRef('');
  const audioQueueRef = useRef([]);
  const playingRef = useRef(false);
  const overlayQueueRef = useRef([]);
  const overlayBusyRef = useRef(false);
  const overlayTimersRef = useRef([]);
  const audioGenRef = useRef(0);
  const initInterruptRef = useRef(false);
  const lastInterruptRef = useRef('');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setDemo(params.has('demo'));
      // /tv?demo=1&musica=url1,url2 — testa músicas sem mexer na playlist real
      const musica = params.get('musica');
      if (params.has('demo') && musica) {
        setDemoTracks(musica.split(',').filter(Boolean).map((url, i) => ({ id: `demo-${i}`, url, title: `Faixa de teste ${i + 1}` })));
      }
    } catch {}
  }, []);

  // Relógio
  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  // Service Worker (resiliência com internet instável)
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw-tv.js').catch(() => {});
  }, []);

  // ---- Destaque de tela cheia a cada chamada ----
  function showNextOverlay() {
    if (overlayBusyRef.current) return;
    const next = overlayQueueRef.current.shift();
    if (!next) return;
    overlayBusyRef.current = true;
    setOverlayLeaving(false);
    setOverlay(next);
    const total = overlayQueueRef.current.length ? OVERLAY_MS_QUEUED : OVERLAY_MS;
    overlayTimersRef.current = [
      setTimeout(() => setOverlayLeaving(true), total - OVERLAY_EXIT_MS),
      setTimeout(() => {
        setOverlay(null);
        setOverlayLeaving(false);
        overlayBusyRef.current = false;
        showNextOverlay();
      }, total),
    ];
  }

  function announce(nome, sala) {
    if (!nome) return;
    enqueueAudio(audioQueueRef, playingRef, nome, sala, audioGenRef);
    overlayQueueRef.current.push({ key: `${Date.now()}-${Math.random()}`, nome, sala });
    showNextOverlay();
  }

  // ---- INTERROMPER AGORA: some da tela e a voz é cortada na hora ----
  function interruptNow() {
    audioGenRef.current += 1;
    audioQueueRef.current = [];
    playingRef.current = false;
    try { if (typeof window.tvStopAnnounce === 'function') window.tvStopAnnounce(); } catch {}
    overlayTimersRef.current.forEach(clearTimeout);
    overlayTimersRef.current = [];
    overlayQueueRef.current = [];
    overlayBusyRef.current = false;
    setOverlayLeaving(false);
    setOverlay(null);
  }

  useEffect(() => {
    if (demo) return undefined;
    const unsub = onSnapshot(doc(db, 'config', 'interrupt'), (snap) => {
      const nonce = snap.exists() ? String(snap.data().nonce || '') : '';
      if (!initInterruptRef.current) {
        initInterruptRef.current = true;
        lastInterruptRef.current = nonce;
        return;
      }
      if (nonce && nonce !== lastInterruptRef.current) {
        lastInterruptRef.current = nonce;
        interruptNow();
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  // No modo demonstração, a tecla X simula o INTERROMPER AGORA
  useEffect(() => {
    if (!demo) return undefined;
    const onKey = (e) => {
      if (String(e.key).toLowerCase() !== 'x') return;
      interruptNow();
      setHistory(h => h.slice(1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  // ---- Sinal de vida: o Admin mostra "TV ligada" enquanto este aviso chegar a cada minuto ----
  useEffect(() => {
    if (demo) return undefined;
    const ping = () => {
      setDoc(doc(db, 'config', 'tvStatus'), {
        lastSeen: serverTimestamp(),
        page: '/tv',
        app: typeof window.AndroidTTS !== 'undefined' ? 'firetv' : 'navegador',
      }, { merge: true }).catch(() => {});
    };
    ping();
    const t = setInterval(ping, 60000);
    return () => clearInterval(t);
  }, [demo]);

  // ---- Histórico de chamadas ----
  useEffect(() => {
    if (demo) return undefined;
    const q = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(8));
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => !x.test));
    });
    return () => unsub();
  }, [demo]);

  // ---- Gatilho de anúncio (mesmo documento usado pelo Admin) ----
  useEffect(() => {
    if (demo) return undefined;
    const unsub = onSnapshot(doc(db, 'config', 'announce'), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      const nonce = String(d.nonce || '');
      if (!initAnnounceRef.current) {
        initAnnounceRef.current = true;
        lastNonceRef.current = nonce;
      } else if (nonce && nonce !== lastNonceRef.current) {
        lastNonceRef.current = nonce;
        if (d.idle === false) setForcedIdle(false);
        announce(d.nome, d.sala);
      }
      if (typeof d.idle === 'boolean') setForcedIdle(Boolean(d.idle));
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  // ---- Configurações (voz, tempo de descanso) ----
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'main'), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};
      const cfg = {
        announceTemplate: data.announceTemplate || 'Atenção: paciente {{nome}}. Dirija-se à sala {{salaTxt}}.',
        duckVolume: Number.isFinite(data.duckVolume) ? Number(data.duckVolume) : 20,
        restoreVolume: Number.isFinite(data.restoreVolume) ? Number(data.restoreVolume) : 60,
        leadMs: Number.isFinite(data.leadMs) ? Number(data.leadMs) : 450,
      };
      setIdleSeconds(Number.isFinite(data.idleSeconds) ? Math.min(300, Math.max(60, Number(data.idleSeconds))) : 120);
      window.tvConfig = { ...(window.tvConfig || {}), ...cfg };
    });
    return () => unsub();
  }, []);

  // ---- Modo demonstração (não grava nada no Firebase) ----
  useEffect(() => {
    if (!demo) return undefined;
    let n = 0;
    const base = Date.now();
    setHistory([
      { id: 'd-a', nome: 'Fernanda Lima', sala: '2', ms: base - 9 * 60000 },
      { id: 'd-b', nome: 'Paulo Henrique Souza', sala: '1', ms: base - 14 * 60000 },
      { id: 'd-c', nome: 'Beatriz Ramos', sala: '3', ms: base - 21 * 60000 },
    ]);
    const fire = () => {
      const [nome, sala] = DEMO_NAMES[n % DEMO_NAMES.length];
      n += 1;
      const item = { id: `d-${Date.now()}`, nome, sala, ms: Date.now() };
      setForcedIdle(false);
      setHistory(h => [item, ...h].slice(0, 8));
      announce(nome, sala);
    };
    // ?demo=1&dupla=1 simula duas chamadas seguidas (tela com dois pacientes)
    // ?demo=1&espera=1 mostra só a tela de espera (nenhuma chamada)
    // No demo a tela volta para a espera 20 s após a chamada (na clínica vale o tempo do Admin)
    const params = new URLSearchParams(window.location.search);
    const pair = params.has('dupla');
    const onlyIdle = params.has('espera');
    if (onlyIdle) setHistory(h => h.map(x => ({ ...x, ms: x.ms - 3600000 })));
    const first = onlyIdle ? null : setTimeout(fire, 6000);
    const second = !onlyIdle && pair ? setTimeout(fire, 9000) : null;
    const every = onlyIdle ? null : setInterval(fire, 45000);
    return () => { clearTimeout(first); clearTimeout(second); clearInterval(every); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  // ---- Derivações (mesma regra do layout anterior) ----
  const lastCallAt = history.length ? tsMs(history[0]) : null;
  const idleWindowS = demo ? DEMO_IDLE_S : idleSeconds;
  const withinIdle = lastCallAt && nowMs ? (nowMs - lastCallAt) < idleWindowS * 1000 : false;
  const isIdle = forcedIdle || !history.length || !withinIdle;

  let currentGroup = [];
  if (!isIdle && history.length) {
    const first = history[0];
    const firstMs = tsMs(first);
    if (firstMs != null) {
      const second = history[1];
      const secondMs = tsMs(second);
      const isPair = second && secondMs != null && (firstMs - secondMs) <= GROUP_WINDOW_MS;
      const keepDual = isPair && (nowMs - secondMs) < DUAL_KEEP_MS;
      currentGroup = (isPair && keepDual) ? [first, second] : [first];
    }
  }
  const currentIds = new Set(currentGroup.map(x => x.id));
  const leftCalls = currentGroup.filter(x => sideOf(x.sala) === 'left');
  const rightCalls = currentGroup.filter(x => sideOf(x.sala) === 'right');
  const past = forcedIdle ? [] : history.filter(h => !currentIds.has(h.id));
  const recentLeft = past.filter(h => sideOf(h.sala) === 'left').slice(0, RECENT_PER_SIDE);
  const recentRight = past.filter(h => sideOf(h.sala) === 'right').slice(0, RECENT_PER_SIDE);
  const laneKey = list => list.map(x => x.id).join('|') || 'vazio';

  const timeTxt = nowMs ? hhmm(nowMs) : '';
  const dateTxt = nowMs ? new Date(nowMs).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

  return (
    <div className={s.screen}>
      <Head>
        <title>Oftalmocenter · Sala de espera</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_URL} />
      </Head>

      {/* Fundo vivo: luzes suaves nas cores da marca */}
      <div className={s.ambient} aria-hidden>
        <div className={s.glowA} />
        <div className={s.glowB} />
        <div className={s.glowC} />
        <div className={s.vignette} />
      </div>

      <header className={s.top}>
        <div className={s.brand}>
          <img className={s.brandMark} src="/logo-simbolo-cores.png" alt="" />
          <img className={s.brandName} src="/logo-nome-cores.png" alt="Oftalmocenter Hospital de Olhos" />
        </div>
        <div className={s.clock}>
          <span className={s.date}>{dateTxt}</span>
          <span className={s.time}>{timeTxt}</span>
        </div>
      </header>

      <main className={s.main}>
        {isIdle ? (
          <section key="idle" className={s.stage}>
            <Welcome />
          </section>
        ) : (
          <section className={s.lanes}>
            <Lane key={`l-${laneKey(leftCalls)}`} side="left" calls={leftCalls} />
            <div className={s.laneDivider} aria-hidden />
            <Lane key={`r-${laneKey(rightCalls)}`} side="right" calls={rightCalls} />
          </section>
        )}
      </main>

      <section className={s.recent}>
        <RecentSide side="left" items={recentLeft} />
        <div className={s.laneDivider} aria-hidden />
        <RecentSide side="right" items={recentRight} />
      </section>

      <footer className={s.bottom}>
        <NowPlaying title={trackTitle} />
        <div className={s.tagline}>Agradecemos a sua confiança</div>
      </footer>

      {overlay && <CallOverlay key={overlay.key} call={overlay} leaving={overlayLeaving} />}

      <AmbientPlayer onTrackChange={setTrackTitle} demoTracks={demoTracks} />

      {/* Script de voz (o ?v= força a TV a baixar a versão nova) */}
      <Script src="/tv-ducking.js?v=2" strategy="afterInteractive" />
    </div>
  );
}

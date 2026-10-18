// pages/tv.js — Sala de espera premium (TV Samsung 85" 4K via Fire TV + app OftalmoCenterTV)
// O layout antigo continua disponível em /tv-classico.
// A voz da chamada é a mesma de antes: fila de áudio abaixo + /tv-ducking.js (sem alterações).
// Para testar sem chamar ninguém de verdade: /tv?demo=1 (simula chamadas só nesta tela).

import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
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

/* ===== Fila de áudio — idêntica à do layout anterior ===== */
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

  const text = String(next.nome || '');
  const estimatedMs = Math.max(3000, text.length * 65 + 1500);
  let resolved = false;

  function advance() {
    if (resolved) return;
    resolved = true;
    setTimeout(() => { playingRef.current = false; playQueue(audioQueueRef, playingRef); }, 500);
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

function Chevrons({ side, big }) {
  return (
    <span className={`${s.chevrons} ${side === 'left' ? s.chevronsLeft : s.chevronsRight} ${big ? s.chevronsBig : ''}`} aria-hidden>
      <i /><i /><i />
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
                {side === 'left' && <Chevrons side="left" />}
                <span className={s.roomPillLg}>Consultório <strong>{p.sala}</strong></span>
                {side === 'right' && <Chevrons side="right" />}
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
      <div className={s.overlayInner}>
        <img className={s.overlayMark} src="/logo-simbolo-claro.png" alt="" />
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
          {side === 'left' && <Chevrons side="left" big />}
          <span>{side === 'left' ? 'à sua esquerda' : 'à sua direita'}</span>
          {side === 'right' && <Chevrons side="right" big />}
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
              <span className={s.recentMeta}>
                {side === 'right' ? `Consultório ${h.sala}` : ''}
                <em>{hhmm(tsMs(h))}</em>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={s.recentEmpty}>—</div>
      )}
    </div>
  );
}

function NowPlaying({ title }) {
  if (title === null) return <div className={s.nowPlaying} />;
  return (
    <div className={s.nowPlaying}>
      <span className={s.eq} aria-hidden><i /><i /><i /><i /></span>
      <span className={s.npLabel}>Música ambiente</span>
      {title ? <span className={s.npTitle}>{title}</span> : null}
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
    setTimeout(() => setOverlayLeaving(true), total - OVERLAY_EXIT_MS);
    setTimeout(() => {
      setOverlay(null);
      setOverlayLeaving(false);
      overlayBusyRef.current = false;
      showNextOverlay();
    }, total);
  }

  function announce(nome, sala) {
    if (!nome) return;
    enqueueAudio(audioQueueRef, playingRef, nome, sala);
    overlayQueueRef.current.push({ key: `${Date.now()}-${Math.random()}`, nome, sala });
    showNextOverlay();
  }

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
    const pair = new URLSearchParams(window.location.search).has('dupla');
    const first = setTimeout(fire, 6000);
    const second = pair ? setTimeout(fire, 9000) : null;
    const every = setInterval(fire, 32000);
    return () => { clearTimeout(first); clearTimeout(second); clearInterval(every); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  // ---- Derivações (mesma regra do layout anterior) ----
  const lastCallAt = history.length ? tsMs(history[0]) : null;
  const withinIdle = lastCallAt && nowMs ? (nowMs - lastCallAt) < idleSeconds * 1000 : false;
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
          <img className={s.brandMark} src="/logo-simbolo-claro.png" alt="" />
          <img className={s.brandName} src="/logo-nome-claro.png" alt="Oftalmocenter Hospital de Olhos" />
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

      {/* Script de voz (inalterado) */}
      <Script src="/tv-ducking.js" strategy="afterInteractive" />
    </div>
  );
}

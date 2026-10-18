// components/sala/AmbientPlayer.js — música ambiente com crossfade e ducking durante a chamada
// Coleção "musicPlaylist": { title, url, path, order }
// config/control: { musicVolume (0-100), musicShuffle (bool) }
//
// O tv-ducking.js (voz da chamada) continua igual: ele chama window.tvYTPlayer.setVolume(duck)
// antes de falar e setVolume(restore) depois. Aqui expomos um tvYTPlayer compatível que,
// em vez do YouTube, abaixa e devolve suavemente o volume da música.

import { useEffect, useRef, useState } from 'react';
import { db } from '../../utils/firebase';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';

const CROSSFADE_S = 6;
const TICK_MS = 100;
const DUCK_RAMP_S = 0.6;
const RESTORE_RAMP_S = 1.6;
const DEFAULT_VOLUME = 40;

function shuffled(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function AmbientPlayer({ onTrackChange, demoTracks }) {
  const [blocked, setBlocked] = useState(false);

  const elsRef = useRef([null, null]);
  const st = useRef({
    tracks: [],
    order: [],
    pos: -1,
    active: 0,           // índice do elemento <audio> principal
    gains: [0, 0],       // ganho de fade de cada elemento (0..1)
    fadingOut: -1,       // elemento saindo no crossfade
    volume: DEFAULT_VOLUME,
    shuffle: false,
    duckFactor: 1,
    duckTarget: 1,
    started: false,
  });

  // ---- Playlist ----
  useEffect(() => {
    if (demoTracks && demoTracks.length) {
      applyTracks(demoTracks);
      return undefined;
    }
    const q = query(collection(db, 'musicPlaylist'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      applyTracks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoTracks]);

  function applyTracks(all) {
    const tracks = all.filter(t => typeof t.url === 'string' && t.url);
    const s = st.current;
    const currentId = s.order[s.pos]?.id;
    s.tracks = tracks;
    s.order = s.shuffle ? shuffled(tracks) : tracks.slice();
    const keep = s.order.findIndex(t => t.id === currentId);
    s.pos = keep;
    if (!tracks.length) {
      elsRef.current.forEach(el => { if (el) { el.pause(); el.removeAttribute('src'); } });
      s.started = false;
      onTrackChange && onTrackChange(null);
    } else if (keep < 0) {
      playNext(false);
    }
  }

  // ---- Volume / embaralhar ----
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'control'), (snap) => {
      const d = snap.exists() ? snap.data() : {};
      const s = st.current;
      if (Number.isFinite(d.musicVolume)) s.volume = Math.max(0, Math.min(100, d.musicVolume));
      const shuffle = Boolean(d.musicShuffle);
      if (shuffle !== s.shuffle) {
        s.shuffle = shuffle;
        const currentId = s.order[s.pos]?.id;
        s.order = shuffle ? shuffled(s.tracks) : s.tracks.slice();
        s.pos = Math.max(0, s.order.findIndex(t => t.id === currentId));
      }
    });
    return () => unsub();
  }, []);

  // ---- Ponte com o tv-ducking.js ----
  useEffect(() => {
    let ducked = false;
    window.tvYTPlayer = {
      setVolume(v) {
        const cfg = window.tvConfig || {};
        const duck = Number.isFinite(cfg.duckVolume) ? cfg.duckVolume : 20;
        const restore = Number.isFinite(cfg.restoreVolume) ? cfg.restoreVolume : 60;
        if (Number(v) === duck && !ducked) {
          ducked = true;
          // Mantém a proporção configurada no Admin (ex.: 20/60 → música cai para 1/3)
          st.current.duckTarget = Math.max(0, Math.min(1, duck / Math.max(1, restore)));
        } else {
          ducked = false;
          st.current.duckTarget = 1;
        }
      },
    };
    return () => { if (window.tvYTPlayer) delete window.tvYTPlayer; };
  }, []);

  function trackAt(pos) {
    const s = st.current;
    return s.order.length ? s.order[((pos % s.order.length) + s.order.length) % s.order.length] : null;
  }

  function tryPlay(el) {
    const p = el.play();
    if (p && typeof p.then === 'function') {
      p.then(() => setBlocked(false)).catch((e) => {
        if (e && e.name === 'NotAllowedError') setBlocked(true);
      });
    }
  }

  // Inicia a próxima faixa. crossfade=true mantém a atual tocando enquanto ela some.
  function playNext(crossfade) {
    const s = st.current;
    if (!s.order.length) return;
    const els = elsRef.current;
    if (!els[0] || !els[1]) return;

    s.pos = s.pos + 1;
    if (s.pos >= s.order.length) {
      s.pos = 0;
      if (s.shuffle && s.order.length > 2) {
        const last = s.order[s.order.length - 1];
        do { s.order = shuffled(s.tracks); } while (s.order[0]?.id === last?.id);
      }
    }
    const track = trackAt(s.pos);
    if (!track) return;

    const next = crossfade ? 1 - s.active : s.active;
    if (crossfade) {
      s.fadingOut = s.active;
    } else {
      const other = els[1 - s.active];
      other.pause();
      s.gains[1 - s.active] = 0;
      s.fadingOut = -1;
    }
    const el = els[next];
    s.active = next;
    s.gains[next] = 0;
    el.src = track.url;
    el.currentTime = 0;
    s.started = true;
    tryPlay(el);
    onTrackChange && onTrackChange(track.title || '');
  }

  // ---- Loop de mixagem (volume, crossfade, ducking) ----
  useEffect(() => {
    const step = TICK_MS / 1000;
    const timer = setInterval(() => {
      const s = st.current;
      const els = elsRef.current;
      if (!els[0] || !els[1] || !s.started) return;

      // Ducking suave
      const rate = s.duckTarget < s.duckFactor ? step / DUCK_RAMP_S : step / RESTORE_RAMP_S;
      if (Math.abs(s.duckTarget - s.duckFactor) <= rate) s.duckFactor = s.duckTarget;
      else s.duckFactor += s.duckTarget < s.duckFactor ? -rate : rate;

      const a = s.active;
      const el = els[a];

      // Fade-in da faixa atual
      s.gains[a] = Math.min(1, s.gains[a] + step / CROSSFADE_S);

      // Fade-out da faixa anterior
      if (s.fadingOut >= 0) {
        const f = s.fadingOut;
        s.gains[f] = Math.max(0, s.gains[f] - step / CROSSFADE_S);
        if (s.gains[f] <= 0) { els[f].pause(); s.fadingOut = -1; }
      }

      // Hora de iniciar o crossfade?
      const dur = el.duration;
      if (s.fadingOut < 0 && Number.isFinite(dur) && dur > CROSSFADE_S * 2 && dur - el.currentTime <= CROSSFADE_S) {
        playNext(true);
      }

      const master = (s.volume / 100) * s.duckFactor;
      for (let i = 0; i < 2; i++) {
        const v = Math.max(0, Math.min(1, master * s.gains[i]));
        if (Math.abs(els[i].volume - v) > 0.002) els[i].volume = v;
      }
    }, TICK_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Vigia: retoma se a reprodução parar sozinha (rede instável) ----
  useEffect(() => {
    const t = setInterval(() => {
      const s = st.current;
      const el = elsRef.current[s.active];
      if (el && s.started && el.paused && !el.ended && el.src) tryPlay(el);
    }, 15000);
    return () => clearInterval(t);
  }, []);

  function handleEnded(i) {
    const s = st.current;
    if (i === s.active) playNext(false);
  }

  function handleError(i) {
    const s = st.current;
    if (i !== s.active) return;
    // Faixa com problema: pula para a próxima depois de um respiro
    setTimeout(() => { if (st.current.active === i) playNext(false); }, 2500);
  }

  function unlock() {
    const s = st.current;
    const el = elsRef.current[s.active];
    if (el) tryPlay(el);
    try { if ('speechSynthesis' in window) window.speechSynthesis.getVoices(); } catch {}
  }

  return (
    <>
      {[0, 1].map(i => (
        <audio
          key={i}
          ref={el => { elsRef.current[i] = el; }}
          preload="auto"
          onEnded={() => handleEnded(i)}
          onError={() => handleError(i)}
          style={{ display: 'none' }}
        />
      ))}
      {blocked && (
        <button
          onClick={unlock}
          style={{
            position: 'fixed', left: '50%', bottom: '11vh', transform: 'translateX(-50%)', zIndex: 50,
            padding: '1.2vh 2.4vh', borderRadius: 999, border: '1px solid rgba(255,255,255,.25)',
            background: 'rgba(8,16,40,.85)', color: '#F4F1EA', font: '600 1.8vh var(--font-sans), sans-serif',
            cursor: 'pointer',
          }}
        >
          Clique aqui para ativar o som
        </button>
      )}
    </>
  );
}

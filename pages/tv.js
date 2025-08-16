// pages/tv.js — "Chamando agora" com até 2 caixas (30s), fila de áudio e logo em idle
import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import YoutubePlayer from '../components/YoutubePlayer';
import Carousel from '../components/Carousel';

const GROUP_WINDOW_MS = 30000; // 30s: se a 2ª chamada vier até 30s da última, vira "dupla"

function applyAccent(color){
  try { document.documentElement.style.setProperty('--tv-accent', color || '#44b2e7'); } catch {}
}

// Fila de anúncios: garante que o áudio fala um por vez
function enqueueAudio(audioQueueRef, playingRef, nome, sala){
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
  // aguarda o anúncio terminar antes do próximo (ajuste fino se quiser)
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

  const initCallsRef = useRef(false);
  const initAnnounceRef = useRef(false);
  const lastNonceRef = useRef('');
  const audioQueueRef = useRef([]);
  const playingRef = useRef(false);

  // =================== Assinaturas ===================

  // Histórico (para decidir quem aparece e o "recente")
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

  // Gatilho universal de anúncio (config/announce) → entra na fila de áudio
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
          // força sair do logo, se admin mandou idle=false
          if (d.idle === false) setForcedIdle(false);
          // entra na fila (fala um por vez)
          enqueueAudio(audioQueueRef, playingRef, d.nome, d.sala);
          // efeito visual "flash" opcional
          const row = document.querySelector('.current-call');
          if (row){ row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
        }
      }

      if (typeof d.idle === 'boolean') {
        setForcedIdle(Boolean(d.idle));
      }
    });
    return () => unsub();
  }, []);

  // Configurações (inclui idleSeconds)
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
      if (!snap.empty) applyConfig(snap.docs[0].data());
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

  // videoId (do(s) docs de config)
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

  // =================== Derivações de UI ===================

  // 1) Decide se está IDLE (logo)
  const nowMs = Date.now();
  const withinIdle = lastCallAt ? (nowMs - lastCallAt) < idleSeconds * 1000 : false;
  const isIdle = forcedIdle || !history.length || !withinIdle;

  // 2) Monta o "grupo" atual (1 ou 2 caixas):
  //    - Sempre inclui a chamada mais recente se

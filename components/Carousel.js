// components/Carousel.js — carrossel "stories" horizontal (16:9) contido no box,
// sem alterar o layout; imagens/vídeos mute com auto-avanço e barras.
import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

const DEFAULT_IMAGE_SEC = 7;
const DEFAULT_VIDEO_SEC = 12;
const MAX_VIDEO_SEC = 30;

export default function Carousel(){
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  const startRef = useRef(Date.now());
  const durRef = useRef(DEFAULT_IMAGE_SEC * 1000);
  const vidRef = useRef(null);
  const vidDurMetaRef = useRef(null);

  // 1) Ler itens (ordenados)
  useEffect(() => {
    const qy = query(collection(db, 'carousel'), orderBy('order', 'asc'));
    const unsub = onSnapshot(qy, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const norm = arr.map((it, i) => ({ ...it, _order: Number.isFinite(it.order) ? Number(it.order) : (i+1) }));
      norm.sort((a,b) => a._order - b._order);
      setItems(norm);
      setIdx(i => (i >= norm.length ? 0 : i));
    });
    return () => unsub();
  }, []);

  // 2) Relógio (progresso)
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // 3) Duração
  function currentDurationMs(){
    const it = items[idx];
    if (!it) return 1;
    if (Number.isFinite(it.durationSec) && it.durationSec > 0) return it.durationSec * 1000;
    if (it.kind === 'video'){
      const meta = vidDurMetaRef.current;
      if (Number.isFinite(meta) && meta > 0) return Math.min(MAX_VIDEO_SEC, meta) * 1000;
      return DEFAULT_VIDEO_SEC * 1000;
    }
    return DEFAULT_IMAGE_SEC * 1000;
  }

  // 4) Troca de item
  useEffect(() => {
    startRef.current = Date.now();
    durRef.current = currentDurationMs();
    setProgress(0);
    vidDurMetaRef.current = null;
    if (items[idx]?.kind === 'video' && vidRef.current){
      vidRef.current.currentTime = 0;
      const p = vidRef.current.play(); if (p?.catch) p.catch(()=>{});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, items.length]);

  // 5) Avanço automático
  useEffect(() => {
    const total = durRef.current || currentDurationMs();
    const elapsed = nowMs - startRef.current;
    setProgress(Math.max(0, Math.min(1, elapsed / total)));
    if (elapsed >= total && items.length){
      setIdx(i => (i + 1) % items.length);
    }
  }, [nowMs, items.length]);

  // 6) Vídeo: metadata/ended
  function onLoadedMetadata(e){
    const v = e?.currentTarget;
    if (!v) return;
    const d = Number(v.duration);
    if (Number.isFinite(d) && d > 0){
      vidDurMetaRef.current = d;
      durRef.current = currentDurationMs();
    }
  }
  function onEnded(){ setIdx(i => (items.length ? (i + 1) % items.length : 0)); }

  if (!items.length){
    return (
      <div className="stories-wrap stories-empty-wrap">
        <div className="stories-frame stories-empty">Adicione imagens/vídeos no Admin…</div>
        {styles}
      </div>
    );
  }

  const it = items[idx];
  const segments = items.map((_, i) => (i < idx ? 1 : i > idx ? 0 : progress));

  return (
    <div className="stories-wrap">
      {/* barras de progresso */}
      <div className="stories-bars">
        {segments.map((v, i) => (
          <div key={i} className="bar">
            <span className="fill" style={{ transform: `scaleX(${v})` }} />
          </div>
        ))}
      </div>

      {/* Frame horizontal 16:9 por altura */}
      <div className="stories-frame">
        {it.kind === 'video' ? (
          <video
            key={it.id}
            ref={vidRef}
            className="stories-media"
            muted
            playsInline
            autoPlay
            controls={false}
            loop={false}
            preload="auto"
            onLoadedMetadata={onLoadedMetadata}
            onEnded={onEnded}
          >
            <source src={String(it.url || '')} />
          </video>
        ) : (
          <img
            key={it.id}
            className="stories-media"
            src={String(it.url || '')}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
      {styles}
    </div>
  );
}

const styles = (
  <style jsx global>{`
    /* ocupa 100% do espaço dado pela coluna .tv-carousel */
    .stories-wrap{ position:relative; width:100%; height:100%; }

    /* Frame horizontal 16:9 por ALTURA (igual ao YouTube) */
    .stories-frame{
      position:absolute; inset:0;
      height:100%;
      aspect-ratio:16 / 9;
      width:auto; max-width:100%;
      margin:0 auto;
      border-radius:12px;
      background:#0b0f12;
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);
      overflow:hidden;
    }

    /* Mídia “contida” (sem cortes). Troque para cover se quiser preencher cortando um pouco. */
    .stories-media{
      position:absolute; inset:0;
      width:100%; height:100%;
      object-fit: cover;
      background:#0b0f12;
    }

    /* Barras de progresso dentro do frame */
    .stories-bars{
      position:absolute; top:6px; left:8px; right:8px; z-index:2;
      display:grid; grid-auto-flow:column; gap:6px;
      max-width:calc(100% - 16px);
      margin:0 auto;
    }
    .stories-bars .bar{ height:4px; border-radius:99px; background:rgba(255,255,255,.18); overflow:hidden; }
    .stories-bars .fill{ display:block; height:100%; width:100%; transform-origin:left center; background:var(--tv-accent, #44b2e7); }

    .stories-empty-wrap{ display:grid; place-items:center; }
    .stories-empty{ display:grid; place-items:center; color:rgba(255,255,255,.7); }
  `}</style>
);

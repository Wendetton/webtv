// components/Carousel.js — Stories (imagens e vídeos mudos) com progresso e auto-avanço
// Firestore: coleção 'carousel' com campos: url (string), kind ('image'|'video'), durationSec (opcional), order (número), createdAt
import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

const DEFAULT_IMAGE_SEC = 7;   // duração padrão para imagem
const DEFAULT_VIDEO_SEC = 12;  // duração padrão para vídeo (se não conseguir ler metadata)
const MAX_VIDEO_SEC = 30;      // teto para vídeos (evita vídeos longos)

export default function Carousel(){
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1 do item atual
  const [nowMs, setNowMs] = useState(Date.now());

  const startRef = useRef(Date.now());
  const durRef = useRef(DEFAULT_IMAGE_SEC * 1000);
  const vidRef = useRef(null);
  const vidDurFromMetaRef = useRef(null);

  // ===== 1) Ler itens do Firestore =====
  useEffect(() => {
    const q = query(collection(db, 'carousel'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // fallback: se não tiver 'order', ao menos mantém algo estável
      const norm = arr.map((it, i) => ({ ...it, _order: Number.isFinite(it.order) ? Number(it.order) : (i+1) }));
      norm.sort((a,b) => a._order - b._order);
      setItems(norm);
      // se índice atual estourou, volta para 0
      setIdx((i) => (i >= norm.length ? 0 : i));
    });
    return () => unsub();
  }, []);

  // ===== 2) Relógio para atualizar progresso =====
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 200); // 5x/seg é fluido e leve
    return () => clearInterval(t);
  }, []);

  // ===== 3) Definir duração do item atual =====
  function currentDurationMs(){
    const it = items[idx];
    if (!it) return 1;
    if (Number.isFinite(it.durationSec) && it.durationSec > 0) {
      return Math.max(1, it.durationSec) * 1000;
    }
    if (it.kind === 'video') {
      // se metadata já foi lida, usa, senão fallback
      const meta = vidDurFromMetaRef.current;
      if (Number.isFinite(meta) && meta > 0) {
        return Math.min(MAX_VIDEO_SEC, meta) * 1000;
      }
      return DEFAULT_VIDEO_SEC * 1000;
    }
    return DEFAULT_IMAGE_SEC * 1000;
  }

  // ===== 4) Reset ao trocar de item =====
  useEffect(() => {
    startRef.current = Date.now();
    durRef.current = currentDurationMs();
    setProgress(0);
    vidDurFromMetaRef.current = null;
    // tenta dar play se for vídeo
    if (items[idx]?.kind === 'video' && vidRef.current) {
      // em TVs/Android o autoplay muted costuma funcionar
      vidRef.current.currentTime = 0;
      const p = vidRef.current.play();
      if (p && typeof p.then === 'function') p.catch(()=>{ /* ignore */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, items.length]);

  // ===== 5) Avança automaticamente =====
  useEffect(() => {
    const total = durRef.current || currentDurationMs();
    const elapsed = nowMs - startRef.current;
    const pr = Math.max(0, Math.min(1, elapsed / total));
    setProgress(pr);

    if (elapsed >= total && items.length > 0) {
      setIdx((i) => (i + 1) % items.length);
    }
  }, [nowMs, items.length]);

  // ===== 6) Eventos do vídeo =====
  function onLoadedMetadata(e){
    const v = e?.currentTarget;
    if (!v) return;
    const dur = Number(v.duration);
    if (Number.isFinite(dur) && dur > 0) {
      vidDurFromMetaRef.current = Math.min(MAX_VIDEO_SEC, dur);
      // recalcula duração a partir da metadata
      durRef.current = currentDurationMs();
    }
  }
  function onEnded(){
    // se o vídeo terminar antes do tempo previsto, avança logo
    setIdx((i) => (items.length ? (i + 1) % items.length : 0));
  }

  if (!items.length) {
    return (
      <div className="stories-wrap">
        <div className="stories-frame empty">
          <div className="stories-empty">Adicione imagens/vídeos no Admin…</div>
        </div>
        {styles}
      </div>
    );
  }

  const it = items[idx];
  const segments = items.map((_, i) => {
    if (i < idx) return 1;
    if (i > idx) return 0;
    return progress;
  });

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

      {/* quadro 9:16 padronizado */}
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
    /* Área total do carrossel (usa todo o espaço disponível do .tv-carousel) */
    .stories-wrap{
      position: relative;
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
    }

    /* Moldura padronizada 9:16 (estilo "stories") */
    .stories-frame{
      position: relative;
      width: min(100%, 420px);          /* limita largura para manter legibilidade */
      aspect-ratio: 9 / 16;
      height: auto;
      overflow: hidden;
      border-radius: 16px;
      background: #0b0f12;
      box-shadow: 0 10px 30px rgba(0,0,0,.25), inset 0 0 0 1px rgba(255,255,255,.06);
    }
    /* se o espaço for pequeno (TV antiga), usa 100% da altura da área */
    @media (max-height: 680px){
      .stories-frame{ width: 100%; }
    }

    .stories-media{
      width: 100%;
      height: 100%;
      object-fit: cover;                /* padroniza enquadramento sem distorcer */
    }

    /* Barras de progresso (topo) */
    .stories-bars{
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: min(100%, 420px);
      display: grid;
      grid-auto-flow: column;
      gap: 6px;
      z-index: 3;
      padding: 0 8px;
    }
    .stories-bars .bar{
      height: 4px;
      border-radius: 99px;
      background: rgba(255,255,255,.18);
      overflow: hidden;
      transform: translateZ(0);
    }
    .stories-bars .fill{
      display: block;
      height: 100%;
      width: 100%;
      transform-origin: left center;
      background: var(--tv-accent, #44b2e7);
    }

    .stories-frame.empty{
      display: grid; place-items: center;
      color: rgba(255,255,255,.7);
      font-size: 14px;
    }
    .stories-empty{
      opacity: .8;
    }
  `}</style>
);

// components/sala/PosterCarousel.js — carrossel da sala de espera (mesma coleção "carousel" do Admin)
// Crossfade lento + leve aproximação (Ken Burns) e barra de progresso discreta.

import { useEffect, useRef, useState } from 'react';
import { db } from '../../utils/firebase';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import s from './sala.module.css';

const DEFAULT_SEC = 9;
const MAX_VIDEO_SEC = 30;

export default function PosterCarousel() {
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [durationSec, setDurationSec] = useState(DEFAULT_SEC);
  const [cycle, setCycle] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'main'), (snap) => {
      const d = snap.exists() ? snap.data() : {};
      // Na sala nova as imagens ficam um pouco mais (ritmo mais calmo)
      if (Number.isFinite(d.carouselDuration)) setDurationSec(Math.min(30, Math.max(6, Number(d.carouselDuration) + 2)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'carousel'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.url);
      setItems(list);
      setIdx(i => (i < list.length ? i : 0));
    });
    return () => unsub();
  }, []);

  const cur = items[idx];
  const isVideo = cur && cur.kind === 'video';
  const itemSec = cur && Number.isFinite(cur.durationSec) ? cur.durationSec : durationSec;

  useEffect(() => {
    if (items.length < 2 || isVideo) return undefined;
    // Pré-carrega a próxima imagem
    const nxt = items[(idx + 1) % items.length];
    if (nxt && nxt.kind !== 'video') { const im = new Image(); im.src = nxt.url; }
    timerRef.current = setTimeout(() => { setIdx(i => (i + 1) % items.length); setCycle(c => c + 1); }, itemSec * 1000);
    return () => clearTimeout(timerRef.current);
  }, [idx, items, itemSec, isVideo]);

  function nextFromVideo() {
    if (items.length > 1) { setIdx(i => (i + 1) % items.length); setCycle(c => c + 1); }
  }

  if (!items.length) {
    return (
      <div className={s.posterEmpty}>
        <img src="/logo-hospital-claro.png" alt="" />
      </div>
    );
  }

  return (
    <div className={s.poster}>
      {items.map((it, i) => {
        const active = i === idx;
        if (it.kind === 'video') {
          return active ? (
            <video
              key={it.id}
              className={`${s.posterLayer} ${s.posterActive}`}
              src={it.url}
              autoPlay
              muted
              playsInline
              onEnded={nextFromVideo}
              onTimeUpdate={e => { if (e.currentTarget.currentTime > MAX_VIDEO_SEC) nextFromVideo(); }}
              onError={nextFromVideo}
            />
          ) : null;
        }
        return (
          <img
            key={it.id}
            src={it.url}
            alt=""
            className={`${s.posterLayer} ${active ? s.posterActive : ''}`}
            style={active ? { animationDuration: `${itemSec + 3}s` } : undefined}
          />
        );
      })}
      {items.length > 1 && !isVideo && (
        <div className={s.posterProgress}>
          <span key={`${idx}-${cycle}`} style={{ animationDuration: `${itemSec}s` }} />
        </div>
      )}
    </div>
  );
}

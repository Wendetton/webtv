// components/Carousel.js — carrossel com fade suave + pré-carregamento (Firestore)
// Lê direto da coleção "carousel" (como no seu projeto atual).
// Campos esperados por item: { url: string, kind: 'image'|'video', order?: number, durationSec?: number }

import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

const DEFAULT_IMAGE_SEC = 7;
const DEFAULT_VIDEO_SEC = 12;
const MAX_VIDEO_SEC = 30;
const FADE_MS = 450;

export default function Carousel(){
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);
  const [frontIsA, setFrontIsA] = useState(true); // alterna camada A/B
  const timerRef = useRef(null);
  const nextAbortRef = useRef(null);
  const cacheRef = useRef(new Map()); // url -> { ok: boolean, type: 'image'|'video' }
  const vidDurMetaRef = useRef(null);

  // 1) Assina Firestore (ordena por 'order' se existir)
  useEffect(() => {
    // tenta ordenar por 'order'; se a coleção não tiver esse campo, comente a linha de 'orderBy'
    let q = query(collection(db, 'carousel'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // fallback de ordenação no cliente (se não houver 'order')
      list.sort((a,b) => {
        const ao = Number.isFinite(a.order) ? a.order : 999999;
        const bo = Number.isFinite(b.order) ? b.order : 999999;
        if (ao !== bo) return ao - bo;
        return String(a.id).localeCompare(String(b.id));
      });
      setItems(list);
      setIdx(0);
      setReady(list.length > 0);
    });
    return () => unsub();
  }, []);

  // 2) Define duração do item atual
  function curDurationMs(cur){
    if (!cur) return DEFAULT_IMAGE_SEC * 1000;
    if (Number.isFinite(cur.durationSec) && cur.durationSec > 0) {
      return cur.durationSec * 1000;
    }
    if (cur.kind === 'video'){
      const meta = vidDurMetaRef.current;
      if (Number.isFinite(meta) && meta > 0) return Math.min(MAX_VIDEO_SEC, meta) * 1000;
      return DEFAULT_VIDEO_SEC * 1000;
    }
    return DEFAULT_IMAGE_SEC * 1000;
  }

  // 3) Pré-carrega o próximo
  async function preload(item, signal){
    if (!item || !item.url) return true;
    const url = String(item.url);
    const cached = cacheRef.current.get(url);
    if (cached?.ok) return true;

    if (!item.kind || item.kind === 'image'){
      try {
        const img = new Image();
        img.decoding = 'async';
        img.loading = 'eager';
        img.src = url;
        await img.decode();
        if (signal?.aborted) return false;
        cacheRef.current.set(url, { ok: true, type: 'image' });
        return true;
      } catch {
        // fallback se decode() não estiver disponível
        return new Promise(resolve => {
          const img = new Image();
          img.onload = () => { if (!signal?.aborted) cacheRef.current.set(url, {ok:true, type:'image'}); resolve(!signal?.aborted); };
          img.onerror = () => resolve(false);
          img.src = url;
        });
      }
    }

    if (item.kind === 'video'){
      return new Promise(resolve => {
        const v = document.createElement('video');
        v.preload = 'auto';
        v.muted = true;
        v.src = url;
        let done = false;
        const finish = ok => {
          if (done) return;
          done = true;
          if (!signal?.aborted && ok) cacheRef.current.set(url, { ok:true, type:'video' });
          resolve(ok && !signal?.aborted);
        };
        const to = setTimeout(() => finish(true), 1200); // timeout de segurança
        v.addEventListener('canplaythrough', () => { clearTimeout(to); try{
          // guarda uma estimativa de duração (útil pra curDurationMs)
          const dur = Number(v.duration);
          if (Number.isFinite(dur)) vidDurMetaRef.current = dur;
        }catch{} finish(true); }, { once:true });
        v.addEventListener('error', () => { clearTimeout(to); finish(false); }, { once:true });
        v.load?.();
      });
    }

    return true;
  }

  function clearTimer(){
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (nextAbortRef.current) nextAbortRef.current.aborted = true;
    nextAbortRef.current = null;
  }

  // 4) Agenda troca com fade após pré-carregar o próximo
  useEffect(() => {
    if (!ready || items.length <= 1) return;
    clearTimer();

    const cur = items[idx];
    const dur = curDurationMs(cur);

    timerRef.current = setTimeout(async () => {
      const nextIdx = (idx + 1) % items.length;
      const ab = { aborted: false };
      nextAbortRef.current = ab;
      await preload(items[nextIdx], ab);

      setFading(true);
      setFrontIsA(v => !v);
      setTimeout(() => {
        setIdx(nextIdx);
        setFading(false);
      }, FADE_MS);
    }, dur);

    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, idx, items]);

  if (!ready) {
    return (
      <div className="stories-frame stories-skeleton">
        <style jsx>{`
          .stories-frame{
            position: relative; width: 100%; height: 100%;
            border-radius: 12px; overflow: hidden;
            background: rgba(255,255,255,0.06);
          }
          .stories-skeleton::after{
            content: ""; position: absolute; inset: 0;
            background: linear-gradient(90deg,
              rgba(255,255,255,.04) 0%,
              rgba(255,255,255,.09) 50%,
              rgba(255,255,255,.04) 100%);
            animation: shine 1150ms infinite;
          }
          @keyframes shine {
            from { transform: translateX(-100%); }
            to   { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  const cur = items[idx];
  const nxt = items[(idx + 1) % items.length];

  return (
    <div className="stories-frame">
      {/* Camada A (frente) */}
      <Layer item={cur} active={frontIsA} fading={fading && frontIsA} />

      {/* Camada B (fundo) com o próximo já pré-carregado */}
      <Layer item={nxt} active={!frontIsA} fading={fading && !frontIsA} isBack />

      <style jsx>{`
        .stories-frame{
          position: relative; width: 100%; height: 100%;
          border-radius: 12px; overflow: hidden;
          background: rgba(0,0,0,0.25);
        }
      `}</style>
    </div>
  );
}

function Layer({ item, active, fading }) {
  const [loaded, setLoaded] = useState(false);
  const vref = useRef(null);

  useEffect(() => { setLoaded(false); }, [item?.url]);

  useEffect(() => {
    if (!item || item.kind !== 'video') return;
    const v = vref.current;
    if (!v) return;
    const onReady = () => setLoaded(true);
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.addEventListener('canplaythrough', onReady, { once:true });
    v.load?.();
    return () => v.removeEventListener('canplaythrough', onReady);
  }, [item?.url, item?.kind]);

  const isImg = !item?.kind || item?.kind === 'image';
  const show = isImg ? true : loaded;

  return (
    <div className={[
      'layer',
      active ? 'is-front' : 'is-back',
      fading ? 'is-fading' : '',
      show ? 'is-ready' : 'is-loading'
    ].join(' ')}>
      {isImg ? (
        <img
          src={item?.url}
          alt=""
          className="media"
          loading="eager"
          decoding="async"
          fetchpriority="high"
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <video
          ref={vref}
          className="media"
          src={item?.url}
          autoPlay
          muted
          loop
          playsInline
        />
      )}

      {!show && <div className="shade" />}

      <style jsx>{`
        .layer{
          position: absolute; inset: 0;
          opacity: 0; transform: scale(1.01);
          transition: opacity ${FADE_MS}ms, transform ${FADE_MS}ms;
          will-change: opacity, transform;
        }
        .layer.is-front{ z-index: 2; }
        .layer.is-back{ z-index: 1; }
        .layer.is-ready{ opacity: 1; transform: none; }
        .layer.is-fading{ opacity: 0; transform: scale(1.01); }

        .media{
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover; object-position: center;
          display: block; background: #000;
        }
        .shade{
          position: absolute; inset: 0;
          background: rgba(0,0,0,.15);
        }

        @media (prefers-reduced-motion: reduce){
          .layer{ transition: none !important; }
        }
      `}</style>
    </div>
  );
}

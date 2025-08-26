// components/Carousel.js
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Drop-in: transição com crossfade e pré-carregamento do próximo item.
 * Aceita imagens e vídeos. Mantém API simples:
 *   <Carousel items={[{url, type: 'image'|'video', durationMs?}]} />
 *
 * Observações:
 * - Usa double-buffer (duas camadas absolutas) para o fade ficar suave.
 * - Pré-carrega o próximo item: imgs com HTMLImageElement.decode(), vídeos aguardam 'canplaythrough' (timeout de segurança).
 * - Respeita reduced motion (prefers-reduced-motion).
 */
export default function Carousel({
  items,
  media,
  data,
  intervalMs = 6000,       // fallback quando item.durationMs não vier
  transitionMs = 450,      // duração do fade
}) {
  const list = useMemo(() => {
    const src = items || media || data || [];
    return Array.isArray(src) ? src.filter(Boolean) : [];
  }, [items, media, data]);

  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [ready, setReady] = useState(false);
  const [frontIsA, setFrontIsA] = useState(true); // alterna entre camada A e B
  const timerRef = useRef(null);
  const nextAbortRef = useRef(null);

  // cache simples para pré-carregamento
  const cacheRef = useRef(new Map()); // url -> { ok: boolean, type: 'image'|'video' }

  const reduceMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // limpa timers ao desmontar
  useEffect(() => () => { clearTimer(); }, []);

  useEffect(() => {
    setReady(list.length > 0);
    setIdx(0);
  }, [list]);

  useEffect(() => {
    if (!ready || list.length === 0) return;
    scheduleNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, idx, list]);

  function clearTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (nextAbortRef.current) {
      try { nextAbortRef.current.aborted = true; } catch {}
      nextAbortRef.current = null;
    }
  }

  async function preload(item, signal) {
    if (!item || !item.url) return true;
    const url = String(item.url);
    if (cacheRef.current.get(url)?.ok) return true;

    // Imagem
    if (!item.type || item.type === 'image') {
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
        // mesmo se falhar decode(), tentamos marcar ok ao carregar onload
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            if (!signal?.aborted) {
              cacheRef.current.set(url, { ok: true, type: 'image' });
              resolve(true);
            } else resolve(false);
          };
          img.onerror = () => resolve(false);
          img.src = url;
        });
      }
    }

    // Vídeo
    if (item.type === 'video') {
      return new Promise((resolve) => {
        const v = document.createElement('video');
        v.preload = 'auto';
        v.muted = true;
        v.src = url;
        let done = false;
        const finish = (ok) => {
          if (done) return;
          done = true;
          if (!signal?.aborted && ok) cacheRef.current.set(url, { ok: true, type: 'video' });
          resolve(ok && !signal?.aborted);
        };
        const to = setTimeout(() => finish(true), 1200); // timeout de segurança
        v.addEventListener('canplaythrough', () => { clearTimeout(to); finish(true); }, { once: true });
        v.addEventListener('error', () => { clearTimeout(to); finish(false); }, { once: true });
        // força carregamento
        v.load?.();
      });
    }

    return true;
  }

  function scheduleNext() {
    clearTimer();
    if (list.length <= 1) return;

    const cur = list[idx];
    const dur = Math.max(1500, Number(cur?.durationMs ?? intervalMs));
    timerRef.current = setTimeout(async () => {
      const next = (idx + 1) % list.length;
      // Pré-carrega o próximo antes de trocar (com abort handle)
      const ab = { aborted: false };
      nextAbortRef.current = ab;
      await preload(list[next], ab);

      // Faz a troca com fade
      if (!reduceMotion) setFading(true);
      setFrontIsA((v) => !v);
      // pequena janela de fade
      setTimeout(() => {
        setIdx(next);
        setFading(false);
      }, reduceMotion ? 0 : transitionMs);
    }, dur);
  }

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

  const cur = list[idx];
  const next = list[(idx + 1) % list.length];

  return (
    <div className="stories-frame">
      {/* Camada A */}
      <Layer
        active={frontIsA}
        fading={fading && frontIsA}
        item={cur}
        transitionMs={transitionMs}
      />
      {/* Camada B (mostra o próximo já carregado quando alterna) */}
      <Layer
        active={!frontIsA}
        fading={fading && !frontIsA}
        item={next}
        transitionMs={transitionMs}
        isBack
      />
      <style jsx>{`
        .stories-frame{
          position: relative; width: 100%; height: 100%;
          border-radius: 12px; overflow: hidden;
          background: rgba(0,0,0,0.25);
          /* fallback para webview sem aspect-ratio controlado externamente */
        }
      `}</style>
    </div>
  );
}

/** Uma camada (A ou B) que ocupa todo o espaço e faz fade por opacity */
function Layer({ item, active, fading, transitionMs, isBack }) {
  const [loaded, setLoaded] = useState(false);
  const refVid = useRef(null);

  useEffect(() => {
    setLoaded(false);
  }, [item?.url]);

  // Quando o vídeo ficar pronto, marcar loaded
  useEffect(() => {
    if (!item || item.type !== 'video') return;
    const v = refVid.current;
    if (!v) return;
    const onReady = () => setLoaded(true);
    v.muted = true; v.playsInline = true;
    v.preload = "auto";
    v.addEventListener('canplaythrough', onReady, { once: true });
    v.load?.();
    return () => { v.removeEventListener('canplaythrough', onReady); };
  }, [item?.url, item?.type]);

  const isImg = !item?.type || item?.type === 'image';
  const show = isImg ? true : loaded;

  return (
    <div
      className={[
        "layer",
        active ? "is-front" : "is-back",
        fading ? "is-fading" : "",
        show ? "is-ready" : "is-loading"
      ].join(" ")}
      style={{ transitionDuration: `${transitionMs}ms` }}
    >
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
          ref={refVid}
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
          opacity: 0;
          transform: scale(1.01);
          transition-property: opacity, transform;
          will-change: opacity, transform;
        }
        .layer.is-front{ z-index: 2; }
        .layer.is-back{ z-index: 1; }
        .layer.is-ready{ opacity: 1; transform: none; }
        .layer.is-fading{ opacity: 0; transform: scale(1.01); }

        .media{
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;               /* preenche todo o box sem bordas */
          object-position: center;
          display: block;
          background: #000;
        }
        .shade{
          position: absolute; inset: 0;
          background: rgba(0,0,0,.15);
        }

        /* Reduz movimento para acessibilidade */
        @media (prefers-reduced-motion: reduce) {
          .layer{ transition: none !important; }
        }
      `}</style>
    </div>
  );
}


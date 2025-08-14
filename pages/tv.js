/* pages/tv.js — Integra configs do anúncio e ignora 'test' no histórico
   - Lê doc 'config/main' (ou primeiro doc) e publica em window.tvAnnounceCfg
   - Atualiza CSS var '--tv-accent' com highlightColor
   - Histórico mostra somente itens com test != true (apenas 2 últimos)
*/
import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import YoutubePlayer from '../components/YoutubePlayer';
import Carousel from '../components/Carousel';

export default function TV(){
  const [list, setList] = useState([]);
  const [videoId, setVideoId] = useState('');
  const [currentName, setCurrentName] = useState('—');
  const [currentSala, setCurrentSala] = useState('');
  const lastAnnouncedRef = useRef('');

  useEffect(() => {
    // Chamada: pega 5 para garantir não perder teste/atual
    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(5));
    const unsubCalls = onSnapshot(qCalls, (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setList(rows);
      // atual = primeiro NÃO test
      const nonTest = rows.filter(r => !r.test);
      if (nonTest.length) {
        const { nome, sala } = nonTest[0];
        if (nome) setCurrentName(String(nome));
        if (sala != null) setCurrentSala(String(sala));
      }
      // se o primeiro item for um teste, anuncia mas não mostra no histórico
      const first = rows[0];
      if (first && first.test && typeof window !== 'undefined' && typeof window.tvAnnounce === 'function') {
        try { window.tvAnnounce(String(first.nome||''), String(first.sala||'')); } catch {}
      }
    });

    // Configurações
    const unsubCfg = onSnapshot(collection(db, 'config'), (snap) => {
      if (!snap.empty) {
        const data = snap.docs.find(d => d.id === 'main')?.data() || snap.docs[0].data();
        if (data?.videoId) setVideoId(String(data.videoId));
        if (typeof window !== 'undefined') {
          window.tvAnnounceCfg = Object.assign({}, window.tvAnnounceCfg || {}, {
            announceMode: data?.announceMode,
            voiceTemplate: data?.voiceTemplate,
            duckVolume: data?.duckVolume,
            restoreVolume: data?.restoreVolume,
            leadMs: data?.leadMs,
          });
        }
        if (data?.highlightColor && typeof document !== 'undefined') {
          document.documentElement.style.setProperty('--tv-accent', data.highlightColor);
        }
      }
    });

    return () => { unsubCalls(); unsubCfg(); };
  }, []);

  useEffect(() => {
    if (!currentName || currentName === '—') return;
    const box = document.querySelector('.current-call');
    if (box) { box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash'); }
    if (typeof window !== 'undefined') {
      if (lastAnnouncedRef.current !== currentName) {
        lastAnnouncedRef.current = currentName;
        if (typeof window.tvAnnounce === 'function') {
          try { window.tvAnnounce(currentName, currentSala); } catch {}
        }
      }
    }
  }, [currentName, currentSala]);

  const history = list.filter(r => !r.test).slice(1, 3);

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
        <div className="called-list">
          {history.length ? (
            history.map((h) => (
              <span key={h.id} className="called-chip">
                {h.nome} – Sala {h.sala}
              </span>
            ))
          ) : (
            <span className="muted">Sem chamados recentes…</span>
          )}
        </div>

        <div className="current-call">
          <div className="label">Chamando agora</div>
          <div id="current-call-name">{currentName || '—'}</div>
          <div className="sub">{currentSala ? `Sala ${currentSala}` : ''}</div>
        </div>
      </div>

      <Script src="/tv-ducking.js" strategy="afterInteractive" />
    </div>
  );
}

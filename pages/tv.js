/* ======= pages/tv.js (FIXED) — TV Caller Page =======
   Data: 2025-08-12
   Ajustes:
   - REMOVIDO o import de '../styles.css' (global CSS agora é importado em pages/_app.js)
   - Mantido Script /tv-ducking.js para ducking de áudio
*/

import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';

export default function TVPage(){
  const [currentName, setCurrentName] = useState('—');
  const [calledList, setCalledList] = useState([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  useEffect(() => {
    function applyState(state){
      if (!state) return;
      if (state.currentName) setCurrentName(String(state.currentName));
      if (Array.isArray(state.calledList)) setCalledList(state.calledList);
      if (state.youtubeUrl) setYoutubeUrl(String(state.youtubeUrl));
    }
    if (typeof window !== 'undefined' && window.tvState) {
      applyState(window.tvState);
    }
    if (typeof window !== 'undefined') {
      window.__applyTVState = applyState;
    }
  }, []);

  useEffect(() => {
    const row = document.querySelector('.current-call');
    if (!row) return;
    row.classList.remove('pulse');
    void row.offsetWidth;
    row.classList.add('pulse');
  }, [currentName]);

  function buildYouTubeSrc(url){
    if (!url) return '';
    try{
      const u = new URL(url);
      if (!u.searchParams.has('enablejsapi')) u.searchParams.set('enablejsapi','1');
      if (!u.searchParams.has('autoplay')) u.searchParams.set('autoplay','1');
      if (!u.searchParams.has('mute')) u.searchParams.set('mute','0');
      if (!u.searchParams.has('playsinline')) u.searchParams.set('playsinline','1');
      return u.toString();
    }catch{
      return url;
    }
  }

  const ytSrc = buildYouTubeSrc(youtubeUrl);

  return (
    <div className="tv-screen">
      <Head>
        <title>Chamador na TV</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="tv-video-wrap">
        <div className="tv-video-inner">
          {ytSrc ? (
            <iframe
              id="yt-player"
              src={ytSrc}
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="TV Video"
            />
          ) : (
            <div className="flex center" style={{width:'100%', height:'100%', opacity:.6}}>
              <div>Configure o vídeo no painel Admin…</div>
            </div>
          )}
        </div>
      </div>

      <div className="tv-footer">
        <div className="current-call">
          <div className="title">Chamando agora</div>
          <div id="current-call-name" className="name">{currentName || '—'}</div>
          <div className="title" style={{opacity:0}}>.</div>
        </div>

        <div className="called-list" aria-label="Já chamados">
          {calledList && calledList.length > 0 ? (
            calledList.map((item, idx) => (
              <div className="called-card" key={idx}>
                <div className="label">Já chamado</div>
                <div className="value">{String(item)}</div>
              </div>
            ))
          ) : (
            <div style={{marginTop:8, color:'var(--tv-muted)'}}>Sem chamados recentes…</div>
          )}
        </div>
      </div>

      <Script src="/tv-ducking.js" strategy="afterInteractive" />
    </div>
  );
}

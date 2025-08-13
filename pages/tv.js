
/* ======= pages/tv.js (FULL) — TV Caller Page =======
   Data: 2025-08-12
   O que este arquivo entrega:
   - Layout que evita cobrir o vídeo
   - Nome chamado centralizado
   - Lista “já chamados” pronta
   - Inclusão do Script /tv-ducking.js para ducking de áudio
   - Mantém compatibilidade: se existir window.tvState (atualizado pelo Firebase
     no seu projeto), a página usa esses dados automaticamente.
*/

import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import '../styles.css'; // importa nosso styles.css completo

export default function TVPage(){
  // Estados locais (serão atualizados por window.tvState se existir)
  const [currentName, setCurrentName] = useState('—');
  const [calledList, setCalledList] = useState([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // 1) Integração passiva: se o seu admin já injeta/atualiza window.tvState via Firebase,
  //    nós observamos e aplicamos aqui sem mudar sua lógica atual.
  useEffect(() => {
    // função para aplicar estado vindo de fora
    function applyState(state){
      if (!state) return;
      if (state.currentName) setCurrentName(String(state.currentName));
      if (Array.isArray(state.calledList)) setCalledList(state.calledList);
      if (state.youtubeUrl) setYoutubeUrl(String(state.youtubeUrl));
    }

    // aplica imediatamente se já existir
    if (typeof window !== 'undefined' && window.tvState) {
      applyState(window.tvState);
    }

    // observa futuras mudanças
    if (typeof window !== 'undefined') {
      window.__applyTVState = applyState; // opcional: seu código externo pode chamar isso
    }
  }, []);

  // 2) Efeito visual “pulse” ao trocar o nome (classe manipulada pelo /public/tv-ducking.js também)
  useEffect(() => {
    const row = document.querySelector('.current-call');
    if (!row) return;
    row.classList.remove('pulse');
    // força reflow
    void row.offsetWidth;
    row.classList.add('pulse');
  }, [currentName]);

  // 3) Monta src do YouTube garantindo enablejsapi=1
  function buildYouTubeSrc(url){
    if (!url) return '';
    try{
      const u = new URL(url);
      if (!u.searchParams.has('enablejsapi')) u.searchParams.set('enablejsapi','1');
      if (!u.searchParams.has('autoplay')) u.searchParams.set('autoplay','1');
      if (!u.searchParams.has('mute')) u.searchParams.set('mute','0'); // som ligado
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

      {/* ÁREA DO VÍDEO */}
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

      {/* FAIXA INFERIOR — nunca cobre o vídeo */}
      <div className="tv-footer">
        <div className="current-call">
          <div className="title">Chamando agora</div>
          <div id="current-call-name" className="name">{currentName || '—'}</div>
          <div className="title" style={{opacity:0}}>.</div>
        </div>

        {/* Lista dos últimos chamados */}
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

      {/* Script responsável pelo ducking do áudio + anúncio por voz */}
      <Script src="/tv-ducking.js" strategy="afterInteractive" />
    </div>
  );
}

/* ======= COMO O ADMIN PODE ATUALIZAR ESTA TELA (opcional) =======
   Se o seu código do /admin já usa Firebase e atualiza um documento/objeto global,
   você pode, a qualquer momento, executar no browser da TV:
   window.__applyTVState({
     currentName: 'FULANO',
     calledList: ['Ciclano', 'Beltrano'],
     youtubeUrl: 'https://www.youtube.com/watch?v=XXXXX'
   });
   A página vai atualizar imediatamente, e o /public/tv-ducking.js vai
   reduzir o volume do vídeo e anunciar o nome em voz alta.
*/

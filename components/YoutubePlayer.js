// components/YoutubePlayer.js — simples: vídeo único por videoId, sem loop forçado.
// (Se quiser playlist depois, dá pra reativar, mas aqui focamos em “como era antes”.)

import { useEffect, useRef } from 'react';

export default function YoutubePlayer({ videoId }) {
  const playerRef = useRef(null);
  const iframeRef = useRef(null);
  const readyRef = useRef(false);

  // carrega a API do YouTube e cria o player
  useEffect(() => {
    function create() {
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player(iframeRef.current, {
        width: '100%',
        height: '100%',
        videoId: videoId || '',
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3,
          mute: 0,            // mantém áudio do YouTube
          playsinline: 1,
        },
        events: {
          onReady: (ev) => {
            readyRef.current = true;
            try { ev.target.playVideo(); } catch {}
          },
          // IMPORTANTE: sem loop forçado aqui
        }
      });
    }

    if (typeof window !== 'undefined' && window.YT && window.YT.Player) {
      create();
    } else if (typeof window !== 'undefined') {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => create();
    }

    return () => {
      try { if (playerRef.current?.destroy) playerRef.current.destroy(); } catch {}
      playerRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // troca de vídeo quando o Admin muda o `videoId`
  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    try {
      if (videoId) playerRef.current.loadVideoById(videoId);
    } catch {}
  }, [videoId]);

  return (
    <div className="yt-wrap">
      <div className="yt-inner">
        <div ref={iframeRef} id="yt-player"></div>
      </div>
      <style jsx>{`
        .yt-wrap { position: relative; width: 100%; height: 100%; }
        .yt-inner { position: absolute; inset: 0; }
        #yt-player, #yt-player iframe { width: 100%; height: 100%; }
      `}</style>
    </div>
  );
}

// components/YoutubePlayer.js — suporta vídeo único OU playlist (loop)
// Usa a YouTube Iframe API. Se playlist tiver itens, ela tem prioridade sobre videoId.

import { useEffect, useRef } from 'react';

export default function YoutubePlayer({ videoId, playlist = [] }) {
  const playerRef = useRef(null);
  const iframeRef = useRef(null);
  const readyRef = useRef(false);
  const playlistRef = useRef(playlist);

  useEffect(() => { playlistRef.current = playlist; }, [playlist]);

  // Carrega a API e cria o player
  useEffect(() => {
    function create() {
      if (playerRef.current) return;

      const initialId = (playlist && playlist.length > 0) ? playlist[0] : (videoId || '');

      playerRef.current = new window.YT.Player(iframeRef.current, {
        width: '100%',
        height: '100%',
        videoId: initialId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3,
          mute: 0,
          playsinline: 1,
          // Dica: para loopar playlist via playerVars, é bom informar "playlist"
          ...(playlist && playlist.length > 0 ? { loop: 1, playlist: playlist.join(',') } : {}),
        },
        events: {
          onReady: (ev) => {
            readyRef.current = true;
                     try {
                const init = (window.tvConfig && Number.isFinite(window.tvConfig.restoreVolume))
                  ? window.tvConfig.restoreVolume : 60;
                ev.target.unMute?.();
                ev.target.setVolume?.(init);
              } catch {}
            },
          onStateChange: (ev) => {
            const YT = window.YT;
            if (!YT) return;
            // Se for vídeo único (sem playlist), loop simples
            if (ev.data === YT.PlayerState.ENDED && (!playlistRef.current || playlistRef.current.length === 0)) {
              try { ev.target.seekTo(0); ev.target.playVideo(); } catch {}
            }
          }
        }
      });
    }

    if (window.YT && window.YT.Player) {
      create();
    } else {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Troca de vídeo único
  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    if (playlist && playlist.length > 0) return; // playlist tem prioridade
    if (!videoId) return;
    try { playerRef.current.loadVideoById(videoId); } catch {}
  }, [videoId, playlist]);

// aplica o volume no MESMO player criado pelo componente
useEffect(() => {
  function setVol(v){
    try{
      const p = playerRef.current;
      if (!p) return;
      // alguns WebViews só respeitam mute/unmute no 0
      if (v <= 0) { p.mute?.(); p.setVolume?.(0); }
      else { p.unMute?.(); p.setVolume?.(v); }
    } catch {}
  }
  function onVol(e){
    const v = Number(e?.detail?.v);
    if (Number.isFinite(v)) setVol(Math.max(0, Math.min(100, Math.round(v))));
  }
  window.addEventListener('tv:ytVolume', onVol);
  return () => window.removeEventListener('tv:ytVolume', onVol);
}, []);
  
  // Troca de playlist
  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    if (playlist && playlist.length > 0) {
      try { playerRef.current.loadPlaylist(playlist, 0, 0); } catch {}
    }
  }, [playlist, videoId]);

  return (
    <div className="yt-wrap">
      <div className="yt-inner">
        <div id="yt-player" ref={iframeRef}></div>
      </div>
      <style jsx>{`
        .yt-wrap { position:relative; width:100%; height:100%; }
        .yt-inner { position:absolute; inset:0; }
        #yt-player, #yt-player iframe { width:100%; height:100%; }
      `}</style>
    </div>
  );
}

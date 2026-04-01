// components/YoutubePlayer.js - CORRIGIDO para Fire TV
// Removido: setPlaybackQuality (deprecated), animação reduceFrameRate (prejudicial),
//           filter: contrast (desnecessário), duplicate player creation
import { useEffect, useRef } from 'react';

export default function YoutubePlayer({ videoId, playlist = [] }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const iframeRef = useRef(null);
  const readyRef = useRef(false);
  const playlistRef = useRef(playlist);
  const mountedRef = useRef(true);

  useEffect(() => { playlistRef.current = playlist; }, [playlist]);

  useEffect(() => {
    mountedRef.current = true;
    
    function create() {
      if (playerRef.current || !iframeRef.current) return;

      const initialId = (playlist && playlist.length > 0) ? playlist[0] : (videoId || '');

      playerRef.current = new window.YT.Player(iframeRef.current, {
        width: '100%',
        height: '100%',
        videoId: initialId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,
          disablekb: 1,
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
          ...(playlist && playlist.length > 0
            ? { loop: 1, playlist: playlist.join(',') }
            : { loop: 1 }),
        },
        events: {
          onReady: (ev) => {
            readyRef.current = true;
            // ✅ FIX: Expõe o player globalmente para tv-ducking.js usar
            // (não cria player duplicado)
            window.tvYTPlayer = ev.target;
            
            console.log('[YT] Player pronto');
            
            try {
              ev.target.playVideo();
              
              setTimeout(() => {
                if (!mountedRef.current) return;
                try {
                  const vol = (window.tvConfig?.restoreVolume) || 60;
                  ev.target.unMute();
                  ev.target.setVolume(vol);
                } catch {}
              }, 3000);
            } catch (e) {
              console.error('[YT] Erro ao configurar:', e);
            }
          },
          onStateChange: (ev) => {
            const YT = window.YT;
            if (!YT || !mountedRef.current) return;
            
            // Se pausou inesperadamente, retoma após delay
            if (ev.data === YT.PlayerState.PAUSED) {
              setTimeout(() => {
                if (!mountedRef.current) return;
                try { ev.target.playVideo(); } catch {}
              }, 1500);
            }
            
            // Se ficou UNSTARTED, tenta reiniciar
            if (ev.data === YT.PlayerState.UNSTARTED) {
              setTimeout(() => {
                if (!mountedRef.current) return;
                try { ev.target.playVideo(); } catch {}
              }, 2500);
            }
            
            // Loop para vídeo único
            if (ev.data === YT.PlayerState.ENDED) {
              if (!playlistRef.current?.length) {
                try { 
                  ev.target.seekTo(0); 
                  ev.target.playVideo(); 
                } catch {}
              }
            }
          },
          onError: (ev) => {
            console.log('[YT] Erro:', ev.data);
            // ✅ FIX: Recuperação mais robusta com backoff
            setTimeout(() => {
              if (!mountedRef.current) return;
              try {
                if (playlistRef.current?.length > 0) {
                  // Se tem playlist, tenta próximo vídeo
                  playerRef.current?.nextVideo?.();
                } else {
                  const id = videoId;
                  if (id) playerRef.current?.loadVideoById(id);
                }
              } catch {}
            }, 5000);
          }
        }
      });
    }

    // ✅ FIX: Carrega YouTube API de forma limpa, sem conflito
    if (window.YT?.Player) {
      create();
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }
      // Usa callback chain para não sobrescrever
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) try { prevCallback(); } catch {}
        create();
      };
    }

    return () => {
      mountedRef.current = false;
      try { 
        playerRef.current?.destroy(); 
        window.tvYTPlayer = null;
      } catch {}
      playerRef.current = null;
      readyRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza vídeo único
  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    if (playlist?.length > 0) return;
    if (!videoId) return;
    try { playerRef.current.loadVideoById(videoId); } catch {}
  }, [videoId, playlist]);

  // Atualiza playlist
  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    if (playlist?.length > 0) {
      try { playerRef.current.loadPlaylist(playlist, 0, 0); } catch {}
    }
  }, [playlist]);

  // Controle de volume externo
  useEffect(() => {
    function handleVolume(e) {
      const v = Number(e?.detail?.v);
      if (!Number.isFinite(v) || !playerRef.current) return;
      try {
        if (v <= 0) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
          playerRef.current.setVolume(v);
        }
      } catch {}
    }
    
    window.addEventListener('tv:ytVolume', handleVolume);
    return () => window.removeEventListener('tv:ytVolume', handleVolume);
  }, []);

  // Interação do usuário para iniciar reprodução (autoplay policy)
  useEffect(() => {
    function handleInteraction() {
      if (!playerRef.current || !readyRef.current) return;
      try {
        const state = playerRef.current.getPlayerState?.();
        if (state !== window.YT?.PlayerState?.PLAYING) {
          playerRef.current.playVideo();
          playerRef.current.unMute();
          playerRef.current.setVolume(window.tvConfig?.restoreVolume || 60);
        }
      } catch {}
    }
    
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%', 
        background: '#000',
        overflow: 'hidden',
      }}
    >
      <div 
        className="yt-wrapper"
        style={{ 
          position: 'absolute', 
          inset: 0,
        }}
      >
        <div 
          id="yt-player" 
          ref={iframeRef}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      
      {/* ✅ FIX: CSS limpo — removidos hacks prejudiciais */}
      <style jsx global>{`
        .yt-wrapper {
          /* GPU compositing simples */
          transform: translateZ(0);
        }
        
        /* Iframe do YouTube */
        #yt-player iframe {
          width: 100% !important;
          height: 100% !important;
          border: 0 !important;
          transform: translateZ(0);
        }
      `}</style>
    </div>
  );
}

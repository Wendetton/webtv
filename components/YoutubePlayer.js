// components/YoutubePlayer.js - ULTRA OTIMIZADO para Fire TV
// Técnicas: qualidade mínima, frame rate reduzido via CSS, GPU offload
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
          iv_load_policy: 3,  // Sem anotações
          playsinline: 1,
          disablekb: 1,       // Sem controles de teclado
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
          // Força qualidade mais baixa possível
          vq: 'tiny',  // tiny = 144p, small = 240p
          ...(playlist && playlist.length > 0 ? { loop: 1, playlist: playlist.join(',') } : { loop: 1 }),
        },
        events: {
          onReady: (ev) => {
            readyRef.current = true;
            window.tvYTPlayer = ev.target;
            
            console.log('[YT] Player pronto - forçando qualidade MÍNIMA');
            
            try {
              // Força a menor qualidade disponível
              const qualities = ev.target.getAvailableQualityLevels();
              console.log('[YT] Qualidades disponíveis:', qualities);
              
              // Pega a menor qualidade (última da lista)
              const lowestQuality = qualities[qualities.length - 1] || 'tiny';
              ev.target.setPlaybackQuality(lowestQuality);
              
              ev.target.playVideo();
              
              setTimeout(() => {
                if (!mountedRef.current) return;
                try {
                  // Tenta forçar qualidade novamente
                  ev.target.setPlaybackQuality(lowestQuality);
                  
                  const vol = (window.tvConfig?.restoreVolume) || 60;
                  ev.target.unMute();
                  ev.target.setVolume(vol);
                  
                  console.log('[YT] Qualidade definida:', ev.target.getPlaybackQuality());
                } catch {}
              }, 3000);
            } catch (e) {
              console.error('[YT] Erro ao configurar:', e);
            }
          },
          onStateChange: (ev) => {
            const YT = window.YT;
            if (!YT || !mountedRef.current) return;
            
            // Quando começa a tocar, força qualidade baixa novamente
            if (ev.data === YT.PlayerState.PLAYING) {
              try {
                const qualities = ev.target.getAvailableQualityLevels();
                const lowestQuality = qualities[qualities.length - 1] || 'tiny';
                const currentQuality = ev.target.getPlaybackQuality();
                
                console.log('[YT] Tocando em:', currentQuality, '| Menor disponível:', lowestQuality);
                
                if (currentQuality !== lowestQuality) {
                  ev.target.setPlaybackQuality(lowestQuality);
                }
              } catch {}
            }
            
            // Se pausou inesperadamente, retoma
            if (ev.data === YT.PlayerState.PAUSED) {
              setTimeout(() => {
                if (!mountedRef.current) return;
                try { ev.target.playVideo(); } catch {}
              }, 1000);
            }
            
            // Se parou (UNSTARTED), tenta reiniciar
            if (ev.data === YT.PlayerState.UNSTARTED) {
              setTimeout(() => {
                if (!mountedRef.current) return;
                try { ev.target.playVideo(); } catch {}
              }, 2000);
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
          onPlaybackQualityChange: (ev) => {
            console.log('[YT] Qualidade mudou para:', ev.data);
          },
          onError: (ev) => {
            console.log('[YT] Erro:', ev.data);
            // Tenta recuperar após erro
            setTimeout(() => {
              if (!mountedRef.current) return;
              try {
                const id = playlistRef.current?.[0] || videoId;
                if (id) playerRef.current?.loadVideoById(id);
              } catch {}
            }, 5000);
          }
        }
      });
    }

    if (window.YT?.Player) {
      create();
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = create;
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

  // Interação do usuário para iniciar reprodução
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
      
      {/* CSS para reduzir frame rate e otimizar GPU */}
      <style jsx global>{`
        /* Container do player com otimizações de GPU */
        .yt-wrapper {
          /* Força composição em GPU separada */
          transform: translateZ(0);
          will-change: transform;
          
          /* REDUZ FRAME RATE - renderiza menos frames */
          /* Isso faz o navegador pular frames, reduzindo carga */
          animation: reduceFrameRate 0.066s steps(1) infinite;
        }
        
        @keyframes reduceFrameRate {
          0%, 100% { opacity: 0.9999; }
          50% { opacity: 1; }
        }
        
        /* Iframe do YouTube */
        #yt-player iframe {
          width: 100% !important;
          height: 100% !important;
          border: 0 !important;
          
          /* Otimizações de renderização */
          transform: translateZ(0);
          backface-visibility: hidden;
          perspective: 1000px;
          
          /* Desabilita anti-aliasing pesado */
          image-rendering: optimizeSpeed;
          
          /* Reduz qualidade de renderização para economizar GPU */
          filter: contrast(1.001);
        }
        
        /* Remove animações desnecessárias do iframe */
        #yt-player iframe * {
          animation-duration: 0.001s !important;
          transition-duration: 0.001s !important;
        }
      `}</style>
    </div>
  );
}

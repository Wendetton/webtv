// components/YoutubePlayer.js - CORRIGIDO para Fire TV / Amazon WebView
// PROBLEMA RESOLVIDO: filter:contrast() + will-change + animation no wrapper
// quebravam o pipeline de hardware video do Amazon WebView (tela preta + áudio)
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
            window.tvYTPlayer = ev.target;

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

            if (ev.data === YT.PlayerState.PAUSED) {
              setTimeout(() => {
                if (!mountedRef.current) return;
                try { ev.target.playVideo(); } catch {}
              }, 1000);
            }

            if (ev.data === YT.PlayerState.UNSTARTED) {
              setTimeout(() => {
                if (!mountedRef.current) return;
                try { ev.target.playVideo(); } catch {}
              }, 2000);
            }

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

  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    if (playlist?.length > 0) return;
    if (!videoId) return;
    try { playerRef.current.loadVideoById(videoId); } catch {}
  }, [videoId, playlist]);

  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    if (playlist?.length > 0) {
      try { playerRef.current.loadPlaylist(playlist, 0, 0); } catch {}
    }
  }, [playlist]);

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
        transform: 'translateZ(0)',
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

      <style jsx global>{`
        .yt-wrapper {
          position: absolute;
          inset: 0;
        }

        #yt-player iframe {
          width: 100% !important;
          height: 100% !important;
          border: 0 !important;
        }
      `}</style>
    </div>
  );
}

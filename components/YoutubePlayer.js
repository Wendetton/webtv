
// ======= components/YoutubePlayer.js (FINAL FIX) =======
// Controles SEMPRE visíveis (controls:1). Ocupa 100% do container.
// Habilita enablejsapi=1 para permitir ajuste de volume via tv-ducking.js.

import YouTube from "react-youtube";

export default function YoutubePlayer({ videoId }) {
  return (
    <YouTube
      videoId={videoId}
      opts={{
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          mute: 0,
          enablejsapi: 1,
        },
      }}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

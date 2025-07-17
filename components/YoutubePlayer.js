import YouTube from "react-youtube";

export default function YoutubePlayer({ videoId }) {
  return (
    <YouTube
      videoId={videoId}
      opts={{
        width: "100%",
        height: "calc(100vh - 160px)", // Deixa espaço para histórico + banner + controles do vídeo!
        playerVars: {
          autoplay: 1,
          controls: 1, // Mostra controles do player (play/pause)
          modestbranding: 1,
          rel: 0
        }
      }}
      style={{ width: "100%", height: "calc(100vh - 160px)" }}
    />
  );
}

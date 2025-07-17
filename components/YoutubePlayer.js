import YouTube from "react-youtube";

export default function YoutubePlayer({ videoId }) {
  // Preenche a tela, mantendo proporção 16:9 SEM erros de sintaxe
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#111",
        zIndex: 1,
      }}
    >
      <div
        style={{
          width: "100vw",
          height: "100vh",
          maxWidth: "177.78vh", // 16/9 proporção (100vh * 16 / 9)
          maxHeight: "100vh",
        }}
      >
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
            },
          }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}

import YouTube from "react-youtube";

export default function YoutubePlayer({ videoId }) {
  // Estilo para preencher a tela mantendo proporção 16:9
  return (
    <div style={{
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
    }}>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          maxWidth: "177.78vh",  // 16/9 = 1.7778... garante que nunca ultrapasse o limite vertical
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
              rel: 0
            }
          }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}

    </div>
  );
}

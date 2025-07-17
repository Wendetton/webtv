import YouTube from "react-youtube";

export default function YoutubePlayer({ videoId }) {
  // Calcula altura ideal em 16:9
  const aspect = 9 / 16;
  // Você pode ajustar 'vw' e 'vh' conforme a tela (aqui prioriza largura total)
  const width = "100vw";
  const height = "calc(100vw * 0.5625)"; // 0.5625 = 9/16

  return (
    <div style={{
      position: "absolute",
      top: 0,
      left: 0,
      width: width,
      height: height,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#111"
    }}>
      <YouTube
        videoId={videoId}
        opts={{
          width: "100vw",
          height: "calc(100vw * 0.5625)",
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0
          }
        }}
      />
    </div>
  );
}

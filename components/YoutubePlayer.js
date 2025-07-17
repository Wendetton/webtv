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
          controls: 0,
          modestbranding: 1,
          rel: 0
        }
      }}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

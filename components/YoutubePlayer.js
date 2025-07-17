import YouTube from "react-youtube";

export default function YoutubePlayer({ videoId, width, height }) {
  return (
    <YouTube
      videoId={videoId}
      opts={{
        width: width,
        height: height,
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
        }
      }}
      style={{ width: width, height: height }}
    />
  );
}

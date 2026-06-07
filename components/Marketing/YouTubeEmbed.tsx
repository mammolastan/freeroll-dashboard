// components/Marketing/YouTubeEmbed.tsx

interface YouTubeEmbedProps {
  embedId: string;
  title: string;
  autoplay?: boolean;
}

export default function YouTubeEmbed({
  embedId,
  title,
  autoplay = false,
}: YouTubeEmbedProps) {
  const params = new URLSearchParams();
  if (autoplay) {
    params.set("autoplay", "1");
    params.set("mute", "1"); // Required for autoplay in most browsers
  }

  const queryString = params.toString();
  const src = `https://www.youtube.com/embed/${embedId}${queryString ? `?${queryString}` : ""}`;

  return (
    <div className="relative w-full pt-[56.25%]">
      <iframe
        className="absolute top-0 left-0 w-full h-full rounded-lg"
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

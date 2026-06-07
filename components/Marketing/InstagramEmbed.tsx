// components/Marketing/InstagramEmbed.tsx

interface InstagramEmbedProps {
  embedId: string;
  title: string;
}

export default function InstagramEmbed({ embedId, title }: InstagramEmbedProps) {
  return (
    <div className="relative w-full max-h-[70vh] aspect-[4/5] mx-auto" style={{ maxWidth: "400px" }}>
      <iframe
        className="absolute top-0 left-0 w-full h-full rounded-lg border-0"
        src={`https://www.instagram.com/p/${embedId}/embed/`}
        title={title}
        allowFullScreen
        style={{ overflow: "hidden" }}
      />
    </div>
  );
}

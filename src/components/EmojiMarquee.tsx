import { useMemo } from "react";

type EmojiMarqueeProps = {
  speed?: "slow" | "medium" | "fast";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const EMOJIS = [
  "😀","😃","😄","😁","😆","😅","😂","🙂","😊","😇",
  "😉","🥳","😎","🤩","🤗","😺","😸","😹","😻","😼","😽",
  "✨","💫","🎉","🎊","🌟","🚀","💥","🔥","💎","🪄"
];

export const EmojiMarquee = ({ speed = "fast", size = "lg", className = "" }: EmojiMarqueeProps) => {
  const fontSize = useMemo(() => {
    switch (size) {
      case "sm": return "text-3xl";
      case "md": return "text-4xl";
      case "lg":
      default: return "text-5xl";
    }
  }, [size]);

  const duration = useMemo(() => {
    switch (speed) {
      case "slow": return 16;
      case "medium": return 12;
      case "fast":
      default: return 8;
    }
  }, [speed]);

  // Repeat emojis to make a long track
  const track = useMemo(() => Array(10).fill(EMOJIS).flat().join("   "), []);

  return (
    <div className={`relative w-full overflow-hidden ${className}`} aria-hidden>
      <div className="relative h-16">
        {/* Two identical tracks for seamless loop */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap will-change-transform ${fontSize}`}
          style={{
            width: "200%",
            animation: `marquee-right ${duration}s linear infinite`,
          }}
        >
          <span className="opacity-90">
            {track}
          </span>
        </div>
        <div
          className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap will-change-transform ${fontSize}`}
          style={{
            left: "-100%",
            width: "200%",
            animation: `marquee-right ${duration}s linear infinite`,
          }}
        >
          <span className="opacity-90">
            {track}
          </span>
        </div>
      </div>
    </div>
  );
};

export default EmojiMarquee;

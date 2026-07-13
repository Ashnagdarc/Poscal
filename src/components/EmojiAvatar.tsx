import { useEffect, useMemo, useState } from "react";

type EmojiAvatarProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  intervalMs?: number;
};

const HAPPY_EMOJIS = [
  "😀",
  "😄",
  "😁",
  "😊",
  "😆",
  "🙂",
  "😉",
  "🤗",
  "🥳",
  "😺",
];

export const EmojiAvatar = ({ size = "md", className = "", intervalMs = 2400 }: EmojiAvatarProps) => {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * HAPPY_EMOJIS.length));

  const textSize = useMemo(() => {
    switch (size) {
      case "sm":
        return "text-2xl";
      case "md":
        return "text-3xl";
      case "lg":
      default:
        return "text-4xl";
    }
  }, [size]);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % HAPPY_EMOJIS.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return (
    <span
      aria-hidden="true"
      className={`${textSize} transition-all duration-500 ease-out will-change-transform ${className}`}
      style={{
        display: "inline-block",
        transform: "translateZ(0)",
      }}
    >
      {HAPPY_EMOJIS[index]}
    </span>
  );
};

export default EmojiAvatar;

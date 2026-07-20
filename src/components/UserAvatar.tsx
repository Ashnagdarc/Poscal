import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/mediaUrl";

type UserAvatarProps = {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "h-10 w-10 text-sm",
  md: "h-11 w-11 text-base",
  lg: "h-24 w-24 text-3xl",
} as const;

const ICON_SIZE = {
  sm: "h-5 w-5",
  md: "h-5 w-5",
  lg: "h-12 w-12",
} as const;

const getInitials = (name?: string | null, email?: string | null) => {
  const source = name?.trim() || email?.trim() || "";
  if (!source) return "";

  if (source.includes("@")) {
    return source.slice(0, 2).toUpperCase();
  }

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

export const UserAvatar = ({
  name,
  email,
  src,
  size = "md",
  className,
}: UserAvatarProps) => {
  const initials = getInitials(name, email);
  const imageSrc = resolveMediaUrl(src);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageSrc) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/15 font-semibold text-brand",
        SIZE_CLASS[size],
        className,
      )}
      aria-hidden={showImage || initials ? undefined : true}
    >
      {showImage ? (
        <img
          src={imageSrc!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : initials ? (
        <span>{initials}</span>
      ) : (
        <User className={cn("text-brand", ICON_SIZE[size])} />
      )}
    </div>
  );
};

import { ReactNode } from "react";
import { Link } from "react-router-dom";
import poscalLogoLight from "@/assets/poscal-logo-light.png";
import { cn } from "@/lib/utils";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  banner?: ReactNode;
}

export const AuthLayout = ({ title, subtitle, children, footer, banner }: AuthLayoutProps) => {
  return (
    <div className="flex min-h-dvh flex-col bg-black px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="animate-fade-in text-center">
          <div className="relative mx-auto mb-8 h-16 w-full max-w-[340px] overflow-hidden sm:h-[4.5rem]">
            <img
              src={poscalLogoLight}
              alt="Poscal"
              className="absolute left-1/2 top-1/2 w-full max-w-[340px] -translate-x-1/2 -translate-y-1/2 brightness-110 contrast-125"
            />
          </div>

          <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/70 sm:max-w-sm">
            {subtitle}
          </p>
        </div>

        <div className="mt-8 animate-slide-up space-y-6">
          {banner}
          {children}
          <div className="animate-fade-in text-center" style={{ animationDelay: "150ms" }}>
            {footer}
          </div>
        </div>
      </main>
    </div>
  );
};

interface AuthFooterProps {
  prompt: string;
  linkLabel: string;
  linkTo: string;
  guestHref?: string;
}

export const AuthFooter = ({ prompt, linkLabel, linkTo, guestHref = "/" }: AuthFooterProps) => {
  return (
    <div className="space-y-5 pt-2">
      <p className="text-sm text-white/70">
        {prompt}{" "}
        <Link
          to={linkTo}
          className="font-semibold text-brand transition-colors hover:text-brand/80"
        >
          {linkLabel}
        </Link>
      </p>
      <Link
        to={guestHref}
        className={cn(
          "inline-flex min-h-11 items-center justify-center px-4 text-sm text-white/60 transition-colors hover:text-white",
        )}
      >
        Continue as guest →
      </Link>
    </div>
  );
};

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
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand/30 via-brand/10 to-background"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 top-32 h-48 w-48 rounded-full bg-brand/15 blur-3xl"
        />

        <div className="relative mx-auto w-full max-w-md px-6 pb-8 pt-14 text-center animate-fade-in">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 shadow-medium backdrop-blur-sm">
            <img
              src={poscalLogoLight}
              alt="Poscal"
              className="h-14 w-14 object-contain"
            />
          </div>
          <p className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.24em] text-brand">
            Poscal
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 px-6 pb-8 animate-slide-up">
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-soft">
          <div className="space-y-5 p-5 sm:p-6">
            {banner}
            {children}
          </div>
        </div>

        <div className="mt-8 animate-fade-in text-center" style={{ animationDelay: "150ms" }}>
          {footer}
        </div>
      </div>
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
    <div className="space-y-4 border-t border-border/60 pt-6">
      <p className="text-sm text-muted-foreground">
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
          "inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground",
        )}
      >
        Continue as guest →
      </Link>
    </div>
  );
};

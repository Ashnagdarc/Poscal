import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  leading?: ReactNode;
  logoSrc?: string;
  logoAlt?: string;
  actions?: ReactNode;
  className?: string;
  sticky?: boolean;
}

export const PageHeader = ({
  title,
  subtitle,
  icon,
  leading,
  logoSrc,
  logoAlt = "Poscal",
  actions,
  className,
  sticky = true,
}: PageHeaderProps) => {
  return (
    <header
      className={cn(
        "z-30 shrink-0 px-6 pb-6 pt-12",
        sticky && "sticky top-0 bg-background/85 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 md:max-w-3xl">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={logoAlt}
              className="h-10 w-10 shrink-0 rounded-xl object-contain"
            />
          ) : icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
};

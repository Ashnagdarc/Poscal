import { ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldClassName =
  "h-12 w-full rounded-xl border border-border/60 bg-secondary/60 px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-secondary/80 focus:border-brand focus:bg-background focus:ring-2 focus:ring-brand/20";

interface AuthFieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}

export const AuthField = ({ id, label, hint, error, children }: AuthFieldProps) => {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
};

interface AuthPasswordFieldProps {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  showPassword: boolean;
  onTogglePassword: () => void;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  minLength?: number;
}

export const AuthPasswordField = ({
  id,
  label,
  value,
  onChange,
  placeholder = "Enter your password",
  autoComplete = "current-password",
  showPassword,
  onTogglePassword,
  hint,
  error,
  required = true,
  minLength,
}: AuthPasswordFieldProps) => {
  return (
    <AuthField id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className={cn(fieldClassName, "pr-12")}
        />
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </AuthField>
  );
};

export const authInputClassName = fieldClassName;

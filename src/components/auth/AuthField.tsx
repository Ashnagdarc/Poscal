import { ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldClassName =
  "h-14 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-base text-white outline-none transition-colors placeholder:text-white/35 hover:border-white/15 hover:bg-white/[0.08] focus:border-brand focus:bg-white/[0.08] focus:ring-2 focus:ring-brand/25";

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
      <label htmlFor={id} className="mb-2.5 ml-1 block text-sm font-semibold text-white/90">
        {label}
      </label>
      {children}
      {hint ? <p className="ml-1 mt-2 text-xs text-white/50">{hint}</p> : null}
      {error ? <p className="ml-1 mt-2 text-xs text-red-400">{error}</p> : null}
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
          className={cn(fieldClassName, "pr-14")}
        />
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </AuthField>
  );
};

export const authInputClassName = fieldClassName;

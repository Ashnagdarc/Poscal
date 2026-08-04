import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AuthFooter, AuthLayout } from "@/components/auth/AuthLayout";
import { AuthField, AuthPasswordField, authInputClassName } from "@/components/auth/AuthField";
import { useAuth } from "@/contexts/AuthContext";

type SignInLocationState = {
  email?: string;
  fromSignup?: boolean;
  from?: string;
  reason?: string;
};

const safeInternalPath = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
};

const SignIn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fromSignupBanner, setFromSignupBanner] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const locationState = (location.state as SignInLocationState | null) ?? null;

  const returnTo = useMemo(() => {
    return (
      safeInternalPath(searchParams.get("returnTo"))
      ?? safeInternalPath(locationState?.from)
      ?? "/"
    );
  }, [searchParams, locationState?.from]);

  const reasonBanner = useMemo(() => {
    const reason = searchParams.get("reason") ?? locationState?.reason ?? "";
    switch (reason) {
      case "session":
        return "Your session expired. Sign in again to continue.";
      case "journal":
        return "Sign in to open your trading journal.";
      case "protected":
        return "Sign in to continue to that page.";
      default:
        return "";
    }
  }, [searchParams, locationState?.reason]);

  const bannerMessage = useMemo(() => {
    if (fromSignupBanner || searchParams.get("fromSignup") === "1") {
      return "Account created. Enter the verification code we emailed you — then you can sign in anytime.";
    }
    return reasonBanner;
  }, [fromSignupBanner, searchParams, reasonBanner]);

  useEffect(() => {
    const stateEmail = locationState?.email?.trim();
    if (stateEmail) {
      setEmail(stateEmail);
    }
    if (locationState?.fromSignup) {
      setFromSignupBanner(true);
    }
  }, [locationState]);

  useEffect(() => {
    // Strip legacy ?email= / ?fromSignup= from the URL so PII is not left in history/logs (P-026).
    const legacyEmail = searchParams.get("email");
    const legacyFromSignup = searchParams.get("fromSignup");
    if (!legacyEmail && !legacyFromSignup) {
      return;
    }

    if (legacyEmail) {
      setEmail((current) => current || legacyEmail);
    }
    if (legacyFromSignup === "1") {
      setFromSignupBanner(true);
    }

    const next = new URLSearchParams(searchParams);
    next.delete("email");
    next.delete("fromSignup");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!email || !password) {
      const message = "Please fill in all fields";
      setFormError(message);
      toast.error(message, { duration: 5000 });
      return;
    }

    if (password.length < 8) {
      const message = "Password must be at least 8 characters";
      setFormError(message);
      toast.error(message, { duration: 5000 });
      return;
    }

    setIsLoading(true);

    try {
      const { error, signedIn } = await signIn(email, password);

      if (error) {
        setFormError(error);
        toast.error(error, { duration: 6000 });
        return;
      }

      if (!signedIn) {
        toast.success("Check your email for a verification code");
        navigate("/verify-email", {
          replace: true,
          state: {
            email: email.trim().toLowerCase(),
            returnTo,
          },
        });
        return;
      }

      toast.success("Welcome back!");
      navigate(returnTo, { replace: true });
    } catch (err: unknown) {
      void err;
      const message = "Invalid email or password";
      setFormError(message);
      toast.error(message, { duration: 6000 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue"
      banner={
        bannerMessage ? (
          <div className="rounded-xl border border-brand/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
            {bannerMessage}
          </div>
        ) : null
      }
      footer={
        <AuthFooter
          prompt="Don't have an account?"
          linkLabel="Sign Up"
          linkTo={returnTo !== "/" ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup"}
        />
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {formError ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          >
            {formError}
          </div>
        ) : null}

        <AuthField id="signin-email" label="Email address">
          <input
            id="signin-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className={authInputClassName}
          />
        </AuthField>

        <AuthPasswordField
          id="signin-password"
          label="Password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (formError) setFormError(null);
          }}
          placeholder="Enter your password"
          autoComplete="current-password"
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((current) => !current)}
        />

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-1 h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-foreground/30 border-t-brand-foreground" />
              Signing in...
            </span>
          ) : (
            "Sign In"
          )}
        </button>
      </form>
    </AuthLayout>
  );
};

export default SignIn;

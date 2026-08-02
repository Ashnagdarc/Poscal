import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AuthFooter, AuthLayout } from "@/components/auth/AuthLayout";
import { AuthField, AuthPasswordField, authInputClassName } from "@/components/auth/AuthField";
import { useAuth } from "@/contexts/AuthContext";

type SignInLocationState = {
  email?: string;
  fromSignup?: boolean;
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

  const locationState = (location.state as SignInLocationState | null) ?? null;

  const bannerMessage = useMemo(() => {
    if (fromSignupBanner || searchParams.get("fromSignup") === "1") {
      // Email verification is not enforced by the Password provider (ETH-006 / AIS-015).
      return "Account created. You can sign in with your email and password.";
    }
    return "";
  }, [fromSignupBanner, searchParams]);

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

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error(error);
      setIsLoading(false);
      return;
    }

    toast.success("Welcome back!");
    navigate("/");
    setIsLoading(false);
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
          linkTo="/signup"
        />
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField id="signin-email" label="Email address">
          <input
            id="signin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
          onChange={setPassword}
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

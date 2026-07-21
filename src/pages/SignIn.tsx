import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AuthFooter, AuthLayout } from "@/components/auth/AuthLayout";
import { AuthField, AuthPasswordField, authInputClassName } from "@/components/auth/AuthField";
import { useAuth } from "@/contexts/AuthContext";

const SignIn = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const bannerMessage = useMemo(() => {
    if (searchParams.get("fromSignup") === "1") {
      return "Account created. Verify your email, then sign in.";
    }
    return "";
  }, [searchParams]);

  useEffect(() => {
    const prefilledEmail = searchParams.get("email");
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      if (error.includes("Invalid credentials") || error.includes("Invalid login credentials")) {
        toast.error("Invalid email or password");
      } else if (error.includes("Email not confirmed")) {
        toast.error("Please check your email to confirm your account");
      } else {
        toast.error(error);
      }
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

        <button
          type="submit"
          disabled={isLoading}
          className="mt-1 h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
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

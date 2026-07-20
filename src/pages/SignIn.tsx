import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import poscalLogo from "@/assets/poscal-logo.png";
import { toast } from "sonner";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
    <div className="flex min-h-screen flex-col bg-background px-6">
      <div className="animate-fade-in pb-8 pt-16 text-center">
        <img
          src={poscalLogo}
          alt="Poscal"
          className="mx-auto mb-6 h-16 w-16 rounded-2xl object-contain"
        />
        <p className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-brand">
          Poscal
        </p>
        <h1 className="mb-2 font-display text-3xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-muted-foreground">Sign in to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md animate-slide-up space-y-5">
        {bannerMessage && (
          <div className="rounded-2xl border border-brand/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
            {bannerMessage}
          </div>
        )}

        <div>
          <label className="mb-2.5 ml-1 block text-sm font-semibold text-foreground">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="h-14 w-full rounded-2xl border border-transparent bg-secondary px-5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-secondary/80 focus:border-brand focus:bg-card"
          />
        </div>

        <div>
          <label className="mb-2.5 ml-1 block text-sm font-semibold text-foreground">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              minLength={6}
              className="h-14 w-full rounded-2xl border border-transparent bg-secondary px-5 pr-14 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-secondary/80 focus:border-brand focus:bg-card"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-6 h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-foreground/30 border-t-brand-foreground" />
              Signing in...
            </span>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <div
        className="mx-auto mt-auto w-full max-w-md animate-fade-in pb-8 text-center"
        style={{ animationDelay: "200ms" }}
      >
        <div className="mt-8 border-t border-border pt-6">
          <p className="text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="font-semibold text-brand transition-colors hover:text-brand/80">
              Sign Up
            </Link>
          </p>
          <Link
            to="/"
            className="mt-4 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Continue as guest →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignIn;

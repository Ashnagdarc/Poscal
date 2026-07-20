import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import poscalLogo from "@/assets/poscal-logo.png";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const SignUp = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);

    const { error } = await signUp(email, password, name);

    if (error) {
      if (error.includes("User already registered") || error.includes("already exists")) {
        toast.error("An account with this email already exists");
      } else {
        toast.error(error);
      }
      setIsLoading(false);
      return;
    }

    toast.success("Account created!");
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
        <p className="mb-2 font-display text-sm font-semibold tracking-[0.2em] text-brand uppercase">
          Poscal
        </p>
        <h1 className="mb-2 font-display text-3xl font-bold tracking-tight text-foreground">
          Create account
        </h1>
        <p className="text-muted-foreground">Start sizing trades with confidence</p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md animate-slide-up space-y-4">
        <div>
          <label className="mb-2.5 ml-1 block text-sm font-semibold text-foreground">
            Full Name <span className="font-normal text-muted-foreground">(Optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className="h-14 w-full rounded-2xl border border-transparent bg-secondary px-5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brand focus:bg-card hover:bg-secondary/80"
          />
        </div>

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
            className="h-14 w-full rounded-2xl border border-transparent bg-secondary px-5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brand focus:bg-card hover:bg-secondary/80"
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
              placeholder="Create a strong password"
              autoComplete="new-password"
              required
              minLength={6}
              className="h-14 w-full rounded-2xl border border-transparent bg-secondary px-5 pr-14 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brand focus:bg-card hover:bg-secondary/80"
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
          <p className="ml-1 mt-2 text-xs text-muted-foreground">Must be at least 6 characters</p>
        </div>

        <div>
          <label className="mb-2.5 ml-1 block text-sm font-semibold text-foreground">
            Confirm Password
          </label>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            required
            minLength={6}
            className="h-14 w-full rounded-2xl border border-transparent bg-secondary px-5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brand focus:bg-card hover:bg-secondary/80"
          />
          {confirmPassword.length > 0 && confirmPassword !== password && (
            <p className="ml-1 mt-2 text-xs text-destructive">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || (confirmPassword.length > 0 && confirmPassword !== password)}
          className="mt-6 h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-foreground/30 border-t-brand-foreground" />
              Creating account...
            </span>
          ) : "Create Account"}
        </button>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          By signing up, you agree to our{" "}
          <Link to="/terms" className="text-brand hover:underline">
            Terms
          </Link>
          {" "}and{" "}
          <Link to="/privacy" className="text-brand hover:underline">
            Privacy Policy
          </Link>
        </p>
      </form>

      <div className="mx-auto mt-auto w-full max-w-md animate-fade-in pb-8 text-center" style={{ animationDelay: "200ms" }}>
        <div className="mt-8 border-t border-border pt-6">
          <p className="text-muted-foreground">
            Already have an account?{" "}
            <Link to="/signin" className="font-semibold text-brand transition-colors hover:text-brand/80">
              Sign In
            </Link>
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground">
            Continue as guest →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignUp;

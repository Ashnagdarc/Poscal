import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { EmojiAvatar } from "@/components/EmojiAvatar";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const SignUp = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    setIsLoading(true);

    const { error } = await signUp(email, password, name);

    if (error) {
      if (error.message.includes("User already registered")) {
        toast.error("An account with this email already exists");
      } else {
        toast.error(error.message);
      }
      setIsLoading(false);
      return;
    }

    toast.success("Account created! Please check your email to verify.");
    navigate("/signin");
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/50 flex flex-col px-6">
      {/* Header */}
      <div className="pt-16 pb-8 text-center animate-fade-in">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20">
          <EmojiAvatar size="lg" />
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-2 tracking-tight">Create Account</h1>
        <p className="text-muted-foreground text-lg">Start your trading journey</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 animate-slide-up max-w-md mx-auto w-full">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2.5 ml-1">
            Full Name <span className="text-muted-foreground font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            autoComplete="name"
            className="w-full h-14 px-5 bg-secondary/80 backdrop-blur-sm text-foreground text-base rounded-2xl border-2 border-transparent outline-none transition-all duration-300 focus:border-primary focus:bg-secondary placeholder:text-muted-foreground/60 hover:bg-secondary"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-2.5 ml-1">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="w-full h-14 px-5 bg-secondary/80 backdrop-blur-sm text-foreground text-base rounded-2xl border-2 border-transparent outline-none transition-all duration-300 focus:border-primary focus:bg-secondary placeholder:text-muted-foreground/60 hover:bg-secondary"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-2.5 ml-1">
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
              className="w-full h-14 px-5 pr-14 bg-secondary/80 backdrop-blur-sm text-foreground text-base rounded-2xl border-2 border-transparent outline-none transition-all duration-300 focus:border-primary focus:bg-secondary placeholder:text-muted-foreground/60 hover:bg-secondary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-background/50"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 ml-1">Must be at least 6 characters</p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-14 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground text-base font-semibold rounded-2xl transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25 mt-6"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></span>
              Creating account...
            </span>
          ) : "Create Account"}
        </button>

        <p className="text-xs text-center text-muted-foreground pt-2">
          By signing up, you agree to our{" "}
          <button type="button" onClick={() => window.open('/terms', '_blank')} className="text-primary hover:underline">
            Terms
          </button>
          {" "}and{" "}
          <button type="button" onClick={() => window.open('/privacy', '_blank')} className="text-primary hover:underline">
            Privacy Policy
          </button>
        </p>
      </form>

      {/* Footer */}
      <div className="mt-auto pb-8 text-center animate-fade-in max-w-md mx-auto w-full" style={{ animationDelay: "200ms" }}>
        <div className="mt-8 pt-6 border-t border-border/50">
          <p className="text-muted-foreground">
            Already have an account?{" "}
            <Link to="/signin" className="text-primary font-semibold hover:text-primary/80 transition-colors">
              Sign In
            </Link>
          </p>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mt-4 inline-block transition-colors">
            Continue as guest →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignUp;

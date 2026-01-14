import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { EmojiAvatar } from "@/components/EmojiAvatar";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const SignIn = () => {
  const navigate = useNavigate();
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);

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
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Invalid email or password");
      } else if (error.message.includes("Email not confirmed")) {
        toast.error("Please check your email to confirm your account");
      } else {
        toast.error(error.message);
      }
      setIsLoading(false);
      return;
    }

    toast.success("Welcome back!");
    navigate("/");
    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast.error("Please enter your email address");
      return;
    }

    setIsResetting(true);
    const { error } = await resetPassword(resetEmail);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset email sent! Check your inbox.");
      setShowForgotPassword(false);
      setResetEmail("");
    }
    setIsResetting(false);
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/50 flex flex-col px-6">
        {/* Header */}
        <div className="pt-12 pb-8 animate-fade-in max-w-md mx-auto w-full">
          <button
            onClick={() => setShowForgotPassword(false)}
            className="w-11 h-11 bg-secondary/80 backdrop-blur-sm rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 hover:bg-secondary mb-8 border border-border/50"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Reset Password</h1>
            <p className="text-muted-foreground text-base">We'll send you a link to reset your password</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleResetPassword} className="space-y-5 animate-slide-up max-w-md mx-auto w-full">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2.5 ml-1">
              Email Address
            </label>
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="w-full h-14 px-5 bg-secondary/80 backdrop-blur-sm text-foreground text-base rounded-2xl border-2 border-transparent outline-none transition-all duration-300 focus:border-primary focus:bg-secondary placeholder:text-muted-foreground/60 hover:bg-secondary"
            />
          </div>

          <button
            type="submit"
            disabled={isResetting}
            className="w-full h-14 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground text-base font-semibold rounded-2xl transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25 mt-6"
          >
            {isResetting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></span>
                Sending...
              </span>
            ) : "Send Reset Link"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-auto pb-8 text-center max-w-md mx-auto w-full">
          <button
            onClick={() => setShowForgotPassword(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to{" "}
            <span className="text-primary font-semibold">Sign In</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/50 flex flex-col px-6">
      {/* Header */}
      <div className="pt-16 pb-8 text-center animate-fade-in">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20">
          <EmojiAvatar size="lg" />
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-2 tracking-tight">Welcome Back</h1>
        <p className="text-muted-foreground text-lg">Sign in to continue trading</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up max-w-md mx-auto w-full">
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
              placeholder="Enter your password"
              autoComplete="current-password"
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
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-14 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground text-base font-semibold rounded-2xl transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25 mt-6"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></span>
              Signing in...
            </span>
          ) : "Sign In"}
        </button>
      </form>

      {/* Footer */}
      <div className="mt-auto pb-8 text-center animate-fade-in max-w-md mx-auto w-full" style={{ animationDelay: "200ms" }}>
        <div className="mt-8 pt-6 border-t border-border/50">
          <p className="text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary font-semibold hover:text-primary/80 transition-colors">
              Sign Up
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

export default SignIn;
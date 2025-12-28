import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Calculator, ArrowLeft } from "lucide-react";
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
      <div className="min-h-screen bg-background flex flex-col px-6">
        {/* Header */}
        <div className="pt-12 pb-8 animate-fade-in">
          <button
            onClick={() => setShowForgotPassword(false)}
            className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 mb-8"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-3xl font-bold text-foreground mb-2">Reset Password</h1>
          <p className="text-muted-foreground">Enter your email to receive a reset link</p>
        </div>

        {/* Form */}
        <form onSubmit={handleResetPassword} className="space-y-4 animate-slide-up">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2 ml-1">
              Email
            </label>
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full h-14 px-4 bg-secondary text-foreground text-lg font-medium rounded-2xl border-0 outline-none transition-all duration-300 focus:ring-2 focus:ring-foreground/10 placeholder:text-muted-foreground/50"
            />
          </div>

          <button
            type="submit"
            disabled={isResetting}
            className="w-full h-14 bg-foreground text-background text-lg font-semibold rounded-2xl transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
          >
            {isResetting ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowForgotPassword(false)}
            className="text-muted-foreground"
          >
            Back to{" "}
            <span className="text-foreground font-semibold">Sign In</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-6">
      {/* Header */}
      <div className="pt-16 pb-12 text-center animate-fade-in">
        <div className="w-16 h-16 bg-foreground rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Calculator className="w-8 h-8 text-background" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h1>
        <p className="text-muted-foreground">Sign in to your account</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 animate-slide-up">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2 ml-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full h-14 px-4 bg-secondary text-foreground text-lg font-medium rounded-2xl border-0 outline-none transition-all duration-300 focus:ring-2 focus:ring-foreground/10 placeholder:text-muted-foreground/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2 ml-1">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full h-14 px-4 pr-12 bg-secondary text-foreground text-lg font-medium rounded-2xl border-0 outline-none transition-all duration-300 focus:ring-2 focus:ring-foreground/10 placeholder:text-muted-foreground/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowForgotPassword(true)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors ml-1"
        >
          Forgot password?
        </button>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-14 bg-foreground text-background text-lg font-semibold rounded-2xl transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {/* Footer */}
      <div className="mt-auto pb-8 text-center animate-fade-in" style={{ animationDelay: "200ms" }}>
        <p className="text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="text-foreground font-semibold">
            Sign Up
          </Link>
        </p>
        <Link to="/" className="text-sm text-muted-foreground mt-4 block">
          Skip for now →
        </Link>
      </div>
    </div>
  );
};

export default SignIn;
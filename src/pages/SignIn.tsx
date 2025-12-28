import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Calculator } from "lucide-react";
import { toast } from "sonner";

const SignIn = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check localStorage for user
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user.email === email && user.password === password) {
        localStorage.setItem("isAuthenticated", "true");
        toast.success("Welcome back!");
        navigate("/");
        return;
      }
    }

    // Demo login
    if (email && password.length >= 6) {
      localStorage.setItem("user", JSON.stringify({ email, password }));
      localStorage.setItem("isAuthenticated", "true");
      toast.success("Signed in successfully!");
      navigate("/");
    } else {
      toast.error("Invalid credentials");
    }

    setIsLoading(false);
  };

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

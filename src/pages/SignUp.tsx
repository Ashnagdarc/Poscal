import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthFooter, AuthLayout } from "@/components/auth/AuthLayout";
import { AuthField, AuthPasswordField, authInputClassName } from "@/components/auth/AuthField";
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

  const passwordsMismatch = confirmPassword.length > 0 && confirmPassword !== password;

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
    <AuthLayout
      title="Create account"
      subtitle="Start sizing trades with confidence"
      footer={
        <AuthFooter
          prompt="Already have an account?"
          linkLabel="Sign In"
          linkTo="/signin"
        />
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField
          id="signup-name"
          label={
            <>
              Full name{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </>
          }
        >
          <input
            id="signup-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className={authInputClassName}
          />
        </AuthField>

        <AuthField id="signup-email" label="Email address">
          <input
            id="signup-email"
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
          id="signup-password"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Create a strong password"
          autoComplete="new-password"
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((current) => !current)}
          hint="Must be at least 6 characters"
          minLength={6}
        />

        <AuthField
          id="signup-confirm-password"
          label="Confirm password"
          error={passwordsMismatch ? "Passwords do not match" : undefined}
        >
          <input
            id="signup-confirm-password"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            required
            minLength={6}
            className={authInputClassName}
          />
        </AuthField>

        <button
          type="submit"
          disabled={isLoading || passwordsMismatch}
          className="mt-1 h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-foreground/30 border-t-brand-foreground" />
              Creating account...
            </span>
          ) : (
            "Create Account"
          )}
        </button>

        <p className="pt-1 text-center text-xs leading-relaxed text-white/50">
          By signing up, you agree to our{" "}
          <Link to="/terms" className="text-brand hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-brand hover:underline">
            Privacy Policy
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default SignUp;

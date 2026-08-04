import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthFooter, AuthLayout } from "@/components/auth/AuthLayout";
import { AuthField, AuthPasswordField, authInputClassName } from "@/components/auth/AuthField";
import { useAuth } from "@/contexts/AuthContext";

type Step = "request" | "verify";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { resetPassword, verifyPasswordReset } = useAuth();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email address");
      return;
    }

    setIsLoading(true);
    setRequestError(null);
    const { error } = await resetPassword(email.trim());
    setIsLoading(false);

    if (error) {
      // Soft-fail config / Resend outage: clear message, stay on request step.
      setRequestError(error);
      toast.error(error, { duration: 7000 });
      return;
    }

    toast.success(
      "If an account exists for that address, a reset code was emailed. Check spam if it is missing.",
      { duration: 7000 },
    );
    setStep("verify");
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) {
      toast.error("Enter the reset code from your email");
      return;
    }
    if (newPassword.length < 10 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error("Password must be at least 10 characters and include a letter and a number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    const { error } = await verifyPasswordReset(email.trim(), code.trim(), newPassword);
    setIsLoading(false);

    if (error) {
      toast.error(error);
      return;
    }

    // Convex Auth Password reset-verification already invalidates other sessions.
    toast.success(
      "Password updated. Other devices were signed out. Sign in with your new password.",
      { duration: 7000 },
    );
    navigate("/signin", { state: { email: email.trim() } });
  };

  return (
    <AuthLayout
      title={step === "request" ? "Reset password" : "Enter reset code"}
      subtitle={
        step === "request"
          ? "We’ll email you an 8-digit code if an account exists for that address."
          : `Enter the code sent to ${email}, then choose a new password.`
      }
      footer={
        <AuthFooter
          prompt="Remembered your password?"
          linkLabel="Sign In"
          linkTo="/signin"
          guestHref={null}
        />
      }
    >
      {step === "request" ? (
        <form onSubmit={handleRequest} className="space-y-5">
          {requestError ? (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {requestError}
            </div>
          ) : null}

          <AuthField id="reset-email" label="Email address">
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (requestError) setRequestError(null);
              }}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className={authInputClassName}
            />
          </AuthField>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Sending..." : "Send reset code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-5">
          <AuthField id="reset-code" label="Reset code">
            <input
              id="reset-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="8-digit code"
              required
              className={authInputClassName}
            />
          </AuthField>

          <AuthPasswordField
            id="reset-new-password"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="At least 10 characters"
            autoComplete="new-password"
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((current) => !current)}
          />

          <AuthField id="reset-confirm-password" label="Confirm password">
            <input
              id="reset-confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              required
              className={authInputClassName}
            />
          </AuthField>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Updating..." : "Update password"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep("request");
              setRequestError(null);
            }}
            className="w-full text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Resend code / change email
          </button>
        </form>
      )}

      <p className="pt-2 text-center text-xs text-muted-foreground">
          <Link
            to="/signin"
            state={{ email: email.trim() || undefined }}
            className="underline-offset-2 hover:underline"
          >
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
};

export default ForgotPassword;

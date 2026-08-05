import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthFooter, AuthLayout } from "@/components/auth/AuthLayout";
import { AuthField, authInputClassName } from "@/components/auth/AuthField";
import { useAuth } from "@/contexts/AuthContext";
import { isClientEmailVerificationRequired } from "@/lib/emailVerificationClient";

type VerifyLocationState = {
  email?: string;
  returnTo?: string;
  fromSignup?: boolean;
};

const safeInternalPath = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
};

const RESEND_COOLDOWN_MS = 45_000;

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, verifyEmail, resendVerification, signOut } = useAuth();
  const locationState = (location.state as VerifyLocationState | null) ?? null;
  const requireEmailVerification = isClientEmailVerificationRequired();
  const softMode = !requireEmailVerification;

  const [email, setEmail] = useState(
    () => locationState?.email?.trim().toLowerCase() || user?.email || "",
  );
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const returnTo = useMemo(() => {
    return (
      safeInternalPath(locationState?.returnTo)
      ?? "/journal"
    );
  }, [locationState?.returnTo]);

  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user?.email, email]);

  useEffect(() => {
    if (user?.email_verified) {
      navigate(returnTo, { replace: true });
    }
  }, [user?.email_verified, navigate, returnTo]);

  useEffect(() => {
    if (resendAvailableAt <= Date.now()) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [resendAvailableAt]);

  const resendSecondsLeft = Math.max(0, Math.ceil((resendAvailableAt - nowMs) / 1000));

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (softMode) {
      toast.message("Email confirmation is optional right now. You can continue into the app.");
      navigate(returnTo, { replace: true });
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("Enter the email you signed up with");
      return;
    }
    if (!trimmedCode || trimmedCode.length < 6) {
      toast.error("Enter the 8-digit code from your email");
      return;
    }

    setIsLoading(true);
    const { error, signedIn } = await verifyEmail(trimmedEmail, trimmedCode);
    setIsLoading(false);

    if (error) {
      toast.error(error);
      return;
    }

    if (!signedIn) {
      toast.error("Could not verify that code. Try again or resend.");
      return;
    }

    toast.success("Email verified. Welcome to Poscal!");
    navigate(returnTo, { replace: true });
  };

  const handleResend = async () => {
    if (softMode) {
      toast.message(
        "Verification codes are not sent while email confirmation is optional. You can use Poscal fully without verifying.",
      );
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("Enter your email to resend a code");
      return;
    }
    if (resendSecondsLeft > 0) {
      return;
    }

    setIsResending(true);
    const { error } = await resendVerification(trimmedEmail);
    setIsResending(false);
    setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
    setNowMs(Date.now());

    // Always neutral success style when possible (no account enumeration).
    if (error && /too many|wait/i.test(error)) {
      toast.error(error);
      return;
    }
    if (error && /not configured|could not be sent|not enabled/i.test(error)) {
      toast.error(error);
      return;
    }
    toast.success("If verification is pending, a new code was sent.");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          <p className="font-display text-sm text-muted-foreground">Loading Poscal…</p>
        </div>
      </div>
    );
  }

  return (
    <AuthLayout
      title={softMode ? "Email confirmation" : "Verify your email"}
      subtitle={
        softMode
          ? "Confirmation is optional for now — you already have full app access. Codes are only required after we turn hard verification back on."
          : email
            ? `We sent an 8-digit code to ${email}. Enter it below to unlock your journal.`
            : "Enter the email you used at sign-up and the 8-digit code we sent."
      }
      banner={
        locationState?.fromSignup || softMode ? (
          <div className="rounded-xl border border-brand/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
            {softMode
              ? "You can skip this and open your journal anytime."
              : "Account created. Check your inbox for a verification code."}
          </div>
        ) : null
      }
      footer={
        <AuthFooter
          prompt="Wrong account?"
          linkLabel="Sign in"
          linkTo="/signin"
          guestHref={null}
        />
      }
    >
      {softMode ? (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => navigate(returnTo, { replace: true })}
            className="mt-1 h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground transition-all active:scale-[0.98]"
          >
            Continue to app
          </button>
          {user ? null : (
            <p className="text-center text-sm text-muted-foreground">
              <Link to="/signin" className="underline-offset-2 hover:underline">
                Sign in
              </Link>{" "}
              if you do not have a session yet.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-5">
          <AuthField id="verify-email" label="Email address">
            <input
              id="verify-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className={authInputClassName}
              readOnly={Boolean(user?.email)}
            />
          </AuthField>

          <AuthField id="verify-code" label="Verification code">
            <input
              id="verify-code"
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

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-foreground/30 border-t-brand-foreground" />
                Verifying...
              </span>
            ) : (
              "Verify email"
            )}
          </button>

          <button
            type="button"
            disabled={isResending || resendSecondsLeft > 0}
            onClick={() => void handleResend()}
            className="w-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {isResending
              ? "Sending..."
              : resendSecondsLeft > 0
                ? `Resend code in ${resendSecondsLeft}s`
                : "Resend code"}
          </button>
        </form>
      )}

      {!softMode ? (
        <p className="pt-2 text-center text-xs leading-relaxed text-muted-foreground">
          Codes expire after a short time. Local/dev builds need{" "}
          <span className="font-medium text-foreground/80">RESEND_API_KEY</span> (or{" "}
          <span className="font-medium text-foreground/80">AUTH_RESEND_KEY</span>) in Convex env.
        </p>
      ) : null}

      {user ? (
        <button
          type="button"
          onClick={() => void signOut().then(() => navigate("/signin", { replace: true }))}
          className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Sign out
        </button>
      ) : (
        <p className="pt-2 text-center text-xs text-muted-foreground">
          <Link to="/signin" className="underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </p>
      )}
    </AuthLayout>
  );
};

export default VerifyEmail;

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import poscalLogo from "@/assets/poscal-logo.png";
import poscalLogoLight from "@/assets/poscal-logo-light.png";
import { useHaptics } from "@/hooks/use-haptics";
import { cn } from "@/lib/utils";

interface OnboardingStep {
  eyebrow?: string;
  title: string;
  description: string;
}

const steps: OnboardingStep[] = [
  {
    title: "Hey Boss, welcome to Poscal",
    description: "Your trading desk for sizing risk and tracking the journey, one trade at a time.",
  },
  {
    eyebrow: "Calculator",
    title: "Size every trade with confidence",
    description:
      "Set your balance, risk percent, and stop loss. Poscal turns that into a clear lot size before you click buy or sell.",
  },
  {
    eyebrow: "Journal",
    title: "Keep a journal that grows with you",
    description:
      "Log your trades, watch your equity curve, and learn what actually works so the next session starts smarter.",
  },
];

const BrandMark = ({ className }: { className?: string }) => (
  <div className={cn("relative mx-auto", className)}>
    <img
      src={poscalLogo}
      alt="Poscal"
      className="mx-auto h-full w-full object-contain dark:hidden"
    />
    <img
      src={poscalLogoLight}
      alt="Poscal"
      className="mx-auto hidden h-full w-full object-contain dark:block"
    />
  </div>
);

const Welcome = () => {
  const navigate = useNavigate();
  const { lightTap, mediumTap, success } = useHaptics();
  const [currentStep, setCurrentStep] = useState(-1);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;

    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentStep < steps.length - 1) {
      mediumTap();
      setCurrentStep(currentStep + 1);
    } else if (isRightSwipe && currentStep > 0) {
      lightTap();
      setCurrentStep(currentStep - 1);
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  useEffect(() => {
    const seen = localStorage.getItem("hasSeenOnboarding");
    if (seen === "true") {
      setHasSeenOnboarding(true);
      navigate("/", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => {
      setShowSplash(false);
      setCurrentStep(0);
    }, 1600);
    return () => clearTimeout(timer);
  }, [showSplash]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      mediumTap();
      setCurrentStep(currentStep + 1);
      return;
    }
    success();
    completeOnboarding();
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      lightTap();
      setCurrentStep(currentStep - 1);
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    navigate("/");
  };

  const handleSkip = () => {
    lightTap();
    completeOnboarding();
  };

  if (hasSeenOnboarding) {
    return null;
  }

  if (showSplash) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <BrandMark className="h-28 w-auto max-w-[220px]" />
        </motion.div>
      </div>
    );
  }

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isFirstStep = currentStep === 0;

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="px-6 pt-12">
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <header className="relative z-10 flex justify-end px-6 pt-4">
        <button
          type="button"
          onClick={handleSkip}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip
        </button>
      </header>

      <main
        className="flex flex-1 flex-col items-center justify-center px-8"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            className="max-w-sm text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            {isFirstStep ? (
              <p className="font-display text-2xl font-semibold leading-snug text-foreground sm:text-3xl">
                {step.title}
              </p>
            ) : (
              <>
                {step.eyebrow ? (
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-brand">
                    {step.eyebrow}
                  </p>
                ) : null}
                <h1 className="mb-4 font-display text-3xl font-bold leading-tight text-foreground">
                  {step.title}
                </h1>
              </>
            )}
            <p
              className={cn(
                "leading-relaxed text-muted-foreground",
                isFirstStep ? "mt-5 text-base sm:text-lg" : "text-lg",
              )}
            >
              {step.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="px-6 pb-12">
        <div className="flex gap-3">
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={handlePrev}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary transition-all hover:bg-secondary/80 active:scale-95"
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6 text-foreground" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleNext}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-brand-foreground transition-all active:scale-[0.98]"
          >
            {currentStep === steps.length - 1 ? "Get Started" : "Continue"}
            {currentStep < steps.length - 1 ? <ChevronRight className="h-5 w-5" /> : null}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Welcome;

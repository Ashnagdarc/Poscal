import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import poscalLogo from '@/assets/poscal-logo.png';
import { useHaptics } from '@/hooks/use-haptics';

interface OnboardingStep {
  title: string;
  description: string;
}

const steps: OnboardingStep[] = [
  {
    title: 'Size every trade',
    description: 'Calculate position size from your balance, risk percentage, and stop loss — before you enter.',
  },
  {
    title: 'Follow signals',
    description: 'Browse curated trading signals and apply them straight into the calculator.',
  },
  {
    title: 'Keep a journal',
    description: 'Save calculations and mark results so you can review what you traded.',
  },
];

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
    const seen = localStorage.getItem('hasSeenOnboarding');
    if (seen === 'true') {
      setHasSeenOnboarding(true);
      navigate('/', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => {
        setShowSplash(false);
        setCurrentStep(0);
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      mediumTap();
      setCurrentStep(currentStep + 1);
    } else {
      success();
      completeOnboarding();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      lightTap();
      setCurrentStep(currentStep - 1);
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    navigate('/');
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
        <div className="animate-scale-in text-center">
          <img
            src={poscalLogo}
            alt="Poscal"
            className="mx-auto h-28 w-28 rounded-3xl object-contain"
          />
          <p className="mt-6 font-display text-sm font-semibold uppercase tracking-[0.28em] text-brand">
            Poscal
          </p>
        </div>
      </div>
    );
  }

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

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
        <div key={currentStep} className="max-w-sm animate-fade-in text-center">
          <img
            src={poscalLogo}
            alt="Poscal"
            className="mx-auto mb-10 h-20 w-20 rounded-2xl object-contain"
          />
          <h1 className="mb-4 font-display text-3xl font-bold text-foreground">{step.title}</h1>
          <p className="text-lg leading-relaxed text-muted-foreground">{step.description}</p>
        </div>
      </main>

      <footer className="px-6 pb-12">
        <div className="flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary transition-all active:scale-95 hover:bg-secondary/80"
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6 text-foreground" />
            </button>
          )}

          <button
            onClick={handleNext}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-brand-foreground transition-all active:scale-[0.98]"
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Continue'}
            {currentStep < steps.length - 1 && <ChevronRight className="h-5 w-5" />}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Welcome;

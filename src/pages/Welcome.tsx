import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import poscalLogo from '@/assets/poscal-logo.png';

interface OnboardingStep {
  title: string;
  description: string;
}

const steps: OnboardingStep[] = [
  {
    title: "Position Size Calculator",
    description: "Calculate the perfect position size for every trade based on your risk tolerance and account balance.",
  },
  {
    title: "Trading Journal",
    description: "Track all your trades, analyze your performance with charts, and learn from your history.",
  },
  {
    title: "Improve Your Trading",
    description: "Make data-driven decisions with analytics, win rate tracking, and profit factor analysis.",
  },
];

const Welcome = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(-1); // -1 = splash screen
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

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
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    navigate('/');
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  if (hasSeenOnboarding) {
    return null;
  }

  // Splash screen with large animated logo
  if (showSplash) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-scale-in">
          <img 
            src={poscalLogo} 
            alt="Poscal"
            className="w-64 h-auto drop-shadow-2xl"
          />
        </div>
      </div>
    );
  }

  const step = steps[currentStep];

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Skip button */}
      <header className="pt-12 px-6 flex justify-end relative z-10">
        <button
          onClick={handleSkip}
          className="text-muted-foreground text-sm font-medium hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-8">
        <div 
          key={currentStep}
          className="animate-fade-in text-center max-w-sm"
        >
          {/* Logo */}
          <div className="relative w-40 h-20 mx-auto mb-12">
            <img 
              src={poscalLogo} 
              alt="Poscal"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-foreground mb-4">
            {step.title}
          </h1>

          {/* Description */}
          <p className="text-muted-foreground text-lg leading-relaxed">
            {step.description}
          </p>
        </div>
      </main>

      {/* Progress & Navigation */}
      <footer className="pb-12 px-6">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentStep 
                  ? 'w-8 bg-foreground' 
                  : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 hover:bg-secondary/80"
            >
              <ChevronLeft className="w-6 h-6 text-foreground" />
            </button>
          )}
          
          <button
            onClick={handleNext}
            className="flex-1 h-14 bg-foreground text-background font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] hover:opacity-90"
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Continue'}
            {currentStep < steps.length - 1 && <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Welcome;

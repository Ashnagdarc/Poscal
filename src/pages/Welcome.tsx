import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, BookOpen, TrendingUp, ChevronRight, ChevronLeft } from 'lucide-react';

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const steps: OnboardingStep[] = [
  {
    icon: <Calculator className="w-16 h-16" />,
    title: "Position Size Calculator",
    description: "Calculate the perfect position size for every trade based on your risk tolerance and account balance.",
    color: "bg-foreground text-background",
  },
  {
    icon: <BookOpen className="w-16 h-16" />,
    title: "Trading Journal",
    description: "Track all your trades, analyze your performance with charts, and learn from your history.",
    color: "bg-foreground text-background",
  },
  {
    icon: <TrendingUp className="w-16 h-16" />,
    title: "Improve Your Trading",
    description: "Make data-driven decisions with analytics, win rate tracking, and profit factor analysis.",
    color: "bg-foreground text-background",
  },
];

const Welcome = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('hasSeenOnboarding');
    if (seen === 'true') {
      setHasSeenOnboarding(true);
      navigate('/', { replace: true });
    }
  }, [navigate]);

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

  const step = steps[currentStep];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Skip button */}
      <header className="pt-12 px-6 flex justify-end">
        <button
          onClick={handleSkip}
          className="text-muted-foreground text-sm font-medium"
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
          {/* Icon */}
          <div className={`w-32 h-32 ${step.color} rounded-3xl flex items-center justify-center mx-auto mb-8`}>
            {step.icon}
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
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentStep 
                  ? 'w-8 bg-foreground' 
                  : 'bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95"
            >
              <ChevronLeft className="w-6 h-6 text-foreground" />
            </button>
          )}
          
          <button
            onClick={handleNext}
            className="flex-1 h-14 bg-foreground text-background font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
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
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator } from "@/components/Calculator";
import { BottomNav } from "@/components/BottomNav";

const Index = () => {
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeenOnboarding) {
      navigate("/welcome", { replace: true });
    } else {
      setIsReady(true);
    }
  }, [navigate]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-24">
      <Calculator />
      <BottomNav />
    </div>
  );
};

export default Index;

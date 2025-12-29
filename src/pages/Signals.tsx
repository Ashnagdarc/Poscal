import { Radio } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';

const Signals = () => {
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-foreground rounded-xl flex items-center justify-center">
            <Radio className="w-5 h-5 text-background" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Trading Signals</h1>
            <p className="text-sm text-muted-foreground">Live signals from admin</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-6">
        <div className="bg-secondary rounded-2xl p-6 text-center">
          <Radio className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Coming Soon</h2>
          <p className="text-sm text-muted-foreground">
            Trading signals will appear here once the database is connected.
            Each signal will include currency pair, entry point, stop loss,
            take profit levels, pip calculations, and chart images.
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Signals;

import { Delete } from "lucide-react";

interface NumPadProps {
  value: string;
  onChange: (value: string) => void;
  onDone: () => void;
  label?: string;
  suffix?: string;
}

export const NumPad = ({ value, onChange, onDone, label = "Enter Value", suffix = "pips" }: NumPadProps) => {
  const handlePress = (key: string) => {
    if (key === "delete") {
      onChange(value.slice(0, -1));
    } else if (key === ".") {
      if (!value.includes(".")) {
        onChange(value + ".");
      }
    } else {
      onChange(value + key);
    }
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "delete"];

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up">
      {/* Display */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <p className="text-sm font-medium text-muted-foreground mb-4">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-6xl font-bold text-foreground tracking-tight">
            {value || "0"}
          </span>
          <span className="text-2xl font-medium text-muted-foreground">{suffix}</span>
        </div>
      </div>

      {/* Keypad */}
      <div className="px-4 pb-8">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {keys.map((key) => (
            <button
              key={key}
              onClick={() => handlePress(key)}
              className="h-16 rounded-2xl bg-secondary text-foreground text-2xl font-semibold transition-all duration-200 active:scale-95 active:bg-secondary/70 flex items-center justify-center"
            >
              {key === "delete" ? <Delete className="w-6 h-6" /> : key}
            </button>
          ))}
        </div>
        <button
          onClick={onDone}
          className="w-full h-14 bg-foreground text-background text-lg font-semibold rounded-2xl transition-all duration-200 active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    </div>
  );
};

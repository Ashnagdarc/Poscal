interface StopLossSelectorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  step: number;
  accent?: "neutral" | "danger";
}

export const StopLossSelector = ({
  label,
  value,
  onChange,
  placeholder,
  step,
  accent = "neutral",
}: StopLossSelectorProps) => {
  return (
    <label
      className={`rounded-[1.7rem] border p-4 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.9)] ${
        accent === "danger"
          ? "border-red-500/10 bg-white/[0.07]"
          : "border-white/10 bg-white/[0.07]"
      }`}
    >
      <span
        className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
          accent === "danger" ? "text-red-400/70" : "text-white/45"
        }`}
      >
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-3 h-11 w-full bg-transparent text-2xl font-semibold tracking-[-0.04em] text-white outline-none placeholder:text-white/20"
      />
    </label>
  );
};

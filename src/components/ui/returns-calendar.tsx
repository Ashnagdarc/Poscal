import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;
const GREEN = "var(--chart-up, #22c55e)";
const RED = "var(--chart-down, #ef5350)";
const SURFACE = "var(--surface, var(--card))";
const HAIRLINE = "var(--border)";

const INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DEFAULT_YEARS = [2021, 2022, 2023, 2024, 2025];

/** Deterministic sample field so every render agrees (2022 reads as a down year). */
const DEFAULT_RETURNS: number[][] = (() => {
  let seed = 2021;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  return DEFAULT_YEARS.map((_, yi) =>
    INITIALS.map(() => Math.round(((yi === 1 ? -1.6 : 0.9) + (rnd() - 0.5) * 12) * 10) / 10),
  );
})();

/** Compounded year return from its months, in percent. */
const compound = (row: number[]) => (row.reduce((acc, r) => acc * (1 + r / 100), 1) - 1) * 100;

/** Cumulative compounded growth after each month — Jan..Dec, derived from the row. */
const cumCurve = (row: number[]) => {
  let acc = 1;
  return row.map((r) => {
    acc *= 1 + r / 100;
    return (acc - 1) * 100;
  });
};

const signed = (v: number, dp: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(dp)}`;

/** magnitude → tinted fill of the single up/down hue, never a second color */
const cellFill = (r: number, on: boolean) =>
  `color-mix(in srgb, ${r >= 0 ? GREEN : RED} ${Math.round(Math.min(Math.abs(r) / 8, 1) * 55 + (on ? 22 : 7))}%, transparent)`;

export interface ReturnsCalendarProps {
  /** Heading above the grid. */
  title?: string;
  /** Caption shown while nothing is hovered. */
  hint?: string;
  /** Row labels — one per row of `returns`. */
  years?: number[];
  /** `returns[year][month]` in percent (12 months per row). */
  returns?: number[][];
  /** Fires when a month cell is clicked. monthIndex is 0–11. */
  onSelectMonth?: (year: number, monthIndex: number) => void;
  /** Currently selected month as `YYYY-MM`. */
  selectedMonthKey?: string;
  className?: string;
}

/**
 * Monthly-returns heat grid — years × months, diverging up/down by magnitude,
 * with a compounded year-total column.
 */
export function ReturnsCalendar({
  title = "Monthly returns",
  hint = "hover a month · year = compounded",
  years = DEFAULT_YEARS,
  returns = DEFAULT_RETURNS,
  onSelectMonth,
  selectedMonthKey,
  className,
}: ReturnsCalendarProps) {
  const reduced = useReducedMotion();
  const [hot, setHot] = useState<{ y: number; m: number } | null>(null);

  const totals = useMemo(() => returns.map(compound), [returns]);
  const hotValue = hot ? returns[hot.y]?.[hot.m] : undefined;

  return (
    <div className={cn("w-full min-w-0", className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
        <span className="text-[13px] font-medium text-foreground">{title}</span>
        <span className="text-[10px] tabular-nums text-foreground/45">
          {hot && hotValue != null ? (
            <>
              <span className="text-foreground">
                {MONTHS[hot.m]} {years[hot.y]}
              </span>
              <span className="mx-1.5 text-foreground/25">·</span>
              <span style={{ color: hotValue >= 0 ? GREEN : RED }}>{signed(hotValue, 1)}%</span>
            </>
          ) : (
            hint
          )}
        </span>
      </div>

      <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <div
          className="grid min-w-[440px] gap-[3px]"
          style={{ gridTemplateColumns: "30px repeat(12, 1fr) 46px" }}
          onPointerLeave={() => setHot(null)}
        >
          <span />
          {INITIALS.map((m, i) => (
            <span
              key={i}
              className="pb-0.5 text-center text-[9px] text-foreground/45"
              style={{ opacity: hot && hot.m !== i ? 0.4 : 1 }}
            >
              {m}
            </span>
          ))}
          <span className="pb-0.5 text-center text-[9px] text-foreground/45">Yr</span>

          {years.map((year, y) => (
            <div key={year} className="contents">
              <span
                className="flex items-center justify-end pr-1 text-[9.5px] tabular-nums text-foreground/45"
                style={{ opacity: hot && hot.y !== y ? 0.4 : 1 }}
              >
                {`’${String(year).slice(2)}`}
              </span>

              {(returns[y] ?? []).map((r, m) => {
                const monthKey = `${year}-${String(m + 1).padStart(2, "0")}`;
                const on = hot?.y === y && hot?.m === m;
                const selected = selectedMonthKey === monthKey;
                const dim = !!hot && !on && hot.y !== y && hot.m !== m;
                return (
                  <motion.button
                    key={m}
                    type="button"
                    aria-label={`${MONTHS[m]} ${year} ${signed(r, 1)}%`}
                    aria-pressed={selected}
                    onPointerEnter={() => setHot({ y, m })}
                    onFocus={() => setHot({ y, m })}
                    onClick={() => onSelectMonth?.(year, m)}
                    className="grid aspect-square place-items-center rounded-[3px] text-[8px] font-semibold tabular-nums outline-none"
                    style={{
                      background: cellFill(r, on || selected),
                      color: `color-mix(in srgb, var(--foreground) ${Math.round(40 + Math.min(Math.abs(r) / 8, 1) * 45)}%, transparent)`,
                      outline: on || selected ? `1.5px solid ${r >= 0 ? GREEN : RED}` : "none",
                      outlineOffset: "-1.5px",
                    }}
                    initial={{ opacity: reduced ? 1 : 0, scale: reduced ? 1 : 0.6 }}
                    animate={{ opacity: dim ? 0.35 : 1, scale: 1 }}
                    transition={reduced ? { duration: 0 } : { duration: 0.3, ease: EASE, delay: 0.008 * (y * 12 + m) }}
                  >
                    {Math.abs(r) >= 4 ? Math.round(r) : ""}
                  </motion.button>
                );
              })}

              <YearTotalCell
                row={returns[y] ?? []}
                total={totals[y]}
                dimmed={!!hot && hot.y !== y}
                reduced={!!reduced}
                align={y === 0 ? "start" : y === years.length - 1 ? "end" : "center"}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function YearTotalCell({
  row,
  total,
  dimmed,
  reduced,
  align,
}: {
  row: number[];
  total: number;
  dimmed: boolean;
  reduced: boolean;
  align: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const hue = total >= 0 ? GREEN : RED;
  const curve = useMemo(() => cumCurve(row), [row]);
  const W = 116;
  const H = 42;
  const lo = Math.min(0, ...curve);
  const hi = Math.max(0, ...curve);
  const span = hi - lo || 1;
  const px = (i: number) => 3 + (i / Math.max(1, curve.length - 1)) * (W - 6);
  const py = (v: number) => 4 + (1 - (v - lo) / span) * (H - 8);
  const pts = curve.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
  const zeroY = py(0);

  return (
    <div
      className="relative grid cursor-help place-items-center rounded-[3px] text-[9px] font-semibold tabular-nums transition-opacity"
      style={{
        background: cellFill(total / 3, open),
        color: hue,
        opacity: dimmed ? 0.4 : 1,
        outline: open ? `1.5px solid ${hue}` : "none",
        outlineOffset: "-1.5px",
      }}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
    >
      {signed(total, 0)}
      <div
        className={cn(
          "pointer-events-none absolute right-[calc(100%+6px)] z-20",
          align === "start" ? "top-0" : align === "end" ? "bottom-0" : "top-1/2 -translate-y-1/2",
        )}
      >
        <AnimatePresence>
          {open && curve.length > 1 && (
            <motion.div
              className="rounded-lg border p-2"
              style={{ background: SURFACE, borderColor: HAIRLINE }}
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 4, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: 4, scale: 0.96 }}
              transition={{ duration: reduced ? 0 : 0.16, ease: EASE }}
            >
              <div className="mb-1 whitespace-nowrap text-[8.5px] font-medium text-foreground/45">
                growth of $1 · Jan→Dec
              </div>
              <svg width={W} height={H} className="block">
                <line
                  x1={3}
                  x2={W - 3}
                  y1={zeroY}
                  y2={zeroY}
                  stroke="color-mix(in srgb, var(--foreground) 14%, transparent)"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
                <path
                  d={`M${pts.join(" L")} L ${px(curve.length - 1)},${zeroY} L ${px(0)},${zeroY} Z`}
                  fill={`color-mix(in srgb, ${hue} 12%, transparent)`}
                />
                <motion.path
                  d={`M${pts.join(" L")}`}
                  fill="none"
                  stroke={hue}
                  strokeWidth={1.4}
                  initial={{ pathLength: reduced ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: reduced ? 0 : 0.5, ease: EASE }}
                />
                <circle cx={px(curve.length - 1)} cy={py(curve[curve.length - 1])} r={2.4} fill={hue} />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ReturnsCalendar;

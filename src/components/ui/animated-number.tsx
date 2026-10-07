import NumberFlow from "@number-flow/react";

import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  zeroAsDash?: boolean;
  useGrouping?: boolean;
}

const TRANSFORM_TIMING = {
  duration: 260,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

const OPACITY_TIMING = {
  duration: 180,
  easing: "ease-out",
} as const;

export const AnimatedNumber = ({
  value,
  decimals = 2,
  prefix,
  suffix,
  className,
  zeroAsDash = true,
  useGrouping = true,
}: AnimatedNumberProps) => {
  if (!Number.isFinite(value) || (zeroAsDash && value === 0)) {
    return <span className={cn("tabular-nums", className)}>—</span>;
  }

  return (
    <NumberFlow
      value={value}
      prefix={prefix}
      suffix={suffix}
      format={{
        useGrouping,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }}
      transformTiming={TRANSFORM_TIMING}
      spinTiming={TRANSFORM_TIMING}
      opacityTiming={OPACITY_TIMING}
      isolate
      className={cn("inline-block tabular-nums", className)}
    />
  );
};

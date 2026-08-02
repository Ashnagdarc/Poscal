/** Common IANA zones for Settings — display formatting (P-029). */
export const COMMON_TIMEZONES = [
  { id: "UTC", label: "UTC" },
  { id: "America/New_York", label: "Eastern Time (New York)" },
  { id: "America/Chicago", label: "Central Time (Chicago)" },
  { id: "America/Denver", label: "Mountain Time (Denver)" },
  { id: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
  { id: "America/Toronto", label: "Eastern Time (Toronto)" },
  { id: "Europe/London", label: "London" },
  { id: "Europe/Paris", label: "Paris / Central Europe" },
  { id: "Europe/Berlin", label: "Berlin" },
  { id: "Africa/Lagos", label: "Lagos (WAT)" },
  { id: "Asia/Dubai", label: "Dubai" },
  { id: "Asia/Kolkata", label: "India (Kolkata)" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Asia/Tokyo", label: "Tokyo" },
  { id: "Australia/Sydney", label: "Sydney" },
] as const;

export type CommonTimezoneId = (typeof COMMON_TIMEZONES)[number]["id"];

export const detectBrowserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export const isValidTimeZone = (value: string): boolean => {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

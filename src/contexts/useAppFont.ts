import { useContext } from "react";
import { FontContext } from "@/contexts/fontContextInstance";

export const useAppFont = () => {
  const context = useContext(FontContext);
  if (!context) {
    throw new Error("useAppFont must be used within FontProvider");
  }
  return context;
};

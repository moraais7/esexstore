import { useEffect, useState } from "react";

const STORAGE_KEY = "esex-store-theme";

export default function useStoreTheme() {
  const [theme, setTheme] = useState(() => (localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark"));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return [theme, setTheme];
}
import React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThemeToggle({ theme, onToggle }) {
  const isLight = theme === "light";
  const Icon = isLight ? Moon : Sun;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onToggle}
      aria-label={isLight ? "Mudar para o tema escuro" : "Mudar para o tema claro"}
      title={isLight ? "Tema escuro" : "Tema claro"}
    >
      <Icon className="h-5 w-5" strokeWidth={1.6} />
    </Button>
  );
}
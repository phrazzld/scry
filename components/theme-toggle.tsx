"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { useButtonPress } from "@/hooks/use-button-press"

export function ThemeToggle() {
  const { setTheme, theme, systemTheme } = useTheme()
  const { isPressing, handlePressStart } = useButtonPress()

  const resolvedTheme = React.useMemo(() => {
    if (theme === "system") {
      return systemTheme ?? "light"
    }

    return theme ?? "light"
  }, [theme, systemTheme])

  const handleThemeSelect = (nextTheme: "light" | "dark") => {
    const shouldMatchSystem = systemTheme === nextTheme
    setTheme(shouldMatchSystem ? "system" : nextTheme)
  }

  const handleToggle = () => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark"
    handleThemeSelect(nextTheme)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative size-9 rounded-full bg-accent/50 text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-foreground hover:scale-105 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
      onPointerDown={handlePressStart}
      onClick={handleToggle}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
    >
      <Sun
        className={`relative h-[1.15rem] w-[1.15rem] text-yellow-500 transition-all duration-300 ${
          isPressing ? "animate-icon-switch" : ""
        } dark:scale-0 dark:opacity-0`}
      />
      <Moon
        className={`absolute h-[1.1rem] w-[1.1rem] scale-0 opacity-0 text-slate-400 moon-glow transition-all duration-300 ${
          isPressing ? "animate-icon-switch" : ""
        } dark:scale-100 dark:opacity-100`}
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

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
      className="relative size-9 rounded-full bg-accent/50 text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-foreground hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
      onPointerDown={handlePressStart}
      onClick={handleToggle}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 rounded-full bg-primary/20 transition-all duration-300 ease-out ${
          isPressing ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      />
      <Sun
        className={`relative h-[1.15rem] w-[1.15rem] text-foreground transition-all duration-500 ease-out ${
          isPressing ? "rotate-12 scale-110" : "rotate-0 scale-100"
        } dark:text-muted-foreground dark:-rotate-90 dark:scale-0`}
      />
      <Moon
        className={`absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 text-muted-foreground transition-all duration-500 ease-out ${
          isPressing ? "-rotate-6 scale-105" : "rotate-90 scale-0"
        } dark:rotate-0 dark:scale-100`}
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

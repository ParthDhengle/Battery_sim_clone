"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { Sun, Moon, Menu } from "lucide-react"

interface NavBarProps {
  onMenuClick: () => void
}

export function NavBar({ onMenuClick }: NavBarProps) {
  const { theme, setTheme } = useTheme()

  return (
    <nav className="border-b border-border bg-card">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        {/* Hamburger Menu Button - Always Visible */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo + Title */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex items-center">
            <img
              src="/logo.svg"
              alt="Company Logo"
              className="h-10 w-auto"
            />
          </div>
          <span className="font-bold text-lg text-foreground">Battery Simulator</span>
        </Link>

        
        {/* Theme Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4 stroke-[3]" /> : <Moon className="h-4 w-4 stroke-[3]" />}
        </Button>
      </div>
    </nav>
  )
}
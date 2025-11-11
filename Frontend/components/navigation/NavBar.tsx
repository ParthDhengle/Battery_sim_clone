"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import {Sun , Moon} from "lucide-react"
export function NavBar() {
  const { theme, setTheme } = useTheme()

  return (
    <nav className="border-b border-border bg-card">
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Logo + Title */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex items-center">
            <img
              src="/logo.svg"  // make sure the logo file is in /public/logo.svg
              alt="Company Logo"
              className="h-10 w-auto"
            />
          </div>
          <span className="font-bold text-lg text-foreground">Battery Simulator</span>
        </Link>

        {/* Version Info */}
        <div className="text-sm text-muted-foreground">v1.0.1</div>

        {/* Theme Toggle Button */}
        <Button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun className="size-4 stroke-[3]" /> : <Moon className="size-4  stroke-[3]" />}
        </Button>
      </div>
    </nav>
  )
}

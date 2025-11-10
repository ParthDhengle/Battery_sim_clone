// components/Settings.tsx
"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { SettingsIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const [darkMode, setDarkMode] = useState(theme === "dark")
  const [units, setUnits] = useState("SI")

  // Sync local state with theme on mount and theme changes
  useEffect(() => {
    setDarkMode(theme === "dark")
  }, [theme])

  // Update theme when switch changes
  const handleDarkModeToggle = (checked: boolean) => {
    setDarkMode(checked)
    setTheme(checked ? "dark" : "light")
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your preferences</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="dark-mode">Dark Mode</Label>
            <Switch
              id="dark-mode"
              checked={darkMode}
              onCheckedChange={handleDarkModeToggle}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="units">Units</Label>
            <select
              id="units"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className="bg-input border border-border rounded-md px-3 py-2 text-foreground"
            >
              <option>SI</option>
              <option>Imperial</option>
            </select>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button>Save Settings</Button>
      </div>
    </div>
  )
}
"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Zap,Home,Battery,LibraryIcon ,CalendarDays , BarChart3, Library, FolderOpen, Settings, HelpCircle, Layers } from "lucide-react"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library/cells", label: "Cell Library", icon: Battery  },
  { href: "/library/packs", label: "Pack Library", icon: Zap },
  { href: "/library/drive-cycles", label: "Drive Cycle Library", icon: CalendarDays },
  { href: "/library/simulations", label: "Simulations", icon: Layers },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: HelpCircle },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r border-border bg-sidebar flex flex-col">
      <div className="flex-1 overflow-auto py-6 px-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-primary/20",
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </aside>
  )
}

"use client"
import { useState } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { NavBar } from "@/components/navigation/NavBar"
import { Sidebar } from "@/components/navigation/Sidebar"
import { Analytics } from "@vercel/analytics/react"
import { GeistSans } from "geist/font/sans"
import "./globals.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.className} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="h-screen flex flex-col overflow-hidden">
            <NavBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
              <main className="flex-1 overflow-auto">
                <div className="p-6 md:p-8">{children}</div>
              </main>
            </div>
          </div>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
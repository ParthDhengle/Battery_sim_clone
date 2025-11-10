// app/layout.tsx
import { ThemeProvider } from "@/components/theme-provider"
import { NavBar } from "@/components/navigation/NavBar"
import { Sidebar } from "@/components/navigation/Sidebar"
import { Analytics } from "@vercel/analytics/react"
import { GeistSans } from "geist/font/sans"
import "./globals.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.className}  font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system" // Follows OS preference by default
          enableSystem
          disableTransitionOnChange // Optional: Prevents flicker during theme change
        >
          <NavBar />
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              <div className="p-6 md:p-8">{children}</div>
            </main>
          </div>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
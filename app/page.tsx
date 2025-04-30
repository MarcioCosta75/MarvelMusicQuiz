import LandingPage from "@/components/landing-page"
import { ThemeProvider } from "@/components/theme-provider"
import { SocketProvider } from "@/context/socket-context"

export default function Home() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="marvel-quiz-theme">
      <SocketProvider>
        <main className="min-h-screen comic-bg-light dark:comic-bg-dark">
          <LandingPage />
        </main>
      </SocketProvider>
    </ThemeProvider>
  )
}

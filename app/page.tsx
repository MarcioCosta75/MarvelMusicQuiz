import LandingPage from "@/components/landing-page"
import { SocketProvider } from "@/context/socket-context"

export default function Home() {
  return (
    <SocketProvider>
      <main className="min-h-screen comic-bg-light dark:comic-bg-dark">
        <LandingPage />
      </main>
    </SocketProvider>
  )
}

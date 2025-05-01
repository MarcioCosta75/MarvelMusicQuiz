import { Button } from "@/components/ui/button"
import { ComicPanel } from "./comic-effects"
import { SpeechBubble } from "./speech-bubble"
import { ComicText } from "./comic-effects"
import { useRouter } from "next/navigation"

export default function HostDisconnected() {
  const router = useRouter()

  return (
    <ComicPanel className="max-w-2xl mx-auto">
      <div className="p-8 text-center">
        <SpeechBubble>
          <ComicText type="pow" size="lg" className="mb-6 text-red-500">
            Host Disconnected!
          </ComicText>
          <p className="text-lg mb-8 font-comic">
            The host has left the game. You will be redirected to the main page.
          </p>
        </SpeechBubble>
        <Button
          onClick={() => router.push("/")}
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-comic text-xl uppercase tracking-wider transform hover:scale-105 transition-transform border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none"
        >
          Return to Main Page
        </Button>
      </div>
    </ComicPanel>
  )
} 
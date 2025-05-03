"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { ComicPanel } from "@/components/comic-effects"
import { SpeechBubble } from "@/components/speech-bubble"
import { ComicText } from "@/components/comic-effects"
import { ArrowLeft } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="relative container mx-auto px-4 py-8 max-w-4xl min-h-screen" style={{ position: 'relative' }}>
      {/* Fundo de pontinhos (halftone) */}
      <div className="pointer-events-none select-none fixed inset-0 z-0" aria-hidden="true" style={{background: "radial-gradient(rgba(0,0,0,0.07) 1px, transparent 1.5px)", backgroundSize: "18px 18px"}} />
      <div className="relative z-10 comic-bg-light dark:comic-bg-dark">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl md:text-6xl font-comic transform -rotate-2 text-red-600 dark:text-red-500 drop-shadow-[4px_4px_0px_rgba(0,0,0,0.3)] dark:drop-shadow-[4px_4px_0px_rgba(255,255,255,0.2)]">
            <span className="inline-block transform rotate-3 text-blue-600 dark:text-blue-500">About</span>{" "}
            <span className="inline-block transform -rotate-1 text-yellow-500">The</span>{" "}
            <span className="inline-block transform rotate-2 text-red-600 dark:text-red-500">Game!</span>
          </h1>
          <ThemeToggle />
        </div>

        <ComicPanel className="relative overflow-hidden mb-8 border-4 border-black dark:border-gray-700 shadow-[8px_8px_0px_rgba(0,0,0,0.3)]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400 transform rotate-45 translate-x-16 -translate-y-16 z-0 opacity-30"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-400 transform rotate-45 -translate-x-16 translate-y-16 z-0 opacity-30"></div>
          
          <div className="p-6 relative z-10">
            <ComicText type="boom" size="lg" className="mb-6">Origin Story</ComicText>
            
            <div className="mb-8 font-comic-sans text-lg leading-relaxed">
              <SpeechBubble>
                <p className="mb-4">
                  Marvel Music Quiz was created by <span className="font-bold text-red-600 dark:text-red-400">Márcio Costa</span>, 
                  a passionate Marvel fan and developer.
                </p>
                <p className="mb-4">
                  The idea sparked during a Discord chat with his cousin <span className="font-bold text-blue-600 dark:text-blue-400">Nuno Bai</span>. 
                  Both being huge Marvel enthusiasts, Márcio said, "Okay cuz, I'm going to play some music and you have to guess 
                  which Marvel character it belongs to."
                </p>
                <p>
                  This simple challenge evolved into the full-fledged game you're playing now! While Nuno didn't participate 
                  in the development, he helped with the concept and testing, earning him a well-deserved honorable mention.
                </p>
              </SpeechBubble>
            </div>

            <div className="bg-yellow-100 dark:bg-yellow-900/40 p-6 rounded-lg border-2 border-dashed border-yellow-500 mb-8 relative overflow-hidden">
              <h2 className="text-2xl font-comic mb-6 transform -rotate-1 text-center">
                <span className="inline-block transform rotate-2 text-purple-600 dark:text-purple-400 drop-shadow-[2px_2px_0px_rgba(0,0,0,0.2)]">Honorable</span>{" "}
                <span className="inline-block transform -rotate-2 text-green-600 dark:text-green-400 drop-shadow-[2px_2px_0px_rgba(0,0,0,0.2)]">Mention</span>
              </h2>
              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                <a 
                  href="https://www.instagram.com/marcilioo75/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 border-4 border-black dark:border-white shadow-[8px_8px_0px_rgba(0,0,0,0.2)] transform rotate-2 max-w-xs w-full transition-all duration-300 hover:scale-105 hover:shadow-[12px_12px_0px_rgba(0,0,0,0.2)] active:scale-95 active:shadow-[4px_4px_0px_rgba(0,0,0,0.2)] cursor-pointer"
                >
                  <h3 className="text-center font-comic text-red-600 dark:text-red-400 mb-2">Márcio Costa</h3>
                  <p className="text-center text-sm font-comic-sans">
                    Developer, designer, and the brain behind the implementation of this marvelous quiz!
                  </p>
                  <div className="mt-3 text-center text-sm font-comic opacity-70">@marcilioo75</div>
                </a>
                <a 
                  href="https://www.instagram.com/genus_wg/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 border-4 border-black dark:border-white shadow-[8px_8px_0px_rgba(0,0,0,0.2)] transform -rotate-2 max-w-xs w-full transition-all duration-300 hover:scale-105 hover:shadow-[12px_12px_0px_rgba(0,0,0,0.2)] active:scale-95 active:shadow-[4px_4px_0px_rgba(0,0,0,0.2)] cursor-pointer"
                >
                  <h3 className="text-center font-comic text-blue-600 dark:text-blue-400 mb-2">Nuno Bai</h3>
                  <p className="text-center text-sm font-comic-sans">
                    For helping coming up with the idea, endless testing, and being an awesome Marvel expert!
                  </p>
                  <div className="mt-3 text-center text-sm font-comic opacity-70">@genus_wg</div>
                </a>
              </div>
            </div>

            <div className="text-center relative">
              <div className="absolute inset-0 flex items-center justify-center z-0">
                <div className="w-64 h-64 bg-yellow-400 opacity-10 rounded-full blur-3xl"></div>
              </div>
              <div className="relative z-10">
                <ComicText type="pow" size="md" className="mb-4">Assemble Your Team!</ComicText>
                <p className="font-comic-sans mb-6">
                  Gather your friends, test your Marvel music knowledge, and have a blast!
                </p>
              </div>
            </div>
          </div>
        </ComicPanel>

        <div className="text-center mt-8">
          <Link href="/">
            <Button className="bg-yellow-400 hover:bg-yellow-500 text-black font-comic text-lg uppercase tracking-wider transform hover:scale-105 transition-transform border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
} 
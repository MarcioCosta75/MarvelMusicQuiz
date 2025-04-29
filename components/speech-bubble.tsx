import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface SpeechBubbleProps {
  children: ReactNode
  className?: string
  type?: "thought" | "speech" | "shout"
  direction?: "left" | "right" | "top" | "bottom"
  tailPosition?: "start" | "center" | "end"
}

export function SpeechBubble({
  children,
  className,
  type = "speech",
  direction = "bottom",
  tailPosition = "center",
}: SpeechBubbleProps) {
  const getBubbleStyle = () => {
    switch (type) {
      case "thought":
        return "rounded-[50%] border-4 border-dashed"
      case "shout":
        return "rounded-lg border-4 border-black dark:border-white [clip-path:polygon(0%_0%,100%_0%,95%_88%,78%_100%,0%_100%)]"
      default:
        return "rounded-2xl border-4"
    }
  }

  const getTailStyle = () => {
    if (type === "thought") return ""

    const positionClasses = {
      start: "left-4",
      center: direction === "left" || direction === "right" ? "top-1/2 -translate-y-1/2" : "left-1/2 -translate-x-1/2",
      end: direction === "bottom" || direction === "top" ? "right-4" : "bottom-4",
    }

    const directionClasses = {
      bottom: `bottom-0 translate-y-1/2 rotate-45 ${positionClasses[tailPosition]}`,
      top: `top-0 -translate-y-1/2 rotate-45 ${positionClasses[tailPosition]}`,
      left: `left-0 -translate-x-1/2 rotate-45 ${positionClasses[tailPosition]}`,
      right: `right-0 translate-x-1/2 rotate-45 ${positionClasses[tailPosition]}`,
    }

    return directionClasses[direction]
  }

  return (
    <div
      className={cn(
        "relative bg-white dark:bg-slate-900 p-4 border-black dark:border-white font-comic-sans",
        getBubbleStyle(),
        className,
      )}
    >
      {type !== "thought" && (
        <div
          className={cn(
            "absolute w-6 h-6 bg-white dark:bg-slate-900 border-black dark:border-white border-b-4 border-r-4 z-[-1]",
            getTailStyle(),
          )}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

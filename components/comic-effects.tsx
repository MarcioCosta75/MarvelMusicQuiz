"use client"

import { cn } from "@/lib/utils"
import type { ReactNode } from "react"
import { motion } from "framer-motion"

interface ComicTextProps {
  children: ReactNode
  className?: string
  type?: "pow" | "bam" | "wham" | "boom" | "zap"
  size?: "sm" | "md" | "lg" | "xl"
}

export function ComicText({ children, className, type = "pow", size = "md" }: ComicTextProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
    xl: "text-6xl",
  }

  const typeClasses = {
    pow: "bg-yellow-400 text-red-600 rotate-6",
    bam: "bg-red-500 text-white -rotate-3",
    wham: "bg-blue-500 text-white rotate-3",
    boom: "bg-purple-500 text-white -rotate-6",
    zap: "bg-green-500 text-white rotate-12",
  }

  return (
    <div
      className={cn(
        "inline-block py-1 px-4 font-extrabold transform skew-x-6 font-comic-sans",
        "uppercase leading-none tracking-wider",
        typeClasses[type],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </div>
  )
}

interface ComicPanelProps {
  children: ReactNode
  className?: string
  active?: boolean
}

export function ComicPanel({ children, className, active = false }: ComicPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "bg-white dark:bg-gray-900 p-4 border-black dark:border-white border-[8px]",
        "shadow-[8px_8px_0px_rgba(0,0,0,0.8)] dark:shadow-[8px_8px_0px_rgba(255,255,255,0.2)]",
        active && "border-yellow-400 dark:border-yellow-400",
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

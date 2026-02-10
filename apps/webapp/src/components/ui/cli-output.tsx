import * as React from "react"
import { cn } from "@/lib/utils"
import { Copy, Trash2, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "./button"
import { Card } from "./card"

export interface CliOutputLine {
  text: string
  timestamp?: string
  level?: "debug" | "info" | "warn" | "error"
}

interface CliOutputProps {
  output: (CliOutputLine | string)[]
  prompt?: string
  autoScroll?: boolean
  maxLines?: number
  showTimestamps?: boolean
  showControls?: boolean
  onClear?: () => void
  className?: string
}

export function CliOutput({
  output,
  prompt = "$",
  autoScroll = true,
  maxLines,
  showTimestamps = false,
  showControls = true,
  onClear,
  className,
}: CliOutputProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [isMaximized, setIsMaximized] = React.useState(false)

  React.useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [output, autoScroll])

  const copyToClipboard = () => {
    const text = output
      .map((line) => (typeof line === "string" ? line : line.text))
      .join("\n")
    navigator.clipboard.writeText(text)
  }

  const parseAnsi = (text: string) => {
    // Simple ANSI parser for common colors
    // In a real scenario, we'd use a library like ansi-to-react
    return text.split(/(\x1b\[[0-9;]*m)/g).map((part, i) => {
      if (part.startsWith("\x1b[")) {
        if (part.includes("32m")) return <span key={i} className="text-green-400" /> // Green
        if (part.includes("31m")) return <span key={i} className="text-red-400" /> // Red
        if (part.includes("33m")) return <span key={i} className="text-yellow-400" /> // Yellow
        if (part.includes("34m")) return <span key={i} className="text-blue-400" /> // Blue
        if (part.includes("0m")) return "" // Reset
        return ""
      }
      return part
    })
  }

  const displayedOutput = maxLines ? output.slice(-maxLines) : output

  return (
    <Card
      className={cn(
        "bg-zinc-950 text-zinc-300 font-mono text-xs overflow-hidden border-zinc-800 flex flex-col transition-all duration-300",
        isMaximized ? "fixed inset-4 z-50 h-[calc(100vh-2rem)]" : "h-[400px]",
        className
      )}
    >
      {/* macOS Style Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-full bg-red-500/80" />
          <div className="w-3.5 h-3.5 rounded-full bg-amber-500/80" />
          <div className="w-3.5 h-3.5 rounded-full bg-green-500/80" />
        </div>
        
        {showControls && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
              onClick={copyToClipboard}
              title="Copy output"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {onClear && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                onClick={onClear}
                title="Clear output"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? "Minimize" : "Maximize"}
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Terminal Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 selection:bg-zinc-700 selection:text-white"
      >
        {displayedOutput.length === 0 && (
          <div className="text-zinc-600 italic">Waiting for logs...</div>
        )}
        {displayedOutput.map((line, i) => {
          const text = typeof line === "string" ? line : line.text
          const timestamp = typeof line === "string" ? null : line.timestamp
          const level = typeof line === "string" ? null : line.level

          return (
            <div key={i} className="flex gap-2 group">
              {showTimestamps && timestamp && (
                <span className="text-zinc-600 flex-shrink-0 tabular-nums">
                  [{new Date(timestamp).toLocaleTimeString()}]
                </span>
              )}
              <span className="text-zinc-500 flex-shrink-0">{prompt}</span>
              <span
                className={cn(
                  "flex-1 break-words",
                  level === "error" && "text-red-400",
                  level === "warn" && "text-amber-400",
                  level === "debug" && "text-zinc-500"
                )}
              >
                {parseAnsi(text)}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

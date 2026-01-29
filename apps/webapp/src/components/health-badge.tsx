import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface HealthBadgeProps {
  status: "healthy" | "unhealthy" | "loading"
  className?: string
}

export function HealthBadge({ status, className }: HealthBadgeProps) {
  // Map status to styles
  // healthy -> success style (mimicking legacy: green background/text)
  // unhealthy -> destructive (red)
  // loading -> secondary (gray/blueish)

  if (status === "healthy") {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-200", 
          className
        )}
      >
        Healthy
      </Badge>
    )
  }

  if (status === "unhealthy") {
    return (
      <Badge variant="destructive" className={className}>
        Unhealthy
      </Badge>
    )
  }

  if (status === "loading") {
    return (
      <Badge variant="secondary" className={className}>
        Loading...
      </Badge>
    )
  }

  return null
}

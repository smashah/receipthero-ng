import * as React from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface StatusCardProps extends React.ComponentProps<typeof Card> {
  title: string
  status: "ok" | "error" | "loading"
  subtitle?: string
  icon?: React.ReactNode
  children?: React.ReactNode
}

export function StatusCard({
  title,
  status,
  subtitle,
  icon,
  children,
  className,
  ...props
}: StatusCardProps) {
  const statusStyles = {
    ok: "border-green-500 ring-green-500/20",
    error: "border-red-500 ring-red-500/20",
    loading: "border-gray-300 ring-gray-300/20",
  }

  return (
    <Card
      className={cn(
        "border transition-colors", 
        statusStyles[status], 
        className
      )}
      {...props}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  )
}

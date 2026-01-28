import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";

interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  checks: {
    paperlessConnection: "ok" | "error";
    togetherAiConnection: "ok" | "error";
    config: "ok" | "error";
  };
  errors?: string[];
}

/**
 * Health check endpoint for Docker and monitoring systems.
 * 
 * Checks:
 * 1. Configuration validity
 * 2. Paperless-NGX connectivity (actual API call)
 * 3. Together AI configuration (API key presence)
 * 
 * Returns 200 OK if all checks pass, 503 Service Unavailable otherwise.
 */
export async function GET() {
  const status: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      paperlessConnection: "ok",
      togetherAiConnection: "ok",
      config: "ok",
    },
  };
  const errors: string[] = [];

  // 1. Config Check
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    status.checks.config = "error";
    status.status = "unhealthy";
    errors.push(`Config validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 2. Together AI Connection Check
  if (config) {
    // Basic verification of API key
    if (!config.togetherAi.apiKey || config.togetherAi.apiKey.length < 10 || config.togetherAi.apiKey === "your-together-ai-api-key") {
      status.checks.togetherAiConnection = "error";
      status.status = "unhealthy";
      errors.push("Together AI API key is missing, too short, or using default placeholder");
    }
  } else {
    status.checks.togetherAiConnection = "error";
    status.status = "unhealthy";
  }

  // 3. Paperless Connection Check
  if (config) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Check Paperless root API endpoint
      const paperlessUrl = `${config.paperless.host.replace(/\/$/, "")}/api/`;
      const response = await fetch(paperlessUrl, {
        headers: {
          Authorization: `Token ${config.paperless.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        status.checks.paperlessConnection = "error";
        status.status = "unhealthy";
        errors.push(`Paperless connection failed with status ${response.status} at ${paperlessUrl}`);
      }
    } catch (error) {
      status.checks.paperlessConnection = "error";
      status.status = "unhealthy";
      
      let message = "Unknown error";
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          message = "Timeout after 5000ms";
        } else {
          message = error.message;
        }
      }
      errors.push(`Paperless connection failed: ${message}`);
    }
  } else {
    status.checks.paperlessConnection = "error";
    status.status = "unhealthy";
  }

  if (errors.length > 0) {
    status.errors = errors;
  }

  // Set Cache-Control to prevent caching health status
  return NextResponse.json(status, { 
    status: status.status === "healthy" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    }
  });
}

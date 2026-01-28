import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { ConfigSchema, CONFIG_PATH } from "@/lib/config";

// Helper to mask API keys
function maskKey(key: string | undefined) {
  if (!key) return "";
  if (key.length < 8) return "********";
  return `${key.substring(0, 3)}...${key.substring(key.length - 4)}`;
}

export async function GET() {
  try {
    let config: any = {};
    
    // Try to read config file
    if (fs.existsSync(CONFIG_PATH)) {
      try {
        const fileContent = fs.readFileSync(CONFIG_PATH, "utf-8");
        config = JSON.parse(fileContent);
      } catch (e) {
        console.warn("Failed to parse config file, using defaults");
      }
    }
    
    // Construct response with safe defaults or loaded values
    const responseConfig = {
      paperless: {
        host: config.paperless?.host || "",
        apiKey: maskKey(config.paperless?.apiKey),
      },
      togetherAi: {
        apiKey: maskKey(config.togetherAi?.apiKey),
      },
      processing: {
        scanInterval: config.processing?.scanInterval || 300000,
        receiptTag: config.processing?.receiptTag || "receipt",
        processedTag: config.processing?.processedTag || "ai-processed",
        failedTag: config.processing?.failedTag || "ai-failed",
        maxRetries: config.processing?.maxRetries || 3,
      }
    };

    return NextResponse.json(responseConfig);
  } catch (error) {
    console.error("Error reading config:", error);
    return NextResponse.json({ error: "Failed to read configuration" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Read existing config to handle masked keys
    let existingConfig: any = {};
    if (fs.existsSync(CONFIG_PATH)) {
      try {
        existingConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      } catch (e) {
        // Ignore parse errors on existing file
      }
    }
    
    const newConfig = { ...body };
    
    // Helper to check if key is masked
    const isMasked = (key: string) => key && (key.includes("...") || key === "********");
    
    // Restore masked keys
    if (isMasked(newConfig.paperless?.apiKey) && existingConfig.paperless?.apiKey) {
      newConfig.paperless.apiKey = existingConfig.paperless.apiKey;
    }
    
    if (isMasked(newConfig.togetherAi?.apiKey) && existingConfig.togetherAi?.apiKey) {
      newConfig.togetherAi.apiKey = existingConfig.togetherAi.apiKey;
    }

    // Validate
    const result = ConfigSchema.safeParse(newConfig);
    if (!result.success) {
      return NextResponse.json({ 
        error: "Validation failed", 
        details: result.error.issues 
      }, { status: 400 });
    }
    
    // Ensure directory exists
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(result.data, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving config:", error);
    return NextResponse.json({ error: "Failed to save configuration" }, { status: 500 });
  }
}

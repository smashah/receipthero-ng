import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { host, apiKey } = await request.json();
    
    if (!host || !apiKey) {
      return NextResponse.json({ error: "Host and API key are required" }, { status: 400 });
    }
    
    // Normalize host (remove trailing slash)
    const normalizedHost = host.replace(/\/$/, "");
    
    // Set 5s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      // Paperless-ngx API root usually returns a list of endpoints or requires authentication
      const response = await fetch(`${normalizedHost}/api/`, {
        headers: {
          "Authorization": `Token ${apiKey}`,
          "Accept": "application/json"
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ 
          error: `Failed to connect: ${response.status} ${response.statusText}` 
        }, { status: response.status });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
         return NextResponse.json({ error: "Connection timed out (5s)" }, { status: 504 });
      }
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Connection failed" }, { status: 500 });
  }
}

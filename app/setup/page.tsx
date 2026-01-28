"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/ui/card";
import { useToast } from "@/ui/toast";
import { Loader2, Check, AlertCircle, Settings2, Receipt, Brain, Save } from "lucide-react";
import { cn } from "@/lib/utils";

// Simple Label component since it's missing in ui/
function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}

// Simple Input component since it's missing in ui/
function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export default function SetupPage() {
  const router = useRouter();
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingPaperless, setTestingPaperless] = useState(false);
  const [testingTogether, setTestingTogether] = useState(false);
  
  const [config, setConfig] = useState({
    paperless: { host: "", apiKey: "" },
    togetherAi: { apiKey: "" },
    processing: {
      scanInterval: 300000,
      receiptTag: "receipt",
      processedTag: "ai-processed",
      failedTag: "ai-failed",
      maxRetries: 3
    }
  });

  // Load initial config
  useEffect(() => {
    fetch("/api/config")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Failed to load config");
      })
      .then((data) => {
        setConfig(data);
      })
      .catch((err) => {
        console.error(err);
        addToast("Failed to load configuration", "error");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [addToast]);

  const handlePaperlessChange = (field: string, value: string) => {
    setConfig((prev) => ({
      ...prev,
      paperless: { ...prev.paperless, [field]: value }
    }));
  };

  const handleTogetherChange = (field: string, value: string) => {
    setConfig((prev) => ({
      ...prev,
      togetherAi: { ...prev.togetherAi, [field]: value }
    }));
  };

  const handleProcessingChange = (field: string, value: string | number) => {
    setConfig((prev) => ({
      ...prev,
      processing: { ...prev.processing, [field]: value }
    }));
  };

  const testPaperless = async () => {
    if (!config.paperless.host || !config.paperless.apiKey) {
      addToast("Please fill in Paperless host and API key", "warning");
      return;
    }
    
    setTestingPaperless(true);
    try {
      const res = await fetch("/api/config/test-paperless", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config.paperless),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        addToast("Connection successful!", "success");
      } else {
        addToast(`Connection failed: ${data.error}`, "error");
      }
    } catch (error) {
      addToast("Failed to test connection", "error");
    } finally {
      setTestingPaperless(false);
    }
  };

  const testTogether = async () => {
    if (!config.togetherAi.apiKey) {
      addToast("Please fill in Together AI API key", "warning");
      return;
    }
    
    setTestingTogether(true);
    try {
      const res = await fetch("/api/config/test-together", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config.togetherAi),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        addToast("API key format looks good!", "success");
      } else {
        addToast(`Validation failed: ${data.error}`, "error");
      }
    } catch (error) {
      addToast("Failed to validate key", "error");
    } finally {
      setTestingTogether(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      // Validate basic requirements
      if (!config.paperless.host || !config.paperless.apiKey) {
        addToast("Paperless configuration is incomplete", "warning");
        setSaving(false);
        return;
      }
      
      if (!config.togetherAi.apiKey) {
        addToast("Together AI configuration is incomplete", "warning");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      
      if (res.ok) {
        addToast("Configuration saved successfully!", "success");
        router.push("/");
      } else {
        const data = await res.json();
        addToast(`Failed to save: ${JSON.stringify(data.error)}`, "error");
      }
    } catch (error) {
      addToast("An error occurred while saving", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">ReceiptHero Setup</h1>
          <p className="text-muted-foreground">
            Configure your Paperless-NGX and Together AI integration
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              <CardTitle>Configuration</CardTitle>
            </div>
            <CardDescription>
              Enter your credentials to connect the services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Paperless Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Paperless-NGX
                </h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={testPaperless}
                  disabled={testingPaperless}
                >
                  {testingPaperless ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="paperless-host">Host URL</Label>
                <Input
                  id="paperless-host"
                  placeholder="http://192.168.1.100:8000"
                  value={config.paperless.host}
                  onChange={(e) => handlePaperlessChange("host", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The full URL to your Paperless-NGX instance (including port)
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="paperless-key">API Key</Label>
                <Input
                  id="paperless-key"
                  type="password"
                  placeholder="Paste your API token here"
                  value={config.paperless.apiKey}
                  onChange={(e) => handlePaperlessChange("apiKey", e.target.value)}
                />
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4" /> Together AI
                </h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={testTogether}
                  disabled={testingTogether}
                >
                  {testingTogether ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Test Key
                </Button>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="together-key">API Key</Label>
                <Input
                  id="together-key"
                  type="password"
                  placeholder="Paste your Together AI API key"
                  value={config.togetherAi.apiKey}
                  onChange={(e) => handleTogetherChange("apiKey", e.target.value)}
                />
              </div>
            </div>

            <div className="border-t pt-6">
              <details className="group">
                <summary className="flex items-center cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Advanced Processing Settings
                </summary>
                <div className="pt-4 space-y-4 pl-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scan-interval">Scan Interval (ms)</Label>
                      <Input
                        id="scan-interval"
                        type="number"
                        value={config.processing.scanInterval}
                        onChange={(e) => handleProcessingChange("scanInterval", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-retries">Max Retries</Label>
                      <Input
                        id="max-retries"
                        type="number"
                        value={config.processing.maxRetries}
                        onChange={(e) => handleProcessingChange("maxRetries", parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tag-receipt">Receipt Tag</Label>
                      <Input
                        id="tag-receipt"
                        value={config.processing.receiptTag}
                        onChange={(e) => handleProcessingChange("receiptTag", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tag-processed">Processed Tag</Label>
                      <Input
                        id="tag-processed"
                        value={config.processing.processedTag}
                        onChange={(e) => handleProcessingChange("processedTag", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tag-failed">Failed Tag</Label>
                      <Input
                        id="tag-failed"
                        value={config.processing.failedTag}
                        onChange={(e) => handleProcessingChange("failedTag", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </details>
            </div>

          </CardContent>
          <CardFooter className="flex justify-between border-t pt-6">
            <Button variant="ghost" onClick={() => router.push("/")}>
              Cancel
            </Button>
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

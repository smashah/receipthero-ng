import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { 
  Settings2, 
  Receipt, 
  Brain, 
  Save, 
  Loader2, 
  Check, 
  ArrowLeft,
  Server,
  Activity
} from 'lucide-react'

import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Separator } from '../components/ui/separator'

import { 
  useConfig, 
  useSaveConfig, 
  useTestPaperless, 
  useTestTogether 
} from '../lib/queries'
import type { Config } from '@sm-rn/shared'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const navigate = useNavigate()
  const { data: remoteConfig, isLoading: isLoadingConfig } = useConfig()
  const saveConfigMutation = useSaveConfig()
  const testPaperlessMutation = useTestPaperless()
  const testTogetherMutation = useTestTogether()

  const [localConfig, setLocalConfig] = useState<Config>({
    paperless: { host: '', apiKey: '' },
    togetherAi: { apiKey: '' },
    processing: {
      scanInterval: 300000,
      receiptTag: 'receipt',
      processedTag: 'ai-processed',
      failedTag: 'ai-failed',
      maxRetries: 3
    },
    rateLimit: {
      enabled: false,
      upstashUrl: '',
      upstashToken: ''
    },
    observability: {
      heliconeEnabled: false,
      heliconeApiKey: ''
    }
  })

  // Sync local state when remote config loads
  useEffect(() => {
    if (remoteConfig) {
      setLocalConfig(remoteConfig)
    }
  }, [remoteConfig])

  const handlePaperlessChange = (field: keyof Config['paperless'], value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      paperless: { ...prev.paperless, [field]: value }
    }))
  }

  const handleTogetherChange = (field: keyof Config['togetherAi'], value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      togetherAi: { ...prev.togetherAi, [field]: value }
    }))
  }

  const handleProcessingChange = (field: keyof Config['processing'], value: string | number) => {
    setLocalConfig(prev => ({
      ...prev,
      processing: { ...prev.processing, [field]: value }
    }))
  }

  const handleRateLimitChange = (field: keyof NonNullable<Config['rateLimit']>, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      rateLimit: { ...prev.rateLimit!, [field]: value }
    }))
  }

  const handleObservabilityChange = (field: keyof NonNullable<Config['observability']>, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      observability: { ...prev.observability!, [field]: value }
    }))
  }

  const handleTestPaperless = async () => {
    if (!localConfig.paperless.host || !localConfig.paperless.apiKey) {
      toast.warning('Please fill in Paperless host and API key')
      return
    }

    try {
      const result = await testPaperlessMutation.mutateAsync()
      if (result.success) {
        toast.success(result.message || 'Connection successful!')
      } else {
        toast.error(result.error || 'Connection failed')
      }
    } catch (error) {
      toast.error('Failed to test connection')
    }
  }

  const handleTestTogether = async () => {
    if (!localConfig.togetherAi.apiKey) {
      toast.warning('Please fill in Together AI API key')
      return
    }

    try {
      const result = await testTogetherMutation.mutateAsync()
      if (result.success) {
        toast.success(result.message || 'API key looks good!')
      } else {
        toast.error(result.error || 'Validation failed')
      }
    } catch (error) {
      toast.error('Failed to validate key')
    }
  }

  const isMasked = (value: string | undefined) => {
    if (!value) return false
    return value.includes('***') || value.includes('...')
  }

  const handleSave = async () => {
    // Validation
    if (!localConfig.paperless.host) {
      toast.error('Paperless Host is required')
      return
    }
    try {
      new URL(localConfig.paperless.host)
    } catch {
      toast.error('Invalid Paperless Host URL')
      return
    }
    
    if (!localConfig.paperless.apiKey) {
      toast.error('Paperless API Key is required')
      return
    }

    if (!localConfig.togetherAi.apiKey) {
      toast.error('Together AI API Key is required')
      return
    }

    // Prepare payload - omit masked fields
    const payload = JSON.parse(JSON.stringify(localConfig))

    if (isMasked(payload.paperless.apiKey)) {
      delete payload.paperless.apiKey
    }

    if (isMasked(payload.togetherAi.apiKey)) {
      delete payload.togetherAi.apiKey
    }
    
    if (payload.rateLimit && isMasked(payload.rateLimit.upstashToken)) {
      delete payload.rateLimit.upstashToken
    }
    
    if (payload.observability && isMasked(payload.observability.heliconeApiKey)) {
      delete payload.observability.heliconeApiKey
    }

    try {
      await saveConfigMutation.mutateAsync(payload)
      toast.success('Configuration saved successfully!')
      navigate({ to: '/' })
    } catch (error) {
      toast.error('Failed to save configuration')
    }
  }

  if (isLoadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
            <p className="text-muted-foreground">
              Manage your connections and processing settings
            </p>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              <CardTitle>Core Settings</CardTitle>
            </div>
            <CardDescription>
              Configure the essential services for receipt processing
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
                  onClick={handleTestPaperless}
                  disabled={testPaperlessMutation.isPending}
                >
                  {testPaperlessMutation.isPending ? (
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
                  value={localConfig.paperless.host}
                  onChange={(e) => handlePaperlessChange('host', e.target.value)}
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
                  value={localConfig.paperless.apiKey}
                  onChange={(e) => handlePaperlessChange('apiKey', e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Together AI Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4" /> Together AI
                </h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleTestTogether}
                  disabled={testTogetherMutation.isPending}
                >
                  {testTogetherMutation.isPending ? (
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
                  value={localConfig.togetherAi.apiKey}
                  onChange={(e) => handleTogetherChange('apiKey', e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Processing Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4" /> Processing
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scan-interval">Scan Interval (ms)</Label>
                  <Input
                    id="scan-interval"
                    type="number"
                    value={localConfig.processing.scanInterval}
                    onChange={(e) => handleProcessingChange('scanInterval', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-retries">Max Retries</Label>
                  <Input
                    id="max-retries"
                    type="number"
                    value={localConfig.processing.maxRetries}
                    onChange={(e) => handleProcessingChange('maxRetries', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tag-receipt">Receipt Tag</Label>
                  <Input
                    id="tag-receipt"
                    value={localConfig.processing.receiptTag}
                    onChange={(e) => handleProcessingChange('receiptTag', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-processed">Processed Tag</Label>
                  <Input
                    id="tag-processed"
                    value={localConfig.processing.processedTag}
                    onChange={(e) => handleProcessingChange('processedTag', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-failed">Failed Tag</Label>
                  <Input
                    id="tag-failed"
                    value={localConfig.processing.failedTag}
                    onChange={(e) => handleProcessingChange('failedTag', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <div className="space-y-4">
           <details className="group">
            <summary className="flex items-center cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground select-none">
              <Settings2 className="h-4 w-4 mr-2" />
              Advanced Settings
            </summary>
            
            <div className="mt-4 space-y-6 pl-1">
              {/* Rate Limiting */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    <CardTitle className="text-base">Rate Limiting (Upstash)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="ratelimit-enabled"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={localConfig.rateLimit?.enabled || false}
                      onChange={(e) => handleRateLimitChange('enabled', e.target.checked)}
                    />
                    <Label htmlFor="ratelimit-enabled">Enable Rate Limiting</Label>
                  </div>

                  {localConfig.rateLimit?.enabled && (
                    <div className="grid gap-4 pl-6 border-l-2 border-gray-100 ml-2">
                      <div className="grid gap-2">
                        <Label htmlFor="upstash-url">Upstash Redis URL</Label>
                        <Textarea
                          id="upstash-url"
                          placeholder="https://..."
                          className="font-mono text-xs"
                          rows={2}
                          value={localConfig.rateLimit?.upstashUrl || ''}
                          onChange={(e) => handleRateLimitChange('upstashUrl', e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="upstash-token">Upstash Token</Label>
                        <Textarea
                          id="upstash-token"
                          type="password"
                          placeholder="Secret token"
                          className="font-mono text-xs"
                          rows={3}
                          value={localConfig.rateLimit?.upstashToken || ''}
                          onChange={(e) => handleRateLimitChange('upstashToken', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Observability */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    <CardTitle className="text-base">Observability (Helicone)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="helicone-enabled"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={localConfig.observability?.heliconeEnabled || false}
                      onChange={(e) => handleObservabilityChange('heliconeEnabled', e.target.checked)}
                    />
                    <Label htmlFor="helicone-enabled">Enable Helicone</Label>
                  </div>

                  {localConfig.observability?.heliconeEnabled && (
                    <div className="grid gap-4 pl-6 border-l-2 border-gray-100 ml-2">
                      <div className="grid gap-2">
                        <Label htmlFor="helicone-key">Helicone API Key</Label>
                        <Textarea
                          id="helicone-key"
                          type="password"
                          placeholder="sk-..."
                          className="font-mono text-xs"
                          rows={2}
                          value={localConfig.observability?.heliconeApiKey || ''}
                          onChange={(e) => handleObservabilityChange('heliconeApiKey', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </details>
        </div>

        <div className="flex justify-end pt-6">
          <Button size="lg" onClick={handleSave} disabled={saveConfigMutation.isPending}>
            {saveConfigMutation.isPending ? (
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
        </div>
      </div>
    </div>
  )
}

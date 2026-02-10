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
  Activity,
  Coins
} from 'lucide-react'

import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Separator } from '../components/ui/separator'
import { Switch } from '../components/ui/switch'

import { 
  useConfig, 
  useSaveConfig, 
  useTestPaperless, 
  useTestTogether,
  useAvailableCurrencies
} from '../lib/queries'
import { FetchError, type ZodIssue } from '../lib/api'
import { type Config, PartialConfigSchema } from '@sm-rn/shared/schemas'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '../components/ui/combobox'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const navigate = useNavigate()
  const { data: remoteConfig, isLoading: isLoadingConfig } = useConfig()
  const saveConfigMutation = useSaveConfig()
  const testPaperlessMutation = useTestPaperless()
  const testTogetherMutation = useTestTogether()
  const { data: availableCurrencies = [] } = useAvailableCurrencies()

  const [errors, setErrors] = useState<Record<string, string>>({})

  const [localConfig, setLocalConfig] = useState<Config>({
    paperless: { host: '', apiKey: '' },
    ai: {
      provider: 'openai-compat',
      apiKey: '',
      baseURL: '',
      model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'
    },
    togetherAi: { apiKey: '' },
    processing: {
      scanInterval: 300000,
      receiptTag: 'receipt',
      processedTag: 'ai-processed',
      failedTag: 'ai-failed',
      skippedTag: 'ai-skipped',
      maxRetries: 3,
      retryStrategy: 'partial',
      useDocumentType: false,
      documentTypeName: 'receipt',
      updateContent: true,
      addJsonPayload: true,
      autoTag: true,
      currencyConversion: {
        enabled: false,
        targetCurrencies: ['GBP', 'USD']
      }
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
    setErrors(prev => {
      const next = { ...prev }
      delete next[`paperless.${field}`]
      return next
    })
  }

  const handleTogetherChange = (field: keyof NonNullable<Config['togetherAi']>, value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      togetherAi: { ...(prev.togetherAi || { apiKey: '' }), [field]: value }
    }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[`togetherAi.${field}`]
      return next
    })
  }

  const handleProcessingChange = (field: keyof Config['processing'], value: string | number) => {
    setLocalConfig(prev => ({
      ...prev,
      processing: { ...prev.processing, [field]: value }
    }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[`processing.${field}`]
      return next
    })
  }

  const handleCurrencyConversionChange = (field: 'enabled' | 'targetCurrencies', value: boolean | string[]) => {
    setLocalConfig(prev => ({
      ...prev,
      processing: {
        ...prev.processing,
        currencyConversion: {
          ...prev.processing.currencyConversion,
          [field]: value
        }
      }
    }))
  }

  const currencyAnchor = useComboboxAnchor()

  const handleRateLimitChange = (field: keyof NonNullable<Config['rateLimit']>, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      rateLimit: { ...prev.rateLimit!, [field]: value }
    }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[`rateLimit.${field}`]
      return next
    })
  }

  const handleObservabilityChange = (field: keyof NonNullable<Config['observability']>, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      observability: { ...prev.observability!, [field]: value }
    }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[`observability.${field}`]
      return next
    })
  }

  const handleTestPaperless = async () => {
    if (!localConfig.paperless.host || !localConfig.paperless.apiKey) {
      toast.warning('Please fill in Paperless host and API key')
      return
    }

    try {
      const result = await testPaperlessMutation.mutateAsync(localConfig.paperless)
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
    if (!localConfig.togetherAi?.apiKey) {
      toast.warning('Please fill in Together AI API key')
      return
    }

    try {
      const result = await testTogetherMutation.mutateAsync({
        apiKey: localConfig.togetherAi?.apiKey || ''
      })
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
    setErrors({})
    
    // Prepare payload - omit masked fields (they'll be preserved by API)
    const payload = JSON.parse(JSON.stringify(localConfig))

    // Remove masked values - API will preserve existing
    if (isMasked(payload.paperless?.apiKey)) {
      delete payload.paperless.apiKey
    }
    if (isMasked(payload.togetherAi?.apiKey)) {
      payload.togetherAi = payload.togetherAi || { apiKey: '' }
      delete payload.togetherAi.apiKey
    }
    if (payload.rateLimit && isMasked(payload.rateLimit.upstashToken)) {
      delete payload.rateLimit.upstashToken
    }
    if (payload.observability && isMasked(payload.observability.heliconeApiKey)) {
      delete payload.observability.heliconeApiKey
    }

    // Clean up empty nested objects
    if (payload.paperless && Object.keys(payload.paperless).length === 0) {
      delete payload.paperless
    }
    if (payload.togetherAi && Object.keys(payload.togetherAi).length === 0) {
      delete payload.togetherAi
    }

    // Client-side validation using the same schema as API (PartialConfigSchema)
    const validation = PartialConfigSchema.safeParse(payload)
    if (!validation.success) {
      const newErrors: Record<string, string> = {}
      validation.error.issues.forEach((issue) => {
        const path = issue.path.join('.')
        newErrors[path] = issue.message
      })
      setErrors(newErrors)
      
      const firstIssue = validation.error.issues[0]
      const fieldLabel = firstIssue.path
        .map(p => {
          const s = String(p)
          if (s === 'apiKey') return 'API Key'
          if (s === 'togetherAi') return 'Together AI'
          return s.charAt(0).toUpperCase() + s.slice(1)
        })
        .join(' ')
      
      toast.error(`${fieldLabel}: ${firstIssue.message}`)
      return
    }

    try {
      await saveConfigMutation.mutateAsync(payload)
      toast.success('Configuration saved successfully!')
      navigate({ to: '/' })
    } catch (error) {
      if (error instanceof FetchError && error.isValidationError) {
        // Handle validation errors with field-specific messages from API
        const issues = error.validationIssues
        if (issues && issues.length > 0) {
          const newErrors: Record<string, string> = {}
          issues.forEach((issue: ZodIssue) => {
            const path = issue.path.join('.')
            newErrors[path] = issue.message
          })
          setErrors(newErrors)

          // Show first validation error in toast (human readable)
          const firstIssue = issues[0]
          const fieldLabel = firstIssue.path
            .map(p => {
              const s = String(p)
              if (s === 'apiKey') return 'API Key'
              if (s === 'togetherAi') return 'Together AI'
              if (s === 'upstashUrl') return 'Upstash URL'
              if (s === 'upstashToken') return 'Upstash Token'
              if (s === 'heliconeApiKey') return 'Helicone API Key'
              return s.charAt(0).toUpperCase() + s.slice(1)
            })
            .join(' ')
          
          toast.error(`${fieldLabel}: ${firstIssue.message}`)
        } else {
          toast.error(error.message || 'Validation failed')
        }
      } else if (error instanceof FetchError) {
        toast.error(error.message || 'Failed to save configuration')
      } else {
        toast.error('Failed to save configuration')
      }
    }
  }

  const ErrorMessage = ({ path }: { path: string }) => {
    if (!errors[path]) return null
    return (
      <p className="text-xs font-medium text-destructive mt-1">
        {errors[path]}
      </p>
    )
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
          <Link to="/" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
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
                  className={errors['paperless.host'] ? 'border-destructive' : ''}
                />
                <ErrorMessage path="paperless.host" />
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
                  className={errors['paperless.apiKey'] ? 'border-destructive' : ''}
                />
                <ErrorMessage path="paperless.apiKey" />
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
                  value={localConfig.togetherAi?.apiKey || ''}
                  onChange={(e) => handleTogetherChange('apiKey', e.target.value)}
                  className={errors['togetherAi.apiKey'] ? 'border-destructive' : ''}
                />
                <ErrorMessage path="togetherAi.apiKey" />
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
                    className={errors['processing.scanInterval'] ? 'border-destructive' : ''}
                  />
                  <ErrorMessage path="processing.scanInterval" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-retries">Max Retries</Label>
                  <Input
                    id="max-retries"
                    type="number"
                    value={localConfig.processing.maxRetries}
                    onChange={(e) => handleProcessingChange('maxRetries', parseInt(e.target.value) || 0)}
                    className={errors['processing.maxRetries'] ? 'border-destructive' : ''}
                  />
                  <ErrorMessage path="processing.maxRetries" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="retry-strategy">Retry Strategy</Label>
                  <select
                    id="retry-strategy"
                    value={localConfig.processing.retryStrategy}
                    onChange={(e) => handleProcessingChange('retryStrategy', e.target.value as any)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="partial">Partial (Reuse AI Data)</option>
                    <option value="full">Full (Redo AI Extraction)</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Partial retries skip AI extraction if receipt data was already captured.
                  </p>
                </div>
              </div>

              {/* Document Detection Mode */}
              <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="use-document-type" className="font-medium">Use Document Type</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Detect receipts by document_type instead of tag (useful if you already have document types set up)
                    </p>
                  </div>
                  <Switch
                    id="use-document-type"
                    checked={localConfig.processing.useDocumentType ?? false}
                    onCheckedChange={(checked) => handleProcessingChange('useDocumentType', checked as any)}
                  />
                </div>
                
                {localConfig.processing.useDocumentType && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="document-type-name">Document Type Name</Label>
                      <Input
                        id="document-type-name"
                        value={localConfig.processing.documentTypeName ?? 'receipt'}
                        onChange={(e) => handleProcessingChange('documentTypeName', e.target.value)}
                        placeholder="receipt"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Name of the document type to look for (case-insensitive)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tag-receipt">Receipt Tag</Label>
                  <Input
                    id="tag-receipt"
                    value={localConfig.processing.receiptTag}
                    onChange={(e) => handleProcessingChange('receiptTag', e.target.value)}
                    className={errors['processing.receiptTag'] ? 'border-destructive' : ''}
                  />
                  <ErrorMessage path="processing.receiptTag" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-processed">Processed Tag</Label>
                  <Input
                    id="tag-processed"
                    value={localConfig.processing.processedTag}
                    onChange={(e) => handleProcessingChange('processedTag', e.target.value)}
                    className={errors['processing.processedTag'] ? 'border-destructive' : ''}
                  />
                  <ErrorMessage path="processing.processedTag" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-failed">Failed Tag</Label>
                  <Input
                    id="tag-failed"
                    value={localConfig.processing.failedTag}
                    onChange={(e) => handleProcessingChange('failedTag', e.target.value)}
                    className={errors['processing.failedTag'] ? 'border-destructive' : ''}
                  />
                  <ErrorMessage path="processing.failedTag" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-skipped">Skipped Tag</Label>
                  <Input
                    id="tag-skipped"
                    value={localConfig.processing.skippedTag}
                    onChange={(e) => handleProcessingChange('skippedTag', e.target.value)}
                    className={errors['processing.skippedTag'] ? 'border-destructive' : ''}
                  />
                  <ErrorMessage path="processing.skippedTag" />
                </div>
              </div>

              <Separator />

              {/* Currency Conversion */}
              <div className="space-y-4">
                <h4 className="text-md font-medium flex items-center gap-2">
                  <Coins className="h-4 w-4" /> Currency Conversion
                </h4>
                <p className="text-xs text-muted-foreground -mt-2">
                  Convert receipt amounts to target currencies using ECB weekly average exchange rates
                </p>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="currency-conversion-enabled"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={localConfig.processing.currencyConversion?.enabled || false}
                    onChange={(e) => handleCurrencyConversionChange('enabled', e.target.checked)}
                  />
                  <Label htmlFor="currency-conversion-enabled">Enable Currency Conversion</Label>
                </div>

                {localConfig.processing.currencyConversion?.enabled && (
                  <div className="grid gap-4 pl-6 border-l-2 border-gray-100 ml-2">
                    <div className="grid gap-2">
                      <Label>Target Currencies</Label>
                      <Combobox
                        items={availableCurrencies.map(c => c.code)}
                        multiple
                        value={localConfig.processing.currencyConversion?.targetCurrencies || []}
                        onValueChange={(currencies) => handleCurrencyConversionChange('targetCurrencies', currencies)}
                      >
                        <ComboboxChips ref={currencyAnchor}>
                          <ComboboxValue>
                            {(localConfig.processing.currencyConversion?.targetCurrencies || ["GBP"]).map((currency) => (
                              <ComboboxChip key={currency}>{currency}</ComboboxChip>
                            ))}
                          </ComboboxValue>
                          <ComboboxChipsInput placeholder="Add currency..." />
                        </ComboboxChips>
                        <ComboboxContent anchor={currencyAnchor}>
                          <ComboboxEmpty>No currencies found.</ComboboxEmpty>
                          <ComboboxList>
                            {(code) => {
                              const info = availableCurrencies.find(c => c.code === code);
                              return (
                                <ComboboxItem key={code} value={code}>
                                  <span className="font-medium">{code}</span>
                                  {info && <span className="ml-2 text-muted-foreground text-xs">{info.name}</span>}
                                </ComboboxItem>
                              );
                            }}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                      <p className="text-xs text-muted-foreground">
                        Select currencies to convert receipt amounts to using ECB rates
                      </p>
                    </div>
                  </div>
                )}
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
                          className={`font-mono text-xs ${errors['rateLimit.upstashUrl'] ? 'border-destructive' : ''}`}
                          rows={2}
                          value={localConfig.rateLimit?.upstashUrl || ''}
                          onChange={(e) => handleRateLimitChange('upstashUrl', e.target.value)}
                        />
                        <ErrorMessage path="rateLimit.upstashUrl" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="upstash-token">Upstash Token</Label>
                        <Textarea
                          id="upstash-token"
                          placeholder="Secret token"
                          className={`font-mono text-xs ${errors['rateLimit.upstashToken'] ? 'border-destructive' : ''}`}
                          rows={3}
                          value={localConfig.rateLimit?.upstashToken || ''}
                          onChange={(e) => handleRateLimitChange('upstashToken', e.target.value)}
                        />
                        <ErrorMessage path="rateLimit.upstashToken" />
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
                          placeholder="sk-..."
                          className={`font-mono text-xs ${errors['observability.heliconeApiKey'] ? 'border-destructive' : ''}`}
                          rows={2}
                          value={localConfig.observability?.heliconeApiKey || ''}
                          onChange={(e) => handleObservabilityChange('heliconeApiKey', e.target.value)}
                        />
                        <ErrorMessage path="observability.heliconeApiKey" />
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

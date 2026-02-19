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
  ArrowRight,
  Workflow,
  Activity,
  Server,
  Coins,
  Webhook,
  Copy,
  RefreshCw,
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
  useTestAi,
  useAvailableCurrencies,
  useWebhookStatus
} from '../lib/queries'
import { FetchError, type ZodIssue } from '../lib/api'
import { type Config, type AIProvider, PartialConfigSchema } from '@sm-rn/shared/schemas'
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
  const testAiMutation = useTestAi()
  const { data: availableCurrencies = [] } = useAvailableCurrencies()
  const { data: webhookStatus } = useWebhookStatus()

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
    },
    webhooks: {
      enabled: false,
      secret: ''
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

  // Default base URLs per provider
  const PROVIDER_BASE_URLS: Record<string, string> = {
    'openai-compat': 'https://api.openai.com/v1',
    'together-ai': 'https://api.together.xyz/v1',
    'openrouter': 'https://openrouter.ai/api/v1',
    'ollama': 'http://localhost:11434/v1',
  }

  const handleAiChange = (field: keyof Config['ai'], value: string) => {
    if (field === 'provider') {
      // Auto-reset baseURL to the correct default for the new provider
      setLocalConfig(prev => ({
        ...prev,
        ai: {
          ...prev.ai,
          provider: value as AIProvider,
          baseURL: PROVIDER_BASE_URLS[value] || '',
        }
      }))
    } else {
      setLocalConfig(prev => ({
        ...prev,
        ai: { ...prev.ai, [field]: value }
      }))
    }
    setErrors(prev => {
      const next = { ...prev }
      delete next[`ai.${field}`]
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

  const handleWebhooksChange = (field: keyof NonNullable<Config['webhooks']>, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      webhooks: { ...prev.webhooks!, [field]: value }
    }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[`webhooks.${field}`]
      return next
    })
  }

  const generateWebhookSecret = () => {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const secret = Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
    handleWebhooksChange('secret', secret)
    toast.success('Generated new webhook secret')
  }

  const copyWebhookUrl = () => {
    const url = `${window.location.origin}/api/webhooks/paperless`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Webhook URL copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy to clipboard')
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

  const handleTestAi = async () => {
    const { provider } = localConfig.ai
    const needsApiKey = provider === 'openai-compat' || provider === 'openrouter'
    if (needsApiKey && !localConfig.ai.apiKey) {
      toast.warning('Please fill in the AI API key')
      return
    }

    try {
      const result = await testAiMutation.mutateAsync({
        provider: localConfig.ai.provider,
        apiKey: localConfig.ai.apiKey || '',
        baseURL: localConfig.ai.baseURL || '',
        model: localConfig.ai.model,
      })
      if (result.success) {
        toast.success(result.message || 'AI connection successful!')
      } else {
        toast.error(result.error || 'AI connection failed')
      }
    } catch (error) {
      toast.error('Failed to test AI connection')
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
    if (isMasked(payload.ai?.apiKey)) {
      delete payload.ai.apiKey
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
    if (payload.webhooks && isMasked(payload.webhooks.secret)) {
      delete payload.webhooks.secret
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
          if (s === 'ai') return 'AI'
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
              if (s === 'ai') return 'AI'
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

            {/* AI Provider Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4" /> AI Provider
                </h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleTestAi}
                  disabled={testAiMutation.isPending}
                >
                  {testAiMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ai-provider">Provider</Label>
                <select
                  id="ai-provider"
                  value={localConfig.ai.provider}
                  onChange={(e) => handleAiChange('provider', e.target.value as AIProvider)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="openai-compat">OpenAI-Compatible (vLLM, etc.)</option>
                  <option value="together-ai">Together AI</option>
                  <option value="ollama">Ollama (Local)</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Select your AI provider. OpenAI-compatible works with Together AI, vLLM, and any OpenAI-compatible API.
                </p>
              </div>

              {/* API Key — required for cloud providers, optional for ollama */}
              {localConfig.ai.provider !== 'ollama' ? (
                <div className="grid gap-2">
                  <Label htmlFor="ai-key">API Key</Label>
                  <Input
                    id="ai-key"
                    type="password"
                    placeholder={
                      localConfig.ai.provider === 'openrouter' ? 'sk-or-...'
                      : localConfig.ai.provider === 'together-ai' ? 'Paste your Together AI key'
                      : 'Paste your API key'
                    }
                    value={localConfig.ai.apiKey || ''}
                    onChange={(e) => handleAiChange('apiKey', e.target.value)}
                    className={errors['ai.apiKey'] ? 'border-destructive' : ''}
                  />
                  <ErrorMessage path="ai.apiKey" />
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="ai-key">API Key <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="ai-key"
                    type="password"
                    placeholder="Leave blank for unauthenticated local Ollama"
                    value={localConfig.ai.apiKey || ''}
                    onChange={(e) => handleAiChange('apiKey', e.target.value)}
                    className={errors['ai.apiKey'] ? 'border-destructive' : ''}
                  />
                  <ErrorMessage path="ai.apiKey" />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="ai-base-url">
                  Base URL
                  {localConfig.ai.provider !== 'openai-compat' && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">(managed)</span>
                  )}
                </Label>
                <Input
                  id="ai-base-url"
                  placeholder={
                    localConfig.ai.provider === 'ollama'
                      ? 'http://localhost:11434/v1'
                      : localConfig.ai.provider === 'openrouter'
                        ? 'https://openrouter.ai/api/v1'
                        : localConfig.ai.provider === 'together-ai'
                          ? 'https://api.together.xyz/v1'
                          : 'https://api.openai.com/v1'
                  }
                  value={localConfig.ai.baseURL || ''}
                  onChange={(e) => handleAiChange('baseURL', e.target.value)}
                  disabled={localConfig.ai.provider === 'openrouter'}
                  className={`${errors['ai.baseURL'] ? 'border-destructive' : ''} ${localConfig.ai.provider === 'openrouter' ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
                <ErrorMessage path="ai.baseURL" />
                <p className="text-xs text-muted-foreground">
                  {localConfig.ai.provider === 'openrouter'
                    ? 'URL is fixed for OpenRouter.'
                    : 'Override the default endpoint. Leave as-is unless using a custom or self-hosted deployment.'}
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="ai-model">Model</Label>
                <Input
                  id="ai-model"
                  placeholder="meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8"
                  value={localConfig.ai.model}
                  onChange={(e) => handleAiChange('model', e.target.value)}
                  className={errors['ai.model'] ? 'border-destructive' : ''}
                />
                <ErrorMessage path="ai.model" />
                <p className="text-xs text-muted-foreground">
                  The model to use for receipt extraction. Must support vision/image input.
                </p>
              </div>
            </div>

            <Separator />

            {/* Processing Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Processing
                </h3>
                <Link 
                  to="/workflows" 
                  className="text-sm font-medium text-primary hover:underline flex items-center gap-1 group"
                >
                  <Workflow className="h-4 w-4" /> Manage Workflows
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
              
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

              <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/30">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Workflow className="h-3 w-3" />
                  These tags are used by the default Receipt workflow. For custom workflows, configure tags in the Workflow editor.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tag-receipt">Receipt Tag <span className="text-[10px] opacity-70 font-normal">(managed via Workflows)</span></Label>
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

        {/* Webhooks */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              <CardTitle>Webhooks</CardTitle>
            </div>
            <CardDescription>
              Receive real-time notifications from Paperless-ngx when documents are added
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="webhooks-enabled" className="font-medium">Enable Webhooks</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Accept incoming webhook notifications from Paperless-ngx for near-instant processing
                </p>
              </div>
              <Switch
                id="webhooks-enabled"
                checked={localConfig.webhooks?.enabled ?? false}
                onCheckedChange={(checked) => handleWebhooksChange('enabled', checked)}
              />
            </div>

            {localConfig.webhooks?.enabled && (
              <div className="grid gap-4 pl-6 border-l-2 border-gray-100 ml-2">
                {/* Webhook URL (read-only) */}
                <div className="grid gap-2">
                  <Label>Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/paperless` : '/api/webhooks/paperless'}
                      className="font-mono text-xs bg-muted"
                    />
                    <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this URL in your Paperless-ngx workflow webhook action
                  </p>
                </div>

                {/* Secret Token */}
                <div className="grid gap-2">
                  <Label htmlFor="webhook-secret">Secret Token (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="webhook-secret"
                      type="password"
                      placeholder="Leave empty for no authentication"
                      value={localConfig.webhooks?.secret || ''}
                      onChange={(e) => handleWebhooksChange('secret', e.target.value)}
                      className={errors['webhooks.secret'] ? 'border-destructive' : ''}
                    />
                    <Button variant="outline" size="sm" onClick={generateWebhookSecret}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <ErrorMessage path="webhooks.secret" />
                  <p className="text-xs text-muted-foreground">
                    If set, Paperless must send this token as a Bearer token in the Authorization header
                  </p>
                </div>

                {/* Queue Status */}
                {webhookStatus && (
                  <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                    <h4 className="text-sm font-medium mb-2">Queue Status</h4>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <div className="font-semibold text-lg">{webhookStatus.queue.pending}</div>
                        <div className="text-muted-foreground">Pending</div>
                      </div>
                      <div>
                        <div className="font-semibold text-lg">{webhookStatus.queue.processing}</div>
                        <div className="text-muted-foreground">Processing</div>
                      </div>
                      <div>
                        <div className="font-semibold text-lg">{webhookStatus.queue.completed}</div>
                        <div className="text-muted-foreground">Completed</div>
                      </div>
                      <div>
                        <div className="font-semibold text-lg">{webhookStatus.queue.failed}</div>
                        <div className="text-muted-foreground">Failed</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Setup instructions */}
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <h4 className="text-sm font-medium mb-2">Paperless-ngx Setup</h4>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Go to <strong>Settings &rarr; Workflows</strong> in Paperless-ngx</li>
                    <li>Create a new workflow triggered on <strong>Document Added</strong></li>
                    <li>Add a <strong>Webhook</strong> action with the URL above</li>
                    <li>Set the body to: <code className="bg-background px-1 rounded">{'{"document_id": "{{ document_id }}"}'}</code></li>
                    {localConfig.webhooks?.secret && (
                      <li>Add a custom header: <code className="bg-background px-1 rounded">Authorization: Bearer {'<your-secret>'}</code></li>
                    )}
                    <li>Save and test with a new document upload</li>
                  </ol>
                </div>
              </div>
            )}
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

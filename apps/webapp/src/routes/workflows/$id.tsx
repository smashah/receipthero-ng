import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { useWorkflow, useCreateWorkflow, useUpdateWorkflow, useValidateSchema } from '../../hooks/useWorkflows';
import { 
  ArrowLeft, 
  Save, 
  Code, 
  Settings2,
  Play,
  CheckCircle2,
  XCircle,
  Brain,
  Plus,
  Trash2,
  Loader2
} from 'lucide-react';
import Editor, { Monaco } from '@monaco-editor/react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import zodDts from '../../lib/zod-safe.d.ts?raw';

export const Route = createFileRoute('/workflows/$id')({
  component: WorkflowEditorPage,
});

const DEFAULT_ZOD_SOURCE = `z.object({
  vendor: z.string().describe("Store or service provider name"),
  amount: z.number().describe("Total amount including tax"),
  currency: z.string().describe("3-letter ISO currency code"),
  date: z.string().describe("Document date in YYYY-MM-DD")
})`;

interface WorkflowOutputMapping {
  correspondentField?: string;
  dateField?: string;
  tagsToApply: string[];
  tagFields: string[];
  customFields: Record<string, string>;
}

interface WorkflowFormData {
  name: string;
  description: string;
  triggerTag: string;
  priority: number;
  enabled: boolean;
  zodSource: string;
  titleTemplate: string;
  promptInstructions: string;
  processedTag: string;
  outputMapping: WorkflowOutputMapping;
}

const DEFAULT_OUTPUT_MAPPING: WorkflowOutputMapping = {
  correspondentField: 'vendor',
  dateField: 'date',
  tagsToApply: ['ai-processed'],
  tagFields: [],
  customFields: { 'json_payload': '*' }
};

function WorkflowEditorPage() {
  const { id } = useParams({ from: '/workflows/$id' });
  const isNew = id === 'new';
  const navigate = useNavigate();
  const queryClient = useWorkflow(isNew ? undefined : parseInt(id, 10));
  const workflow = queryClient.data;
  
  const createMutation = useCreateWorkflow();
  const updateMutation = useUpdateWorkflow();
  const validateMutation = useValidateSchema();

  const [formData, setFormData] = useState<WorkflowFormData>({
    name: '',
    description: '',
    triggerTag: '',
    priority: 0,
    enabled: true,
    zodSource: DEFAULT_ZOD_SOURCE,
    titleTemplate: '{vendor} - {amount} {currency}',
    promptInstructions: '',
    processedTag: 'ai-processed',
    outputMapping: DEFAULT_OUTPUT_MAPPING
  });

  const [validationResult, setValidationResult] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingExtraction, setIsTestingExtraction] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (workflow) {
      setFormData({
        ...workflow,
        outputMapping: typeof workflow.outputMapping === 'string' 
          ? JSON.parse(workflow.outputMapping) 
          : (workflow.outputMapping || DEFAULT_OUTPUT_MAPPING)
      });
    }
  }, [workflow]);

  const handleEditorWillMount = (monaco: Monaco) => {
    monaco.languages.typescript.typescriptDefaults.addExtraLib(zodDts, 'zod-safe.d.ts');
  };

  const handleSave = async () => {
    // Basic validation
    if (!formData.name) return toast.error('Name is required');
    if (!formData.triggerTag) return toast.error('Trigger tag is required');

    try {
      // Re-validate schema before saving
      const validation = await validateMutation.mutateAsync(formData.zodSource);
      if (!validation.valid) {
        return toast.error('Schema is invalid. Please validate before saving.');
      }

      const payload = {
        ...formData,
        jsonSchema: JSON.stringify(validation.jsonSchema),
        slug: formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      };

      if (isNew) {
        await createMutation.mutateAsync(payload);
        toast.success('Workflow created');
      } else {
        await updateMutation.mutateAsync({ id: parseInt(id, 10), data: payload });
        toast.success('Workflow updated');
      }
      navigate({ to: '/workflows' });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleValidate = async () => {
    try {
      const res = await validateMutation.mutateAsync(formData.zodSource);
      setValidationResult(res);
      if (res.valid) toast.success('Schema is valid');
      else toast.error('Schema has errors');
    } catch (e) {
      toast.error('Validation failed');
    }
  };
  
  const handleTestExtraction = () => {
    if (isNew) {
      toast.error('Please save the workflow first before testing extraction');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit');
      return;
    }

    setIsTestingExtraction(true);
    setTestResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        
        // Using fetch directly as this specific test endpoint might not be in the shared hooks yet
        // or to ensure we have full control over the request
        const res = await fetch(`/api/workflows/${id}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 })
        });
        
        if (!res.ok) {
          throw new Error('Extraction failed');
        }
        
        const data = await res.json();
        setTestResult(data);
        toast.success('Extraction test completed');
      } catch (err: any) {
        toast.error(err.message || 'Failed to test extraction');
      } finally {
        setIsTestingExtraction(false);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
      setIsTestingExtraction(false);
    };
    reader.readAsDataURL(file);
  };

  const addCustomField = () => {
    setFormData(prev => ({
      ...prev,
      outputMapping: {
        ...prev.outputMapping,
        customFields: { ...prev.outputMapping.customFields, '': '' }
      }
    }));
  };

  const removeCustomField = (key: string) => {
    setFormData(prev => {
      const newCustomFields = { ...prev.outputMapping.customFields };
      delete newCustomFields[key];
      return {
        ...prev,
        outputMapping: {
          ...prev.outputMapping,
          customFields: newCustomFields
        }
      };
    });
  };

  const updateCustomFieldKey = (oldKey: string, newKey: string) => {
    setFormData(prev => {
      const customFields = prev.outputMapping.customFields;
      const value = customFields[oldKey];
      const newCustomFields = { ...customFields };
      delete newCustomFields[oldKey];
      newCustomFields[newKey] = value;
      return {
        ...prev,
        outputMapping: {
          ...prev.outputMapping,
          customFields: newCustomFields
        }
      };
    });
  };

  const updateCustomFieldValue = (key: string, newValue: string) => {
    setFormData(prev => ({
      ...prev,
      outputMapping: {
        ...prev.outputMapping,
        customFields: { ...prev.outputMapping.customFields, [key]: newValue }
      }
    }));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: '/workflows' })}
            className="rounded-full"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{isNew ? 'Create Workflow' : `Edit: ${formData.name}`}</h1>
            <p className="text-muted-foreground">Configure your document extraction pipeline</p>
          </div>
        </div>
        <Button 
          onClick={handleSave}
          className="gap-2 px-6"
        >
          <Save className="h-4 w-4" />
          Save Workflow
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* General Config */}
          <section className="p-6 rounded-2xl border border-border bg-card space-y-6 text-card-foreground shadow-sm">
            <div className="flex items-center gap-2 text-primary font-semibold mb-2">
              <Settings2 className="h-5 w-5" />
              General Configuration
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</Label>
                <Input 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Utility Bills"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trigger Tag</Label>
                <Input 
                  value={formData.triggerTag}
                  onChange={e => setFormData({ ...formData, triggerTag: e.target.value })}
                  placeholder="e.g. utility-bill"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea 
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="What does this workflow do?"
                className="min-h-[80px]"
              />
            </div>
          </section>

          {/* Schema Editor */}
          <section className="p-6 rounded-2xl border border-border bg-card space-y-4 text-card-foreground shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <Code className="h-5 w-5" />
                Zod Schema Definition
              </div>
              <Button 
                variant="outline"
                size="sm"
                onClick={handleValidate}
                className="h-8"
              >
                Validate Schema
              </Button>
            </div>

            <div className="rounded-xl border border-border overflow-hidden bg-[#1e1e1e] min-h-[300px]">
              <Editor
                height="300px"
                defaultLanguage="typescript"
                theme="vs-dark"
                value={formData.zodSource}
                onChange={val => setFormData({ ...formData, zodSource: val || '' })}
                beforeMount={handleEditorWillMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>

            {validationResult && (
              <div className={`p-4 rounded-xl text-sm border ${validationResult.valid ? 'bg-green-500/5 border-green-500/20 text-green-500' : 'bg-destructive/5 border-destructive/20 text-destructive'}`}>
                <div className="flex items-center gap-2 font-bold mb-1">
                  {validationResult.valid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {validationResult.valid ? 'Valid Schema' : 'Validation Failed'}
                </div>
                {validationResult.valid ? (
                  <pre className="mt-2 text-[10px] bg-black/20 p-2 rounded overflow-auto max-h-32 font-mono whitespace-pre-wrap">
                    {JSON.stringify(validationResult.jsonSchema, null, 2)}
                  </pre>
                ) : (
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {validationResult.errors.map((err: string, i: number) => <li key={i}>{err}</li>)}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* Prompt Instructions */}
          <section className="p-6 rounded-2xl border border-border bg-card space-y-4 text-card-foreground shadow-sm">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Brain className="h-5 w-5" />
              AI Prompt Instructions
            </div>
            <Textarea 
              value={formData.promptInstructions}
              onChange={e => setFormData({ ...formData, promptInstructions: e.target.value })}
              placeholder="e.g. Focus on extracting the usage period and total due amount. For 'vendor', use the utility company name."
              className="min-h-[120px]"
            />
          </section>
        </div>

        <div className="space-y-8">
          {/* Status & Priority */}
          <section className="p-6 rounded-2xl border border-border bg-card space-y-6 text-card-foreground shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Workflow Enabled</span>
              <Switch 
                checked={formData.enabled}
                onCheckedChange={checked => setFormData({ ...formData, enabled: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Priority (higher = runs first)</Label>
              <Input 
                type="number"
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value, 10) })}
              />
            </div>
          </section>

          {/* Paperless Mapping */}
          <section className="p-6 rounded-2xl border border-border bg-card space-y-6 text-card-foreground shadow-sm">
            <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2 mb-4">Paperless Output Mapping</div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Title Template</Label>
              <Input 
                value={formData.titleTemplate}
                onChange={e => setFormData({ ...formData, titleTemplate: e.target.value })}
                placeholder="{vendor} - {amount}"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Correspondent Field</Label>
              <Input 
                value={formData.outputMapping.correspondentField}
                onChange={e => setFormData({ ...formData, outputMapping: { ...formData.outputMapping, correspondentField: e.target.value } })}
                placeholder="vendor"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Date Field</Label>
              <Input 
                value={formData.outputMapping.dateField}
                onChange={e => setFormData({ ...formData, outputMapping: { ...formData.outputMapping, dateField: e.target.value } })}
                placeholder="date"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Processed Tag</Label>
              <Input 
                value={formData.processedTag}
                onChange={e => setFormData({ ...formData, processedTag: e.target.value })}
                className="text-sm font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Tags to Apply</Label>
              <Input 
                value={formData.outputMapping.tagsToApply.join(', ')}
                onChange={e => setFormData({ 
                  ...formData, 
                  outputMapping: { 
                    ...formData.outputMapping, 
                    tagsToApply: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                  } 
                })}
                placeholder="tag1, tag2"
                className="text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Comma-separated list of tags to add</p>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Tag Fields</Label>
              <Input 
                value={formData.outputMapping.tagFields.join(', ')}
                onChange={e => setFormData({ 
                  ...formData, 
                  outputMapping: { 
                    ...formData.outputMapping, 
                    tagFields: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                  } 
                })}
                placeholder="category, status"
                className="text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Fields from extraction to use as tags</p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Custom Fields Map</Label>
                <Button variant="outline" size="sm" onClick={addCustomField} className="h-6 w-6 p-0 rounded-full">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {Object.entries(formData.outputMapping.customFields).map(([key, value], index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input 
                      value={key}
                      onChange={e => updateCustomFieldKey(key, e.target.value)}
                      placeholder="Paperless Field"
                      className="text-xs h-8"
                    />
                    <span className="text-muted-foreground">→</span>
                    <Input 
                      value={value}
                      onChange={e => updateCustomFieldValue(key, e.target.value)}
                      placeholder="Extracted Field"
                      className="text-xs h-8"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeCustomField(key)} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {Object.keys(formData.outputMapping.customFields).length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No custom fields mapped</p>
                )}
              </div>
            </div>
          </section>

          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />

          <div className="space-y-4">
            <Button 
              variant="outline" 
              onClick={handleTestExtraction}
              disabled={isTestingExtraction}
              className="w-full h-16 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all font-medium group gap-2"
            >
              {isTestingExtraction ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5 group-hover:scale-110 transition-transform" />
              )}
              {isTestingExtraction ? 'Extracting...' : 'Test Extraction'}
            </Button>

            {testResult && (
              <div className="p-4 rounded-xl border border-border bg-card text-card-foreground text-sm space-y-2">
                <div className="font-semibold text-primary">Extraction Result</div>
                <pre className="bg-muted p-2 rounded-lg overflow-auto max-h-[200px] text-xs font-mono">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useRef, useState } from 'react';
import { useWorkflows, useTestWorkflow } from '../../hooks/useWorkflows';
import {
  Upload,
  FlaskConical,
  ClipboardPaste,
  X,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Brain,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

export const Route = createFileRoute('/workflows/playground')({
  component: PlaygroundPage,
});

// ── Image drop zone ────────────────────────────────────────────────────────────

interface DropZoneProps {
  image: string | null;
  onImage: (base64: string) => void;
  onClear: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data-URL prefix — API expects raw base64
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function DropZone({ image, onImage, onClear }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Please drop an image file.');
        return;
      }
      const [base64, dataUrl] = await Promise.all([fileToBase64(file), fileToDataUrl(file)]);
      setPreviewSrc(dataUrl);
      onImage(base64);
    },
    [onImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
      if (item) {
        const file = item.getAsFile();
        if (file) handleFile(file);
      }
    },
    [handleFile],
  );

  const handleClear = () => {
    setPreviewSrc(null);
    onClear();
    if (inputRef.current) inputRef.current.value = '';
  };

  if (image && previewSrc) {
    return (
      <div className="relative rounded-2xl border border-border overflow-hidden bg-card">
        <img
          src={previewSrc}
          alt="Receipt preview"
          className="w-full max-h-80 object-contain bg-muted/30"
        />
        <button
          onClick={handleClear}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-background/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Remove image"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="absolute bottom-3 left-3 text-[10px] bg-background/80 backdrop-blur text-muted-foreground px-2 py-1 rounded font-mono">
          Image loaded — ready to test
        </div>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onPaste={handlePaste}
      tabIndex={0}
      className={`
        relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12
        cursor-pointer outline-none transition-colors
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        ${isDragging
          ? 'border-primary bg-primary/5 scale-[1.01]'
          : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'
        }
      `}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        <Upload className="h-8 w-8" />
      </div>
      <div className="text-center space-y-1">
        <p className="font-semibold text-sm">Drop a receipt screenshot here</p>
        <p className="text-xs text-muted-foreground">
          or <span className="text-primary underline-offset-2 underline">click to browse</span>
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
        <ClipboardPaste className="h-3.5 w-3.5" />
        Paste with Ctrl+V / ⌘+V
      </div>
    </div>
  );
}

// ── Result panel ───────────────────────────────────────────────────────────────

interface ResultPanelProps {
  result: {
    items: unknown[];
    workflowId: number;
    workflowName: string;
    ai?: { provider: string; model: string; baseURL?: string };
  } | null;
  error: Error | null;
  isPending: boolean;
}

function ResultPanel({ result, error, isPending }: ResultPanelProps) {
  if (isPending) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 rounded-2xl border border-border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Running extraction…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-2">
        <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
          <AlertCircle className="h-4 w-4" />
          Extraction failed
        </div>
        <p className="text-xs text-destructive/80 font-mono bg-destructive/10 rounded px-3 py-2">
          {error.message}
        </p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 text-green-500 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Extraction successful — {result.items.length} item{result.items.length !== 1 ? 's' : ''}
          </div>
          <span className="text-xs text-muted-foreground font-mono">{result.workflowName}</span>
        </div>
        {result.ai && (
          <div className="flex items-center gap-2 flex-wrap px-5 py-2.5 border-b border-border bg-muted/10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
              <Brain className="h-3 w-3" />
              {result.ai.model}
            </span>
            <span className="text-xs text-muted-foreground">
              via <span className="font-medium text-foreground">{result.ai.provider}</span>
            </span>
            {result.ai.baseURL && (
              <span className="text-xs text-muted-foreground font-mono truncate max-w-[220px]" title={result.ai.baseURL}>
                {result.ai.baseURL}
              </span>
            )}
          </div>
        )}
        <pre className="text-xs font-mono p-5 overflow-auto max-h-[500px] text-foreground/90 leading-relaxed">
          {JSON.stringify(result.items, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-2xl border-2 border-dashed border-border bg-card/50 text-muted-foreground">
      <FlaskConical className="h-8 w-8 opacity-40" />
      <p className="text-sm">Results will appear here after you run a test</p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function PlaygroundPage() {
  const { data: workflows, isLoading: isLoadingWorkflows } = useWorkflows();
  const testWorkflow = useTestWorkflow();

  const [image, setImage] = useState<string | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);

  // Auto-select first workflow
  const effectiveWorkflowId =
    selectedWorkflowId ?? (workflows && workflows.length > 0 ? workflows[0].id : null);

  const handleRun = async () => {
    if (!image) {
      toast.error('Please add an image first.');
      return;
    }
    if (!effectiveWorkflowId) {
      toast.error('Please select a workflow.');
      return;
    }
    testWorkflow.reset();
    testWorkflow.mutate({ id: effectiveWorkflowId, image });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <FlaskConical className="h-7 w-7 text-primary" />
          Playground
        </h1>
        <p className="text-muted-foreground">
          Drop or paste a receipt screenshot, pick a workflow, and test extraction in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
        {/* Left: Input controls */}
        <div className="space-y-5">
          {/* Drop zone */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Receipt Image
            </label>
            <DropZone
              image={image}
              onImage={setImage}
              onClear={() => {
                setImage(null);
                testWorkflow.reset();
              }}
            />
          </div>

          {/* Workflow selector */}
          <div className="space-y-2">
            <label
              htmlFor="workflow-select"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
              Workflow
            </label>
            <div className="relative">
              <select
                id="workflow-select"
                className="w-full appearance-none rounded-xl border border-border bg-card px-4 py-3 pr-10 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50"
                disabled={isLoadingWorkflows || !workflows?.length}
                value={effectiveWorkflowId ?? ''}
                onChange={(e) => setSelectedWorkflowId(Number(e.target.value))}
              >
                {isLoadingWorkflows ? (
                  <option>Loading workflows…</option>
                ) : !workflows?.length ? (
                  <option>No workflows found</option>
                ) : (
                  workflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.isBuiltIn ? ' (built-in)' : ''}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Run button */}
          <Button
            className="w-full gap-2 h-11 rounded-xl text-sm font-semibold"
            onClick={handleRun}
            disabled={!image || !effectiveWorkflowId || testWorkflow.isPending}
          >
            {testWorkflow.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="h-4 w-4" />
            )}
            {testWorkflow.isPending ? 'Running…' : 'Run Test'}
          </Button>
        </div>

        {/* Right: Result panel */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Output
          </p>
          <ResultPanel
            result={testWorkflow.data ?? null}
            error={testWorkflow.error}
            isPending={testWorkflow.isPending}
          />
        </div>
      </div>
    </div>
  );
}

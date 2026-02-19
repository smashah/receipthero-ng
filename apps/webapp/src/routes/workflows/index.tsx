import { createFileRoute, Link } from '@tanstack/react-router';
import { useWorkflows, useDeleteWorkflow } from '../../hooks/useWorkflows';
import { 
  Workflow, 
  Settings2, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle,
  FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';

export const Route = createFileRoute('/workflows/')({
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const { data: workflows, isLoading } = useWorkflows();
  const deleteWorkflow = useDeleteWorkflow();

  const handleDelete = async (id: number, isBuiltIn: boolean) => {
    if (isBuiltIn) return;
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      await deleteWorkflow.mutateAsync(id);
      toast.success('Workflow deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">Manage your AI document extraction pipelines</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/workflows/playground">
            <Button variant="outline" className="gap-2">
              <FlaskConical className="h-4 w-4" />
              Playground
            </Button>
          </Link>
          <Link to="/workflows/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Workflow
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="h-48 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {workflows?.map(workflow => (
            <div 
              key={workflow.id} 
              className="group relative flex flex-col p-6 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all shadow-sm overflow-hidden"
            >
              {workflow.isBuiltIn && (
                <div className="absolute top-0 right-0 bg-primary/10 text-primary text-[10px] uppercase font-bold px-3 py-1 rounded-bl-lg tracking-wider">
                  Built-in
                </div>
              )}
              
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                    <Workflow className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold leading-tight">{workflow.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">#{workflow.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link 
                    to={`/workflows/${workflow.id as any}`}
                  >
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Edit workflow">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </Link>
                  {!workflow.isBuiltIn && (
                    <Button 
                      onClick={() => handleDelete(workflow.id, workflow.isBuiltIn)}
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete workflow"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {workflow.description || 'No description provided.'}
                </p>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Trigger Tag</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="font-mono">{workflow.triggerTag}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Priority</p>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold">{workflow.priority}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {workflow.enabled ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Enabled
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Circle className="h-4 w-4" />
                      Paused
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Updated {new Date(workflow.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}

          {workflows?.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-border rounded-3xl">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Workflow className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">No workflows found</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">Create your first document extraction workflow to get started.</p>
              </div>
              <Link 
                to="/workflows/new"
              >
                <Button variant="outline" className="rounded-full px-6">
                  Create Workflow
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

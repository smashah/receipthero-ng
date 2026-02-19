import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Workflow, CreateWorkflow, UpdateWorkflow } from '@sm-rn/shared/workflow-schemas';
import { fetchApi } from '@/lib/api';

const API_PATH = '/api/workflows';

export function useWorkflows() {
  return useQuery<Workflow[]>({
    queryKey: ['workflows'],
    queryFn: () => fetchApi<Workflow[]>(API_PATH),
  });
}

export function useWorkflow(id?: number) {
  return useQuery<Workflow>({
    queryKey: ['workflows', id],
    queryFn: () => fetchApi<Workflow>(`${API_PATH}/${id}`),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkflow) =>
      fetchApi<Workflow>(API_PATH, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateWorkflow }) =>
      fetchApi<Workflow>(`${API_PATH}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflows', id] });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchApi<{ success: boolean }>(`${API_PATH}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function useValidateSchema() {
  return useMutation({
    mutationFn: (zodSource: string) =>
      fetchApi<{ valid: boolean; jsonSchema?: object; errors?: string[] }>(
        `${API_PATH}/validate-schema`,
        {
          method: 'POST',
          body: JSON.stringify({ zodSource }),
        }
      ),
  });
}

export interface TestWorkflowResult {
  items: unknown[];
  workflowId: number;
  workflowName: string;
}

export function useTestWorkflow() {
  return useMutation<TestWorkflowResult, Error, { id: number; image: string }>({
    mutationFn: ({ id, image }) =>
      fetchApi<TestWorkflowResult>(`${API_PATH}/${id}/test`, {
        method: 'POST',
        body: JSON.stringify({ image }),
      }),
  });
}

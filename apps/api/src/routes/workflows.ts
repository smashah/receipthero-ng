import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  CreateWorkflowSchema,
  UpdateWorkflowSchema,
  ValidateSchemaRequest,
} from '@sm-rn/shared/workflow-schemas';
import {
  getWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  validateZodSource,
  extractWithSchema,
  loadConfig,
  createAIAdapter,
} from '@sm-rn/core';

const app = new Hono();

// List all workflows
app.get('/', async (c) => {
  const workflows = await getWorkflows();
  return c.json(workflows);
});

// Get single workflow
app.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const workflow = await getWorkflow(id);
  if (!workflow) return c.json({ error: 'Workflow not found' }, 404);
  return c.json(workflow);
});

// Create workflow
app.post('/', zValidator('json', CreateWorkflowSchema), async (c) => {
  const data = c.req.valid('json');
  try {
    const workflow = await createWorkflow(data);
    return c.json(workflow, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Update workflow
app.put('/:id', zValidator('json', UpdateWorkflowSchema), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const data = c.req.valid('json');
  try {
    const workflow = await updateWorkflow(id, data);
    return c.json(workflow);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Delete workflow
app.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const workflow = await getWorkflow(id);

  if (!workflow) return c.json({ error: 'Workflow not found' }, 404);
  if (workflow.isBuiltIn) return c.json({ error: 'Built-in workflows cannot be deleted' }, 403);

  await deleteWorkflow(id);
  return c.json({ success: true });
});

// Validate Zod schema
app.post('/validate-schema', zValidator('json', ValidateSchemaRequest), async (c) => {
  const { zodSource } = c.req.valid('json');
  const result = await validateZodSource(zodSource);
  return c.json(result);
});

// Test extraction — accepts a base64 image, runs extractWithSchema() using the workflow's schema
app.post('/:id/test', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const workflow = await getWorkflow(id);
  if (!workflow) return c.json({ error: 'Workflow not found' }, 404);

  let body: { image?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.image) {
    return c.json({ error: 'Missing "image" field (base64 encoded image data)' }, 400);
  }

  try {
    const config = loadConfig();
    const adapter = createAIAdapter(config);

    // Parse the stored JSON Schema string back to an object
    const jsonSchema = typeof workflow.jsonSchema === 'string'
      ? JSON.parse(workflow.jsonSchema)
      : workflow.jsonSchema;

    const items = await extractWithSchema(
      body.image,
      jsonSchema,
      workflow.promptInstructions ?? undefined,
      config
    );

    return c.json({ items, workflowId: id, workflowName: workflow.name });
  } catch (error: any) {
    return c.json({ error: error.message || 'Extraction failed' }, 500);
  }
});

export default app;

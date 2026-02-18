import { z } from "zod";

// Workflow output mapping schema
export const WorkflowOutputMappingSchema = z.object({
  correspondentField: z.string().optional(),     // which extracted field maps to Paperless correspondent
  dateField: z.string().optional(),                // which extracted field maps to document date
  tagsToApply: z.array(z.string()).default([]),    // static tags to add after processing
  tagFields: z.array(z.string()).default([]),          // extracted fields whose values become tags
  customFields: z.record(z.string(), z.string()).default({}), // map extracted fields to Paperless custom fields (field_name -> extracted_field or "*")
});

export type WorkflowOutputMapping = z.infer<typeof WorkflowOutputMappingSchema>;

// Base workflow schema for shared fields
const WorkflowBase = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(0),
  triggerTag: z.string().min(1),
  zodSource: z.string().min(1),
  jsonSchema: z.string().min(1),
  promptInstructions: z.string().optional(),
  titleTemplate: z.string().optional(),
  outputMapping: WorkflowOutputMappingSchema,
  processedTag: z.string().min(1),
  failedTag: z.string().optional(),
  skippedTag: z.string().optional(),
  isBuiltIn: z.boolean().default(false),
});

// Schema for API responses
export const WorkflowSchema = WorkflowBase.extend({
  id: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Workflow = z.infer<typeof WorkflowSchema>;

// Schema for creating a new workflow
export const CreateWorkflowSchema = WorkflowBase.omit({
  isBuiltIn: true,
});

export type CreateWorkflow = z.infer<typeof CreateWorkflowSchema>;

// Schema for updating an existing workflow
export const UpdateWorkflowSchema = CreateWorkflowSchema.partial();

export type UpdateWorkflow = z.infer<typeof UpdateWorkflowSchema>;

// Schema for workflow validation API
export const ValidateSchemaRequest = z.object({
  zodSource: z.string().min(1),
});

export const ValidateSchemaResponse = z.object({
  valid: z.boolean(),
  jsonSchema: z.any().optional(),
  errors: z.array(z.string()).optional(),
});

import { z } from "zod";

export const PaperlessConfigSchema = z.object({
  host: z.string().url(),
  apiKey: z.string(),
  processedTagName: z.string().default("ai-processed"),
});

export type PaperlessConfig = z.infer<typeof PaperlessConfigSchema>;

interface Tag {
  id: number;
  name: string;
  [key: string]: unknown;
}

export class PaperlessClient {
  private config: PaperlessConfig;
  private tagCache: Map<string, Tag> = new Map();
  private lastTagRefresh = 0;
  private readonly CACHE_LIFETIME = 3000; // 3 seconds

  constructor(config: PaperlessConfig) {
    this.config = config;
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    const url = `${this.config.host.replace(/\/$/, "")}/api${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Token ${this.config.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Paperless API error (${response.status}): ${error}`);
    }

    return response;
  }

  /**
   * Ensures the tag cache is fresh. Refreshes if older than CACHE_LIFETIME.
   */
  private async ensureTagCache(): Promise<void> {
    const now = Date.now();
    if (this.tagCache.size === 0 || (now - this.lastTagRefresh) > this.CACHE_LIFETIME) {
      await this.refreshTagCache();
    }
  }

  /**
   * Loads all existing tags with pagination support.
   */
  private async refreshTagCache(): Promise<void> {
    console.log("[DEBUG] Refreshing tag cache...");
    this.tagCache.clear();
    let nextUrl: string | null = "/tags/";

    while (nextUrl) {
      const response = await this.fetchApi(nextUrl);
      const data = await response.json() as any;

      // Validate response structure
      if (!data?.results) {
        console.error("[ERROR] Invalid response structure from API:", data);
        break;
      }

      for (const tag of data.results) {
        this.tagCache.set(tag.name.toLowerCase(), tag);
      }

      // Handle pagination - extract relative path from next URL
      if (data.next) {
        try {
          const nextUrlObj = new URL(data.next);
          const baseUrl = this.config.host.replace(/\/$/, "");
          const baseUrlObj = new URL(baseUrl);

          // Extract path relative to baseURL to avoid double /api/ prefix
          let relativePath = nextUrlObj.pathname;
          // Remove /api prefix if present since fetchApi adds it
          if (relativePath.startsWith("/api")) {
            relativePath = relativePath.substring(4);
          }
          // Remove base path if included
          if (baseUrlObj.pathname && baseUrlObj.pathname !== "/") {
            relativePath = relativePath.replace(baseUrlObj.pathname, "");
          }
          // Ensure path starts with /
          if (!relativePath.startsWith("/")) {
            relativePath = "/" + relativePath;
          }

          nextUrl = relativePath + nextUrlObj.search;
          console.log("[DEBUG] Next page URL:", nextUrl);
        } catch (e: any) {
          console.error("[ERROR] Failed to parse next URL:", e.message);
          nextUrl = null;
        }
      } else {
        nextUrl = null;
      }
    }

    this.lastTagRefresh = Date.now();
    console.log(`[DEBUG] Tag cache refreshed. Found ${this.tagCache.size} tags.`);
  }

  /**
   * Finds an existing tag by name, checking cache first then API.
   */
  async findExistingTag(tagName: string): Promise<Tag | null> {
    const normalizedName = tagName.toLowerCase();

    // 1. Check cache first
    const cachedTag = this.tagCache.get(normalizedName);
    if (cachedTag) {
      console.log(`[DEBUG] Found tag "${tagName}" in cache with ID ${cachedTag.id}`);
      return cachedTag;
    }

    // 2. Direct API search with case-insensitive exact match
    try {
      const response = await this.fetchApi(`/tags/?name__iexact=${encodeURIComponent(normalizedName)}`);
      const data = await response.json() as any;

      if (data.results.length > 0) {
        const foundTag = data.results[0];
        console.log(`[DEBUG] Found existing tag "${tagName}" via API with ID ${foundTag.id}`);
        this.tagCache.set(normalizedName, foundTag);
        return foundTag;
      }
    } catch (error: any) {
      console.warn(`[ERROR] searching for tag "${tagName}":`, error.message);
    }

    return null;
  }

  /**
   * Safely creates a tag, handling race conditions.
   */
  async createTagSafely(tagName: string): Promise<Tag> {
    const normalizedName = tagName.toLowerCase();

    try {
      // Try to create the tag (owner: null makes it public/shared)
      const response = await this.fetchApi("/tags/", {
        method: "POST",
        body: JSON.stringify({ name: tagName, owner: null }),
      });
      const newTag = await response.json() as Tag;
      console.log(`[DEBUG] Successfully created tag "${tagName}" with ID ${newTag.id}`);
      this.tagCache.set(normalizedName, newTag);
      return newTag;
    } catch (error: any) {
      // Handle 400 error (likely tag already exists due to race condition)
      if (error.message?.includes("400")) {
        // Refresh cache and search again
        await this.refreshTagCache();

        const existingTag = await this.findExistingTag(tagName);
        if (existingTag) {
          return existingTag;
        }
      }
      throw error;
    }
  }

  /**
   * Get all tags with pagination support.
   */
  async getTags(): Promise<Tag[]> {
    await this.ensureTagCache();
    return Array.from(this.tagCache.values());
  }

  /**
   * Gets or creates a tag by name.
   */
  async getOrCreateTag(name: string): Promise<number> {
    await this.ensureTagCache();

    // Search for existing tag first
    let tag = await this.findExistingTag(name);

    // If no existing tag found, create new one
    if (!tag) {
      tag = await this.createTagSafely(name);
    }

    return tag.id;
  }

  /**
   * Process multiple tags, returning their IDs.
   */
  async processTags(
    tagNames: string | string[],
    options: { restrictToExistingTags?: boolean } = {}
  ): Promise<{ tagIds: number[]; errors: Array<{ tagName: string; error: string }> }> {
    await this.ensureTagCache();

    // Convert to array if string is passed
    const tagsArray = typeof tagNames === "string"
      ? [tagNames]
      : Array.isArray(tagNames)
        ? tagNames
        : [];

    if (tagsArray.length === 0) {
      console.warn("[DEBUG] No valid tags to process");
      return { tagIds: [], errors: [] };
    }

    const tagIds: number[] = [];
    const errors: Array<{ tagName: string; error: string }> = [];
    const processedTags = new Set<string>(); // Prevent duplicates

    console.log(`[DEBUG] Processing tags with restrictToExistingTags=${options.restrictToExistingTags}`);

    for (const tagName of tagsArray) {
      if (!tagName || typeof tagName !== "string") {
        console.warn(`[DEBUG] Skipping invalid tag name: ${tagName}`);
        errors.push({ tagName: String(tagName), error: "Invalid tag name" });
        continue;
      }

      const normalizedName = tagName.toLowerCase().trim();

      // Skip empty or already processed tags
      if (!normalizedName || processedTags.has(normalizedName)) {
        continue;
      }

      try {
        // Search for existing tag first
        let tag = await this.findExistingTag(tagName);

        // If no existing tag found and restrictions are not enabled, create new one
        if (!tag && !options.restrictToExistingTags) {
          tag = await this.createTagSafely(tagName);
        } else if (!tag && options.restrictToExistingTags) {
          console.log(`[DEBUG] Tag "${tagName}" does not exist and restrictions are enabled, skipping`);
          errors.push({ tagName, error: "Tag does not exist and restrictions are enabled" });
          continue;
        }

        if (tag?.id) {
          tagIds.push(tag.id);
          processedTags.add(normalizedName);
        }
      } catch (error: any) {
        console.error(`[ERROR] processing tag "${tagName}":`, error.message);
        errors.push({ tagName, error: error.message });
      }
    }

    return {
      tagIds: [...new Set(tagIds)], // Remove any duplicates
      errors,
    };
  }

  async getOrCreateCorrespondent(name: string): Promise<number> {
    const res = await this.fetchApi(`/correspondents/?name__icontains=${encodeURIComponent(name)}`);
    const data = await res.json() as any;
    const existing = data.results.find((c: any) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    try {
      const postRes = await this.fetchApi("/correspondents/", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      const postData = await postRes.json() as any;
      return postData.id;
    } catch (error: any) {
      if (error.message?.includes("unique constraint") || error.message?.includes("400")) {
        const retryRes = await this.fetchApi(`/correspondents/?name__icontains=${encodeURIComponent(name)}`);
        const retryData = await retryRes.json() as any;
        const retryExisting = retryData.results.find((c: any) => c.name.toLowerCase() === name.toLowerCase());
        if (retryExisting) return retryExisting.id;
      }
      throw error;
    }
  }

  async getUnprocessedDocuments(
    processedTagName: string = this.config.processedTagName,
    receiptTagName: string = "receipt"
  ) {
    // First, find the tag IDs
    const tags = await this.getTags();
    const processedTag = tags.find((t: any) => t.name.toLowerCase() === processedTagName.toLowerCase());
    const receiptTag = tags.find((t: any) => t.name.toLowerCase() === receiptTagName.toLowerCase());

    // Search for documents that HAVE the receipt tag AND DON'T have the processed tag
    let queryParts: string[] = [];
    if (receiptTag) {
      queryParts.push(`tags__id__all=${receiptTag.id}`);
    }
    if (processedTag) {
      queryParts.push(`tags__id__none=${processedTag.id}`);
    }
    const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

    let allDocs: any[] = [];
    let nextUrl: string | null = `/documents/${query}`;

    while (nextUrl) {
      const res = await this.fetchApi(nextUrl);
      const data = await res.json() as any;
      allDocs = allDocs.concat(data.results);

      if (data.next) {
        const url = new URL(data.next);
        const pathname = url.pathname.startsWith("/api")
          ? url.pathname.substring(4)
          : url.pathname;
        nextUrl = pathname + url.search;
      } else {
        nextUrl = null;
      }
    }

    return allDocs;
  }

  async getDocument(id: number): Promise<any> {
    const res = await this.fetchApi(`/documents/${id}/`);
    return await res.json();
  }

  async getDocumentFile(id: number): Promise<Buffer> {
    const res = await this.fetchApi(`/documents/${id}/download/`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getDocumentThumbnail(id: number): Promise<Buffer> {
    const res = await this.fetchApi(`/documents/${id}/thumb/`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async updateDocument(id: number, updates: {
    title?: string;
    created?: string;
    correspondent?: number;
    tags?: number[];
    content?: string;
    custom_fields?: Array<{ field: number; value: string | number | boolean | null }>;
  }) {
    await this.fetchApi(`/documents/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  /**
   * Add a note to a document.
   */
  async addNote(documentId: number, note: string): Promise<void> {
    console.log(`[DEBUG] Adding note to document ${documentId}, note length: ${note.length}`);
    try {
      await this.fetchApi(`/documents/${documentId}/notes/`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
      console.log(`[DEBUG] Successfully added note to document ${documentId}`);
    } catch (error: any) {
      console.error(`[ERROR] Failed to add note to document ${documentId}:`, error.message);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Custom Field Management
  // ─────────────────────────────────────────────────────────────────────────────

  private customFieldCache: Map<string, { id: number; name: string; data_type: string }> = new Map();
  private lastCustomFieldRefresh = 0;
  private readonly CUSTOM_FIELD_CACHE_LIFETIME = 60000; // 1 minute

  /**
   * Get all custom fields with pagination support.
   */
  async getCustomFields(): Promise<Array<{ id: number; name: string; data_type: string }>> {
    const now = Date.now();
    if (this.customFieldCache.size > 0 && (now - this.lastCustomFieldRefresh) < this.CUSTOM_FIELD_CACHE_LIFETIME) {
      return Array.from(this.customFieldCache.values());
    }

    this.customFieldCache.clear();
    let nextUrl: string | null = "/custom_fields/";
    const allFields: Array<{ id: number; name: string; data_type: string }> = [];

    while (nextUrl) {
      const response = await this.fetchApi(nextUrl);
      const data = await response.json() as any;

      if (!data?.results) break;

      for (const field of data.results) {
        const fieldEntry = { id: field.id, name: field.name, data_type: field.data_type };
        allFields.push(fieldEntry);
        this.customFieldCache.set(field.name.toLowerCase(), fieldEntry);
      }

      if (data.next) {
        try {
          const nextUrlObj = new URL(data.next);
          let relativePath = nextUrlObj.pathname;
          if (relativePath.startsWith("/api")) {
            relativePath = relativePath.substring(4);
          }
          nextUrl = relativePath + nextUrlObj.search;
        } catch {
          nextUrl = null;
        }
      } else {
        nextUrl = null;
      }
    }

    this.lastCustomFieldRefresh = Date.now();
    console.log(`[DEBUG] Custom field cache refreshed. Found ${allFields.length} fields.`);
    return allFields;
  }

  /**
   * Find a custom field by name.
   */
  async findCustomFieldByName(name: string): Promise<{ id: number; name: string; data_type: string } | null> {
    const normalizedName = name.toLowerCase();

    // Check cache first
    if (this.customFieldCache.has(normalizedName)) {
      return this.customFieldCache.get(normalizedName)!;
    }

    // Refresh cache and try again
    await this.getCustomFields();
    return this.customFieldCache.get(normalizedName) || null;
  }

  /**
   * Create a new custom field.
   * @param name - Field name
   * @param dataType - One of: string, url, date, boolean, integer, float, monetary, documentlink, select, longtext
   */
  async createCustomField(name: string, dataType: string = "longtext"): Promise<{ id: number; name: string; data_type: string }> {
    console.log(`[DEBUG] Creating custom field "${name}" with type "${dataType}"`);
    const response = await this.fetchApi("/custom_fields/", {
      method: "POST",
      body: JSON.stringify({ name, data_type: dataType }),
    });
    const field = await response.json() as any;
    const fieldEntry = { id: field.id, name: field.name, data_type: field.data_type };
    this.customFieldCache.set(name.toLowerCase(), fieldEntry);
    console.log(`[DEBUG] Successfully created custom field "${name}" with ID ${field.id}`);
    return fieldEntry;
  }

  /**
   * Ensure a custom field exists, creating it if necessary.
   * Returns the field ID.
   */
  async ensureCustomField(name: string, dataType: string = "longtext"): Promise<number> {
    let field = await this.findCustomFieldByName(name);

    if (!field) {
      try {
        field = await this.createCustomField(name, dataType);
      } catch (error: any) {
        // Handle race condition - field may have been created by another process
        if (error.message?.includes("400")) {
          // Force cache refresh and try to find again
          this.lastCustomFieldRefresh = 0;
          field = await this.findCustomFieldByName(name);
          if (field) {
            return field.id;
          }
        }
        throw error;
      }
    }

    return field.id;
  }
}


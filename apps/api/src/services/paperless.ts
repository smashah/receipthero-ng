import { z } from "zod";

export const PaperlessConfigSchema = z.object({
  host: z.string().url(),
  apiKey: z.string(),
  processedTagName: z.string().default("ai-processed"),
});

export type PaperlessConfig = z.infer<typeof PaperlessConfigSchema>;

// Paperless-NGX API response types
interface PaperlessTag {
  id: number;
  name: string;
  color?: string;
}

interface PaperlessCorrespondent {
  id: number;
  name: string;
}

export interface PaperlessDocument {
  id: number;
  title: string;
  tags: number[];
  correspondent: number | null;
  created: string;
  [key: string]: unknown;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export class PaperlessClient {
  private config: PaperlessConfig;

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

  async getTags(): Promise<PaperlessTag[]> {
    const res = await this.fetchApi("/tags/");
    const data = await res.json() as PaginatedResponse<PaperlessTag>;
    return data.results;
  }

  async getOrCreateTag(name: string): Promise<number> {
    const tags = await this.getTags();
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    const res = await this.fetchApi("/tags/", {
      method: "POST",
      body: JSON.stringify({ name, color: "#00FF00" }),
    });
    const data = await res.json() as PaperlessTag;
    return data.id;
  }

  async getOrCreateCorrespondent(name: string): Promise<number> {
    const res = await this.fetchApi(`/correspondents/?name__icontains=${encodeURIComponent(name)}`);
    const data = await res.json() as PaginatedResponse<PaperlessCorrespondent>;
    const existing = data.results.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    const postRes = await this.fetchApi("/correspondents/", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const postData = await postRes.json() as PaperlessCorrespondent;
    return postData.id;
  }

  async getUnprocessedDocuments(
    processedTagName: string = this.config.processedTagName,
    receiptTagName: string = "receipt"
  ) {
    // First, find the tag IDs
    const tags = await this.getTags();
    const processedTag = tags.find((t) => t.name.toLowerCase() === processedTagName.toLowerCase());
    const receiptTag = tags.find((t) => t.name.toLowerCase() === receiptTagName.toLowerCase());
    
    // Search for documents that HAVE the receipt tag AND DON'T have the processed tag
    let queryParts: string[] = [];
    if (receiptTag) {
      queryParts.push(`tags__id__all=${receiptTag.id}`);
    }
    if (processedTag) {
      queryParts.push(`tags__id__none=${processedTag.id}`);
    }
    const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    
    let allDocs: PaperlessDocument[] = [];
    let nextUrl: string | null = `/documents/${query}`;
    
    while (nextUrl) {
      const res = await this.fetchApi(nextUrl);
      const data = await res.json() as PaginatedResponse<PaperlessDocument>;
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

  async getDocument(id: number): Promise<PaperlessDocument> {
    const res = await this.fetchApi(`/documents/${id}/`);
    return await res.json() as PaperlessDocument;
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
  }) {
    await this.fetchApi(`/documents/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }
}

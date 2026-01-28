import { z } from "zod";

export const PaperlessConfigSchema = z.object({
  host: z.string().url(),
  apiKey: z.string(),
  processedTagName: z.string().default("ai-processed"),
});

export type PaperlessConfig = z.infer<typeof PaperlessConfigSchema>;

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

  async getTags() {
    const res = await this.fetchApi("/tags/");
    const data = await res.json();
    return data.results;
  }

  async getOrCreateTag(name: string): Promise<number> {
    const tags = await this.getTags();
    const existing = tags.find((t: any) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    const res = await this.fetchApi("/tags/", {
      method: "POST",
      body: JSON.stringify({ name, color: "#00FF00" }),
    });
    const data = await res.json();
    return data.id;
  }

  async getOrCreateCorrespondent(name: string): Promise<number> {
    const res = await this.fetchApi(`/correspondents/?name__icontains=${encodeURIComponent(name)}`);
    const data = await res.json();
    const existing = data.results.find((c: any) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    const postRes = await this.fetchApi("/correspondents/", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const postData = await postRes.json();
    return postData.id;
  }

  async getUnprocessedDocuments(tagName: string = this.config.processedTagName) {
    // First, find the tag ID
    const tags = await this.getTags();
    const tag = tags.find((t: any) => t.name.toLowerCase() === tagName.toLowerCase());
    
    // Search for documents that DON'T have this tag
    const query = tag ? `?tags__id__none=${tag.id}` : "";
    
    let allDocs: any[] = [];
    let nextUrl: string | null = `/documents/${query}`;
    
    while (nextUrl) {
      const res = await this.fetchApi(nextUrl);
      const data = await res.json();
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

  async getDocument(id: number) {
    const res = await this.fetchApi(`/documents/${id}/`);
    return await res.json();
  }

  async getDocumentFile(id: number): Promise<Buffer> {
    const res = await this.fetchApi(`/documents/${id}/download/`);
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

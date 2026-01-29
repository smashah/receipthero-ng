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
    const data = await res.json() as any;
    return data.results;
  }

  async getOrCreateTag(name: string): Promise<number> {
    const tags = await this.getTags();
    console.log("Found tags:", tags, name)
    const existing = tags.find((t: any) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    try {
      const res = await this.fetchApi("/tags/", {
        method: "POST",
        body: JSON.stringify({ name, color: "#00FF00" }),
      });
      const data = await res.json() as any;
      return data.id;
    } catch (error: any) {
      console.log("1IUH23IU1H23:", error.message)
      // If it fails with a unique constraint error, try to fetch again
      // The object might have been created by another process
      if (error.message?.includes("unique constraint") || error.message?.includes("400")) {
        const retryTags = await this.getTags();
        const retryExisting = retryTags.find((t: any) => t.name.toLowerCase() === name.toLowerCase());
        if (retryExisting) return retryExisting.id;
      }
      throw error;
    }
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
  }) {
    await this.fetchApi(`/documents/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }
}

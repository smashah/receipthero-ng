import { Hono } from 'hono';
import { loadConfig, PaperlessClient } from '@sm-rn/core';

const documents = new Hono();

// GET /api/documents/:id/image - Get original file
documents.get('/:id/image', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  try {
    const config = loadConfig();
    const client = new PaperlessClient({
      host: config.paperless.host,
      apiKey: config.paperless.apiKey,
      processedTagName: config.processing.processedTag,
    });
    
    const buffer = await client.getDocumentFile(id);
    // Determine mime type if possible, or use a default
    // Ideally we'd get this from document metadata
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf', // Default, Paperless usually serves PDFs or images
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// GET /api/documents/:id/thumbnail - Get thumbnail
documents.get('/:id/thumbnail', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  try {
    const config = loadConfig();
    const client = new PaperlessClient({
      host: config.paperless.host,
      apiKey: config.paperless.apiKey,
      processedTagName: config.processing.processedTag,
    });
    
    const buffer = await client.getDocumentThumbnail(id);
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

export default documents;

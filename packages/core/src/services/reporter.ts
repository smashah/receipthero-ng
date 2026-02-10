import { type ProcessingEventType } from '@sm-rn/shared/types';

// Note: We can't use createLogger here to avoid circular dependency
// (logger.ts imports reporter.ts, so reporter.ts can't import logger.ts)
// This is fine since reporter errors are rare edge cases

export class StatusReporter {
  private apiUrl: string;

  constructor(apiUrl: string = process.env.API_URL || 'http://localhost:3001') {
    this.apiUrl = apiUrl;
  }

  async report(type: ProcessingEventType, payload: any) {
    try {
      const response = await fetch(`${this.apiUrl.replace(/\/$/, "")}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload }),
      });
      if (!response.ok) {
        // Silent fail - don't spam logs when API is starting up
      }
    } catch {
      // Silent fail - network errors are expected when API isn't running
    }
  }
}

export const reporter = new StatusReporter();

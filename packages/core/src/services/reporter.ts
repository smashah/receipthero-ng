import { type ProcessingEventType } from '@sm-rn/shared/types';

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
        console.error(`Failed to report status: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to report status (network error):', error);
    }
  }
}

export const reporter = new StatusReporter();

import { describe, it, expect } from 'bun:test';
import { interpolateTemplate, dataToMarkdown } from '../services/workflow-executor';

describe('Workflow Executor Utils', () => {
  describe('interpolateTemplate', () => {
    it('should interpolate fields correctly', () => {
      const template = '{vendor} - {amount} {currency}';
      const data = { vendor: 'Apple', amount: 42.99, currency: 'USD' };
      expect(interpolateTemplate(template, data)).toBe('Apple - 42.99 USD');
    });

    it('should handle missing fields gracefully', () => {
      const template = '{vendor} - {missing}';
      const data = { vendor: 'Apple' };
      expect(interpolateTemplate(template, data)).toBe('Apple - {missing}');
    });
  });

  describe('dataToMarkdown', () => {
    it('should format generic data correctly', () => {
      const data = {
        vendor: 'Apple',
        amount: 42.99,
        summary: 'A test summary'
      };
      const markdown = dataToMarkdown(data, 'Test Workflow');
      expect(markdown).toContain('### **Test Workflow Data**');
      expect(markdown).toContain('**Vendor:** Apple');
      expect(markdown).toContain('**Amount:** 42.99');
      expect(markdown).toContain('### **Summary**');
      expect(markdown).toContain('A test summary');
    });
  });
});

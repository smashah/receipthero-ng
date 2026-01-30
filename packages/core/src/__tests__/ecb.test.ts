/**
 * ECB Currency Conversion Service Tests
 */
import { describe, test, expect } from 'bun:test';
import { getWeekBoundaries } from '../services/ecb';

describe('ECB Currency Service', () => {
    describe('getWeekBoundaries', () => {
        test('should calculate correct week boundaries for a Monday', () => {
            // 2025-01-27 is a Monday
            const result = getWeekBoundaries('2025-01-27');
            expect(result.weekStart).toBe('2025-01-27');
            expect(result.weekEnd).toBe('2025-02-02');
        });

        test('should calculate correct week boundaries for a Wednesday', () => {
            // 2025-01-29 is a Wednesday
            const result = getWeekBoundaries('2025-01-29');
            expect(result.weekStart).toBe('2025-01-27');
            expect(result.weekEnd).toBe('2025-02-02');
        });

        test('should calculate correct week boundaries for a Sunday', () => {
            // 2025-02-02 is a Sunday
            const result = getWeekBoundaries('2025-02-02');
            expect(result.weekStart).toBe('2025-01-27');
            expect(result.weekEnd).toBe('2025-02-02');
        });

        test('should calculate correct week boundaries for a Saturday', () => {
            // 2025-02-01 is a Saturday
            const result = getWeekBoundaries('2025-02-01');
            expect(result.weekStart).toBe('2025-01-27');
            expect(result.weekEnd).toBe('2025-02-02');
        });

        test('should handle year boundary correctly', () => {
            // 2024-12-31 is a Tuesday
            const result = getWeekBoundaries('2024-12-31');
            expect(result.weekStart).toBe('2024-12-30');
            expect(result.weekEnd).toBe('2025-01-05');
        });
    });
});

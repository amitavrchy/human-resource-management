import { dateOnly, workingDays } from './database.js';

describe('calendar and leave accounting', () => {
  it('counts working days inclusively and skips weekends', () => {
    expect(
      workingDays(
        dateOnly('2026-11-02'),
        dateOnly('2026-11-08'),
        [1, 2, 3, 4, 5],
      ),
    ).toBe(5);
  });
  it('supports organization-specific work weeks', () => {
    expect(
      workingDays(
        dateOnly('2026-11-06'),
        dateOnly('2026-11-08'),
        [0, 1, 2, 3, 4],
      ),
    ).toBe(1);
  });
  it('rejects impossible dates, reversed ranges and cross-year requests', () => {
    expect(() => dateOnly('2026-02-30')).toThrow();
    expect(() =>
      workingDays(
        dateOnly('2026-11-04'),
        dateOnly('2026-11-02'),
        [1, 2, 3, 4, 5],
      ),
    ).toThrow();
    expect(() =>
      workingDays(
        dateOnly('2026-12-31'),
        dateOnly('2027-01-01'),
        [1, 2, 3, 4, 5],
      ),
    ).toThrow();
  });
  it('rejects a weekend-only request', () => {
    expect(() =>
      workingDays(
        dateOnly('2026-11-07'),
        dateOnly('2026-11-08'),
        [1, 2, 3, 4, 5],
      ),
    ).toThrow();
  });
});

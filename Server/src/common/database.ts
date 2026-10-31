import { ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';

export async function serializable<T>(db: PrismaClient, run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await db.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 }); }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error;
    }
  }
  throw new ConflictException('Another change is in progress. Please try again.');
}
export function dateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Enter a valid calendar date.');
  return date;
}
export function workingDays(start: Date, end: Date, weekdays: number[]) {
  if (end < start || start.getUTCFullYear() !== end.getUTCFullYear() || end.getTime() - start.getTime() > 366 * 86400000) throw new BadRequestException('Use a valid date range within one calendar year.');
  let days = 0;
  for (let stamp = start.getTime(); stamp <= end.getTime(); stamp += 86400000) if (weekdays.includes(new Date(stamp).getUTCDay())) days++;
  if (!days) throw new BadRequestException('Choose at least one working day.');
  return days;
}

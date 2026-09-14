import { SelectQueryBuilder } from 'typeorm';

export interface CursorRef {
  createdAt: Date;
  id: string;
}

export function applyCursorPagination<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  cursorRef: CursorRef | null,
  limit: number,
): void {
  if (cursorRef) {
    qb.andWhere(
      `(${alias}.createdAt < :cursorCreatedAt OR (${alias}.createdAt = :cursorCreatedAt AND ${alias}.id < :cursorId))`,
      { cursorCreatedAt: cursorRef.createdAt, cursorId: cursorRef.id },
    );
  }
  qb.orderBy(`${alias}.createdAt`, 'DESC').addOrderBy(`${alias}.id`, 'DESC').take(limit);
}

export function computeNextCursor<T extends { id: string }>(items: T[], limit: number): string | null {
  return items.length === limit ? items[items.length - 1].id : null;
}

import { SelectQueryBuilder } from 'typeorm';
import { applyCursorPagination, computeNextCursor } from './cursor-pagination.util';

describe('applyCursorPagination', () => {
  const createMockQb = (): jest.Mocked<SelectQueryBuilder<object>> => {
    const qb: Partial<jest.Mocked<SelectQueryBuilder<object>>> = {};
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.orderBy = jest.fn().mockReturnValue(qb);
    qb.addOrderBy = jest.fn().mockReturnValue(qb);
    qb.take = jest.fn().mockReturnValue(qb);
    return qb as jest.Mocked<SelectQueryBuilder<object>>;
  };

  it('skips the WHERE clause and only sets ordering/limit when there is no cursor', () => {
    const qb = createMockQb();

    applyCursorPagination(qb, 'post', null, 20);

    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(qb.orderBy).toHaveBeenCalledWith('post.createdAt', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('post.id', 'DESC');
    expect(qb.take).toHaveBeenCalledWith(20);
  });

  it('adds the keyset WHERE clause anchored on the cursor row when one is given', () => {
    const qb = createMockQb();
    const cursorRef = { createdAt: new Date('2026-01-01T00:00:00.000Z'), id: 'post-5' };

    applyCursorPagination(qb, 'post', cursorRef, 20);

    expect(qb.andWhere).toHaveBeenCalledWith(
      '(post.createdAt < :cursorCreatedAt OR (post.createdAt = :cursorCreatedAt AND post.id < :cursorId))',
      { cursorCreatedAt: cursorRef.createdAt, cursorId: cursorRef.id },
    );
  });
});

describe('computeNextCursor', () => {
  it('returns null when the page came back shorter than the limit', () => {
    const items = [{ id: 'a' }, { id: 'b' }];

    expect(computeNextCursor(items, 20)).toBeNull();
  });

  it("returns the last item's id when the page is exactly at the limit", () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    expect(computeNextCursor(items, 3)).toBe('c');
  });
});

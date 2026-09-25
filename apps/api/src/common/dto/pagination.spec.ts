import { findPage, mapPage, paginate, PaginationDto } from './pagination.dto';

function dto(page: number, pageSize: number) {
  const d = new PaginationDto();
  d.page = page;
  d.pageSize = pageSize;
  return d;
}

describe('pagination', () => {
  it('computes skip and totalPages', () => {
    const d = dto(3, 10);
    expect(d.skip).toBe(20);
    expect(paginate([], 0, d).totalPages).toBe(1);
    expect(paginate([], 31, d).totalPages).toBe(4);
  });

  it('findPage runs list and count and wraps them', async () => {
    const page = await findPage(
      dto(1, 2),
      async () => ['a', 'b'],
      async () => 5,
    );
    expect(page).toEqual({ items: ['a', 'b'], page: 1, pageSize: 2, total: 5, totalPages: 3 });
  });

  it('mapPage transforms items and keeps metadata', async () => {
    const page = await mapPage(paginate([1, 2], 2, dto(1, 20)), async (n) => n * 10);
    expect(page.items).toEqual([10, 20]);
    expect(page.total).toBe(2);
  });
});

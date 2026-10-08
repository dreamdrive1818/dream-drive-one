import { cacheGet, cacheSet, remember } from '../../../lib/cache';

describe('in-memory cache', () => {
  it('round-trips JSON values', async () => {
    await cacheSet('dd:test:roundtrip', { ok: true }, 30);
    await expect(cacheGet('dd:test:roundtrip')).resolves.toEqual({ ok: true });
  });

  it('remember loads once per key', async () => {
    let n = 0;
    const load = async () => {
      n += 1;
      return { n };
    };
    const a = await remember('dd:test:once', 30, load);
    const b = await remember('dd:test:once', 30, load);
    expect(a).toEqual({ n: 1 });
    expect(b).toEqual({ n: 1 });
    expect(n).toBe(1);
  });
});

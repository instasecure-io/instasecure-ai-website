import { describe, it, expect } from 'vitest';
import { LEARN_CATEGORIES, LEARN_ITEMS } from '@/data/learn/catalog';

describe('learn catalog invariants', () => {
  it('category ids are unique', () => {
    const ids = LEARN_CATEGORIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('item hrefs are unique', () => {
    const hrefs = LEARN_ITEMS.map(i => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('every item belongs to an existing category and never to blog', () => {
    const ids = new Set(LEARN_CATEGORIES.map(c => c.id));
    for (const item of LEARN_ITEMS) {
      expect(ids.has(item.category)).toBe(true);
      expect(item.category).not.toBe('blog');
    }
  });

  it('exactly one item is featured (drives the nav pin)', () => {
    expect(LEARN_ITEMS.filter(i => i.featured).length).toBe(1);
  });

  it('every non-blog category has at least one item', () => {
    for (const cat of LEARN_CATEGORIES.filter(c => c.id !== 'blog')) {
      expect(LEARN_ITEMS.some(i => i.category === cat.id)).toBe(true);
    }
  });
});

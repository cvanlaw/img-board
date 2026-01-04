const { deepMerge } = require('../../lib/utils');

describe('deepMerge', () => {
  test('merges top-level properties', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    expect(deepMerge(target, source)).toEqual({ a: 1, b: 3, c: 4 });
  });

  test('merges nested objects', () => {
    const target = { nested: { a: 1, b: 2 } };
    const source = { nested: { b: 3 } };
    expect(deepMerge(target, source)).toEqual({ nested: { a: 1, b: 3 } });
  });

  test('replaces arrays instead of merging', () => {
    const target = { arr: [1, 2, 3] };
    const source = { arr: [4, 5] };
    expect(deepMerge(target, source)).toEqual({ arr: [4, 5] });
  });

  test('does not modify original objects', () => {
    const target = { nested: { a: 1 } };
    const source = { nested: { b: 2 } };
    deepMerge(target, source);
    expect(target).toEqual({ nested: { a: 1 } });
    expect(source).toEqual({ nested: { b: 2 } });
  });
});

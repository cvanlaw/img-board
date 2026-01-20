const { getRotationAngle } = require('../../lib/utils');

describe('Rotation angle calculation', () => {
  test('cw direction returns 90 degrees', () => {
    expect(getRotationAngle('cw')).toBe(90);
  });

  test('ccw direction returns -90 degrees', () => {
    expect(getRotationAngle('ccw')).toBe(-90);
  });

  test('invalid direction returns null', () => {
    expect(getRotationAngle('invalid')).toBeNull();
    expect(getRotationAngle('')).toBeNull();
    expect(getRotationAngle(null)).toBeNull();
    expect(getRotationAngle(undefined)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { mascotMood } from './RainMascot';

describe('the displayed probability selects the matching original character', () => {
  it.each([
    [0, 'easy'], [29, 'easy'], [30, 'prepared'], [59, 'prepared'],
    [60, 'umbrella'], [79, 'umbrella'], [80, 'raincoat'], [100, 'raincoat'],
    [29.6, 'prepared'], [59.6, 'umbrella'], [79.6, 'raincoat'],
  ])('%s%% selects %s', (probability, mood) => { expect(mascotMood(probability)).toBe(mood); });
  it.each([null, NaN, -1, 101])('does not pick a rain category for %s', value => { expect(mascotMood(value)).toBe('waiting'); });
});

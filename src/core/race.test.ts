import { describe, expect, it } from 'vitest';
import { forPlatform, layoutById } from '../content/layouts';
import { GAME_CONFIG } from './config';
import { applyFinish, applyProgress, createRace, isOver, markLeft, needsForgiving, standings } from './race';

const result = (ms: number) => ({ ms, netWpm: 40, accuracy: 0.95, errors: 1 });

describe('Ink Race', () => {
  it('ranks finishers by time, then progress, then those who left', () => {
    let race = createRace('austen-pride', 'en', 100, 0, ['host', 'p1', 'p2', 'p3']);
    race = applyProgress(race, 'p1', 40);
    race = applyProgress(race, 'p2', 70);
    race = applyFinish(race, 'p3', result(30_000));
    race = applyFinish(race, 'host', result(25_000));
    race = markLeft(race, 'p2');
    expect(standings(race).map((r) => r.id)).toEqual(['host', 'p3', 'p1', 'p2']);
    expect(standings(race)[0]!.at).toBe(100);
  });

  it('keeps progress on the page and ignores news after finishing or leaving', () => {
    let race = createRace('austen-pride', 'en', 100, 0, ['host', 'p1']);
    race = applyProgress(race, 'p1', 250);
    expect(race.racers[1]!.at).toBe(100);
    race = applyFinish(race, 'p1', result(9000));
    race = applyProgress(race, 'p1', 3);
    race = markLeft(race, 'p1');
    expect(race.racers[1]).toMatchObject({ at: 100, left: false });
  });

  it('is over when everyone is done or gone, or time runs out', () => {
    let race = createRace('austen-pride', 'en', 100, 1000, ['host', 'p1']);
    expect(isOver(race, 2000)).toBe(false);
    expect(isOver(race, 1000 + GAME_CONFIG.race.maxMs)).toBe(true);
    race = applyFinish(race, 'host', result(1));
    race = markLeft(race, 'p1');
    expect(isOver(race, 2000)).toBe(true);
  });

  it('forgives accents that are not on the player’s own keyboard', () => {
    const french = 'Il était une fois, à Noël.';
    expect(needsForgiving('Plain English text.', layoutById('us-qwerty'), 'mac')).toBe(false);
    expect(needsForgiving(french, layoutById('us-qwerty'), 'mac')).toBe(true);
    expect(needsForgiving(french, layoutById('us-qwerty'), 'pc')).toBe(true);
    expect(needsForgiving(french, forPlatform(layoutById('fr-azerty'), 'pc'), 'pc')).toBe(false);
    expect(needsForgiving('¿Qué? ¡Sí! Niño.', forPlatform(layoutById('es-iso'), 'pc'), 'pc')).toBe(false);
    expect(needsForgiving('El niño.', forPlatform(layoutById('fr-azerty'), 'pc'), 'pc')).toBe(false);
    expect(needsForgiving('El niño.', layoutById('dvorak'), 'pc')).toBe(true);
  });
});

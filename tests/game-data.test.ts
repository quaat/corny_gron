import assert from 'node:assert/strict';
import test from 'node:test';

import { ADVANCEMENTS, SCROLL_DESCRIPTIONS, WEAPONS } from '../constants.js';
import {
  FORBIDDEN_UNDINE_WEAPONS,
  HARDY_ENEMIES,
  LOCATION_OPTIONS,
  MILORD,
  MANOR_HAJDUK,
  SCANTY_ENEMIES,
  SPIRIT,
} from '../rules.js';
import { ScrollType, WeaponType } from '../types.js';

const ALL_ENEMIES = [...SCANTY_ENEMIES, ...HARDY_ENEMIES, MILORD, MANOR_HAJDUK, SPIRIT];

test('all enemies have expected core fields', () => {
  for (const enemy of ALL_ENEMIES) {
    assert.ok(enemy.name.length > 0);
    assert.ok(enemy.points > 0);
    assert.ok(enemy.dmgDie > 0);
    assert.ok(enemy.hp > 0);
  }
});

test('enemy groups match expected sizes', () => {
  assert.equal(SCANTY_ENEMIES.length, 4);
  assert.equal(HARDY_ENEMIES.length, 4);
});

test('undine weapon restrictions contain firearms only', () => {
  assert.deepEqual(FORBIDDEN_UNDINE_WEAPONS, [WeaponType.SAMOPAL, WeaponType.SCATTERGUN]);
});

test('location options table has stable shape and key entries', () => {
  assert.equal(LOCATION_OPTIONS.length, 12);
  assert.deepEqual(LOCATION_OPTIONS[0], { id: 1, label: 'Peak Black' });
  assert.deepEqual(LOCATION_OPTIONS[11], { id: 12, label: 'Mountain Village' });
});

test('weapons table contains all weapon types with valid values', () => {
  const weaponTypes = Object.values(WeaponType);
  for (const weaponType of weaponTypes) {
    const weapon = WEAPONS[weaponType];
    assert.ok(weapon, `Missing weapon config for ${weaponType}`);
    assert.equal(weapon.name, weaponType);
    assert.ok(weapon.damageDie > 0);
    assert.ok(Number.isInteger(weapon.bonusDamage));
    assert.ok(Number.isInteger(weapon.hitBonus));
    assert.ok(weapon.price >= 0);
  }
});

test('advancements and scroll descriptions are complete', () => {
  assert.equal(ADVANCEMENTS.length, 6);
  for (const scrollType of Object.values(ScrollType)) {
    assert.ok(SCROLL_DESCRIPTIONS[scrollType].length > 0);
  }
});

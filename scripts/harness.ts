import { ADVANCEMENTS, WEAPONS } from '../constants.js';
import { WeaponType } from '../types.js';
import { SCANTY_ENEMIES, HARDY_ENEMIES, MILORD, MANOR_HAJDUK, SPIRIT, LOCATION_OPTIONS } from '../rules.js';

type Check = { ok: boolean; message: string };

const checks: Check[] = [];
const check = (ok: boolean, message: string) => {
  checks.push({ ok, message });
};

const findEnemy = (name: string) => {
  return SCANTY_ENEMIES.concat(HARDY_ENEMIES).concat([MILORD, MANOR_HAJDUK, SPIRIT]).find(e => e.name === name);
};

const expectEnemy = (name: string, expected: { points: number; dmgDie: number; dmgBonus: number; hp: number }) => {
  const enemy = findEnemy(name);
  check(!!enemy, `Enemy exists: ${name}`);
  if (!enemy) return;
  check(enemy.points === expected.points, `${name} points == ${expected.points}`);
  check(enemy.dmgDie === expected.dmgDie, `${name} damage die == d${expected.dmgDie}`);
  check(enemy.dmgBonus === expected.dmgBonus, `${name} damage bonus == ${expected.dmgBonus}`);
  check(enemy.hp === expected.hp, `${name} HP == ${expected.hp}`);
};

expectEnemy("Hajduk", { points: 3, dmgDie: 4, dmgBonus: 0, hp: 6 });
expectEnemy("Bies", { points: 3, dmgDie: 4, dmgBonus: 0, hp: 6 });
expectEnemy("Poacher", { points: 3, dmgDie: 4, dmgBonus: 0, hp: 5 });
expectEnemy("Wolf", { points: 4, dmgDie: 4, dmgBonus: 1, hp: 6 });

expectEnemy("Undine", { points: 4, dmgDie: 4, dmgBonus: 0, hp: 8 });
expectEnemy("Bear", { points: 5, dmgDie: 6, dmgBonus: 1, hp: 10 });
expectEnemy("Highwayman", { points: 4, dmgDie: 6, dmgBonus: 1, hp: 10 });
expectEnemy("Spook", { points: 5, dmgDie: 6, dmgBonus: 0, hp: 12 });

expectEnemy("The Milord", { points: 5, dmgDie: 6, dmgBonus: 2, hp: 14 });
expectEnemy("Milord's Hajduk", { points: 3, dmgDie: 6, dmgBonus: 0, hp: 6 });
expectEnemy("Spirit of the Mountains", { points: 6, dmgDie: 6, dmgBonus: 2, hp: 20 });

check(WEAPONS[WeaponType.KNIFE].damageDie === 4 && WEAPONS[WeaponType.KNIFE].bonusDamage === 0, "Knife damage is d4");
check(WEAPONS[WeaponType.CIUPAGA].damageDie === 6 && WEAPONS[WeaponType.CIUPAGA].bonusDamage === 0, "Ciupaga damage is d6");
check(WEAPONS[WeaponType.SABRE].damageDie === 6 && WEAPONS[WeaponType.SABRE].hitBonus === 1, "Sabre damage is d6 and +1 hit");
check(WEAPONS[WeaponType.SAMOPAL].damageDie === 6 && WEAPONS[WeaponType.SAMOPAL].bonusDamage === 1, "Samopał damage is d6+1");
check(WEAPONS[WeaponType.SCATTERGUN].damageDie === 6 && WEAPONS[WeaponType.SCATTERGUN].bonusDamage === 2, "Scattergun damage is d6+2");

check(ADVANCEMENTS.length === 6, "Advancements table has 6 entries");
check(LOCATION_OPTIONS.length === 12, "Location table has 12 entries");
check(LOCATION_OPTIONS[0].label === "Peak Black", "Location roll 1 is Peak Black");

const failures = checks.filter(c => !c.ok);
if (failures.length > 0) {
  console.error("Harness failed:");
  for (const failure of failures) {
    console.error(`- ${failure.message}`);
  }
  process.exit(1);
}

console.log(`Harness passed (${checks.length} checks).`);


import { WeaponType, Weapon, ScrollType } from './types';

export const WEAPONS: Record<WeaponType, Weapon> = {
  [WeaponType.KNIFE]: { name: WeaponType.KNIFE, damageDie: 4, bonusDamage: 0, hitBonus: 0, price: 6 },
  [WeaponType.CIUPAGA]: { name: WeaponType.CIUPAGA, damageDie: 6, bonusDamage: 0, hitBonus: 0, price: 9 },
  [WeaponType.SABRE]: { name: WeaponType.SABRE, damageDie: 6, bonusDamage: 0, hitBonus: 1, price: 12 },
  [WeaponType.SAMOPAL]: { name: WeaponType.SAMOPAL, damageDie: 6, bonusDamage: 1, hitBonus: 0, price: 15 },
  [WeaponType.SCATTERGUN]: { name: WeaponType.SCATTERGUN, damageDie: 6, bonusDamage: 2, hitBonus: 0, price: 25 },
  [WeaponType.KARABELA]: { name: WeaponType.KARABELA, damageDie: 6, bonusDamage: 2, hitBonus: 1, price: 999 },
  [WeaponType.BARE_HANDS]: { name: WeaponType.BARE_HANDS, damageDie: 4, bonusDamage: -1, hitBonus: 0, price: 0 }
};

export const ADVANCEMENTS = [
  "Harnaś Title (Leader of Outlaws)",
  "+1 to Hit Rolls",
  "Max HP increases to 20",
  "Travelling Herbalist (Gain 5 points)",
  "Get a Scattergun",
  "Resilience: Half damage from one Enemy type"
];

export const SCROLL_DESCRIPTIONS = {
  [ScrollType.BIES_SUMMONING]: "Summons a bies for d4 turns, dealing d4 damage each turn.",
  [ScrollType.FIRE_GLYPH]: "d4 uses, each deals d6+1 damage regardless of hit.",
  [ScrollType.PROTECTION_WARD]: "d4 uses, lowers damage received by d4 each turn.",
  [ScrollType.DIVINATION_SIGIL]: "1 use, choose next location or re-roll location die."
};

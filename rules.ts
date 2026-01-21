import { WeaponType } from './types.js';

export type EnemyCategory = 'scanty' | 'hardy' | 'special';

export type Enemy = {
  name: string;
  points: number;
  rewardPoints?: number;
  dmgDie: number;
  dmgBonus: number;
  hp: number;
  category: EnemyCategory;
};

export const SCANTY_ENEMIES: Enemy[] = [
  { name: "Hajduk", points: 3, dmgDie: 4, dmgBonus: 0, hp: 6, category: 'scanty' },
  { name: "Bies", points: 3, dmgDie: 4, dmgBonus: 0, hp: 6, category: 'scanty' },
  { name: "Poacher", points: 3, dmgDie: 4, dmgBonus: 0, hp: 5, category: 'scanty' },
  { name: "Wolf", points: 4, dmgDie: 4, dmgBonus: 1, hp: 6, category: 'scanty' },
];

export const HARDY_ENEMIES: Enemy[] = [
  { name: "Undine", points: 4, dmgDie: 4, dmgBonus: 0, hp: 8, category: 'hardy' },
  { name: "Bear", points: 5, rewardPoints: 7, dmgDie: 6, dmgBonus: 1, hp: 10, category: 'hardy' },
  { name: "Highwayman", points: 4, dmgDie: 6, dmgBonus: 1, hp: 10, category: 'hardy' },
  { name: "Spook", points: 5, dmgDie: 6, dmgBonus: 0, hp: 12, category: 'hardy' },
];

export const MILORD: Enemy = { name: "The Milord", points: 5, dmgDie: 6, dmgBonus: 2, hp: 14, category: 'special' };
export const MANOR_HAJDUK: Enemy = { name: "Milord's Hajduk", points: 3, dmgDie: 6, dmgBonus: 0, hp: 6, category: 'special' };
export const SPIRIT: Enemy = { name: "Spirit of the Mountains", points: 6, dmgDie: 6, dmgBonus: 2, hp: 20, category: 'special' };

export const LOCATION_OPTIONS = [
  { id: 1, label: "Peak Black" },
  { id: 2, label: "Milord's Manor" },
  { id: 3, label: "A Cliff" },
  { id: 4, label: "Crags" },
  { id: 5, label: "A Burrow" },
  { id: 6, label: "Deep Woods" },
  { id: 7, label: "Deep Woods" },
  { id: 8, label: "A Meadow" },
  { id: 9, label: "A Meadow" },
  { id: 10, label: "Mountain Pass" },
  { id: 11, label: "Bacówka (Shepherd's Hut)" },
  { id: 12, label: "Mountain Village" },
];

export const FORBIDDEN_UNDINE_WEAPONS = [WeaponType.SAMOPAL, WeaponType.SCATTERGUN];

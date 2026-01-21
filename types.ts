
export enum WeaponType {
  KNIFE = 'Knife',
  CIUPAGA = 'Ciupaga',
  SABRE = 'Sabre',
  SAMOPAL = 'Samopał',
  SCATTERGUN = 'Scattergun',
  KARABELA = 'Karabela',
  BARE_HANDS = 'Bare Hands'
}

export interface Weapon {
  name: WeaponType;
  damageDie: number;
  bonusDamage: number;
  hitBonus: number;
  price: number;
}

export enum ScrollType {
  BIES_SUMMONING = 'Bies Summoning',
  FIRE_GLYPH = 'Fire Glyph',
  PROTECTION_WARD = 'Protection Ward',
  DIVINATION_SIGIL = 'Divination Sigil'
}

export interface Scroll {
  type: ScrollType;
  uses: number;
  description: string;
}

export type DroppedItem =
  | { kind: 'weapon'; weapon: Weapon; storedAtVisitId: number }
  | { kind: 'potion'; storedAtVisitId: number }
  | { kind: 'scroll'; scroll: Scroll; storedAtVisitId: number }
  | { kind: 'rope'; storedAtVisitId: number }
  | { kind: 'kaftan'; storedAtVisitId: number }
  | { kind: 'invisibility-cap'; charges: number; storedAtVisitId: number };

export interface GameState {
  playerName: string;
  hp: number;
  maxHp: number;
  dutki: number;
  points: number;
  visitedPlacesCount: number;
  visitedTypes: Set<string>;
  escapedTypes: Set<string>;
  locationRollModifier: number;
  hutRestCooldown: number;
  villageRestCooldown: number;
  springRestCooldown: number;
  manorRoomsVisited: Set<number>;
  manorEnteredFromCave: boolean;
  milordDefeated: boolean;
  milordHunts: boolean;
  milordTrueNameKnown: boolean;
  nextFightHitMod: number;
  temporaryHitPenalty: number;
  inventory: {
    weapon: Weapon;
    potions: number;
    scrolls: Scroll[];
    hasKaftan: boolean;
    hasInvisibilityCap: number; // stores charges
    hasRope: boolean;
    hasMountainSpiritHeart: boolean;
    hasKarabela: boolean;
  };
  advancements: number[]; // indices of Advancements already taken
  activeBiesTurns: number;
  permanentHitBonus: number;
  halfDamageEnemies: {
    scanty?: string;
    hardy?: string;
  };
  currentLocation: string;
  locationVisitId: number;
  locationItems: Record<string, DroppedItem[]>;
  inCave: boolean;
  caveHiddenPassageSeen: boolean;
  isDead: boolean;
  hasWon: boolean;
  log: string[];
}

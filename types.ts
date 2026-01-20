
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

export interface GameState {
  playerName: string;
  hp: number;
  maxHp: number;
  dutki: number;
  points: number;
  visitedPlacesCount: number;
  visitedTypes: Set<string>;
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
  halfDamageEnemies: string[]; // "scanty", "hardy"
  currentLocation: string;
  isDead: boolean;
  hasWon: boolean;
  log: string[];
}

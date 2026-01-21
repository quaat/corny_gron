
import React, { useRef, useState } from 'react';
import { GameState, WeaponType, ScrollType, Weapon, Scroll } from './types';
import { WEAPONS, ADVANCEMENTS, SCROLL_DESCRIPTIONS } from './constants';
import { Enemy, SCANTY_ENEMIES, HARDY_ENEMIES, MILORD, MANOR_HAJDUK, SPIRIT, LOCATION_OPTIONS, FORBIDDEN_UNDINE_WEAPONS } from './rules';

type CombatEnemy = Enemy & {
  currentHp: number;
};

const MAP_LOCATIONS = [
  "Mountain Pass",
  "Deep Woods",
  "A Meadow",
  "A Cliff",
  "Crags",
  "A Burrow",
  "Cave",
  "Milord's Manor",
  "Bacówka (Shepherd's Hut)",
  "Mountain Village",
  "Peak Black",
];

const LOCATION_LORE: Record<string, string> = {
  "Mountain Pass": "Old smugglers once carved these switchbacks, and travelers still leave coins at the cairns for safe passage.",
  "Deep Woods": "The firs here are said to whisper in Lemko, and the wind carries the warnings of lost woodcutters.",
  "A Meadow": "Shepherds tell of midnight dances where the grass lies flat by morning, and no bell rings twice the same.",
  "A Cliff": "A black scar in the ridge, where storms are born and ravens circle like wardens of old oaths.",
  "Crags": "Jagged teeth of the mountains, named for a stone spirit that tests the sure-footed and punishes the vain.",
  "A Burrow": "A hungry hollow in the earth, rumored to open only for those who owe a debt to the underworld.",
  "Cave": "Cold breath seeps from this throat of stone; miners claim it is a vein of the underworld itself.",
  "Milord's Manor": "A decaying court of a cursed noble; locals say the clocks here count only debts.",
  "Bacówka (Shepherd's Hut)": "A warm lamp in the high pasture, kept by a bac who swears he once shared vodka with a mountain spirit.",
  "Mountain Village": "A stubborn settlement bound by old rites; hearth smoke carries prayers to saints and forest guardians alike.",
  "Peak Black": "Known as Corny Groń, this summit marks the border between the living world and the mountain spirits.",
};

const ENEMY_LORE: Record<string, string> = {
  "Hajduk": "A court guard turned outlaw, still bound to old orders and old grudges.",
  "Bies": "A malicious spirit of the wilds; bonfires and salt were meant to keep its gaze away.",
  "Poacher": "A hunter who ignores village taboos, claiming the forest owes him its meat and silence.",
  "Wolf": "Not just a beast but a watcher; some say it is a witch's eyes on four legs.",
  "Undine": "A water spirit that coils in river mists, luring travelers with songs drowned in reeds.",
  "Bear": "A forest lord; in old tales, bears are kin to men and must be treated with grim respect.",
  "Highwayman": "A mountain bandit who knows every trail and every traveler who never returned.",
  "Spook": "A restless soul, bound to these heights by unkept vows and winter burial.",
  "The Milord": "A noble corrupted by pride, haunting his halls with contracts written in blood.",
  "Milord's Hajduk": "The Milord's last loyal blade, kept by oath even after the manor fell to ruin.",
  "Spirit of the Mountains": "The ancient guardian of Corny Groń, older than the trail and colder than the stone.",
};

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [diceLog, setDiceLog] = useState<{ id: number; sides: number[]; results: number[]; total?: number }[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [currentView, setCurrentView] = useState<'start' | 'game' | 'combat' | 'event' | 'shop' | 'dead' | 'win'>('start');
  const [combatState, setCombatState] = useState<{
    enemy: CombatEnemy;
    isHardy: boolean;
    turn: number;
    protectionActive: number; // turns left for ward
    currentBiesTurns: number;
    message: string;
    locationType: string;
    fleeDamageDie: number;
    allowInvisibility: boolean;
    forbiddenWeapons: WeaponType[];
    fightHitMod: number;
    postCombatReward?: string[];
    enemyLore?: string;
  } | null>(null);
  const [shopMode, setShopMode] = useState<'merchant' | 'village'>('merchant');
  const [afterShopAction, setAfterShopAction] = useState<(() => void) | null>(null);
  const [eventData, setEventData] = useState<{
    title: string;
    description: string;
    choices: { label: string; action: () => void }[];
  } | null>(null);
  const rollCounter = useRef(1);
  const rollDelayMs = 650;
  const diceLogLimit = 1;

  // --- Dice + Action Timing ---
  const recordRoll = (sides: number[], results: number[], total?: number) => {
    setDiceLog(prev => [
      { id: rollCounter.current++, sides, results, total },
      ...prev
    ].slice(0, diceLogLimit));
  };

  const roll = (sides: number) => {
    const result = Math.floor(Math.random() * sides) + 1;
    recordRoll([sides], [result], result);
    return result;
  };

  const rollDice = (sides: number[]) => {
    const results = sides.map(side => Math.floor(Math.random() * side) + 1);
    const total = results.reduce((sum, value) => sum + value, 0);
    recordRoll(sides, results, total);
    return { results, total };
  };

  const rollD6 = () => roll(6);
  const rollD4 = () => roll(4);

  const queueAction = (action: () => void) => {
    if (isRolling) return;
    setIsRolling(true);
    window.setTimeout(() => {
      action();
      window.setTimeout(() => setIsRolling(false), 140);
    }, rollDelayMs);
  };

  // --- Helpers ---
  const addLog = (msg: string) => {
    setGameLog(prev => [msg, ...prev].slice(0, 50));
  };

  const withLore = (desc: string, location: string) => {
    const lore = LOCATION_LORE[location];
    return lore ? `${desc} ${lore}`.trim() : desc;
  };

  const getLocationStatus = (location: string) => {
    if (!gameState) return 'unknown';
    if (location === gameState.currentLocation || (location === "Cave" && gameState.inCave)) return 'current';
    if (gameState.visitedTypes.has(location)) return 'visited';
    if (gameState.escapedTypes.has(location)) return 'escaped';
    return 'unknown';
  };

  const updateState = (updater: (prev: GameState) => GameState) => {
    setGameState(prev => {
      if (!prev) return prev;
      const newState = updater(prev);
      if (newState.hp <= 0 && !newState.isDead) {
        newState.isDead = true;
        setCurrentView('dead');
      }
      if (newState.advancements.length >= 6 && !newState.hasWon) {
        newState.hasWon = true;
        setCurrentView('win');
      }
      return newState;
    });
  };

  const applyState = (nextState: GameState) => {
    let newState = { ...nextState };
    if (newState.hp <= 0 && !newState.isDead) {
      newState.isDead = true;
      setCurrentView('dead');
    }
    if (newState.advancements.length >= 6 && !newState.hasWon) {
      newState.hasWon = true;
      setCurrentView('win');
    }
    setGameState(newState);
  };

  const returnToGameIfAlive = () => {
    setGameState(prev => {
      if (!prev) return prev;
      if (prev.hp <= 0) {
        setCurrentView('dead');
        return prev;
      }
      setCurrentView('game');
      return prev;
    });
  };

  const runIfAlive = (action: () => void) => {
    setGameState(prev => {
      if (!prev) return prev;
      if (prev.hp <= 0) {
        setCurrentView('dead');
        return prev;
      }
      action();
      return prev;
    });
  };

  // --- Initial Game Setup ---
  const startGame = (name: string) => {
    const weaponRoll = rollD4();
    const startingWeapons = [WeaponType.KNIFE, WeaponType.CIUPAGA, WeaponType.SABRE, WeaponType.SAMOPAL];
    const weapon = WEAPONS[startingWeapons[weaponRoll - 1]];

    const extraRoll = rollD4();
    const initialInventory = {
      weapon,
      potions: 0,
      scrolls: [] as Scroll[],
      hasKaftan: false,
      hasInvisibilityCap: 0,
      hasRope: false,
      hasMountainSpiritHeart: false,
      hasKarabela: false,
    };

    if (extraRoll === 1) initialInventory.hasKaftan = true;
    if (extraRoll === 2) initialInventory.potions = 1;
    if (extraRoll === 3) {
      initialInventory.scrolls.push({ type: ScrollType.BIES_SUMMONING, uses: rollD4(), description: SCROLL_DESCRIPTIONS[ScrollType.BIES_SUMMONING] });
    }
    if (extraRoll === 4) initialInventory.hasInvisibilityCap = rollD4();

    const initialState: GameState = {
      playerName: name,
      hp: 15,
      maxHp: 15,
      dutki: rollD6() + 6,
      points: 0,
      visitedPlacesCount: 0,
      visitedTypes: new Set(),
      escapedTypes: new Set(),
      locationRollModifier: 0,
      hutRestCooldown: 6,
      villageRestCooldown: 6,
      springRestCooldown: 6,
      manorRoomsVisited: new Set(),
      manorEnteredFromCave: false,
      milordDefeated: false,
      milordHunts: false,
      milordTrueNameKnown: false,
      nextFightHitMod: 0,
      temporaryHitPenalty: 0,
      inventory: initialInventory,
      advancements: [],
      activeBiesTurns: 0,
      permanentHitBonus: 0,
      halfDamageEnemies: {},
      currentLocation: 'Mountain Pass',
      inCave: false,
      caveHiddenPassageSeen: false,
      isDead: false,
      hasWon: false,
      log: [],
    };

    setGameState(initialState);
    setGameLog(["You begin your journey at the Mountain Pass."]);
    setCurrentView('game');
    resolveMountainPass(initialState);
  };

  const resolveMountainPass = (state: GameState) => {
    const pRoll = rollD4();
    let title = "Mountain Pass: ";
    let desc = "";
    let effect = () => {};

    if (pRoll === 1) {
      title += "Highwaymen's Hideout";
      desc = "You find an object buried by a highwayman. A rusted dagger marks the spot, as if it was meant to be returned.";
      effect = () => {
        findRandomObject();
        markVisited("Mountain Pass");
      };
    } else if (pRoll === 2) {
      title += "Vermin Ridge";
      desc = "A Scanty Enemy lurks here, drawn by the scent of travelers and the promise of easy spoils.";
      effect = () => startCombat({ isHardy: false, locationType: "Mountain Pass" });
    } else if (pRoll === 3) {
      title += "Bottom of a Cliff";
      desc = "You find a scroll on the body of a dead juhas, the ink smeared by rain and prayer.";
      effect = () => {
        findRandomScroll();
        markVisited("Mountain Pass");
      };
    } else {
      title += "Misty Valley";
      desc = "Creepily empty and quiet, as if the valley is holding its breath.";
      effect = () => {
        addLog("The valley is eerily silent.");
        markVisited("Mountain Pass");
        setCurrentView('game');
      };
    }

    setEventData({
      title,
      description: `${desc} ${LOCATION_LORE["Mountain Pass"]}`.trim(),
      choices: [{ label: "Continue", action: effect }]
    });
    setCurrentView('event');
  };

  const markVisited = (locationType: string) => {
    updateState(s => {
      const next = { ...s };
      next.visitedPlacesCount += 1;
      next.visitedTypes.add(locationType);
      next.escapedTypes.delete(locationType);
      next.hutRestCooldown += 1;
      next.villageRestCooldown += 1;
      next.springRestCooldown += 1;
      return next;
    });
  };

  const rollNewAdvancement = (state: GameState) => {
    let rollResult = rollD6();
    while (state.advancements.includes(rollResult)) {
      rollResult = rollD6();
    }
    return rollResult;
  };

  const applyAdvancementEffects = (state: GameState, aRoll: number) => {
    state.advancements.push(aRoll);
    if (aRoll === 2) state.permanentHitBonus += 1;
    if (aRoll === 3) {
      state.maxHp = 20;
      state.hp = 20;
    }
    if (aRoll === 4) state.points += 5;
    if (aRoll === 5) state.inventory.weapon = WEAPONS[WeaponType.SCATTERGUN];
  };

  const startAdvancementSequence = (count: number, onDone?: () => void) => {
    if (!gameState) return;
    const nextStep = (remaining: number) => {
      if (remaining <= 0) {
        if (onDone) onDone();
        else setCurrentView('game');
        return;
      }

      let currentRoll = 0;
      updateState(s => {
        currentRoll = rollNewAdvancement(s);
        if (currentRoll !== 6) {
          applyAdvancementEffects(s, currentRoll);
        }
        return s;
      });

      if (currentRoll === 6) {
        const scantyChoices = SCANTY_ENEMIES.map(e => e.name);
        const hardyChoices = HARDY_ENEMIES.map(e => e.name);
        setEventData({
          title: "Advancement!",
          description: `${ADVANCEMENTS[5]} Choose a Scanty Enemy to halve its damage.`,
          choices: scantyChoices.map(choice => ({
            label: choice,
            action: () => {
              setEventData({
                title: "Advancement!",
                description: `${ADVANCEMENTS[5]} Choose a Hardy Enemy to halve its damage.`,
                choices: hardyChoices.map(hChoice => ({
                  label: hChoice,
                  action: () => {
                    updateState(s => {
                      s.advancements.push(6);
                      s.halfDamageEnemies = { ...s.halfDamageEnemies, scanty: choice, hardy: hChoice };
                      return s;
                    });
                    nextStep(remaining - 1);
                  }
                }))
              });
            }
          }))
        });
        setCurrentView('event');
        return;
      }

      setEventData({
        title: "Advancement!",
        description: `You have grown stronger: ${ADVANCEMENTS[currentRoll - 1]}`,
        choices: [{ label: "Continue", action: () => nextStep(remaining - 1) }]
      });
      setCurrentView('event');
    };

    nextStep(count);
  };

  const getLoseableItems = (state: GameState) => {
    const items: { label: string; apply: (s: GameState) => void }[] = [];
    if (state.inventory.weapon.name !== WeaponType.BARE_HANDS) {
      items.push({
        label: `Weapon: ${state.inventory.weapon.name}`,
        apply: s => { s.inventory.weapon = WEAPONS[WeaponType.BARE_HANDS]; }
      });
    }
    if (state.inventory.potions > 0) {
      items.push({
        label: "Herbal Potion",
        apply: s => { s.inventory.potions -= 1; }
      });
    }
    if (state.inventory.hasRope) {
      items.push({
        label: "Rope",
        apply: s => { s.inventory.hasRope = false; }
      });
    }
    if (state.inventory.hasKaftan) {
      items.push({
        label: "Leather Kaftan",
        apply: s => { s.inventory.hasKaftan = false; }
      });
    }
    if (state.inventory.hasInvisibilityCap > 0) {
      items.push({
        label: "Invisibility Cap",
        apply: s => { s.inventory.hasInvisibilityCap = 0; }
      });
    }
    state.inventory.scrolls.forEach((scroll, index) => {
      items.push({
        label: `Scroll: ${scroll.type}`,
        apply: s => { s.inventory.scrolls.splice(index, 1); }
      });
    });
    return items;
  };

  const removeAdvancement = (state: GameState, id: number) => {
    state.advancements = state.advancements.filter(a => a !== id);
    if (id === 2) {
      state.permanentHitBonus = Math.max(0, state.permanentHitBonus - 1);
    }
    if (id === 3) {
      state.maxHp = 15;
      state.hp = Math.min(state.hp, 15);
    }
    if (id === 4) {
      state.points = Math.max(0, state.points - 5);
    }
    if (id === 5 && state.inventory.weapon.name === WeaponType.SCATTERGUN) {
      state.inventory.weapon = WEAPONS[WeaponType.BARE_HANDS];
    }
    if (id === 6) {
      state.halfDamageEnemies = {};
    }
  };

  // --- Combat Logic ---
  const startCombat = (params: {
    isHardy: boolean;
    enemy?: Enemy;
    locationType: string;
    fleeDamageDie?: number;
    allowInvisibility?: boolean;
    forbiddenWeapons?: WeaponType[];
    postCombatReward?: string[];
  }) => {
    const baseEnemy = params.enemy || (params.isHardy ? HARDY_ENEMIES[rollD4() - 1] : SCANTY_ENEMIES[rollD4() - 1]);
    const shouldOverrideWithMilord = gameState?.milordHunts && params.isHardy && baseEnemy.name !== MILORD.name && baseEnemy.name !== SPIRIT.name;
    const enemyBase = shouldOverrideWithMilord ? MILORD : baseEnemy;
    const fightHitMod = gameState?.nextFightHitMod || 0;

    updateState(s => ({ ...s, nextFightHitMod: 0 }));

    const allowInvisibility = params.allowInvisibility ?? (enemyBase.name !== MILORD.name && enemyBase.name !== SPIRIT.name);
    setCombatState({
      enemy: { ...enemyBase, currentHp: enemyBase.hp },
      isHardy: params.isHardy,
      turn: 1,
      protectionActive: 0,
      currentBiesTurns: gameState?.activeBiesTurns || 0,
      message: `A ${enemyBase.name} blocks your path!`,
      locationType: params.locationType,
      fleeDamageDie: params.fleeDamageDie ?? 4,
      allowInvisibility,
      forbiddenWeapons: params.forbiddenWeapons ?? [],
      fightHitMod,
      postCombatReward: params.postCombatReward,
      enemyLore: ENEMY_LORE[enemyBase.name] || "",
    });
    setCurrentView('combat');
  };

  const resolveCombatTurn = (action: 'hit' | 'potion' | 'scroll' | 'run', scrollIndex?: number) => {
    if (!combatState || !gameState) return;

    let msg = "";
    let enemyDmgTaken = 0;
    let playerDmgTaken = 0;
    let biesDmg = 0;
    let hitSucceeded = false;
    let newCombat = { ...combatState };
    let newState = { ...gameState };

    const weaponBlocked = newCombat.forbiddenWeapons.includes(newState.inventory.weapon.name);
    const combatWeapon = weaponBlocked ? WEAPONS[WeaponType.BARE_HANDS] : newState.inventory.weapon;

    if (action === 'run') {
      const runDmg = newCombat.fleeDamageDie === 0 ? 0 : roll(newCombat.fleeDamageDie);
      if (runDmg > 0) {
        newState.hp -= runDmg;
      }
      addLog(`You fled${runDmg > 0 ? `, taking ${runDmg} damage` : ""}.`);
      if (newCombat.enemy.name === MILORD.name) {
        newState.milordHunts = true;
      }
      if (newCombat.locationType) {
        newState.escapedTypes = new Set(newState.escapedTypes);
        newState.escapedTypes.add(newCombat.locationType);
      }
      setCombatState(null);
      applyState(newState);
      if (newCombat.locationType === "A Cliff" || newCombat.locationType === "Crags") {
        resolveFallRisk(newCombat.locationType, () => returnToGameIfAlive());
      } else {
        returnToGameIfAlive();
      }
      return;
    }

    // Player Turn
    if (action === 'hit') {
      const hitRoll = rollD6();
      const milordBonus = newCombat.enemy.name === MILORD.name && newState.milordTrueNameKnown ? 1 : 0;
      const spiritBonus = newCombat.enemy.name === SPIRIT.name && newState.inventory.hasMountainSpiritHeart ? 1 : 0;
      const totalHit = hitRoll + combatWeapon.hitBonus + newState.permanentHitBonus + newCombat.fightHitMod + newState.temporaryHitPenalty + milordBonus + spiritBonus;
      if (totalHit >= newCombat.enemy.points) {
        enemyDmgTaken = roll(combatWeapon.damageDie) + combatWeapon.bonusDamage;
        msg = `You hit for ${enemyDmgTaken}! `;
        hitSucceeded = true;
      } else {
        msg = `You missed! `;
      }
    } else if (action === 'potion') {
      if (newState.inventory.potions > 0) {
        const heal = rollD6();
        newState.hp = Math.min(newState.hp + heal, newState.maxHp);
        newState.inventory.potions--;
        msg = `You drank a potion and healed ${heal} HP. `;
      }
    } else if (action === 'scroll') {
      const scroll = scrollIndex !== undefined ? newState.inventory.scrolls[scrollIndex] : undefined;
      if (scroll) {
        if (scroll.type === ScrollType.BIES_SUMMONING) {
          if (newCombat.currentBiesTurns > 0) {
            msg = "A bies is already active. ";
          } else {
            const turns = rollD4();
            newCombat.currentBiesTurns = turns;
            msg = `You summoned a bies for ${turns} turns. `;
            scroll.uses -= 1;
          }
        }
        if (scroll.type === ScrollType.FIRE_GLYPH) {
          const dmg = rollD6() + 1;
          enemyDmgTaken += dmg;
          msg = `Fire glyph scorches for ${dmg} damage! `;
          scroll.uses -= 1;
        }
        if (scroll.type === ScrollType.PROTECTION_WARD) {
          const turns = rollD4();
          newCombat.protectionActive = turns;
          msg = `Protection ward shields you for ${turns} turns. `;
          scroll.uses -= 1;
        }
      }
      newState.inventory.scrolls = newState.inventory.scrolls.filter(s => s.uses > 0);
    }

    // Bies Helper
    if (newCombat.currentBiesTurns > 0) {
      biesDmg = rollD4();
      enemyDmgTaken += biesDmg;
      newCombat.currentBiesTurns--;
      msg += `Bies deals ${biesDmg} damage! `;
    }

    newCombat.enemy.currentHp -= enemyDmgTaken;

    // Check Enemy Death
    if (newCombat.enemy.currentHp <= 0) {
      const rewardPoints = newCombat.enemy.rewardPoints ?? newCombat.enemy.points;
      addLog(`Defeated ${newCombat.enemy.name}! Gained ${rewardPoints} points.`);
      newState.points += rewardPoints;
      newState.activeBiesTurns = newCombat.currentBiesTurns;
      resolveAfterFight(newCombat.enemy, newState, newCombat.locationType, newCombat.postCombatReward);
      return;
    }

    // Enemy Turn: only on miss or when not attacking
    const enemyAttacks = !hitSucceeded;
    if (enemyAttacks) {
      let baseEnemyDmg = roll(newCombat.enemy.dmgDie) + newCombat.enemy.dmgBonus;

      if (newCombat.enemy.name === "Undine" && newCombat.turn % 2 === 0) {
        baseEnemyDmg = rollD6();
        msg += "Undine ensnares you! ";
      }

      if (newCombat.enemy.category === 'scanty' && newState.halfDamageEnemies.scanty === newCombat.enemy.name) {
        baseEnemyDmg = Math.floor(baseEnemyDmg / 2);
      }
      if (newCombat.enemy.category === 'hardy' && newState.halfDamageEnemies.hardy === newCombat.enemy.name) {
        baseEnemyDmg = Math.floor(baseEnemyDmg / 2);
      }

      playerDmgTaken = baseEnemyDmg;
      if (newState.inventory.hasKaftan) {
        playerDmgTaken = Math.max(0, playerDmgTaken - rollD4());
      }
      if (newCombat.protectionActive > 0) {
        playerDmgTaken = Math.max(0, playerDmgTaken - rollD4());
      }

      newState.hp -= playerDmgTaken;
      msg += `Enemy deals ${playerDmgTaken} damage.`;
    }

    if (newCombat.protectionActive > 0) {
      newCombat.protectionActive -= 1;
    }

    newCombat.turn++;
    newCombat.message = msg;
    setCombatState(newCombat);
    applyState(newState);
  };

  const avoidCombatWithCap = () => {
    if (!combatState || !gameState) return;
    const rewardPoints = combatState.enemy.rewardPoints ?? combatState.enemy.points;
    updateState(s => ({
      ...s,
      points: s.points + rewardPoints,
      inventory: {
        ...s.inventory,
        hasInvisibilityCap: Math.max(0, s.inventory.hasInvisibilityCap - 1)
      }
    }));
    addLog(`You vanish from sight and gain ${rewardPoints} points without a fight.`);
    markVisited(combatState.locationType);
    setCombatState(null);
    if (combatState.locationType === "A Cliff" || combatState.locationType === "Crags") {
      resolveFallRisk(combatState.locationType, () => returnToGameIfAlive());
    } else {
      returnToGameIfAlive();
    }
  };

  const resolveAfterFight = (enemy: Enemy, state: GameState, locationType: string, postCombatReward?: string[]) => {
    let msg = `You defeated the ${enemy.name}. `;
    let requiresLossChoice = false;
    let lossReason = "";

    if (enemy.name === "Hajduk" && rollD6() <= 2) {
      if (state.inventory.weapon.name !== WeaponType.KNIFE) {
        msg += "You found a Knife! ";
        state.inventory.weapon = WEAPONS[WeaponType.KNIFE];
      } else {
        msg += "You found a Knife, but you already have one. ";
      }
    }
    if (enemy.name === "Bies" && rollD6() <= 2) {
      msg += "Found a Bies scroll! ";
      state.inventory.scrolls.push({ type: ScrollType.BIES_SUMMONING, uses: rollD4(), description: SCROLL_DESCRIPTIONS[ScrollType.BIES_SUMMONING] });
    }
    if (enemy.name === "Poacher" && rollD6() <= 2) {
      if (!state.inventory.hasRope) {
        msg += "Found a Rope! ";
        state.inventory.hasRope = true;
      } else {
        msg += "Found a Rope, but you already have one. ";
      }
    }
    if (enemy.name === "Wolf" && rollD6() === 1) {
      requiresLossChoice = true;
      lossReason = "The wolf stole an item. Choose what you lose.";
    }
    if (enemy.name === "Undine") {
      const gold = rollDice([6, 6, 6]).total;
      state.dutki += gold;
      msg += `Found ${gold} dutki in golden sand. `;
      if (rollD6() === 1) {
        state.points = 0;
        msg += "A curse took all your points!";
      }
    }
    if (enemy.name === "Bear" && rollD6() <= 2) {
      requiresLossChoice = true;
      lossReason = "The bear broke something. Choose what you lose.";
    }
    if (enemy.name === "Highwayman") {
      const gold = rollDice([4, 6]).total;
      state.dutki += gold;
      msg += `Looted ${gold} dutki. `;
      if (rollD6() === 1) {
        state.temporaryHitPenalty = -1;
        msg += "A bullet got stuck in your side! (-1 to hit rolls until you rest or advance)";
      }
    }
    if (enemy.name === "Spook" && rollD6() <= 2) {
      msg += "Spiritual awakening! Immediate Advancement!";
    }
    if (enemy.name === MILORD.name) {
      const gold = rollDice([6, 6]).total;
      state.dutki += gold;
      state.inventory.weapon = WEAPONS[WeaponType.KARABELA];
      state.inventory.hasKarabela = true;
      state.milordDefeated = true;
      state.milordHunts = false;
      msg += `You took ${gold} dutki and the Milord's karabela. `;
    }
    if (enemy.name === MANOR_HAJDUK.name && rollD6() <= 2) {
      msg += "Found a Sabre! ";
      state.inventory.weapon = WEAPONS[WeaponType.SABRE];
    }
    if (postCombatReward?.includes('pantry-one')) {
      const heal = rollD4();
      state.hp = Math.min(state.hp + heal, state.maxHp);
      const reward = grantRandomObject(state);
      msg += `You found ${reward} and healed ${heal} HP. `;
    }
    if (postCombatReward?.includes('pantry-two')) {
      const heal = rollD6();
      state.hp = Math.min(state.hp + heal, state.maxHp);
      const rewardA = grantRandomObject(state);
      const rewardB = grantRandomObject(state);
      msg += `You found ${rewardA} and ${rewardB}, and healed ${heal} HP. `;
    }
    if (postCombatReward?.includes('library-spook')) {
      state.inventory.scrolls.push(createRandomScroll());
      msg += "You found a random scroll. ";
    }

    applyState(state);

    const finishVictory = () => {
      markVisited(locationType);
      if (enemy.name === "Spook" && msg.includes("Advancement")) {
        startAdvancementSequence(1, () => {
          if (postCombatReward?.includes('manor-continue')) {
            offerManorContinuation();
          } else {
            setCurrentView('game');
          }
        });
        return;
      }
      if (enemy.name === MILORD.name) {
        startAdvancementSequence(1, () => {
          if (postCombatReward?.includes('manor-continue')) {
            offerManorContinuation();
          } else {
            setCurrentView('game');
          }
        });
        return;
      }
      if (enemy.name === SPIRIT.name) {
        const treasureGold = rollD6() * rollD6();
        updateState(s => {
          s.dutki += treasureGold;
          s.inventory.scrolls.push(createRandomScroll(), createRandomScroll(), createRandomScroll());
          return s;
        });
        startAdvancementSequence(2, () => {
          addLog(`The Spirit's treasure grants ${treasureGold} dutki and three scrolls.`);
          setCurrentView('game');
        });
        return;
      }
      if (postCombatReward?.includes('enter-manor')) {
        enterManor(true);
        return;
      }
      if (postCombatReward?.includes('cave-continue')) {
        caveContinuePrompt();
        return;
      }
      if (postCombatReward?.includes('manor-continue')) {
        offerManorContinuation();
        return;
      }
      if (postCombatReward?.includes('fall-risk')) {
        resolveFallRisk(locationType, () => returnToGameIfAlive());
        return;
      }
      returnToGameIfAlive();
    };

    if (requiresLossChoice) {
      const items = getLoseableItems(state);
      if (items.length === 0) {
        setEventData({
          title: "Victory",
          description: `${msg} You had nothing to lose.`,
          choices: [{ label: "Move On", action: finishVictory }]
        });
        setCurrentView('event');
        return;
      }
      setEventData({
        title: "Choose a Loss",
        description: lossReason,
        choices: items.map(item => ({
          label: item.label,
          action: () => {
            updateState(s => {
              item.apply(s);
              return s;
            });
            setEventData({
              title: "Victory",
              description: msg,
              choices: [{ label: "Move On", action: finishVictory }]
            });
          }
        }))
      });
      setCurrentView('event');
      setCombatState(null);
      return;
    }

    setEventData({
      title: "Victory",
      description: msg,
      choices: [{ label: "Move On", action: finishVictory }]
    });
    setCurrentView('event');
    setCombatState(null);
  };

  // --- Exploration ---
  const travel = () => {
    if (!gameState) return;
    if (gameState.inCave) {
      resolveCaveEncounter();
      return;
    }
    const locationRoll = rollDice([6, 6]).total + gameState.locationRollModifier;
    const finalRoll = Math.max(1, Math.min(12, locationRoll));
    resolveLocation(finalRoll);
  };

  const useDivinationSigil = () => {
    if (!gameState) return;
    if (gameState.inCave) return;
    const sigilIndex = gameState.inventory.scrolls.findIndex(s => s.type === ScrollType.DIVINATION_SIGIL);
    if (sigilIndex === -1) return;
    setEventData({
      title: "Divination Sigil",
      description: "Choose the next place in the mountains.",
      choices: LOCATION_OPTIONS.map(option => ({
        label: option.label,
        action: () => {
          updateState(s => {
            const scroll = s.inventory.scrolls[sigilIndex];
            if (scroll) {
              scroll.uses -= 1;
              if (scroll.uses <= 0) {
                s.inventory.scrolls.splice(sigilIndex, 1);
              }
            }
            return s;
          });
          resolveLocation(option.id);
        }
      }))
    });
    setCurrentView('event');
  };

  const resolveLocation = (id: number) => {
    let loc = "";
    let desc = "";
    let effect = () => {};

    switch(id) {
      case 1:
        loc = "Peak Black";
        desc = "The final destination.";
        effect = () => resolvePeakBlack();
        break;
      case 2:
        loc = "Milord's Manor";
        desc = "A decadent, dark house on the ridge.";
        effect = () => enterManor(false);
        break;
      case 3:
        loc = "A Cliff";
        desc = "Steep and dangerous.";
        effect = () => resolveDangerousTerrain("Cliff");
        break;
      case 4:
        loc = "Crags";
        desc = "Jagged rocks everywhere.";
        effect = () => resolveDangerousTerrain("Crags");
        break;
      case 5:
        loc = "A Burrow";
        desc = "A hole leads deep into a cave.";
        effect = () => resolveBurrow();
        break;
      case 6:
      case 7:
        loc = "Deep Woods";
        desc = "Shadows move between the trees.";
        effect = () => startEncounter(loc);
        break;
      case 8:
      case 9:
        loc = "A Meadow";
        desc = "A peaceful-looking clearing.";
        effect = () => startEncounter(loc, undefined, true);
        break;
      case 10:
        loc = "Mountain Pass";
        desc = "A narrow crossing.";
        effect = () => resolveMountainPass(gameState!);
        break;
      case 11:
        loc = "Bacówka (Shepherd's Hut)";
        desc = "A place to rest.";
        effect = () => resolveBacowka();
        break;
      case 12:
        loc = "Mountain Village";
        desc = "Life among the peaks.";
        effect = () => resolveMountainVillage();
        break;
      default:
        loc = "Peak Black";
        desc = "The final destination.";
        effect = () => resolvePeakBlack();
    }

    if (loc === "Milord's Manor" && gameState?.visitedTypes.has(loc)) {
      loc = "Peak Black";
      desc = "The final destination.";
      effect = () => resolvePeakBlack();
    }

    updateState(s => ({ ...s, currentLocation: loc, inCave: false }));

    const isRevisit = loc !== "Peak Black" && (gameState?.visitedTypes.has(loc) || gameState?.escapedTypes.has(loc));
    if (isRevisit) {
      const encounterRoll = rollD4();
      if (encounterRoll === 1) {
        setEventData({
          title: loc,
          description: "You return to a familiar place. An enemy approaches.",
          choices: [{
            label: "Prepare",
            action: () => startCombat({
              isHardy: false,
              locationType: loc,
              fleeDamageDie: loc === "A Meadow" ? 0 : 4,
            })
          }]
        });
      } else {
        setEventData({
          title: loc,
          description: "You return to a familiar place. It is empty.",
          choices: [{ label: "Continue", action: () => setCurrentView('game') }]
        });
      }
      setCurrentView('event');
      return;
    }

    setEventData({
      title: loc,
      description: withLore(desc, loc),
      choices: [{ label: "Explore", action: effect }]
    });
    setCurrentView('event');
  };

  const resolveFallRisk = (type: string, onDone: () => void) => {
    const resolveFall = (useRope: boolean) => {
      if (useRope) {
        updateState(s => ({ ...s, inventory: { ...s.inventory, hasRope: false } }));
      }
      if (rollD6() <= 3) {
        const check = rollD6() + (useRope ? 1 : 0);
        if (check <= 3) {
          const dmg = rollD6() + 2;
          updateState(s => ({ ...s, hp: s.hp - dmg }));
          addLog(`You fell down the ${type}! Took ${dmg} damage.`);
        }
      }
      runIfAlive(onDone);
    };

    if (gameState?.inventory.hasRope) {
      setEventData({
        title: type,
        description: "There is a risk of falling. Use your rope to add +1 to the roll?",
        choices: [
          { label: "Use Rope", action: () => resolveFall(true) },
          { label: "Do Not Use Rope", action: () => resolveFall(false) }
        ]
      });
      setCurrentView('event');
    } else {
      resolveFall(false);
    }
  };

  const resolveDangerousTerrain = (type: string) => {
    const finishTerrain = () => {
      resolveFallRisk(type, () => {
        markVisited(type);
        returnToGameIfAlive();
      });
    };

    startEncounter(type, finishTerrain, false, ['fall-risk'], true);
  };

  const startEncounter = (locationType: string, onFinish?: () => void, allowMeadowEscape?: boolean, postCombatReward?: string[], skipAutoVisit?: boolean) => {
    const eRoll = rollD6();
    switch(eRoll) {
      case 1: 
        addLog("Nothing happens.");
        if (!skipAutoVisit) markVisited(locationType);
        onFinish ? runIfAlive(onFinish) : returnToGameIfAlive();
        break;
      case 2: { // Snares
        const resolveSnares = (useRope: boolean) => {
          if (useRope) {
            updateState(s => ({ ...s, inventory: { ...s.inventory, hasRope: false } }));
          }
          const snareRoll = rollD6() + (useRope ? 1 : 0);
          if (snareRoll <= 3) {
            const dmg = rollD6();
            updateState(s => ({ ...s, hp: s.hp - dmg }));
            addLog(`Caught in snares! Took ${dmg} damage.`);
          }
          runIfAlive(() => {
            if (rollD6() === 1) {
              startCombat({ isHardy: false, locationType, postCombatReward });
            } else {
              if (!skipAutoVisit) markVisited(locationType);
              onFinish ? onFinish() : returnToGameIfAlive();
            }
          });
        };
        if (gameState?.inventory.hasRope) {
          setEventData({
            title: "Snares",
            description: "Use your rope to add +1 to the roll?",
            choices: [
              { label: "Use Rope", action: () => resolveSnares(true) },
              { label: "Do Not Use Rope", action: () => resolveSnares(false) }
            ]
          });
          setCurrentView('event');
        } else {
          resolveSnares(false);
        }
        break;
      }
      case 3: // Riddle
        setEventData({
          title: "A Traveller",
          description: "A hooded figure asks you a riddle. Solve it?",
          choices: [
            { label: "Answer (Roll d6)", action: () => {
              if (rollD6() % 2 !== 0) {
                setEventData({
                  title: "Riddle Answered",
                  description: "Correct! Choose your reward.",
                  choices: [
                    { label: "6 Dutki", action: () => {
                      updateState(s => ({ ...s, dutki: s.dutki + 6 }));
                      addLog("Correct! Gained 6 dutki.");
                      if (!skipAutoVisit) markVisited(locationType);
                      onFinish ? runIfAlive(onFinish) : returnToGameIfAlive();
                    }},
                    { label: "3 Points", action: () => {
                      updateState(s => ({ ...s, points: s.points + 3 }));
                      addLog("Correct! Gained 3 points.");
                      if (!skipAutoVisit) markVisited(locationType);
                      onFinish ? runIfAlive(onFinish) : returnToGameIfAlive();
                    }}
                  ]
                });
                setCurrentView('event');
              } else {
                const dmg = rollD4();
                updateState(s => ({ ...s, hp: s.hp - dmg }));
                addLog(`Wrong! Punishment: ${dmg} damage.`);
                if (!skipAutoVisit) markVisited(locationType);
                onFinish ? runIfAlive(onFinish) : returnToGameIfAlive();
              }
            }}
          ]
        });
        setCurrentView('event');
        break;
      case 4:
        startCombat({ isHardy: false, locationType, fleeDamageDie: allowMeadowEscape ? 0 : 4, postCombatReward });
        break;
      case 5:
        startCombat({ isHardy: true, locationType, fleeDamageDie: allowMeadowEscape ? 0 : 4, postCombatReward });
        break;
      case 6:
        if (!skipAutoVisit) markVisited(locationType);
        setShopMode('merchant');
        if (onFinish) {
          setAfterShopAction(() => onFinish);
        }
        setCurrentView('shop');
        break;
    }
  };

  const createRandomScroll = () => {
    const sRoll = rollD4();
    const types = [ScrollType.BIES_SUMMONING, ScrollType.FIRE_GLYPH, ScrollType.PROTECTION_WARD, ScrollType.DIVINATION_SIGIL];
    const type = types[sRoll - 1];
    return { type, uses: sRoll === 4 ? 1 : rollD4(), description: SCROLL_DESCRIPTIONS[type] };
  };

  const grantRandomObject = (state: GameState) => {
    const oRoll = rollD6();
    if (oRoll === 1) {
      const weaponRoll = rollD4();
      const startingWeapons = [WeaponType.KNIFE, WeaponType.CIUPAGA, WeaponType.SABRE, WeaponType.SAMOPAL];
      const newWeapon = WEAPONS[startingWeapons[weaponRoll - 1]];
      if (state.inventory.weapon.name !== newWeapon.name) {
        state.inventory.weapon = newWeapon;
        return newWeapon.name;
      }
      return `${newWeapon.name} (already have one)`;
    }
    if (oRoll === 2) {
      if (state.inventory.potions < 10) {
        state.inventory.potions++;
        return "Herbal Potion";
      }
      return "Herbal Potion (pack is full)";
    }
    if (oRoll === 3) {
      if (!state.inventory.hasRope) {
        state.inventory.hasRope = true;
        return "Rope";
      }
      return "Rope (already have one)";
    }
    if (oRoll === 4) {
      state.inventory.scrolls.push(createRandomScroll());
      return "Scroll";
    }
    if (oRoll === 5) {
      if (!state.inventory.hasKaftan) {
        state.inventory.hasKaftan = true;
        return "Leather Kaftan";
      }
      return "Leather Kaftan (already have one)";
    }
    if (oRoll === 6) {
      if (state.inventory.hasInvisibilityCap === 0) {
        state.inventory.hasInvisibilityCap = rollD4();
        return "Invisibility Cap";
      }
      return "Invisibility Cap (already have one)";
    }
    return "Object";
  };

  const findRandomObject = () => {
    const oRoll = rollD6();
    let item = "";
    updateState(s => {
      if (oRoll === 1) {
        const weaponRoll = rollD4();
        const startingWeapons = [WeaponType.KNIFE, WeaponType.CIUPAGA, WeaponType.SABRE, WeaponType.SAMOPAL];
        const newWeapon = WEAPONS[startingWeapons[weaponRoll - 1]];
        if (s.inventory.weapon.name !== newWeapon.name) {
          s.inventory.weapon = newWeapon;
          item = newWeapon.name;
        } else {
          item = `${newWeapon.name} (already have one)`;
        }
      }
      if (oRoll === 2) {
        if (s.inventory.potions < 10) {
          s.inventory.potions++;
          item = "Herbal Potion";
        } else {
          item = "Herbal Potion (pack is full)";
        }
      }
      if (oRoll === 3) {
        if (!s.inventory.hasRope) {
          s.inventory.hasRope = true;
          item = "Rope";
        } else {
          item = "Rope (already have one)";
        }
      }
      if (oRoll === 4) {
        s.inventory.scrolls.push(createRandomScroll());
        item = "a Scroll";
      }
      if (oRoll === 5) {
        if (!s.inventory.hasKaftan) {
          s.inventory.hasKaftan = true;
          item = "Leather Kaftan";
        } else {
          item = "Leather Kaftan (already have one)";
        }
      }
      if (oRoll === 6) {
        if (s.inventory.hasInvisibilityCap === 0) {
          s.inventory.hasInvisibilityCap = rollD4();
          item = "Invisibility Cap";
        } else {
          item = "Invisibility Cap (already have one)";
        }
      }
      addLog(`Found: ${item}`);
      return s;
    });
    setCurrentView('game');
  };

  const findRandomScroll = () => {
    updateState(s => {
      const scroll = createRandomScroll();
      s.inventory.scrolls.push(scroll);
      return s;
    });
    addLog("Found a scroll.");
    setCurrentView('game');
  };

  const offerManorContinuation = (allowExit = true) => {
    setEventData({
      title: "Milord's Manor",
      description: withLore("Do you want to explore another room or leave the manor?", "Milord's Manor"),
      choices: [
        { label: "Explore Another Room", action: () => enterNextManorRoom() },
        ...(allowExit ? [{ label: "Leave Manor", action: () => setCurrentView('game') }] : [])
      ]
    });
    setCurrentView('event');
  };

  const enterNextManorRoom = () => {
    if (!gameState) return;
    let rollResult = rollD6();
    let nextRoom = rollResult;
    while (nextRoom >= 1 && gameState.manorRoomsVisited.has(nextRoom)) {
      nextRoom -= 1;
    }
    if (nextRoom < 1) nextRoom = rollResult;
    resolveManorRoom(nextRoom);
  };

  const enterManor = (fromCave: boolean) => {
    addLog("You enter the Milord's Manor.");
    updateState(s => ({ ...s, manorEnteredFromCave: fromCave, currentLocation: "Milord's Manor", inCave: false }));
    if (fromCave) {
      resolveManorRoom(6);
      return;
    }
    const entryRoll = rollD6();
    if (entryRoll <= 2) resolveManorRoom(3);
    else if (entryRoll <= 5) resolveManorRoom(2);
    else resolveManorRoom(4);
  };

  const resolveManorRoom = (roomId: number) => {
    updateState(s => {
      s.manorRoomsVisited.add(roomId);
      return s;
    });

    switch (roomId) {
      case 1: { // Study
        const demandRoll = rollD6();
        let description = "";
        let choices: { label: string; action: () => void }[] = [];
        if (demandRoll <= 2) {
          description = "The Milord demands all your scrolls and potions.";
          choices = [
            {
              label: "Give Them",
              action: () => {
                updateState(s => {
                  s.inventory.scrolls = [];
                  s.inventory.potions = 0;
                  return s;
                });
                markVisited("Milord's Manor");
                offerManorContinuation();
              }
            },
            {
              label: "Fight",
              action: () => startCombat({
                isHardy: true,
                enemy: MILORD,
                locationType: "Milord's Manor",
                fleeDamageDie: 6,
                allowInvisibility: false,
                postCombatReward: ['manor-continue'],
              })
            }
          ];
        } else if (demandRoll <= 4) {
          description = "The Milord demands all your dutki and points.";
          choices = [
            {
              label: "Give Them",
              action: () => {
                updateState(s => ({ ...s, dutki: 0, points: 0 }));
                markVisited("Milord's Manor");
                offerManorContinuation();
              }
            },
            {
              label: "Fight",
              action: () => startCombat({
                isHardy: true,
                enemy: MILORD,
                locationType: "Milord's Manor",
                fleeDamageDie: 6,
                allowInvisibility: false,
                postCombatReward: ['manor-continue'],
              })
            }
          ];
        } else {
          description = "The Milord demands your soul.";
          choices = [
            {
              label: "Fight",
              action: () => startCombat({
                isHardy: true,
                enemy: MILORD,
                locationType: "Milord's Manor",
                fleeDamageDie: 6,
                allowInvisibility: false,
                postCombatReward: ['manor-continue'],
              })
            },
            {
              label: "Submit",
              action: () => {
                updateState(s => ({ ...s, hp: 0 }));
                setCurrentView('dead');
              }
            }
          ];
        }
        setEventData({
          title: "Milord's Study",
          description,
          choices
        });
        setCurrentView('event');
        break;
      }
      case 2:
        setEventData({
          title: "Hallway",
          description: "The Milord's hajduk stands guard.",
          choices: [{
            label: "Fight",
            action: () => startCombat({
              isHardy: false,
              enemy: MANOR_HAJDUK,
              locationType: "Milord's Manor",
              postCombatReward: ['manor-continue'],
            })
          }]
        });
        setCurrentView('event');
        break;
      case 3:
        setEventData({
          title: "Dining Room",
          description: "Milord’s dinner is waiting on the lavishly set table. Will you eat?",
          choices: [
            {
              label: "Eat",
              action: () => {
                const mealRoll = rollD6();
                if (mealRoll === 1) {
                  setEventData({
                    title: "Cursed Wine",
                    description: "You lose all your points and one Advancement of your choice.",
                    choices: (gameState?.advancements.length ? gameState.advancements : [0]).map(a => ({
                      label: a === 0 ? "No Advancements to Lose" : `Lose Advancement ${a}`,
                      action: () => {
                        updateState(s => {
                          s.points = 0;
                          if (a !== 0) removeAdvancement(s, a);
                          return s;
                        });
                        markVisited("Milord's Manor");
                        offerManorContinuation();
                      }
                    }))
                  });
                  setCurrentView('event');
                  return;
                }
                if (mealRoll <= 3) {
                  const dmg = rollD6();
                  updateState(s => {
                    s.hp -= dmg;
                    s.nextFightHitMod = -1;
                    return s;
                  });
                  addLog(`Devilish feast: took ${dmg} damage and -1 to next fight hit rolls.`);
                  runIfAlive(() => {
                    markVisited("Milord's Manor");
                    offerManorContinuation(gameState?.manorEnteredFromCave ?? false);
                  });
                  return;
                } else if (mealRoll <= 5) {
                  const heal = rollD6();
                  updateState(s => ({ ...s, hp: Math.min(s.hp + heal, s.maxHp) }));
                  addLog(`Delicious roast healed ${heal} HP.`);
                } else {
                  updateState(s => ({ ...s, hp: s.maxHp, nextFightHitMod: 1 }));
                  addLog("Feast of the gods! Full HP and +1 to next fight hit rolls.");
                }
                markVisited("Milord's Manor");
                offerManorContinuation(gameState?.manorEnteredFromCave ?? false);
              }
            },
            {
              label: "Leave It",
              action: () => {
                markVisited("Milord's Manor");
                offerManorContinuation();
              }
            }
          ]
        });
        setCurrentView('event');
        break;
      case 4: {
        const pantryRoll = rollD6();
        if (pantryRoll <= 2) {
          setEventData({
            title: "Pantry",
            description: "There is nothing in the pantry apart from gnawed human bones.",
            choices: [{ label: "Continue", action: () => { markVisited("Milord's Manor"); offerManorContinuation(gameState?.manorEnteredFromCave ?? false); } }]
          });
          setCurrentView('event');
          break;
        }
        if (pantryRoll <= 4) {
          setEventData({
            title: "Pantry",
            description: "The Milord’s hajduk guards the provisions.",
            choices: [{
              label: "Fight",
              action: () => startCombat({
                isHardy: false,
                enemy: MANOR_HAJDUK,
                locationType: "Milord's Manor",
                postCombatReward: ['pantry-one', 'manor-continue'],
              })
            }]
          });
          setCurrentView('event');
          break;
        }
        let rewardA = "";
        let rewardB = "";
        const heal = rollD6();
        updateState(s => {
          rewardA = grantRandomObject(s);
          rewardB = grantRandomObject(s);
          s.hp = Math.min(s.hp + heal, s.maxHp);
          return s;
        });
        setEventData({
          title: "Pantry",
          description: `You found ${rewardA} and ${rewardB}, and healed ${heal} HP.`,
          choices: [{ label: "Continue", action: () => { markVisited("Milord's Manor"); offerManorContinuation(); } }]
        });
        setCurrentView('event');
        break;
      }
      case 5: {
        const libraryRoll = rollD6();
        if (libraryRoll <= 2) {
          setEventData({
            title: "Library",
            description: "A spook guards the library.",
            choices: [{
              label: "Fight",
              action: () => startCombat({
                isHardy: true,
                enemy: HARDY_ENEMIES.find(e => e.name === "Spook") || HARDY_ENEMIES[3],
                locationType: "Milord's Manor",
                postCombatReward: ['library-spook', 'manor-continue'],
              })
            }]
          });
          setCurrentView('event');
          break;
        }
        if (libraryRoll <= 4) {
          updateState(s => {
            s.inventory.scrolls.push(createRandomScroll(), createRandomScroll());
            return s;
          });
          setEventData({
            title: "Library",
            description: "You found two random scrolls.",
            choices: [{ label: "Continue", action: () => { markVisited("Milord's Manor"); offerManorContinuation(); } }]
          });
          setCurrentView('event');
          break;
        }
        updateState(s => ({ ...s, milordTrueNameKnown: true }));
        setEventData({
          title: "Library",
          description: "You found the Milord’s True Name. +1 to hit rolls against him.",
          choices: [{ label: "Continue", action: () => { markVisited("Milord's Manor"); offerManorContinuation(); } }]
        });
        setCurrentView('event');
        break;
      }
      case 6: {
        const cellarRoll = rollD6();
        if (cellarRoll <= 2) {
          updateState(s => ({ ...s, inventory: { ...s.inventory, potions: Math.min(10, s.inventory.potions + 1) } }));
          setEventData({
            title: "Cellar",
            description: "A drunk hajduk sleeps here. You steal an herbal potion.",
            choices: [{ label: "Continue", action: () => { markVisited("Milord's Manor"); offerManorContinuation(); } }]
          });
          setCurrentView('event');
          break;
        }
        if (cellarRoll <= 4) {
          setEventData({
            title: "Cellar",
            description: "You find a mysterious potion. Drink it?",
            choices: [
              {
                label: "Drink",
                action: () => {
                  const potionRoll = rollD6();
                  if (potionRoll % 2 === 0) {
                    updateState(s => ({ ...s, hp: s.maxHp }));
                    addLog("You regain full HP.");
                  } else {
                    const dmg = rollD6();
                    updateState(s => ({ ...s, hp: s.hp - dmg, points: 0 }));
                    addLog(`It was human blood! You lost ${dmg} HP and all points.`);
                    runIfAlive(() => {
                      markVisited("Milord's Manor");
                      offerManorContinuation(gameState?.manorEnteredFromCave ?? false);
                    });
                    return;
                  }
                  markVisited("Milord's Manor");
                  offerManorContinuation(gameState?.manorEnteredFromCave ?? false);
                }
              },
              { label: "Leave It", action: () => { markVisited("Milord's Manor"); offerManorContinuation(gameState?.manorEnteredFromCave ?? false); } }
            ]
          });
          setCurrentView('event');
          break;
        }
        const treasure = rollD4() * rollD6();
        updateState(s => ({ ...s, dutki: s.dutki + treasure }));
        setEventData({
          title: "Cellar",
          description: `You find the Milord’s treasure: ${treasure} dutki.`,
          choices: [{ label: "Continue", action: () => { markVisited("Milord's Manor"); offerManorContinuation(gameState?.manorEnteredFromCave ?? false); } }]
        });
        setCurrentView('event');
        break;
      }
      default:
        offerManorContinuation();
    }
  };

  const resolveBurrow = () => {
    startEncounter("A Burrow", () => {
      setEventData({
        title: "A Burrow",
        description: withLore("A tunnel leads into the Cave.", "A Burrow"),
        choices: [
          { label: "Enter the Cave", action: () => enterCave() },
          { label: "Leave It", action: () => setCurrentView('game') }
        ]
      });
      setCurrentView('event');
    });
  };

  const resolveBacowka = () => {
    startEncounter("Bacówka (Shepherd's Hut)", () => {
    const canRest = (gameState?.hutRestCooldown || 0) >= 6;
    setEventData({
      title: "Bacówka",
      description: withLore(
        canRest ? "You can rest here and regain d6+2 HP." : "You cannot rest here again yet.",
        "Bacówka (Shepherd's Hut)"
      ),
      choices: [
        ...(canRest ? [{
          label: "Rest",
          action: () => {
              const heal = rollD6() + 2;
              updateState(s => ({ ...s, hp: Math.min(s.hp + heal, s.maxHp), hutRestCooldown: 0, temporaryHitPenalty: 0 }));
              addLog(`You rested and regained ${heal} HP.`);
              setCurrentView('game');
            }
          }] : []),
          { label: "Leave", action: () => setCurrentView('game') }
        ]
      });
      setCurrentView('event');
    });
  };

  const resolveMountainVillage = () => {
    markVisited("Mountain Village");
    updateState(s => ({ ...s, locationRollModifier: -1 }));
    setAfterShopAction(null);
    const canRest = (gameState?.villageRestCooldown || 0) >= 6;
    setEventData({
      title: "Mountain Village",
      description: withLore("You can trade here, and rest if enough time has passed.", "Mountain Village"),
      choices: [
        { label: "Trade", action: () => { setShopMode('village'); setCurrentView('shop'); } },
        ...(canRest ? [{
          label: "Rest",
          action: () => {
            const heal = rollD6() + 6;
            updateState(s => ({ ...s, hp: Math.min(s.hp + heal, s.maxHp), villageRestCooldown: 0, temporaryHitPenalty: 0 }));
            addLog(`You rested and regained ${heal} HP.`);
            setCurrentView('game');
          }
        }] : []),
        { label: "Leave", action: () => setCurrentView('game') }
      ]
    });
    setCurrentView('event');
  };

  const enterCave = () => {
    updateState(s => ({ ...s, inCave: true, currentLocation: "Cave" }));
    resolveCaveEncounter();
  };

  const resolveCaveEncounter = () => {
    const cRoll = rollD6();
    if (cRoll === 1) {
      setEventData({
        title: "Cave",
        description: withLore("The cavern is dark and damp, but empty.", "Cave"),
        choices: [{ label: "Continue", action: () => { markVisited("Cave"); caveContinuePrompt(); } }]
      });
      setCurrentView('event');
      return;
    }
    if (cRoll === 2) {
      const swimRoll = rollD6() + (gameState?.inventory.hasKaftan ? 0 : 1);
      if (swimRoll <= 2) {
        const dmg = rollD6();
        updateState(s => ({ ...s, hp: s.hp - dmg }));
        runIfAlive(() => {
          setEventData({
            title: "Flooded Cavern",
            description: withLore(`The water is too deep. You lose ${dmg} HP and must turn back.`, "Cave"),
            choices: [{ label: "Retreat", action: () => exitCave() }]
          });
          setCurrentView('event');
        });
        return;
      }
      if (swimRoll <= 4) {
        startCombat({
          isHardy: true,
          enemy: HARDY_ENEMIES.find(e => e.name === "Undine") || HARDY_ENEMIES[0],
          locationType: "Cave",
          forbiddenWeapons: FORBIDDEN_UNDINE_WEAPONS,
          postCombatReward: ['cave-continue'],
        });
        return;
      }
      updateState(s => ({ ...s, inventory: { ...s.inventory, hasMountainSpiritHeart: true } }));
      setEventData({
        title: "Flooded Cavern",
        description: withLore("You find the Mountain Spirit’s heart at the bottom of the pool.", "Cave"),
        choices: [{ label: "Continue", action: () => { markVisited("Cave"); caveContinuePrompt(); } }]
      });
      setCurrentView('event');
      return;
    }
    if (cRoll === 3) {
      startCombat({ isHardy: true, locationType: "Cave", postCombatReward: ['cave-continue'] });
      return;
    }
    if (cRoll === 4) {
      const canUseSpring = (gameState?.springRestCooldown || 0) >= 6;
      setEventData({
        title: "Spring of Life",
        description: withLore(
          canUseSpring ? "Drink from the spring to restore to full HP." : "The spring has lost its power for now.",
          "Cave"
        ),
        choices: [
          ...(canUseSpring ? [{
            label: "Drink",
            action: () => {
              updateState(s => ({ ...s, hp: s.maxHp, springRestCooldown: 0, temporaryHitPenalty: 0 }));
              markVisited("Cave");
              caveContinuePrompt();
            }
          }] : []),
          { label: "Leave It", action: () => { markVisited("Cave"); caveContinuePrompt(); } }
        ]
      });
      setCurrentView('event');
      return;
    }
    if (cRoll === 5) {
      setEventData({
        title: "Cave Exit",
        description: withLore("You find an exit to the surface.", "Cave"),
        choices: [{
          label: "Exit",
          action: () => {
            markVisited("Cave");
            updateState(s => ({ ...s, inCave: false, currentLocation: "Mountain Pass" }));
            resolveMountainPass(gameState!);
          }
        }]
      });
      setCurrentView('event');
      return;
    }
    if (cRoll === 6) {
      if (gameState?.caveHiddenPassageSeen) {
        const passageRoll = rollD6();
        if (passageRoll <= 3) {
          startCombat({ isHardy: true, locationType: "Cave", postCombatReward: ['cave-continue'] });
          return;
        }
        if (passageRoll <= 5) {
          setEventData({
            title: "Cave Exit",
            description: withLore("You find the exit to the surface.", "Cave"),
            choices: [{
              label: "Exit",
              action: () => {
                markVisited("Cave");
                updateState(s => ({ ...s, inCave: false, currentLocation: "Mountain Pass" }));
                resolveMountainPass(gameState!);
              }
            }]
          });
          setCurrentView('event');
          return;
        }
        setEventData({
          title: "Hidden Passage",
          description: withLore("A path leads to Peak Black.", "Cave"),
          choices: [{
            label: "Follow It",
            action: () => {
              markVisited("Cave");
              updateState(s => ({ ...s, inCave: false, currentLocation: "Peak Black" }));
              resolvePeakBlack();
            }
          }]
        });
        setCurrentView('event');
        return;
      }
      updateState(s => ({ ...s, caveHiddenPassageSeen: true }));
      startCombat({
        isHardy: true,
        locationType: "Cave",
        postCombatReward: ['enter-manor'],
      });
      return;
    }
  };

  const caveContinuePrompt = () => {
    setEventData({
      title: "Cave",
      description: withLore("Do you go deeper or try to leave the cave?", "Cave"),
      choices: [
        { label: "Go Deeper", action: () => resolveCaveEncounter() },
        { label: "Exit Cave", action: () => exitCave() }
      ]
    });
    setCurrentView('event');
  };

  const exitCave = () => {
    if (rollD4() === 1) {
      startCombat({ isHardy: true, locationType: "Cave" });
      return;
    }
    updateState(s => ({ ...s, inCave: false }));
    setCurrentView('game');
  };

  const resolvePeakBlack = () => {
    const requiredTypes = [
      "A Cliff",
      "Crags",
      "A Burrow",
      "Deep Woods",
      "A Meadow",
      "Mountain Pass",
      "Bacówka (Shepherd's Hut)",
      "Mountain Village",
      "Milord's Manor",
    ];
    const hasVisitedAll = requiredTypes.every(type => gameState?.visitedTypes.has(type));
    if (hasVisitedAll) {
      setEventData({
        title: "Spirit of the Mountains",
        description: withLore(
          "The Spirit bestows the title of Harnaś upon you, along with its treasure and two other Advancements.",
          "Peak Black"
        ),
        choices: [{
          label: "Accept Greatness",
          action: () => {
            updateState(s => {
              if (!s.advancements.includes(1)) {
                s.advancements.push(1);
              }
              const treasureGold = rollD6() * rollD6();
              s.dutki += treasureGold;
              s.inventory.scrolls.push(createRandomScroll(), createRandomScroll(), createRandomScroll());
              return s;
            });
            markVisited("Peak Black");
            startAdvancementSequence(2, () => setCurrentView('game'));
          }
        }]
      });
      setCurrentView('event');
    } else {
      startCombat({
        isHardy: true,
        enemy: SPIRIT,
        locationType: "Peak Black",
        allowInvisibility: false,
      });
    }
  };

  const triggerAdvancement = () => {
    startAdvancementSequence(1);
  };

  const buyDucat = () => {
    if (gameState && gameState.dutki >= 40) {
        updateState(s => ({ ...s, dutki: s.dutki - 40, temporaryHitPenalty: 0 }));
        triggerAdvancement();
    }
  };

  // --- Render ---
  if (currentView === 'start') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-stone-950">
        <div className="max-w-md w-full woodcut-border p-8 bg-stone-900 text-center">
            <h1 className="text-6xl font-game mb-4 tracking-tighter">CORNY GROŃ</h1>
            <p className="mb-8 italic text-stone-400">A solo adventure in the dark peaks.</p>
            <div className="space-y-4">
                <button 
                  disabled={isRolling}
                  onClick={() => queueAction(() => startGame("Jasiek"))}
                  className="w-full py-3 bg-stone-100 text-stone-950 font-game text-2xl hover:bg-stone-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  PLAY AS JASIEK
                </button>
                <button 
                  disabled={isRolling}
                  onClick={() => queueAction(() => startGame("Jagna"))}
                  className="w-full py-3 bg-stone-800 text-stone-100 border border-stone-100 font-game text-2xl hover:bg-stone-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  PLAY AS JAGNA
                </button>
            </div>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-stone-950">
      {/* Sidebar: Stats */}
      <div className="w-full lg:w-80 p-6 bg-stone-900 border-b lg:border-r border-stone-800 flex flex-col gap-6">
        <div className="border-b border-stone-800 pb-4">
            <h2 className="text-3xl font-game">{gameState.playerName}</h2>
            <div className="flex justify-between mt-2">
                <span>HP</span>
                <span className={gameState.hp < 5 ? 'text-red-500 font-bold' : ''}>
                    {gameState.hp} / {gameState.maxHp}
                </span>
            </div>
            <div className="w-full bg-stone-800 h-2 mt-1">
                <div 
                  className="bg-stone-100 h-full transition-all" 
                  style={{ width: `${(gameState.hp / gameState.maxHp) * 100}%` }}
                />
            </div>
        </div>

        <div className="space-y-2">
            <div className="flex justify-between"><span>Dutki (Coins)</span><span>{gameState.dutki}</span></div>
            <div className="flex justify-between"><span>Points</span><span>{gameState.points} / 15</span></div>
            <div className="flex justify-between"><span>Places</span><span>{gameState.visitedPlacesCount} / 12</span></div>
        </div>

        <div>
            <h3 className="text-xl font-game mb-2 text-stone-400">Inventory</h3>
            <div className="text-sm space-y-1">
                <p><strong>Weapon:</strong> {gameState.inventory.weapon.name}</p>
                <p><strong>Potions:</strong> {gameState.inventory.potions}</p>
                {gameState.inventory.hasKaftan && <p>• Leather Kaftan</p>}
                {gameState.inventory.hasRope && <p>• Rope</p>}
                {gameState.inventory.hasInvisibilityCap > 0 && <p>• Invisibility Cap ({gameState.inventory.hasInvisibilityCap})</p>}
                {gameState.inventory.scrolls.map((s, i) => (
                    <p key={i} className="text-stone-300">• {s.type} ({s.uses})</p>
                ))}
                {currentView !== 'combat' && gameState.inventory.potions > 0 && (
                  <button
                    disabled={isRolling}
                    onClick={() => queueAction(() => {
                      const heal = rollD6();
                      updateState(s => ({
                        ...s,
                        hp: Math.min(s.hp + heal, s.maxHp),
                        inventory: { ...s.inventory, potions: s.inventory.potions - 1 }
                      }));
                      addLog(`You drank a potion and healed ${heal} HP.`);
                    })}
                    className="mt-2 w-full py-2 border border-stone-500 text-stone-100 font-game text-sm hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    DRINK POTION (OUTSIDE FIGHT)
                  </button>
                )}
            </div>
        </div>

        <div>
            <h3 className="text-xl font-game mb-2 text-stone-400">Map</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
                {MAP_LOCATIONS.map((loc) => {
                  const status = getLocationStatus(loc);
                  const isCurrent = status === 'current';
                  const baseClass = "p-2 border text-center map-tile";
                  const statusClass = status === 'visited'
                    ? "border-stone-500 bg-stone-800 text-stone-100"
                    : status === 'escaped'
                    ? "border-yellow-700 bg-stone-900 text-yellow-400"
                    : status === 'current'
                    ? "border-stone-100 bg-stone-100 text-stone-950"
                    : "border-stone-800 text-stone-600";
                  return (
                    <div key={loc} className={`${baseClass} ${statusClass} ${isCurrent ? 'ring-2 ring-stone-300' : ''}`}>
                      {loc}
                    </div>
                  );
                })}
            </div>
        </div>

        <div>
            <h3 className="text-xl font-game mb-2 text-stone-400">Dice Tray</h3>
            <div className="border border-stone-800 bg-stone-900 p-3 text-sm space-y-1">
                {isRolling && (
                  <div className="text-xs uppercase tracking-widest text-stone-500 animate-pulse">Rolling...</div>
                )}
                {diceLog.length === 0 ? (
                  <div className="text-stone-500 italic">No rolls yet.</div>
                ) : (
                  diceLog.map(entry => (
                    <>
                      {entry.results.map((result, idx) => (
                        <div key={`${entry.id}-${idx}`} className="flex justify-between">
                          <span className="text-stone-400">d{entry.sides[idx]}</span>
                          <span className="font-bold text-stone-100">{result}</span>
                        </div>
                      ))}
                      {entry.sides.length === 2 && (
                        <div className="flex justify-between border-t border-stone-800 pt-1 mt-1">
                          <span className="text-stone-500">Total</span>
                          <span className="font-bold text-stone-100">{entry.total}</span>
                        </div>
                      )}
                    </>
                  ))
                )}
            </div>
        </div>

        <button 
            disabled={isRolling || gameState.points < 15 || gameState.visitedPlacesCount < 12}
            onClick={() => queueAction(() => {
                updateState(s => ({ ...s, points: 0, visitedPlacesCount: 0, temporaryHitPenalty: 0 }));
                triggerAdvancement();
            })}
            className="mt-auto py-2 bg-stone-100 text-stone-950 font-bold disabled:opacity-30 disabled:cursor-not-allowed"
        >
            ADVANCE (15 pts / 12 sites)
        </button>
        <button 
            disabled={isRolling || gameState.dutki < 40}
            onClick={() => queueAction(buyDucat)}
            className="py-2 border border-stone-100 text-stone-100 font-bold disabled:opacity-30"
        >
            BUY DUCAT (40 dutki)
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 lg:p-12 overflow-y-auto">
        {currentView === 'game' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center woodcut-border p-12 bg-stone-900">
                <p className="text-stone-500 mb-2 uppercase tracking-widest text-xs">Current Location</p>
                <h2 className="text-5xl font-game mb-4">{gameState.currentLocation}</h2>
                <button 
                    disabled={isRolling}
                    onClick={() => queueAction(travel)}
                    className="px-8 py-4 bg-stone-100 text-stone-950 font-game text-3xl hover:bg-white transition shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    FOLLOW THE PATH
                </button>
                {!gameState.inCave && gameState.inventory.scrolls.some(s => s.type === ScrollType.DIVINATION_SIGIL) && (
                  <button
                    disabled={isRolling}
                    onClick={() => queueAction(useDivinationSigil)}
                    className="mt-4 px-6 py-2 border border-stone-500 text-stone-100 font-game text-xl hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    USE DIVINATION SIGIL
                  </button>
                )}
            </div>
            
            <div className="bg-stone-900 p-6 rounded border border-stone-800">
                <h3 className="font-game text-2xl mb-4 border-b border-stone-800">Travel Log</h3>
                <div className="h-48 overflow-y-auto space-y-2 text-stone-400 text-sm">
                    {gameLog.map((log, i) => (
                        <p key={i} className={i === 0 ? 'text-stone-100 font-bold' : ''}>{log}</p>
                    ))}
                </div>
            </div>
          </div>
        )}

        {currentView === 'combat' && combatState && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-stone-900 woodcut-border p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-900">
                    <div 
                      className="bg-red-500 h-full transition-all duration-500" 
                      style={{ width: `${(combatState.enemy.currentHp / combatState.enemy.hp) * 100}%` }}
                    />
                </div>
                <h2 className="text-4xl font-game text-red-500 mb-2">{combatState.enemy.name}</h2>
                {combatState.enemyLore && (
                  <p className="text-sm text-stone-500 italic mb-2">{combatState.enemyLore}</p>
                )}
                <p className="text-stone-500 mb-6">Enemy HP: {combatState.enemy.currentHp} / {combatState.enemy.hp}</p>
                <p className="italic text-xl min-h-[3rem] text-stone-200">{combatState.message}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button 
                    disabled={isRolling}
                    onClick={() => queueAction(() => resolveCombatTurn('hit'))}
                    className="py-4 bg-stone-100 text-stone-950 font-game text-2xl hover:invert transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    ATTACK
                </button>
                <button 
                    disabled={isRolling || gameState.inventory.potions === 0}
                    onClick={() => queueAction(() => resolveCombatTurn('potion'))}
                    className="py-4 border border-stone-500 text-stone-100 font-game text-2xl hover:bg-stone-800 disabled:opacity-20 disabled:cursor-not-allowed"
                >
                    DRINK POTION
                </button>
                {combatState.allowInvisibility && gameState.inventory.hasInvisibilityCap > 0 && (
                  <button 
                      disabled={isRolling}
                      onClick={() => queueAction(avoidCombatWithCap)}
                      className="py-4 border border-stone-500 text-stone-100 font-game text-2xl hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                      USE INVISIBILITY CAP
                  </button>
                )}
                <button 
                    disabled={isRolling}
                    onClick={() => queueAction(() => resolveCombatTurn('run'))}
                    className="py-4 border border-red-900 text-red-500 font-game text-2xl hover:bg-red-950 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {combatState.fleeDamageDie === 0 ? "FLEE (NO DAMAGE)" : `FLEE (-d${combatState.fleeDamageDie} HP)`}
                </button>
            </div>
            {gameState.inventory.scrolls.length > 0 && (
              <div className="grid grid-cols-1 gap-2">
                {gameState.inventory.scrolls.map((s, i) => {
                  const disabled = s.type === ScrollType.DIVINATION_SIGIL || (s.type === ScrollType.BIES_SUMMONING && combatState.currentBiesTurns > 0);
                  return (
                    <button
                      key={`${s.type}-${i}`}
                      disabled={isRolling || disabled}
                      onClick={() => queueAction(() => resolveCombatTurn('scroll', i))}
                      className="py-3 border border-stone-500 text-stone-100 font-game text-xl hover:bg-stone-800 disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      USE {s.type.toUpperCase()} ({s.uses})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {currentView === 'event' && eventData && (
          <div className="max-w-xl mx-auto mt-20 p-8 woodcut-border bg-stone-900 text-center animate-in fade-in zoom-in duration-300">
            <h2 className="text-4xl font-game mb-4">{eventData.title}</h2>
            <p className="text-stone-300 text-lg mb-8 leading-relaxed">{eventData.description}</p>
            <div className="space-y-4">
                {eventData.choices.map((choice, i) => (
                    <button 
                        key={i}
                        disabled={isRolling}
                        onClick={() => queueAction(choice.action)}
                        className="w-full py-3 bg-stone-100 text-stone-950 font-bold hover:bg-stone-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {choice.label.toUpperCase()}
                    </button>
                ))}
            </div>
          </div>
        )}

        {currentView === 'shop' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-4xl font-game text-center mb-8">{shopMode === 'merchant' ? "The Merchant" : "Mountain Village"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    { name: "Potion", price: 4, disabled: gameState.inventory.potions >= 10, action: () => updateState(s => ({ ...s, dutki: s.dutki - 4, inventory: { ...s.inventory, potions: Math.min(10, s.inventory.potions + 1) } })) },
                    { name: "Knife", price: 6, action: () => updateState(s => ({ ...s, dutki: s.dutki - 6, inventory: { ...s.inventory, weapon: WEAPONS[WeaponType.KNIFE] } })) },
                    { name: "Ciupaga", price: 9, action: () => updateState(s => ({ ...s, dutki: s.dutki - 9, inventory: { ...s.inventory, weapon: WEAPONS[WeaponType.CIUPAGA] } })) },
                    { name: "Rope", price: 5, disabled: gameState.inventory.hasRope, action: () => updateState(s => ({ ...s, dutki: s.dutki - 5, inventory: { ...s.inventory, hasRope: true } })) },
                    { name: "Sabre", price: 12, action: () => updateState(s => ({ ...s, dutki: s.dutki - 12, inventory: { ...s.inventory, weapon: WEAPONS[WeaponType.SABRE] } })) },
                    { name: "Samopał", price: 15, action: () => updateState(s => ({ ...s, dutki: s.dutki - 15, inventory: { ...s.inventory, weapon: WEAPONS[WeaponType.SAMOPAL] } })) },
                    { name: "Scattergun", price: 25, action: () => updateState(s => ({ ...s, dutki: s.dutki - 25, inventory: { ...s.inventory, weapon: WEAPONS[WeaponType.SCATTERGUN] } })) },
                    { name: "Kaftan", price: 10, disabled: gameState.inventory.hasKaftan, action: () => updateState(s => ({ ...s, dutki: s.dutki - 10, inventory: { ...s.inventory, hasKaftan: true } })) },
                    ...(shopMode === 'merchant' ? [{ name: "Scroll", price: 7, action: () => { updateState(s => ({ ...s, dutki: s.dutki - 7 })); findRandomScroll(); } }] : []),
                ].map((item, i) => (
                    <button 
                        key={i}
                        disabled={isRolling || gameState.dutki < item.price || item.disabled}
                        onClick={() => queueAction(item.action)}
                        className="p-4 bg-stone-900 border border-stone-800 hover:border-stone-500 disabled:opacity-30 transition flex justify-between disabled:cursor-not-allowed"
                    >
                        <span>{item.name}</span>
                        <span className="text-stone-500">{item.price} dutki</span>
                    </button>
                ))}
            </div>
            <div className="pt-4 border-t border-stone-800">
                <h3 className="font-game text-2xl mb-4">Sell</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      ...(gameState.inventory.potions > 0 ? [{ name: "Potion", price: 4, action: () => updateState(s => ({ ...s, dutki: s.dutki + 4, inventory: { ...s.inventory, potions: s.inventory.potions - 1 } })) }] : []),
                      ...(gameState.inventory.weapon.name !== WeaponType.BARE_HANDS ? [{ name: `Weapon (${gameState.inventory.weapon.name})`, price: gameState.inventory.weapon.price, action: () => updateState(s => ({ ...s, dutki: s.dutki + s.inventory.weapon.price, inventory: { ...s.inventory, weapon: WEAPONS[WeaponType.BARE_HANDS] } })) }] : []),
                      ...(gameState.inventory.hasRope ? [{ name: "Rope", price: 5, action: () => updateState(s => ({ ...s, dutki: s.dutki + 5, inventory: { ...s.inventory, hasRope: false } })) }] : []),
                      ...(gameState.inventory.hasKaftan ? [{ name: "Kaftan", price: 10, action: () => updateState(s => ({ ...s, dutki: s.dutki + 10, inventory: { ...s.inventory, hasKaftan: false } })) }] : []),
                      ...(gameState.inventory.hasInvisibilityCap > 0 ? [{ name: "Invisibility Cap", price: 15, action: () => updateState(s => ({ ...s, dutki: s.dutki + 15, inventory: { ...s.inventory, hasInvisibilityCap: 0 } })) }] : []),
                      ...(gameState.inventory.scrolls.map((scroll, index) => ({
                        name: `Scroll (${scroll.type})`,
                        price: 7,
                        action: () => updateState(s => {
                          s.dutki += 7;
                          s.inventory.scrolls.splice(index, 1);
                          return s;
                        })
                      }))),
                    ].map((item, i) => (
                        <button 
                            key={`sell-${i}`}
                            disabled={isRolling}
                            onClick={() => queueAction(item.action)}
                            className="p-4 bg-stone-900 border border-stone-800 hover:border-stone-500 transition flex justify-between disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <span>{item.name}</span>
                            <span className="text-stone-500">{item.price} dutki</span>
                        </button>
                    ))}
                </div>
            </div>
            <button 
                disabled={isRolling}
                onClick={() => queueAction(() => {
                  if (afterShopAction) {
                    const action = afterShopAction;
                    setAfterShopAction(null);
                    action();
                  } else {
                    setCurrentView('game');
                  }
                })}
                className="w-full py-4 bg-stone-100 text-stone-950 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
                LEAVE SHOP
            </button>
          </div>
        )}

        {currentView === 'dead' && (
          <div className="max-w-md mx-auto text-center space-y-8 mt-20">
            <h1 className="text-7xl font-game text-red-900">DIED</h1>
            <p className="text-stone-500 italic">The mountains claimed another soul.</p>
            <button 
                onClick={() => window.location.reload()}
                className="px-8 py-3 border border-stone-100 hover:bg-stone-100 hover:text-stone-950 transition"
            >
                TRY AGAIN
            </button>
          </div>
        )}

        {currentView === 'win' && (
          <div className="max-w-md mx-auto text-center space-y-8 mt-20">
            <h1 className="text-7xl font-game text-stone-100">VICTORY</h1>
            <p className="text-stone-300 text-xl">You are the Harnaś! The King of the Outlaws.</p>
            <div className="p-8 woodcut-border bg-stone-900">
                <p>Your legend will be sung in the valleys for generations.</p>
            </div>
            <button 
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-stone-100 text-stone-950 font-bold transition"
            >
                PLAY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

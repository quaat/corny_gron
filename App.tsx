
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, WeaponType, ScrollType, Weapon, Scroll } from './types';
import { WEAPONS, ADVANCEMENTS, SCROLL_DESCRIPTIONS } from './constants';

// --- Utility Functions ---
const roll = (sides: number) => Math.floor(Math.random() * sides) + 1;
const rollD6 = () => roll(6);
const rollD4 = () => roll(4);

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<'start' | 'game' | 'combat' | 'event' | 'shop' | 'dead' | 'win'>('start');
  const [combatState, setCombatState] = useState<{
    enemy: any;
    isHardy: boolean;
    turn: number;
    protectionActive: number; // turns left for ward
    currentBiesTurns: number;
    message: string;
  } | null>(null);
  const [eventData, setEventData] = useState<{
    title: string;
    description: string;
    choices: { label: string; action: () => void }[];
  } | null>(null);

  // --- Helpers ---
  const addLog = (msg: string) => {
    setGameLog(prev => [msg, ...prev].slice(0, 50));
  };

  const updateState = (updater: (prev: GameState) => GameState) => {
    setGameState(prev => {
      if (!prev) return prev;
      const newState = updater(prev);
      if (newState.hp <= 0 && !newState.isDead) {
        newState.isDead = true;
        setCurrentView('dead');
      }
      return newState;
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
      visitedTypes: new Set(['Mountain Pass']),
      inventory: initialInventory,
      advancements: [],
      activeBiesTurns: 0,
      permanentHitBonus: 0,
      halfDamageEnemies: [],
      currentLocation: 'Mountain Pass',
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
      desc = "You find an object buried by a highwayman.";
      effect = () => findRandomObject();
    } else if (pRoll === 2) {
      title += "Vermin Ridge";
      desc = "A Scanty Enemy lurks here.";
      effect = () => startCombat(false);
    } else if (pRoll === 3) {
      title += "Bottom of a Cliff";
      desc = "You find a scroll on the body of a dead juhas.";
      effect = () => findRandomScroll();
    } else {
      title += "Misty Valley";
      desc = "Creepily empty and quiet...";
      effect = () => { addLog("The valley is eerily silent."); setCurrentView('game'); };
    }

    setEventData({
      title,
      description: desc,
      choices: [{ label: "Continue", action: effect }]
    });
    setCurrentView('event');
  };

  // --- Combat Logic ---
  const startCombat = (isHardy: boolean, customEnemy?: any) => {
    const scantyEnemies = [
      { name: "Hajduk", points: 3, dmg: 4, hp: 6, after: "2-on-6 knife" },
      { name: "Bies", points: 3, dmg: 4, hp: 6, after: "2-on-6 scroll" },
      { name: "Poacher", points: 3, dmg: 4, hp: 5, after: "2-on-6 rope" },
      { name: "Wolf", points: 4, dmg: 5, hp: 6, after: "1-on-6 lose item" },
    ];
    const hardyEnemies = [
      { name: "Undine", points: 4, dmg: 4, hp: 8, after: "Gold & Curse?" },
      { name: "Bear", points: 7, dmg: 7, hp: 10, after: "2-on-6 lose item" },
      { name: "Highwayman", points: 4, dmg: 7, hp: 10, after: "Dutki & Bullet" },
      { name: "Spook", points: 5, dmg: 6, hp: 12, after: "2-on-6 Advance" },
    ];

    const enemyBase = customEnemy || (isHardy ? hardyEnemies[rollD4() - 1] : scantyEnemies[rollD4() - 1]);
    
    setCombatState({
      enemy: { ...enemyBase, currentHp: enemyBase.hp },
      isHardy,
      turn: 1,
      protectionActive: 0,
      currentBiesTurns: gameState?.activeBiesTurns || 0,
      message: `A ${enemyBase.name} blocks your path!`
    });
    setCurrentView('combat');
  };

  const resolveCombatTurn = (action: 'hit' | 'potion' | 'scroll' | 'run') => {
    if (!combatState || !gameState) return;

    let msg = "";
    let enemyDmgTaken = 0;
    let playerDmgTaken = 0;
    let biesDmg = 0;
    let newCombat = { ...combatState };
    let newState = { ...gameState };

    if (action === 'run') {
      const runDmg = rollD4();
      newState.hp -= runDmg;
      addLog(`You fled, taking ${runDmg} damage.`);
      setGameState(newState);
      setCurrentView('game');
      return;
    }

    // Player Turn
    if (action === 'hit') {
      const hitRoll = rollD6();
      const totalHit = hitRoll + newState.inventory.weapon.hitBonus + newState.permanentHitBonus;
      if (totalHit >= combatState.enemy.points) {
        enemyDmgTaken = roll(newState.inventory.weapon.damageDie) + newState.inventory.weapon.bonusDamage;
        msg = `You hit for ${enemyDmgTaken}! `;
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
      addLog(`Defeated ${newCombat.enemy.name}! Gained ${newCombat.enemy.points} points.`);
      newState.points += newCombat.enemy.points;
      newState.activeBiesTurns = newCombat.currentBiesTurns;
      
      // Resolve After Effects
      resolveAfterFight(newCombat.enemy, newState);
      return;
    }

    // Enemy Turn
    let baseEnemyDmg = roll(newCombat.enemy.dmg);
    
    // Special Undine logic
    if (newCombat.enemy.name === "Undine" && newCombat.turn % 2 === 0) {
      baseEnemyDmg = rollD6();
      msg += "Undine ensnares you! ";
    }

    playerDmgTaken = baseEnemyDmg;
    if (newState.inventory.hasKaftan) {
      playerDmgTaken = Math.max(0, playerDmgTaken - rollD4());
    }
    
    newState.hp -= playerDmgTaken;
    msg += `Enemy deals ${playerDmgTaken} damage.`;

    newCombat.turn++;
    newCombat.message = msg;
    setCombatState(newCombat);
    setGameState(newState);
  };

  const resolveAfterFight = (enemy: any, state: GameState) => {
    let msg = `You defeated the ${enemy.name}. `;
    
    // Check for "2-on-6" type chances
    if (enemy.name === "Hajduk" && rollD6() <= 2) {
      msg += "You found a Knife! ";
      state.inventory.weapon = WEAPONS[WeaponType.KNIFE];
    }
    if (enemy.name === "Bies" && rollD6() <= 2) {
      msg += "Found a Bies scroll! ";
      state.inventory.scrolls.push({ type: ScrollType.BIES_SUMMONING, uses: rollD4(), description: SCROLL_DESCRIPTIONS[ScrollType.BIES_SUMMONING] });
    }
    if (enemy.name === "Poacher" && rollD6() <= 2) {
      msg += "Found a Rope! ";
      state.inventory.hasRope = true;
    }
    if (enemy.name === "Wolf" && rollD6() === 1) {
      msg += "The wolf stole an item! ";
      // Simplify: lose a potion if any
      if (state.inventory.potions > 0) state.inventory.potions--;
    }
    if (enemy.name === "Undine") {
      const gold = rollD6() + rollD6() + rollD6();
      state.dutki += gold;
      msg += `Found ${gold} dutki in golden sand. `;
      if (rollD6() === 1) {
        state.points = 0;
        msg += "A curse took all your points!";
      }
    }
    if (enemy.name === "Bear" && rollD6() <= 2) {
      msg += "The bear broke something! (Lost a potion)";
      if (state.inventory.potions > 0) state.inventory.potions--;
    }
    if (enemy.name === "Highwayman") {
      const gold = rollD4() + rollD6();
      state.dutki += gold;
      msg += `Looted ${gold} dutki. `;
      if (rollD6() === 1) {
        state.permanentHitBonus -= 1;
        msg += "A bullet got stuck in your side! (-1 to hit rolls)";
      }
    }
    if (enemy.name === "Spook" && rollD6() <= 2) {
      msg += "Spiritual awakening! Immediate Advancement!";
      // This will be handled in the event cleanup
    }

    setGameState(state);
    setEventData({
      title: "Victory",
      description: msg,
      choices: [{ label: "Move On", action: () => {
        if (enemy.name === "Spook" && msg.includes("Advancement")) {
          triggerAdvancement();
        } else {
          setCurrentView('game');
        }
      }}]
    });
    setCurrentView('event');
  };

  // --- Exploration ---
  const travel = () => {
    if (!gameState) return;
    const locationRoll = rollD6() + rollD6();
    resolveLocation(locationRoll);
  };

  const resolveLocation = (id: number) => {
    let loc = "";
    let desc = "";
    let effect = () => {};

    switch(id) {
      case 2:
        loc = "Milord's Manor";
        desc = "A decadent, dark house on the ridge.";
        effect = () => enterManor();
        break;
      case 3:
        loc = "A Cliff";
        desc = "Steep and dangerous.";
        effect = () => resolveDangerousTerrain("Cliff", 3);
        break;
      case 4:
        loc = "Crags";
        desc = "Jagged rocks everywhere.";
        effect = () => resolveDangerousTerrain("Crags", 2);
        break;
      case 5:
        loc = "A Burrow";
        desc = "A hole leads deep into a cave.";
        effect = () => setCurrentView('game'); // Simplify: cave entrance
        break;
      case 6:
      case 7:
        loc = "Deep Woods";
        desc = "Shadows move between the trees.";
        effect = () => startEncounter();
        break;
      case 8:
      case 9:
        loc = "A Meadow";
        desc = "A peaceful-looking clearing.";
        effect = () => startEncounter();
        break;
      case 10:
        loc = "Mountain Pass";
        desc = "A narrow crossing.";
        effect = () => resolveMountainPass(gameState!);
        break;
      case 11:
        loc = "Bacówka (Shepherd's Hut)";
        desc = "A place to rest.";
        effect = () => {
          updateState(s => ({ ...s, hp: Math.min(s.hp + rollD6() + 2, s.maxHp) }));
          addLog("You rested at the hut.");
          setCurrentView('game');
        };
        break;
      case 12:
        loc = "Mountain Village";
        desc = "Life among the peaks.";
        effect = () => setCurrentView('shop');
        break;
      default:
        loc = "Peak Black";
        desc = "The final destination.";
        effect = () => resolvePeakBlack();
    }

    updateState(s => {
      const next = { ...s, currentLocation: loc, visitedPlacesCount: s.visitedPlacesCount + 1 };
      next.visitedTypes.add(loc);
      return next;
    });

    setEventData({
      title: loc,
      description: desc,
      choices: [{ label: "Explore", action: effect }]
    });
    setCurrentView('event');
  };

  const resolveDangerousTerrain = (type: string, penalty: number) => {
    startEncounter(() => {
        if (rollD6() <= 3) {
            const ropeBonus = gameState?.inventory.hasRope ? 1 : 0;
            if (rollD6() + ropeBonus <= 3) {
                const dmg = rollD6() + 2;
                updateState(s => ({...s, hp: s.hp - dmg}));
                addLog(`You fell down the ${type}! Took ${dmg} damage.`);
            }
        }
        setCurrentView('game');
    });
  };

  const startEncounter = (onFinish?: () => void) => {
    const eRoll = rollD6();
    switch(eRoll) {
      case 1: 
        addLog("Nothing happens.");
        onFinish ? onFinish() : setCurrentView('game');
        break;
      case 2: // Snares
        if (rollD6() <= 3) {
            const dmg = rollD6();
            updateState(s => ({...s, hp: s.hp - dmg}));
            addLog(`Caught in snares! Took ${dmg} damage.`);
        }
        if (rollD6() === 1) startCombat(false);
        else onFinish ? onFinish() : setCurrentView('game');
        break;
      case 3: // Riddle
        setEventData({
          title: "A Traveller",
          description: "A hooded figure asks you a riddle. Solve it?",
          choices: [
            { label: "Answer (Roll d6)", action: () => {
              if (rollD6() % 2 !== 0) {
                updateState(s => ({ ...s, dutki: s.dutki + 6 }));
                addLog("Correct! Gained 6 dutki.");
              } else {
                const dmg = rollD4();
                updateState(s => ({ ...s, hp: s.hp - dmg }));
                addLog(`Wrong! Punishment: ${dmg} damage.`);
              }
              onFinish ? onFinish() : setCurrentView('game');
            }}
          ]
        });
        setCurrentView('event');
        break;
      case 4: startCombat(false); break;
      case 5: startCombat(true); break;
      case 6: setCurrentView('shop'); break;
    }
  };

  const findRandomObject = () => {
    const oRoll = rollD6();
    let item = "";
    updateState(s => {
      if (oRoll === 1) { s.inventory.weapon = WEAPONS[WeaponType.KNIFE]; item = "Knife"; }
      if (oRoll === 2) { s.inventory.potions++; item = "Herbal Potion"; }
      if (oRoll === 3) { s.inventory.hasRope = true; item = "Rope"; }
      if (oRoll === 4) { findRandomScroll(); item = "a Scroll"; return s; }
      if (oRoll === 5) { s.inventory.hasKaftan = true; item = "Leather Kaftan"; }
      if (oRoll === 6) { s.inventory.hasInvisibilityCap = rollD4(); item = "Invisibility Cap"; }
      addLog(`Found: ${item}`);
      return s;
    });
    setCurrentView('game');
  };

  const findRandomScroll = () => {
    const sRoll = rollD4();
    const types = [ScrollType.BIES_SUMMONING, ScrollType.FIRE_GLYPH, ScrollType.PROTECTION_WARD, ScrollType.DIVINATION_SIGIL];
    const type = types[sRoll - 1];
    updateState(s => {
      s.inventory.scrolls.push({ type, uses: sRoll === 4 ? 1 : rollD4(), description: SCROLL_DESCRIPTIONS[type] });
      return s;
    });
    addLog(`Found a ${type} scroll.`);
    setCurrentView('game');
  };

  const enterManor = () => {
    addLog("You enter the Milord's Manor.");
    // Simplify manor: straight to Milord or Hallway
    if (rollD6() <= 3) {
        startCombat(true, { name: "The Milord", points: 5, dmg: 8, hp: 14, after: "Karabela & Advance" });
    } else {
        startCombat(false, { name: "Milord's Hajduk", points: 3, dmg: 6, hp: 6, after: "2-on-6 Sabre" });
    }
  };

  const resolvePeakBlack = () => {
    const hasVisitedAll = gameState?.visitedTypes.size || 0 >= 9;
    if (hasVisitedAll) {
        setEventData({
            title: "Spirit of the Mountains",
            description: "The Spirit bestows the title of Harnaś upon you!",
            choices: [{ label: "Accept Greatness", action: () => {
                updateState(s => ({ ...s, hasWon: true }));
                setCurrentView('win');
            }}]
        });
    } else {
        startCombat(true, { name: "Spirit of the Mountains", points: 6, dmg: 8, hp: 20, after: "Victory" });
    }
  };

  const triggerAdvancement = () => {
    const aRoll = rollD6();
    let desc = ADVANCEMENTS[aRoll-1];
    updateState(s => {
        if (aRoll === 1) s.advancements.push(1);
        if (aRoll === 2) s.permanentHitBonus += 1;
        if (aRoll === 3) { s.maxHp = 20; s.hp = 20; }
        if (aRoll === 4) s.points += 5;
        if (aRoll === 5) s.inventory.weapon = WEAPONS[WeaponType.SCATTERGUN];
        if (aRoll === 6) s.halfDamageEnemies.push("scanty");
        return s;
    });
    setEventData({
        title: "Advancement!",
        description: `You have grown stronger: ${desc}`,
        choices: [{ label: "Continue", action: () => setCurrentView('game') }]
    });
    setCurrentView('event');
  };

  const buyDucat = () => {
    if (gameState && gameState.dutki >= 40) {
        updateState(s => ({ ...s, dutki: s.dutki - 40 }));
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
                  onClick={() => startGame("Jasiek")}
                  className="w-full py-3 bg-stone-100 text-stone-950 font-game text-2xl hover:bg-stone-300 transition"
                >
                  PLAY AS JASIEK
                </button>
                <button 
                  onClick={() => startGame("Jagna")}
                  className="w-full py-3 bg-stone-800 text-stone-100 border border-stone-100 font-game text-2xl hover:bg-stone-700 transition"
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
            </div>
        </div>

        <button 
            disabled={gameState.points < 15 || gameState.visitedPlacesCount < 12}
            onClick={() => {
                updateState(s => ({ ...s, points: 0, visitedPlacesCount: 0 }));
                triggerAdvancement();
            }}
            className="mt-auto py-2 bg-stone-100 text-stone-950 font-bold disabled:opacity-30 disabled:cursor-not-allowed"
        >
            ADVANCE (15 pts / 12 sites)
        </button>
        <button 
            disabled={gameState.dutki < 40}
            onClick={buyDucat}
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
                    onClick={travel}
                    className="px-8 py-4 bg-stone-100 text-stone-950 font-game text-3xl hover:bg-white transition shadow-xl"
                >
                    FOLLOW THE PATH
                </button>
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
                <p className="text-stone-500 mb-6">Enemy HP: {combatState.enemy.currentHp} / {combatState.enemy.hp}</p>
                <p className="italic text-xl min-h-[3rem] text-stone-200">{combatState.message}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={() => resolveCombatTurn('hit')}
                    className="py-4 bg-stone-100 text-stone-950 font-game text-2xl hover:invert transition"
                >
                    ATTACK
                </button>
                <button 
                    disabled={gameState.inventory.potions === 0}
                    onClick={() => resolveCombatTurn('potion')}
                    className="py-4 border border-stone-500 text-stone-100 font-game text-2xl hover:bg-stone-800 disabled:opacity-20"
                >
                    DRINK POTION
                </button>
                <button 
                    onClick={() => resolveCombatTurn('run')}
                    className="py-4 border border-red-900 text-red-500 font-game text-2xl hover:bg-red-950"
                >
                    FLEE (-d4 HP)
                </button>
            </div>
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
                        onClick={choice.action}
                        className="w-full py-3 bg-stone-100 text-stone-950 font-bold hover:bg-stone-300 transition"
                    >
                        {choice.label.toUpperCase()}
                    </button>
                ))}
            </div>
          </div>
        )}

        {currentView === 'shop' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-4xl font-game text-center mb-8">The Merchant</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    { name: "Potion", price: 4, action: () => updateState(s => ({ ...s, dutki: s.dutki - 4, inventory: { ...s.inventory, potions: s.inventory.potions + 1 } })) },
                    { name: "Rope", price: 5, action: () => updateState(s => ({ ...s, dutki: s.dutki - 5, inventory: { ...s.inventory, hasRope: true } })) },
                    { name: "Sabre", price: 12, action: () => updateState(s => ({ ...s, dutki: s.dutki - 12, inventory: { ...s.inventory, weapon: WEAPONS[WeaponType.SABRE] } })) },
                    { name: "Samopał", price: 15, action: () => updateState(s => ({ ...s, dutki: s.dutki - 15, inventory: { ...s.inventory, weapon: WEAPONS[WeaponType.SAMOPAL] } })) },
                    { name: "Kaftan", price: 10, action: () => updateState(s => ({ ...s, dutki: s.dutki - 10, inventory: { ...s.inventory, hasKaftan: true } })) },
                    { name: "Scroll", price: 7, action: () => { updateState(s => ({ ...s, dutki: s.dutki - 7 })); findRandomScroll(); } },
                ].map((item, i) => (
                    <button 
                        key={i}
                        disabled={gameState.dutki < item.price}
                        onClick={item.action}
                        className="p-4 bg-stone-900 border border-stone-800 hover:border-stone-500 disabled:opacity-30 transition flex justify-between"
                    >
                        <span>{item.name}</span>
                        <span className="text-stone-500">{item.price} dutki</span>
                    </button>
                ))}
            </div>
            <button 
                onClick={() => setCurrentView('game')}
                className="w-full py-4 bg-stone-100 text-stone-950 font-bold"
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

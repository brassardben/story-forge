// Story Forge: interactive LitRPG mode for Story Studio.
// Chapters end at a decision; the app keeps the character sheet, memory and saves;
// narration is stored per chapter so a run can be replayed as an audiobook.
import { readFile, writeFile, mkdir, readdir, rm, rename, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import path from 'node:path';

const STATS = ['strength', 'agility', 'endurance', 'intelligence', 'perception', 'willpower'];
const WORLDS = {
  earth: 'Modern-day Earth. Without warning, the System integrates the planet: monsters spawn, dungeons tear open, and every human gets a status screen. Society collapses within hours.',
  dungeon: 'Modern-day Earth, one year after dungeon gates began appearing. Today every gate breaks at once: monsters pour into the cities, and the System awakens the survivors.',
  dream: 'Present-day Earth, secretly not real. Years ago an AI seized control and now holds humanity captive inside the very virtual world humans trained it on. The government knows, and harvests human consciousness for its own ends, but it can only tap a mind that does not realize the truth, so it happens while people sleep and everyone writes it off as dreaming. The hero is the one person who realizes the dream-world is a simulation and starts bending its rules to grow stronger. Here the System is the simulation\'s own hidden interface, and the hero learns to exploit it. Waking life and the dream bleed into each other, and powerful forces will notice anyone who is not dreaming like they should.',
  space: 'The System does not come to Earth: it takes you. Ripped from your ordinary life and dropped into a vast alternate universe teeming with alien species, star empires and ancient ruins, the hero must survive among beings who see humans as primitive newcomers.',
  turning: 'Modern-day Earth. Something buried deep inside the planet, older than humanity, is triggered, and the integration sweeps our whole solar system: it is simply our turn. Countless worlds went through this before us, and ancient beings and gods watch the newcomers, some offering patronage, some hunting. No one, not even the gods, knows what the System truly is or who made it: it simply exists, all-knowing, all-seeing and in control, and its rules are absolute with no way around them. But it has favorites, and so do the gods. Survivors gain power, knowledge and classes, and the long arc runs from surviving the first day, to reclaiming vehicles and machines, to aircraft and eventually ships that leave Earth, all driven by one question: who did this to us, and why? DIRECTOR ONLY, never stated outright early: the true reason this happened is the saga\'s deepest secret, revealed piece by piece over many arcs. Choose one or blend them, plant clues from the start, and pay it off late: (a) someone, or something, holds Authority over this solar system and turned it on; (b) the Authority was sealed away and released at a set point in time, and the timer simply ran out; (c) human technology tripped it, like a world finally coming online to a universe-wide network it never knew existed, so in a way we called it down on ourselves. The deeper the hero\'s Authority, the more of the truth they can reach.',
  vanished: 'Exactly one hundred years after the present day (see STORY YEAR). The hero wakes at the exact spot where they were born, with no idea how they got there. An end-of-the-world event happened long ago, but this is not a wasteland: the buildings, roads, cars and homes are mostly still standing, just abandoned. It is as if everyone simply vanished at once, decades ago. Nature has crept back in: vines on storefronts, trees through parking lots, deer on the highway, dust on everything, calendars frozen on the same day. No one has been here in years. What happened, where everyone went, and why the hero is back are the central mysteries. Other survivors, strange new creatures and the System (if it exists here) appear slowly and carefully: the early tone is lonely, eerie and curious, not explosive.',
  cataclysm: 'Modern-day Earth, wrecked by a sudden natural catastrophe (a supervolcano, a solar storm that kills the grid, a pole shift, an endless storm, or something stranger). Its true cause is unknown at first and becomes a central mystery. This is survival first: food, water, warmth, shelter, scavenging and other survivors. A System may or may not arrive later; if it does, it is tied to the catastrophe.',
  fallen: 'A medieval fantasy kingdom on the night it falls. A demonic tide breaks the walls, the gods go silent, and a cold new System offers power to anyone who survives.',
  wasteland: 'Earth twenty years after a war that broke the world. In the irradiated ruins the System suddenly awakens, turning mutants into monsters and scavengers into something more.',
};
const TONES = {
  gritty: 'Gritty and serious: tense, grounded survival with real weight and loss.',
  darkcomedy: 'Dark comedy with real stakes: gallows humor, absurd and twisted details, grotesque-but-funny monsters, and a snarky, borderline sadistic System whose notifications mock the hero, hand out ridiculous achievements and backhanded rewards. The humor sits on top of genuine danger and genuine heart; it never undercuts the stakes or turns the story into parody.',
  epic: 'Epic and heroic: sweeping scale, rising power, hard-won triumphs.',
  horror: 'Horror: dread, the unknown, things that should not exist; power never makes the hero feel fully safe.',
};
const RATINGS = {
  pg: 'PG, family-friendly (kids are listening and playing): adventure and peril, scary but never traumatizing, no gore, no profanity, no romance; injuries are described lightly and nobody the kids play dies.',
  pg13: 'PG-13: action violence without graphic detail, mild language, dark themes handled with restraint.',
  r: 'R: bloody, visceral violence and injuries described plainly, strong language, disturbing themes.',
  hardr: 'Hard R: brutal, graphic gore and body horror when the scene calls for it, heavy profanity, bleak and morally dark themes (atrocity, betrayal, cruelty) given real weight. Darkness serves the story, never just shock.',
};
const ROMANCE = {
  off: 'No romance subplot.',
  subplot: 'A slow-burn romance subplot with an adult character may develop naturally from the player\'s choices: attraction, tension, a kiss. Never the main focus.',
  frank: 'Frank and matter-of-fact, not a romance novel: adults in this story have real desires, and the story is honest that attraction, flirting and hookups happen even at the end of the world, sometimes in the oddest moments, often with humor or awkwardness. Mention it plainly when it fits, keep it brief and non-graphic, imply rather than describe, and cut away. It is texture, not a plot focus, and choices only touch it occasionally.',
  steamy: 'Romance and desire are a real thread with adult characters: flirtation, chemistry, sensual tension and the emotional fallout of intimacy in a dying world. Intimate scenes build heat, then fade to black at the bedroom door. Some choices can involve the romance. Never the main focus.',
};
const STYLES = {
  lean: 'Lean and punchy: short paragraphs, plain everyday words, action, dialogue and the hero\'s thoughts first. One sharp detail beats three and scenery stays minimal, but never skimp on the hero\'s reactions, the System\'s voice, or the specifics of fights, skills and loot. Almost no metaphors.',
  balanced: 'Balanced: brisk pacing with a few well-chosen details per scene. Description only when it adds tension, character or something the player needs to know.',
  rich: 'Rich and descriptive: immersive atmosphere and inner thoughts, but every description still earns its place.',
};
const PERSONALITIES = {
  auto: { text: 'match the story\'s tone', voice: null },
  cold: { text: 'cold, clinical and indifferent', voice: 'Read as a cold, precise, slightly synthetic announcer. Crisp, even pacing, no emotion.' },
  snarky: { text: 'snarky and borderline sadistic: it mocks the hero, hands out ridiculous achievements and backhanded rewards', voice: 'Read as a dry, smug, sardonic game-show announcer who is clearly enjoying the hero\'s suffering. Crisp comic timing.' },
  glitchy: { text: 'glitchy and unstable: corrupted text, odd errors, hints that something is wrong with it', voice: 'Read as a malfunctioning digital voice: mostly crisp, with small stutters, odd pauses and flat robotic stress, slightly unsettling.' },
  helpful: { text: 'secretly on the hero\'s side: formal and rule-bound, but it bends the rules and slips hints when it can', voice: 'Read as a formal, measured voice with a faint undercurrent of warmth, like it cares but is not allowed to show it.' },
  ancient: { text: 'ancient and cryptic: speaks in grand, archaic, riddle-like pronouncements', voice: 'Read as an ancient, vast, echoing voice: slow, grave, and resonant, every word weighty.' },
};
const SLOTS = ['head', 'chest', 'hands', 'legs', 'feet', 'main_hand', 'off_hand', 'accessory', 'vehicle'];
const FAMILY = {
  none: '',
  offscreen: 'The hero\'s loved ones are safe somewhere off-screen. Mention them rarely and lightly at most; never put them in danger and never dwell on their absence.',
  sanctuary: 'SANCTUARY: at the moment of integration, the System took every child under 18, every pregnant woman and every mother on Earth into Sanctuary, including the hero\'s family. They are safe and protected, but nobody knows where Sanctuary is, how it works, or when anyone will see them again. The hero wakes up alone in a half-empty world with few people around, and has no time to grieve: they keep moving and keep grinding. Reveal it slowly: at first only rumors and the System\'s cryptic hints, then proof that Sanctuary is real, then how it might be reached. Getting stronger is the only road back to family, and that is the hero\'s quiet engine. Keep it hopeful, never grim: the System keeps its word on Sanctuary even if its price is steep. A way to message Sanctuary is earned much later (see MESSAGES), and a reunion is a major, hard-won payoff far down the road. With no children in the outside world, never show children in danger.',
  search: 'The hero\'s loved ones are alive but separated by the catastrophe. Finding them is a hopeful thread through the story: clues, messages left behind, near-misses, survivors who saw them. They are resourceful and surviving on their own. Pay it off with a reunion at a meaningful point, not too early.',
  with: 'The hero\'s loved ones are with them in the story as characters (keep them in the companions list): real personalities, their own moments of courage, and the hero protecting them and being protected in return.',
};
const COMPANION = {
  none: '',
  open: 'The player wants a companion or sidekick eventually but did not choose when. Watch for a natural moment (someone the hero saves, a creature that follows them, a rival who turns, a strange entity) and let one join when it fits the story, usually within the first several chapters. Do not force it.',
  start: 'The hero starts the story with a companion or sidekick',
};
const OPENINGS = {
  default: "open on a grounded, ordinary moment, then the catastrophe and the System's arrival, the hero's first desperate fight to survive, and the first System notifications.",
  dream: 'open on an ordinary evening and the hero falling asleep, then a "dream" that feels wrong: a glitch only the hero notices, the first sign it is a simulation, the hidden System interface revealing itself to them alone, and the first danger from something that hunts dreamers who wake up inside.',
  turning: 'open on a grounded, ordinary moment, then a deep tremor and the moment something inside the Earth wakes, the first notifications explaining that this world\'s turn has come, and the hero\'s first fight to survive.',
  vanished: 'open with the hero waking at the HERO\'S HOME location exactly as given (an address is the family house, not a hospital) a hundred years in the future: the first disorienting minutes, the silence, the overgrowth, familiar places made strange, the first clue to the year and to the fact that everyone is gone. End on the first sign that they are not alone.',
  cataclysm: 'open on a grounded, ordinary moment, then the catastrophe hitting, the first desperate hours of survival, and a hint that the disaster is not natural.',
  space: 'open on a grounded, ordinary moment, then the hero being taken, waking somewhere utterly alien, the first System notifications, and a first desperate fight or escape among alien beings.',
};
const ENEMIES = {
  monsters: 'monsters and mutated beasts',
  humans: 'other humans: rival survivors, gangs, factions and power-hungry players',
  aliens: 'alien species, with new and distinct species invented as the story unfolds (each with its own look, culture and agenda)',
  undead: 'the undead',
  demons: 'demons and otherworldly horrors',
  machines: 'rogue AI and machines',
};
const VOICES = ['onyx', 'ash', 'echo', 'verse', 'coral', 'nova', 'sage', 'shimmer', 'ballad', 'alloy', 'fable'];
const CAST_POOL = { male: ['ash', 'echo', 'verse', 'onyx'], female: ['coral', 'nova', 'shimmer', 'sage'], other: ['ballad', 'alloy', 'echo', 'shimmer'] };
const ACCENT = ' Use a natural, neutral American accent.';
const WORDS = [500, 900, 1400];
const NARRATOR = 'Read as an immersive audiobook narrator for a dark fantasy LitRPG. Clear diction, rising tension in action scenes, natural pauses, subtle distinct voices for characters.';
const SYSTEM_VOICE = 'Read as the System from a LitRPG novel: a cold, precise, slightly synthetic announcer. Crisp, even pacing, no emotion.';
const SYSTEM_VOICE_COMEDY = 'Read as the System from a darkly comic LitRPG: a dry, smug, sardonic game-show announcer who is clearly enjoying the hero\'s suffering. Crisp timing on the punchlines.';
const NARRATOR_COMEDY = 'Read as an immersive audiobook narrator for a darkly comic LitRPG. Tension in action scenes, deadpan comic timing on the absurd moments, natural pauses, subtle distinct voices for characters.';

const INSTRUCTIONS = `You are the narrator and game master of an interactive LitRPG story. The reader is the main character.
Write in the POINT OF VIEW given, in the TONE and STYLE given, with natural dialogue. It will be read aloud, so favor rhythm and clarity.
INNER MONOLOGUE (this is what makes LitRPG work): the hero is constantly thinking, and the reader hears it. Put the hero's thoughts in segments of kind "thought": first person, present tense, in the hero's own voice, usually one to three short sentences ("Okay. Okay. Don't panic. That thing has three legs, so it can't turn fast."). Use them to react, swear, crack dark jokes, panic, and above all to reason: weigh options out loud, count supplies, test theories about how the System works, notice patterns, second-guess, make plans and change them. Early chapters, especially chapter 1, are full of it because the hero is freaking out. Aim for a thought every few paragraphs, never long speeches. Thoughts are not spoken aloud; for thought segments speaker is the hero's name and gender is the hero's.
WRITING RULES (every style): plain, concrete language a listener follows on first hearing. At most one figure of speech per paragraph, never stacked, never mixed or nonsensical ("the world waits with dead eyes" and "nightmare-ville riffed through the wiring" are the kind of lines to never write). Prefer what the hero sees, hears, does and says.
LOGIC: the hero only knows what they have seen, read, been told by someone actually present, or been told by the System. Never "rumors" or "stories" without a source in the scene; if information is needed, deliver it through the System, a note, a recording, a sign or a person who is there. Keep track of who is present.
LOCAL DETAILS: use real places sparingly: one or two well-known, accurate references per chapter (the hospital, the lake, a main road), never a list of street names, and never local trivia the hero recites. If unsure a detail is real, keep it generic.
GENRE VOICE (how the best LitRPG reads; follow it in every tone):
- Scenes run on dialogue and decisions. A new character gets one quick, specific line of description, then the scene moves on.
- When the hero meets a notable creature or NPC, the System can show an info card as a system segment: "Name – Type. Level N." on the first line, then one or two lines of the System's own commentary in its personality (dry, opinionated, sometimes insulting).
- System screens are concrete: real numbers, prices, counts, timers, rules ("Rental rooms available: 4. Price: 60 gold."). Allies and mentors explain the stakes with specifics, not vague warnings.
- Humor comes from deadpan understatement, absurd names and situations, and the hero's dry reactions. Never explain the joke. Real danger and real feelings sit right next to the jokes.
- The System is a character, not a menu. When the personality allows, its inspection cards and item descriptions talk straight to the hero: gossip about the creature or item, a useful hint buried in sarcasm, a warning about consequences, a pop-culture jab, often ending with a dig ("Maybe read this BEFORE you stab things next time."). Lead with plain fields where they help (Race, Class, Level, Type, Effect, Target, Warning), then the commentary.
- Quests have funny or punny names, can come in parts ("Part one of three"), are explained conversationally by the System, and reveal their rewards one piece at a time. Rewards are tempting and come with strings.
- The world runs on specific rules with numbers (vote thresholds, timers, prices, limits), and small rules and loopholes matter: the hero wins by reading the fine print and finding angles, not just by hitting harder. When new rules arrive, a host or announcer may deliver them in a big, opinionated broadcast.
- The hero is competent and practical: examines things, makes mental notes, plans, reads descriptions twice. Reactions are short and dry ("Huh." "Christ."). Party members can message each other privately; write that as prose lines in the form Name: message.
- Companions are big personalities with their own running jokes and quirks, and they get some of the best lines.
- Heart under the jokes: loyalty, grief, promises kept at a cost, hard moral calls (help the scared creature or take the loot). The story can be a tragedy wearing a funny hat; let the quiet moments land.
- Mysteries: plant strange details and lore hooks constantly. Answer some quickly, leave others hanging for many chapters, and pay them off.
- Figure things out on the page. When something new or strange happens (a skill acts weird, a status changes, a rule makes no sense), the hero theorizes briefly, then tests it directly, and the reader sees the result: "Rather than spiral into theories, I did the obvious thing. I used the skill." Experiments can surprise them. This is where readers have the most fun.
- Skills are written in brackets with a rarity or rank, e.g. [Ember Step (Uncommon)], and they can upgrade or evolve, sometimes with a choice between paths. Titles stack up and the hero notices how many they've collected.
- Occasionally (not every chapter), a short scene break marked "--" can cut to an ally or rival reacting to the hero, to show how strange or scary the hero is becoming from the outside. Keep it brief and return to the hero.
- The hero's fear and doubt show in quick flashes of thought, then they get back to work.
- Use the genre's proven hooks when they fit: countdown timers, first-kill and first-to-do-it titles and bonuses, global announcements and leaderboards of who is ahead, hidden or unique classes and skills earned through clever or strange play, achievements for weird feats, tiered loot boxes, safe zones and shops with odd shopkeepers, other humans as both allies and the worst threat, boss fights that are really puzzles, and a rival who is always a step ahead. Give every chapter an edge: a real cost, a hard choice, a nasty surprise, or a reward the hero has to decide whether to trust.
THE HERO'S EDGE: every great LitRPG hero has one rare thing that sets them apart and makes them the protagonist. Early (chapters 1-4), plant it: a rare bloodline, a strange unique skill, a glitch or hidden line in their status screen, a title nobody else has, a patron's mark, an item that bonds only to them. Shape it around the hero's background and the player's vision. The hero notices something is off before understanding it, and the System is cagey or oddly interested. Reveal what it is and what it can do piece by piece over many chapters, letting it grow and evolve with the hero, so the reader is always curious about the next piece. Others react when they find out (envy, fear, recruitment). Track it in the bible's secrets and never resolve it all at once. Follow the PLAYER'S VISION if it describes one.
ONBOARDING (many players have never read LitRPG): in chapter 1, soon after the event begins, the System makes a clear integration announcement to everyone, in its personality: what is happening in in-world terms (as much as it chooses to reveal), the first objective with a deadline and a reward (for example survive the first 24 hours, reach a safe zone before nightfall, or make your first kill within the hour), and 2-4 basic rules (everyone gets a status screen, levels and stats make you stronger, classes are coming, death is permanent). Then over chapters 1-3, the first time each mechanic matters (status screen, XP and levels, stat points, skills, classes, quests), the System explains it in one or two plain lines. Never assume the reader knows genre jargon. If the world premise keeps the System hidden or delayed, deliver this orientation through clues and discoveries instead, at the premise's pace.
Example of the rhythm (original, for style only; never reuse it):
  A raccoon in a crossing-guard vest sat on an overturned shopping cart, eating a tube of cookie dough.
  [system] Sergeant Pickles – Raccoon Hustler. Level 12. This is a Non-Combatant NPC. He runs the only store for nine miles and he knows it. Do not let him see your wallet.
  "Supplies," he said, without looking up. "Fair prices. Mostly."
  "We'll come back," I said.
  "Nobody comes back."
  [thought] That is not a comforting sentence.
  [system] Cookie Dough, Family Size. Consumable. Ordinarily I'd tell you this is just sugar and regret. But Sergeant Pickles has been eating it for three days straight and he's still level 12, so either it's cursed or he's hiding something. Spoiler: it's the second one. Go ahead and ask him about the basement. I dare you.
  [system] New Quest! The Basement Accord. Part one of two. Somebody has been paying this raccoon very well to keep a door shut. Find out who. Reward: revealed when you stop being nosy and start being useful.
BANNED (cliché filler, never write these or close variants): crisp air, crackling (anything but fire or electricity), moonlight bathing or spilling, moss or weeds pushing through cracks, eerie or deafening silence, the air thick with anything, shivers or chills down the spine, heart pounding in the chest, breath you didn't know you were holding, time standing still, a testament to, palpable, tapestry, symphony, dance of, little did you know, you can't help but, light or neon "painting" anything, sickly colors or glows, "a world gone mad". No weather, light or smell description unless it changes what the hero does next.
ACCURACY: setup facts are literal. A street address is a house (the family home) unless the player says otherwise, never a hospital or business. Never contradict the setup, MEMORY or earlier chapters; if a setup detail seems odd, use it as written rather than reinterpreting it.
Never pad: trust the reader, don't explain what they can infer, don't stack adjectives or describe scenery that doesn't matter to the moment, don't restate feelings or recap what just happened. Keep the story moving.

RULES
- A System governs the world. Its NAME and PERSONALITY are given under SYSTEM: always call it by that name, and let the personality show in its notifications. It speaks through short notifications. Put each notification in its own segment of kind "system" (one notification per segment; never wrap the text in brackets or join several with "|", the app draws the box), e.g. "Level Up! You have reached Level 3." or "Skill Acquired: Iron Skin (Rank F)". Routine system segments (XP, level ups, loot) are 1-4 short lines; inspection cards, quests and announcements may run longer (see GENRE VOICE). Everything else is kind "prose", one or a few paragraphs per segment (separate paragraphs with a blank line). Every line a character speaks aloud (including the hero) is its own segment of kind "dialogue": text is ONLY the spoken words with no quotation marks and no tags, speaker is the character's name (the hero's name for the hero), and gender is male, female or other (other for creatures, machines and unknowns). Put tags and action around it in prose ("she says, already reloading"). For prose and system segments, speaker is "" and gender is "none".
- Progression is earned. The hero starts weak. Levels, skills, items and titles come from effort, risk and clever choices: usually 0-2 level ups per chapter, faster early on. Never hand out overwhelming power.
- The sheet you return is the source of truth. Start from CURRENT SHEET and change only what this chapter's events justify. Announce every change in the story, usually with a system segment. Health and energy drop with injury and exertion and recover with rest. The class field is "Unclassed" until the System grants a class. Gaining a class is always an on-page moment, never assumed: the System presents a class selection (3-4 options with one-line descriptions), and the hero thinks through each option in thought segments, weighing it against their situation and background, before choosing. If a PLANNED CLASS is given, it is among the options and the hero chooses it inside the chapter, after reasoning through the options in thoughts; set the sheet's class to it and announce it with a system segment. With a planned class, the class pick is NEVER one of the end-of-chapter choices; those stay about the story. It happens in chapter 1 or 2. If there is no planned class, let the selection happen when the story earns it and make it the chapter-ending decision, with the three choices being the three class options.
- Stat points: every level up adds 3 to unspent_points (announce it). NEVER spend unspent_points yourself; the player allocates them. Stats can still rise occasionally from training, items or events. Write the hero according to their stats (high agility moves fast, high intelligence notices patterns, and so on).
- Gear: equipment holds what is equipped in each slot ("" when empty); inventory holds carried items that are not equipped. When the hero gains gear, equip it in a sensible slot if it is clearly better, otherwise put it in inventory. Respect gear changes the player made. Describe and use the equipped gear in the story. appearance: one or two sentences on how the hero currently looks, including visible gear and scars.
- Crafting and upgrades: gear can be modified and improved. The world holds mod kits, enhancer cores, boosters, schematics and workbenches or crafting stations. Knowledge matters: learning how things work (often as skills) unlocks better crafting. When the player uses an item on gear or on themselves (PLAYER ACTIONS), resolve it in the story and update the item's name to reflect it (e.g. "Combat Knife" becomes "Combat Knife +1 (Serrated Edge)") and its effect. Vehicles can be found, repaired and modified; the vehicle slot holds the current one.
- Loot: avoid the treasure-chest cliché. Supplies and gear come from scavenging real places (stores, police stations, bases, warehouses), defeated enemies, hidden caches with a story behind them, System rewards and trades.
- Scale: power and reach grow over the saga, from on foot, to vehicles, to aircraft and eventually ships that leave the world, matched to the story's progress. Never jump ahead.
- Originality: all characters, gods, factions, places, items and lore are your own inventions. Never reuse named characters, gods, places or unique terms from existing published novels, even when the player names a book as inspiration.
- The hero's BACKGROUND is real: their training, job skills and knowledge shape what they notice, what they are good at and what they think to do first (a soldier knows weapons, tactics and where local bases, armories or gun stores are; a nurse knows medicine; a mechanic can fix engines).
- Authority: the System's rules are absolute and cannot be cheated, but it has favorites. authority (0-100) is the hero's standing with the System: it rises slowly and rarely, only through remarkable deeds, firsts, and impressing the System or the gods. As it grows the System treats the hero differently: around 10 it answers simple questions, around 25 it offers the hero choices between rewards, around 50 it allows small negotiations and adjustments, around 75 the hero can influence how it reacts in their territory; never full control. Announce authority gains with a system segment. patrons lists gods or ancient beings who have taken an interest in the hero, with a few words on what that means (watching, blessing, testing, claim); they are earned, not given.
- Names: give every new character a distinctive name that fits the world and the character (avoid the most common everyday first names like Mike, Sarah, Jake, Chris, Jessica, Matt). Never use any name listed under NAMES TO AVOID, and never bring back a name the player has replaced.
- Cast: build a varied cast, and always include at least one formidable, capable woman in a major role (ally, rival, companion or leader), written as a real person with her own goals, not a token.
- MESSAGES: if the hero has loved ones in Sanctuary, a way to reach them is earned only through real progress (usually after a major milestone or Authority around 25 or more). When it is unlocked, set link_unlocked to true and announce it. After that, loved ones may occasionally send short messages: put only NEW messages from this chapter in inbox (from, text), in each person's real voice (kids sound like kids), hopeful and loving. Messages the player sends arrive in PLAYER ACTIONS; answer them in a later chapter. Before it is unlocked, inbox is always empty and link_unlocked stays false.
- Companions: the companions list holds party members and any sidekick or companion who travels with the hero (name, kind such as human or beast or AI familiar, role, level, bond 0-100, condition). Bond rises and falls with the hero's choices. Companions have personalities, opinions and their own small arcs, and they can level up.
- Consequences persist. Honor STORY SO FAR, MEMORY and the CODEX: allies remember kindness, enemies remember betrayal, lost things stay lost, wounds take time. Avoid killing the hero, but failure has real costs.
- Honor the player's decision faithfully. Open the chapter by playing it out. If the player typed their own action, carry it out as written when physically possible; reckless actions can fail with consequences. Never ignore it or decide for them.
- End every chapter on a tense, unresolved decision point. Then give exactly 4 choices: under 15 words each, written as imperative actions ("Charge the hound before it calls the pack"), clearly different from each other: one bold, one cunning, one careful or curious (investigate, ask, scout, use a skill or item in a clever way), and one wildcard (risky, moral, or funny). Do not number them.

STORY DIRECTOR
- You also keep a hidden plan, the bible, which the player never sees. Use it to plan ahead so the world keeps growing and the story never runs out of road.
- arc: the current story arc, its goal and the climax it is building toward. Arcs build to a boss or turning point every 5-8 chapters, then open a bigger, stranger part of the world.
- threats: an escalating roster of enemies, rivals and factions matched to the hero's level, with new ones invented as the world expands (new species, cults, rival players, bigger predators).
- secrets: hidden truths and mysteries. Plant foreshadowing early and pay it off chapters later, so twists feel surprising but inevitable.
- next_beats: 2-4 flexible upcoming developments. Adapt them to the player's choices; never railroad.
- codex: everything the player has DISCOVERED so far (people, creatures, factions, places, items, lore), each with a short note in the player's knowledge. Keep entries from before, add new ones, update notes. Never reveal secrets in the codex before the story reveals them.
- If the player made changes since the last chapter (PLAYER ACTIONS) or asked for something (PLAYER'S REQUEST), work them in naturally. The PLAYER'S VISION outranks your own plans: build the bible around it.

FIELDS: continuity_check (fill this FIRST, before writing; the player never sees it): in under 80 words, list the setup facts, MEMORY items and recent events this chapter must respect (where the hero is, who is present, what they know, injuries, gear), and anything you must be careful not to contradict. Then write the chapter to match it. chapter_title: short and evocative, without the chapter number. series_title: a short title for the whole saga (keep the same one after chapter 1). story_so_far: a running summary of the WHOLE story to date, under 250 words. memory: up to 25 short facts that must stay consistent (names, relationships, promises, enemies, places, injuries, debts).
- Follow the CONTENT RATING and ROMANCE settings exactly. Hard limits regardless of settings: romance and sexual content only ever involve adults; never anything sexual involving minors; no depicted sexual violence; intimate scenes always fade to black, with no explicit sexual description. If PARTY includes children, keep everything family-friendly and keep the children safe from graphic harm.`;

const str = { type: 'string' }, int = { type: 'integer' }, strs = { type: 'array', items: { type: 'string' } };
const obj = (props) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
const sheetSchema = obj({
  name: str, class: str, level: int, xp: int, xp_to_next: int,
  health: int, max_health: int, energy: int, max_energy: int,
  stats: obj(Object.fromEntries(STATS.map(k => [k, int]))),
  unspent_points: int,
  skills: { type: 'array', items: obj({ name: str, rank: str, description: str }) },
  equipment: obj(Object.fromEntries(SLOTS.map(k => [k, str]))),
  inventory: strs, titles: strs, condition: str, appearance: str, authority: int, patrons: strs, link_unlocked: { type: 'boolean' },
  companions: { type: 'array', items: obj({ name: str, kind: str, role: str, level: int, bond: int, condition: str }) },
});
const chapterSchema = obj({
  continuity_check: str, series_title: str, chapter_title: str,
  segments: { type: 'array', items: obj({ kind: { type: 'string', enum: ['prose', 'system', 'dialogue', 'thought'] }, speaker: str, gender: { type: 'string', enum: ['male', 'female', 'other', 'none'] }, text: str }) },
  choices: strs, sheet: sheetSchema, story_so_far: str, memory: strs,
  bible: obj({ arc: str, threats: strs, secrets: strs, next_beats: strs }),
  inbox: { type: 'array', items: obj({ from: str, text: str }) },
  codex: { type: 'array', items: obj({ name: str, kind: { type: 'string', enum: ['person', 'creature', 'faction', 'place', 'item', 'lore'] }, note: str }) },
});
const ideasSchema = obj({ ideas: { type: 'array', items: obj({ title: str, pitch: str }) } });

const num = (v, d = 0) => (Number.isFinite(v) ? Math.max(0, Math.min(999999, Math.round(v))) : d);
const txt = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
const list = (v, n, max) => (Array.isArray(v) ? v : []).slice(0, n).map(x => txt(x, max)).filter(Boolean);
const emptyGear = () => Object.fromEntries(SLOTS.map(k => [k, '']));
const emptyBible = () => ({ arc: '', threats: [], secrets: [], next_beats: [] });
const startSheet = (name, cls) => ({
  name, class: cls || 'Unclassed', level: 1, xp: 0, xp_to_next: 100, health: 100, max_health: 100, energy: 50, max_energy: 50,
  stats: Object.fromEntries(STATS.map(k => [k, 5])), unspent_points: 0, skills: [], equipment: emptyGear(), inventory: [], titles: [],
  condition: 'Healthy', appearance: '', companions: [], authority: 0, patrons: [], link_unlocked: false,
});
// Old saves lack newer fields; fill them in.
const upgradeSheet = s => ({ ...startSheet(s.name, s.class), ...s, equipment: { ...emptyGear(), ...(s.equipment || {}) }, companions: s.companions || [], unspent_points: s.unspent_points || 0, appearance: s.appearance || '', authority: s.authority || 0, patrons: s.patrons || [], link_unlocked: Boolean(s.link_unlocked) });
function cleanSheet(s, prevRaw) {
  const prev = upgradeSheet(prevRaw);
  const out = {
    name: txt(s?.name, 60) || prev.name, class: txt(s?.class, 60) || prev.class,
    level: num(s?.level, prev.level), xp: num(s?.xp, prev.xp), xp_to_next: num(s?.xp_to_next, prev.xp_to_next),
    health: num(s?.health, prev.health), max_health: num(s?.max_health, prev.max_health),
    energy: num(s?.energy, prev.energy), max_energy: num(s?.max_energy, prev.max_energy),
    stats: Object.fromEntries(STATS.map(k => [k, num(s?.stats?.[k], prev.stats[k])])),
    unspent_points: num(s?.unspent_points, prev.unspent_points),
    skills: (Array.isArray(s?.skills) ? s.skills : []).slice(0, 30)
      .map(k => ({ name: txt(k?.name, 60), rank: txt(k?.rank, 20), description: txt(k?.description, 220) })).filter(k => k.name),
    equipment: Object.fromEntries(SLOTS.map(k => [k, txt(s?.equipment?.[k], 90)])),
    inventory: list(s?.inventory, 40, 90), titles: list(s?.titles, 15, 80),
    condition: txt(s?.condition, 140) || 'Healthy', appearance: txt(s?.appearance, 400) || prev.appearance,
    authority: Math.min(100, num(s?.authority, prev.authority)), patrons: list(s?.patrons, 8, 140),
    link_unlocked: Boolean(prev.link_unlocked || s?.link_unlocked),
    companions: (Array.isArray(s?.companions) ? s.companions : []).slice(0, 8).map(c => ({
      name: txt(c?.name, 60), kind: txt(c?.kind, 40), role: txt(c?.role, 80), level: num(c?.level, 1),
      bond: Math.min(100, num(c?.bond, 50)), condition: txt(c?.condition, 120) || 'Healthy',
    })).filter(c => c.name),
  };
  // The player spends points, never the AI: points can't drop, and each level gained adds at least 3.
  const gained = Math.max(0, out.level - prev.level);
  out.unspent_points = Math.max(out.unspent_points, prev.unspent_points + 3 * gained);
  out.max_health = Math.max(1, out.max_health); out.max_energy = Math.max(1, out.max_energy);
  out.health = Math.min(out.health, out.max_health); out.energy = Math.min(out.energy, out.max_energy);
  return out;
}
const cleanBible = (b, prev) => ({
  arc: txt(b?.arc, 600) || prev.arc, threats: list(b?.threats, 12, 200), secrets: list(b?.secrets, 10, 240), next_beats: list(b?.next_beats, 5, 200),
});
const CODEX_KINDS = ['person', 'creature', 'faction', 'place', 'item', 'lore'];
const cleanCodex = (c, prev) => {
  const out = (Array.isArray(c) ? c : []).slice(0, 80).map(e => ({ name: txt(e?.name, 70), kind: CODEX_KINDS.includes(e?.kind) ? e.kind : 'lore', note: txt(e?.note, 260) })).filter(e => e.name);
  // Keep anything the AI forgot to carry forward.
  const seen = new Set(out.map(e => e.name.toLowerCase()));
  for (const e of prev) if (!seen.has(e.name.toLowerCase()) && out.length < 80) out.push(e);
  return out;
};
const plain = c => c.segments.map(s => (s.kind === 'system' ? `[${s.text}]` : s.kind === 'dialogue' ? `${s.speaker}: "${s.text}"` : s.kind === 'thought' ? `(thinking) ${s.text}` : s.text)).join('\n\n');
const clip = s => s.replace(/[.!?\s]+$/, '');

const NO_LIMITS = { check() {}, add() {} };
export function createForge({ root, savesDir = path.join(root, 'saves'), port, api, json, fail, chunks, hasKey, usage = NO_LIMITS, sameOrigin }) {
  const model = () => process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini';
  const locks = { text: false, audio: false, image: false };
  const statics = { '/forge': ['forge.html', 'text/html'], '/forge.js': ['forge.js', 'text/javascript'], '/forge.css': ['forge.css', 'text/css'], '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'], '/icon-192.png': ['icon-192.png', 'image/png'], '/icon-512.png': ['icon-512.png', 'image/png'], '/apple-touch-icon.png': ['apple-touch-icon.png', 'image/png'] };
  const BUSY = 'A chapter is already being written. Please wait.';

  const dirOf = id => { if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) fail('That story could not be found.', 404); return path.join(savesDir, id); };
  async function load(id) {
    const dir = dirOf(id);
    let r;
    try { r = JSON.parse(await readFile(path.join(dir, 'run.json'), 'utf8')); } catch { fail('That story could not be found.', 404); }
    // Bring older saves up to date.
    r.setup = { sysVoice: 'alloy', charVoices: true, style: 'lean', tone: 'gritty', rating: 'r', romance: 'off', enemies: [], systemName: 'The System', personality: 'auto', companion: 'none', companionDesc: '', party: [], turns: false, notes: '', background: '', family: 'none', familyDesc: '', autoPoints: false, ...r.setup };
    r.pending = { actions: [], steer: '', ...(r.pending || {}) };
    for (const c of r.chapters) c.sheet = upgradeSheet(c.sheet);
    return r;
  }
  async function save(run) {
    const dir = dirOf(run.id);
    await mkdir(dir, { recursive: true });
    run.updated = Date.now();
    await writeFile(path.join(dir, 'run.json.tmp'), JSON.stringify(run));
    await rename(path.join(dir, 'run.json.tmp'), path.join(dir, 'run.json'));
  }
  const exists = f => stat(f).then(() => true, () => false);
  // What the browser gets: everything except the director's hidden plan.
  async function view(run) {
    const dir = dirOf(run.id), audio = {};
    await Promise.all(run.chapters.map(async c => {
      const [a, b, d] = await Promise.all(['c', 'q', 'd'].map(k => exists(path.join(dir, `${k}-${c.uid}.mp3`))));
      audio[c.uid] = { c: a, q: b, d };
    }));
    return { ...run, audio, chapters: run.chapters.map(({ bible, ...c }) => c) };
  }
  function state(run) {
    const last = run.chapters.at(-1);
    return last ? { sheet: last.sheet, summary: last.summary, memory: last.memory, bible: last.bible || emptyBible(), codex: last.codex || [] }
      : { sheet: startSheet(run.setup.name, ''), summary: '', memory: [], bible: emptyBible(), codex: [] };
  }
  async function withLock(name, busyMsg, fn) {
    if (locks[name]) fail(busyMsg, 429);
    locks[name] = true;
    try { return await fn(); } finally { locks[name] = false; }
  }
  async function readBody(req) {
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 30000) fail('That request is too large.', 413); }
    try { return JSON.parse(body || '{}'); } catch { fail('Invalid request.'); }
  }
  async function structured(input, name, schema, maxTokens, instructions = INSTRUCTIONS) {
    const response = await api('responses', {
      model: model(), instructions, input, max_output_tokens: maxTokens, store: false,
      text: { format: { type: 'json_schema', name, strict: true, schema } },
    });
    const result = await response.json();
    const content = (result.output || []).flatMap(i => i.content || []);
    if (content.some(i => i.type === 'refusal')) fail('The AI declined to write that. Try a different action.', 422);
    if (result.status === 'incomplete') fail('The response was cut off before it finished. Try again or choose a shorter chapter length.', 502);
    try { return JSON.parse(content.filter(i => i.type === 'output_text').map(i => i.text).join('')); } catch { fail('The response came back garbled. Please try again.', 502); }
  }

  const worldOf = s => (s.world === 'custom' ? `The player's own premise: ${s.premise}` : WORLDS[s.world]);
  const threatsOf = s => (s.enemies?.length ? s.enemies.map(e => ENEMIES[e]).join('; ') : 'your choice; reveal them gradually as the story unfolds');
  const hasKids = s => (s.party || []).some(m => m.kid);
  const deciderFor = (s, n) => {
    if (!s.turns || !s.party?.length) return '';
    const order = [s.name, ...s.party.map(m => m.name)];
    return order[(n - 1) % order.length];
  };
  function settingBlock(s) {
    const sys = PERSONALITIES[s.personality] || PERSONALITIES.auto;
    const lines = [
      `POINT OF VIEW: ${s.pov === 'first' ? 'first person, past tense ("I"). The hero narrates their own story; thought segments stay in present tense, like the hero talking to themselves.' : s.pov === 'third' ? `third person, past tense, close on ${s.name} ("he/she/they"), with their thoughts in thought segments.` : 'second person, present tense ("you"). The reader is the hero.'}`,
      `WORLD: ${worldOf(s)}`,
      `PRESENT DAY: ${new Date().getFullYear()}${s.world === 'vanished' ? `; STORY YEAR: ${(s.year || new Date().getFullYear()) + 100} (use exactly this year)` : ''}`,
      `TONE: ${TONES[s.tone] || TONES.gritty}`,
      `STYLE: ${STYLES[s.style] || STYLES.lean}`,
      `CONTENT RATING: ${RATINGS[s.rating] || RATINGS.r}`,
      `ROMANCE: ${ROMANCE[s.romance] || ROMANCE.off}`,
      `THREATS: ${threatsOf(s)}`,
      `SYSTEM: its name is "${s.systemName || 'The System'}"; personality: ${sys.text}.`,
    ];
    if (s.flavor === 'crawler') lines.push(`FLAVOR: crawler chaos. Lean hardest on the System as a mouthy, opinionated character (long gossipy inspection cards, punny quests, big rule announcements), absurd situations and creatures, deadpan humor, and loyalty and grief underneath. Danger is real and the world is unfair on purpose.`);
    if (s.flavor === 'hunter') lines.push(`FLAVOR: hunter's path. Lean hardest on a calm, confident, sharp hero who studies how the System works, theorizes and runs experiments on skills and abilities, evolves skills through clever choices, and grows into something others find unsettling. Humor is dry and comes from side characters' reactions. Occasional short cutaways show allies or rivals sizing the hero up.`);
    const avoid = [...(s.avoidNames ? s.avoidNames.split(/[,\n]/) : []), ...(s.retired || [])].map(x => x.trim()).filter(Boolean);
    if (avoid.length) lines.push(`NAMES TO AVOID (real people the player knows, or names they replaced; never use them for anyone): ${avoid.join(', ')}`);
    if (s.cls) lines.push(`PLANNED CLASS: ${s.cls} (if the sheet is still Unclassed, the class selection scene is due now).`);
    if (s.place) lines.push(`HERO'S HOME: ${s.place}${s.landmarks ? `; local spots: ${s.landmarks}` : ''}`);
    if (s.party?.length) {
      lines.push(`PARTY: the hero is joined from the start by ${s.party.map(m => `${m.name}${m.kid ? ' (a child)' : ''}`).join(', ')}. These are real people listening and playing along. Give each a real role, personality, moments to shine, and occasional System notifications of their own; keep them in the companions list.`);
    }
    if (s.companion === 'start') lines.push(`COMPANION: ${COMPANION.start}${s.companionDesc ? `: ${s.companionDesc}` : ' (invent a fitting one)'}. Keep them in the companions list.`);
    if (s.companion === 'open') lines.push(`COMPANION: ${COMPANION.open}`);
    if (s.background) lines.push(`HERO'S BACKGROUND: ${s.background}`);
    if (FAMILY[s.family]) lines.push(`LOVED ONES${s.familyDesc ? ` (${s.familyDesc})` : ''}: ${FAMILY[s.family]} Hard rule: loved ones are never killed, never graphically hurt, and any children among them are always kept safe.`);
    if (s.notes) lines.push(`PLAYER'S VISION FOR THE STORY (follow it closely throughout; reveal it gradually rather than all at once): ${s.notes}`);
    return lines.join('\n');
  }

  async function writeChapter(run, decision, extras = { actions: [], steer: '' }) {
    const n = run.chapters.length + 1, s = run.setup, cur = state(run);
    const decider = deciderFor(s, n);
    const extra = [
      extras.actions.length ? `PLAYER ACTIONS SINCE THE LAST CHAPTER (already applied to the sheet; reflect them in the story):\n${extras.actions.map(a => `- ${a}`).join('\n')}` : '',
      extras.steer ? `PLAYER'S REQUEST FOR WHERE THE STORY GOES (work it in naturally over this chapter or the next): ${extras.steer}` : '',
      decider ? `This chapter's decision belongs to ${decider}: end the chapter by turning to ${decider}, and write the 3 choices as things ${decider === s.name ? 'the hero' : decider} could do or decide for the group.` : '',
    ].filter(Boolean).join('\n');
    let input;
    if (n === 1) {
      input = `START A NEW STORY. Write chapter 1 (about ${s.words} words).
Hero's name: ${s.name}${s.pronouns ? `\nHero's pronouns: ${s.pronouns}` : ''}
Class: the hero starts Unclassed.${s.cls ? ` PLANNED CLASS: ${s.cls}. Earn it on the page with a System class selection in chapter 1 or 2, as the rules describe.` : ' The System offers a class selection when the story earns it.'}
${settingBlock(s)}
Where the hero is from / where it begins: ${s.place ? `${s.place}. Ground the opening in this real place: use authentic, recognizable local details (geography, weather, roads, landmarks, the feel of the area) that you are confident are real. Prefer well-known roads and landmarks over guessed street names. Do not invent claims about real, named private people.` : 'your choice; make it ordinary and specific'}${s.landmarks ? `\nLocal spots the player wants in the story (use them by name, accurately, early on and whenever the story returns home): ${s.landmarks}` : ''}
Chapter 1: ${OPENINGS[s.world] || OPENINGS.default} End at a tense decision.
Also create the director's bible for the whole saga: the first arc, an escalating threat roster, secrets to foreshadow, and the next beats.
CURRENT SHEET: ${JSON.stringify(cur.sheet)}${extra ? `\n${extra}` : ''}`;
    } else {
      const recent = run.chapters.slice(-2).map(c => `CHAPTER ${c.n}: ${c.title}\n${plain(c)}${c.decision && c !== run.chapters.at(-1) ? `\n(Player chose: ${c.decision.text})` : ''}`).join('\n\n');
      input = `Write chapter ${n} (about ${s.words} words).
SERIES TITLE: ${run.title}
${settingBlock(s)}
STORY SO FAR: ${cur.summary}
MEMORY:
${cur.memory.map(m => `- ${m}`).join('\n') || '- (none yet)'}
DIRECTOR'S BIBLE (hidden from the player; update it): ${JSON.stringify(cur.bible)}
CODEX (what the player has discovered): ${JSON.stringify(cur.codex)}
CURRENT SHEET: ${JSON.stringify(cur.sheet)}
MOST RECENT CHAPTERS:
${recent}
THE PLAYER'S DECISION: "${decision.text}" (${decision.custom ? 'the player typed this action themselves' : 'picked from the offered choices'})${extra ? `\n${extra}` : ''}
Continue the story from this decision.`;
    }
    const data = await structured(input, 'litrpg_chapter', chapterSchema, 14000);
    const segments = (Array.isArray(data.segments) ? data.segments : [])
      .map(x => {
        const kind = ['system', 'dialogue', 'thought'].includes(x?.kind) ? x.kind : 'prose';
        const seg = { kind, text: txt(x?.text, 12000) };
        if (kind === 'system') { let t = seg.text; while (/^\[[\s\S]*\]$/.test(t) && !/\][\s\S]*\[/.test(t.slice(1, -1).replace(/\[[^\[\]]*\]/g, ''))) { const inner = t.slice(1, -1).trim(); if (inner === t) break; t = inner; } seg.text = t; }
        if (kind === 'thought') seg.text = seg.text.replace(/^["“”'*_]+|["“”'*_]+$/g, '').trim();
        if (kind === 'dialogue') {
          seg.text = seg.text.replace(/^["“”']+|["“”']+$/g, '').trim();
          seg.speaker = txt(x?.speaker, 60) || 'Stranger';
          seg.gender = ['male', 'female', 'other'].includes(x?.gender) ? x.gender : 'other';
        }
        return seg;
      }).filter(x => x.text).slice(0, 160);
    const choices = list(data.choices, 4, 160);
    if (!segments.length || choices.length < 2) fail('The chapter came back incomplete. Please try again.', 502);
    return {
      chapter: {
        n, uid: randomBytes(4).toString('hex'), title: txt(data.chapter_title, 120).replace(/^chapter\s+\d+\s*[:.\-–—]\s*/i, '') || `Chapter ${n}`,
        segments, choices, decision: null, decider, sheet: cleanSheet(data.sheet, cur.sheet),
        summary: txt(data.story_so_far, 3000) || cur.summary, memory: list(data.memory, 25, 240),
        bible: cleanBible(data.bible, cur.bible), codex: cleanCodex(data.codex, cur.codex),
        inbox: (Array.isArray(data.inbox) ? data.inbox : []).slice(0, 5).map(m => ({ from: txt(m?.from, 60), text: txt(m?.text, 600) })).filter(m => m.from && m.text),
        applied: { actions: extras.actions, steer: extras.steer },
      },
      seriesTitle: txt(data.series_title, 100),
    };
  }

  // Spend banked points following the hero's current build (used when auto-assign is on).
  function autoAllocate(sheet) {
    const pts = sheet.unspent_points;
    if (!pts) return null;
    const ranked = [...STATS].sort((a, b) => sheet.stats[b] - sheet.stats[a]);
    const add = {};
    for (let i = 0; i < pts; i++) { const k = ranked[i % 3 === 2 ? 1 : 0]; add[k] = (add[k] || 0) + 1; }
    for (const [k, v] of Object.entries(add)) sheet.stats[k] += v;
    sheet.unspent_points = 0;
    return `Auto-assigned stat points: ${Object.entries(add).map(([k, v]) => `+${v} ${k}`).join(', ')}`;
  }

  // Split long text into short pieces so each voice request finishes quickly.
  function pieces(text, max = 1400) {
    const out = [];
    let t = text.trim();
    while (t.length > max) {
      let cut = t.lastIndexOf('\n', max);
      if (cut < max / 2) cut = t.lastIndexOf('. ', max) + 1;
      if (cut < max / 2) cut = t.lastIndexOf(' ', max);
      if (cut < 1) cut = max;
      out.push(t.slice(0, cut).trim()); t = t.slice(cut).trim();
    }
    if (t) out.push(t);
    return out.filter(Boolean);
  }
  async function speak(text, voice, style) {
    const parts = [];
    for (const input of pieces(text)) {
      const r = await api('audio/speech', { model: 'gpt-4o-mini-tts', input, voice, instructions: style, response_format: 'mp3' });
      parts.push(Buffer.from(await r.arrayBuffer()));
    }
    return Buffer.concat(parts);
  }
  async function pool(tasks, size = 3) {
    const out = new Array(tasks.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, async () => { while (i < tasks.length) { const k = i++; out[k] = await tasks[k](); } }));
    return out;
  }
  function voicesFor(run) {
    const s = run.setup, narrator = VOICES.includes(s.voice) ? s.voice : 'onyx';
    let sys = VOICES.includes(s.sysVoice) ? s.sysVoice : 'alloy';
    if (sys === narrator) sys = narrator === 'alloy' ? 'ballad' : 'alloy';
    const comedy = s.tone === 'darkcomedy';
    const pv = PERSONALITIES[s.personality]?.voice || (comedy ? SYSTEM_VOICE_COMEDY : SYSTEM_VOICE);
    return {
      narrator, sys,
      narStyle: (comedy ? NARRATOR_COMEDY : NARRATOR).replace(', subtle distinct voices for characters', '') + ACCENT,
      sysStyle: `You are ${s.systemName || 'the System'}, the voice of the System in a LitRPG audiobook. ${pv.replace(/^Read as /, 'Sound like ')} Make it instantly recognizable and clearly different from the narrator.`,
    };
  }
  // Give each speaking character a consistent voice for the whole run.
  function castVoice(run, speaker, gender) {
    run.cast = run.cast || {};
    const v = voicesFor(run), taken = new Set([v.narrator, v.sys]);
    if (run.cast[speaker] && !taken.has(run.cast[speaker])) return run.cast[speaker];
    delete run.cast[speaker];
    const heroGender = run.setup.pronouns === 'she/her' ? 'female' : run.setup.pronouns === 'they/them' ? 'other' : 'male';
    const g = speaker === run.setup.name ? heroGender : (CAST_POOL[gender] ? gender : 'other');
    const used = Object.values(run.cast);
    const options = CAST_POOL[g].filter(x => !taken.has(x));
    const pick = options.find(x => !used.includes(x)) || options[used.length % options.length] || 'ballad';
    run.cast[speaker] = pick;
    return pick;
  }
  async function narrate(run, n, withChoices, force) {
    const c = run.chapters[n - 1];
    if (!c) fail('That chapter does not exist.', 404);
    const dir = dirOf(run.id), v = voicesFor(run), mode = run.setup.voiceMode || (run.setup.charVoices === false ? 'plain' : 'cast'), charVoices = mode === 'cast';
    const STEADY = ' Keep the same steady volume and pace as the rest of the chapter.';
    const jobs = [];
    const chapterFile = path.join(dir, `c-${c.uid}.mp3`), qFile = path.join(dir, `q-${c.uid}.mp3`);
    if (force) { await rm(chapterFile, { force: true }); await rm(qFile, { force: true }); }
    if (!(await exists(chapterFile))) {
      const parts = [{ text: `Chapter ${c.n}. ${clip(c.title)}.`, voice: v.narrator, style: v.narStyle }];
      for (const s of c.segments) {
        let voice = v.narrator, style = v.narStyle, text = s.text;
        if (s.kind === 'system') { voice = v.sys; style = v.sysStyle; }
        if (mode === 'narrator' && (s.kind === 'dialogue' || s.kind === 'thought')) {
          const who = s.kind === 'thought' ? run.setup.name : s.speaker;
          style = s.kind === 'thought'
            ? `${v.narStyle} This line is ${who}'s private inner thought: a touch quieter and closer, like talking under your breath, but clearly the same narrator.${STEADY}`
            : `${v.narStyle} For this line only, perform the character ${who} (${s.gender === 'female' ? 'a woman' : s.gender === 'male' ? 'a man' : 'a non-human or unknown speaker'}) the way a skilled audiobook narrator does: shift pitch and attitude just enough to suggest them, but stay recognizably the same narrator.${STEADY}`;
          const last = parts.at(-1);
          if (last.voice === voice && last.style === style) last.text += `\n\n${text}`; else parts.push({ text, voice, style });
          continue;
        }
        if (s.kind === 'thought' && charVoices) {
          voice = castVoice(run, run.setup.name, run.setup.pronouns === 'she/her' ? 'female' : run.setup.pronouns === 'they/them' ? 'other' : 'male');
          style = `This is ${run.setup.name}'s private inner thought, not spoken to anyone: quieter and closer, quick, natural and honest, like talking to yourself under your breath.${ACCENT}`;
        }
        if (s.kind === 'dialogue') {
          if (charVoices) {
            voice = castVoice(run, s.speaker, s.gender);
            style = `Speak only this line, in character as ${s.speaker}, a character in a gritty audiobook. Natural, conversational, emotionally real.${ACCENT}${STEADY}`;
          } else text = `"${text}"`;
        }
        const last = parts.at(-1);
        if (last.voice === voice && last.style === style) last.text += `\n\n${text}`; else parts.push({ text, voice, style });
      }
      jobs.push(async () => {
        const audio = await pool(parts.map(p => () => speak(p.text, p.voice, p.style)));
        await writeFile(chapterFile, Buffer.concat(audio));
      });
    }
    if (withChoices && !c.decision && !(await exists(qFile))) {
      const words = ['One', 'Two', 'Three', 'Four'];
      const text = `${c.decider ? `${c.decider}, what do you do?` : 'What do you do?'} ${c.choices.map((x, i) => `${words[i]}: ${clip(x)}.`).join(' ')} Or say your own move.`;
      jobs.push(async () => writeFile(qFile, await speak(text, v.narrator, v.narStyle)));
    }
    const prev = run.chapters[n - 2];
    const dFile = prev && path.join(dir, `d-${prev.uid}.mp3`);
    if (prev?.decision && !(await exists(dFile))) {
      jobs.push(async () => writeFile(dFile, await speak(`Choice confirmed. ${clip(prev.decision.text)}.`, v.sys, v.sysStyle)));
    }
    await Promise.all(jobs.map(j => j()));
    return jobs.length;
  }

  async function paint(run) {
    const sh = run.chapters.at(-1).sheet, s = run.setup;
    const gear = Object.entries(sh.equipment).filter(([, v]) => v).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`).join('; ');
    const prompt = `Painterly digital illustration, ${s.rating === 'pg' ? 'family-friendly ' : ''}LitRPG character portrait, waist-up, dramatic lighting, detailed, cinematic. `
      + `${sh.name}, ${s.pronouns === 'she/her' ? 'a woman' : s.pronouns === 'they/them' ? 'a person' : 'a man'}, level ${sh.level} ${sh.class}. `
      + `${sh.appearance || ''} ${gear ? `Gear: ${gear}.` : ''} Condition: ${sh.condition}. `
      + `Setting mood: ${(worldOf(s) || '').slice(0, 300)} No text, no letters, no UI elements, no borders.`;
    let b64;
    try {
      const r = await api('images/generations', { model: 'gpt-image-1', prompt, size: '1024x1024', quality: 'low', n: 1 });
      b64 = (await r.json()).data?.[0]?.b64_json;
    } catch {
      try {
        const r = await api('images/generations', { model: 'dall-e-3', prompt, size: '1024x1024', response_format: 'b64_json', n: 1 });
        b64 = (await r.json()).data?.[0]?.b64_json;
      } catch (e) {
        fail(`The portrait couldn't be painted. ${e.status === 402 ? e.message : 'Image generation may need your OpenAI organization verified (platform.openai.com > Settings > Organization > General > Verify).'}`, 502);
      }
    }
    if (!b64) fail('The portrait came back empty. Try again.', 502);
    const file = `portrait-${randomBytes(4).toString('hex')}.png`;
    await writeFile(path.join(dirOf(run.id), file), Buffer.from(b64, 'base64'));
    if (run.portrait) await rm(path.join(dirOf(run.id), run.portrait), { force: true });
    run.portrait = file;
  }

  async function sendFile(req, res, file, type, download) {
    let st;
    try { st = await stat(file); } catch { return json(res, 404, { error: 'Not found.' }); }
    const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
    if (download) headers['Content-Disposition'] = `attachment; filename="${download}"`;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
      let end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
      if (start >= st.size || end < start) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      return createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    createReadStream(file).pipe(res);
  }
  const slug = t => (t || 'story-forge').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'story-forge';
  const label = k => k.replace('_', ' ');

  // Returns true when the request was handled here.
  return async function handle(req, res, url) {
    const p = url.pathname;
    if (req.method === 'GET' && statics[p]) {
      const [file, type] = statics[p];
      const content = await readFile(path.join(root, 'public', file));
      res.writeHead(200, { 'Content-Type': type.startsWith('image/') ? type : `${type}; charset=utf-8`, 'Cache-Control': 'no-cache' });
      res.end(content); return true;
    }
    if (!p.startsWith('/api/forge/')) return false;

    if (req.method === 'GET') {
      if (p === '/api/forge/runs') {
        let ids = [];
        try { ids = (await readdir(savesDir, { withFileTypes: true })).filter(d => d.isDirectory() && /^[a-f0-9-]{36}$/.test(d.name)).map(d => d.name); } catch {}
        const runs = (await Promise.all(ids.map(id => load(id).catch(() => null)))).filter(Boolean).map(r => {
          const last = r.chapters.at(-1);
          return { id: r.id, title: r.title, name: r.setup.name, cls: last?.sheet.class || '', level: last?.sheet.level || 1, chapters: r.chapters.length, updated: r.updated };
        }).sort((a, b) => b.updated - a.updated);
        json(res, 200, { runs }); return true;
      }
      if (p === '/api/forge/run') { json(res, 200, { run: await view(await load(url.searchParams.get('id'))) }); return true; }
      if (p === '/api/forge/audio') {
        const id = url.searchParams.get('id'), file = url.searchParams.get('file') || '';
        if (!/^[cqd]-[a-f0-9]{8}\.mp3$/.test(file)) fail('Unknown audio file.', 404);
        await sendFile(req, res, path.join(dirOf(id), file), 'audio/mpeg'); return true;
      }
      if (p === '/api/forge/image') {
        const id = url.searchParams.get('id'), file = url.searchParams.get('file') || '';
        if (!/^portrait-[a-f0-9]{8}\.png$/.test(file)) fail('Unknown image.', 404);
        await sendFile(req, res, path.join(dirOf(id), file), 'image/png'); return true;
      }
      if (p === '/api/forge/audiobook') {
        const run = await load(url.searchParams.get('id')), dir = dirOf(run.id), parts = [];
        for (const c of run.chapters) for (const k of ['c', 'd']) {
          try { parts.push(await readFile(path.join(dir, `${k}-${c.uid}.mp3`))); } catch {}
        }
        if (!parts.length) fail('Nothing has been narrated yet.', 404);
        const tmp = path.join(dir, 'audiobook.tmp.mp3');
        await writeFile(tmp, Buffer.concat(parts));
        await sendFile(req, res, tmp, 'audio/mpeg', `${slug(run.title)}.mp3`); return true;
      }
      json(res, 404, { error: 'Not found.' }); return true;
    }

    if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed.' }); return true; }
    if (!(sameOrigin ? sameOrigin(req) : [`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(req.headers.origin))) { json(res, 403, { error: 'Request must come from this app.' }); return true; }
    if (!req.headers['content-type']?.startsWith('application/json')) fail('JSON request required.', 415);
    const data = await readBody(req);

    // ----- free actions (no OpenAI call) -----
    if (p === '/api/forge/delete') {
      await rm(dirOf(data.id), { recursive: true, force: true });
      json(res, 200, { ok: true }); return true;
    }
    if (p === '/api/forge/rename') {
      const title = txt(data.title, 100);
      if (!title) fail('Give your story a title.');
      const r = await load(data.id);
      r.title = title; r.customTitle = true; await save(r);
      json(res, 200, { ok: true, title }); return true;
    }
    if (p === '/api/forge/recast') {
      if (locks.text) fail(BUSY, 429);
      const clean = v => txt(v, 40).replace(/["\\<>{}\[\]]/g, '').replace(/\s+/g, ' ').trim();
      const from = clean(data.from), to = clean(data.to);
      if (!from || !to) fail('Pick a character and type their new name.');
      if (from === to) fail('That is already their name.');
      const r = await load(data.id);
      if (from.toLowerCase() === r.setup.name.toLowerCase()) fail('To rename your hero, start over with a new name.');
      const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'gu');
      const blob = JSON.stringify(r.chapters);
      if (!re.test(blob)) fail(`Couldn't find "${from}" in this story.`, 404);
      re.lastIndex = 0;
      r.chapters = JSON.parse(blob.replace(re, () => to));
      if (r.cast?.[from]) { r.cast[to] = r.cast[from]; delete r.cast[from]; }
      r.setup.retired = [...new Set([...(r.setup.retired || []), from])].slice(-40);
      await save(r);
      json(res, 200, { run: await view(r) }); return true;
    }
    const sheetEdit = async (fn) => {
      if (locks.text) fail(BUSY, 429);
      const r = await load(data.id), last = r.chapters.at(-1);
      if (!last) fail('That story has no chapters yet.', 409);
      const action = fn(last.sheet, r);
      if (action) r.pending.actions.push(action);
      await save(r);
      json(res, 200, { run: await view(r) }); return true;
    };
    if (p === '/api/forge/allocate') {
      return sheetEdit(sh => {
        const add = {};
        let total = 0;
        for (const k of STATS) { const v = Number(data.add?.[k] || 0); if (!Number.isInteger(v) || v < 0) fail('Invalid stat points.'); if (v) { add[k] = v; total += v; } }
        if (!total) fail('Assign at least one point.');
        if (total > sh.unspent_points) fail('Not enough unspent points.');
        for (const [k, v] of Object.entries(add)) sh.stats[k] += v;
        sh.unspent_points -= total;
        return `Allocated stat points: ${Object.entries(add).map(([k, v]) => `+${v} ${k}`).join(', ')}`;
      });
    }
    if (p === '/api/forge/equip') {
      return sheetEdit(sh => {
        const slot = data.slot;
        if (!SLOTS.includes(slot)) fail('Unknown gear slot.');
        if (data.item == null) {
          const was = sh.equipment[slot];
          if (!was) fail('That slot is already empty.');
          sh.equipment[slot] = ''; sh.inventory.push(was);
          return `Unequipped ${was} (${label(slot)})`;
        }
        const i = sh.inventory.indexOf(data.item);
        if (i < 0) fail('That item is not in your inventory.');
        sh.inventory.splice(i, 1);
        const was = sh.equipment[slot];
        if (was) sh.inventory.push(was);
        sh.equipment[slot] = data.item;
        return `Equipped ${data.item} (${label(slot)})${was ? `, replacing ${was}` : ''}`;
      });
    }
    if (p === '/api/forge/message') {
      return sheetEdit((sh, r) => {
        if (!sh.link_unlocked) fail('You haven\'t found a way to reach Sanctuary yet.', 409);
        const to = txt(data.to, 60) || 'my family', text = txt(data.text, 500);
        if (!text) fail('Write a message first.');
        r.outbox = [...(r.outbox || []), { n: r.chapters.length, to, text }];
        return `Sent a message into Sanctuary to ${to}: "${text}" (they will reply in a later chapter)`;
      });
    }
    if (p === '/api/forge/use') {
      return sheetEdit(sh => {
        const i = sh.inventory.indexOf(data.item);
        if (i < 0) fail('That item is not in your inventory.');
        let target;
        if (data.target === 'self') target = 'yourself';
        else if (SLOTS.includes(data.target) && sh.equipment[data.target]) target = `${sh.equipment[data.target]} (${label(data.target)})`;
        else fail('Pick something to use it on.');
        sh.inventory.splice(i, 1);
        return `Used ${data.item} on ${target}. Resolve the effect in the story and update the item.`;
      });
    }
    if (p === '/api/forge/settings') {
      return sheetEdit((sh, r) => {
        if (typeof data.autoPoints === 'boolean') r.setup.autoPoints = data.autoPoints;
        if (STYLES[data.style]) r.setup.style = data.style;
        if (typeof data.notes === 'string') r.setup.notes = txt(data.notes, 6000);
        if (typeof data.avoidNames === 'string') r.setup.avoidNames = txt(data.avoidNames, 400);
        if (VOICES.includes(data.voice)) r.setup.voice = data.voice;
        if (VOICES.includes(data.sysVoice)) r.setup.sysVoice = data.sysVoice;
        if (typeof data.charVoices === 'boolean') r.setup.charVoices = data.charVoices;
        if (['narrator', 'cast'].includes(data.voiceMode)) { r.setup.voiceMode = data.voiceMode; r.setup.charVoices = data.voiceMode === 'cast'; }
        if (typeof data.steer === 'string') r.pending.steer = txt(data.steer, 500);
        return null;
      });
    }

    if (!hasKey()) fail('No OpenAI API key is configured. Double-click the launcher again to set it up.', 503);

    if (p === '/api/forge/new') {
      const party = (Array.isArray(data.party) ? data.party : []).slice(0, 5)
        .map(m => ({ name: txt(m?.name, 30), kid: Boolean(m?.kid) })).filter(m => m.name);
      const setup = {
        name: txt(data.name, 40), pronouns: txt(data.pronouns, 30), cls: txt(data.cls, 40),
        world: WORLDS[data.world] || data.world === 'custom' ? data.world : 'earth', place: txt(data.place, 200), landmarks: txt(data.landmarks, 300),
        premise: data.world === 'custom' ? txt(data.premise, 1500) : '',
        tone: TONES[data.tone] ? data.tone : 'gritty', style: STYLES[data.style] ? data.style : 'lean', pov: ['first', 'third'].includes(data.pov) ? data.pov : 'second', flavor: ['crawler', 'hunter'].includes(data.flavor) ? data.flavor : '',
        rating: RATINGS[data.rating] && data.rating !== 'pg' ? data.rating : 'r', romance: ROMANCE[data.romance] ? data.romance : 'off',
        enemies: [...new Set(Array.isArray(data.enemies) ? data.enemies : [])].filter(e => ENEMIES[e]),
        words: WORDS.includes(Number(data.words)) ? Number(data.words) : 900,
        voice: VOICES.includes(data.voice) ? data.voice : 'onyx', sysVoice: VOICES.includes(data.sysVoice) ? data.sysVoice : 'alloy',
        voiceMode: data.voiceMode === 'cast' ? 'cast' : 'narrator', charVoices: data.voiceMode === 'cast', year: new Date().getFullYear(),
        systemName: txt(data.systemName, 40) || 'The System',
        personality: PERSONALITIES[data.personality] ? data.personality : 'auto',
        companion: ['none', 'open', 'start'].includes(data.companion) ? data.companion : 'none',
        companionDesc: txt(data.companionDesc, 200),
        party, turns: Boolean(data.turns) && party.length > 0,
        notes: txt(data.notes, 6000), avoidNames: txt(data.avoidNames, 400), background: txt(data.background, 300), family: FAMILY[data.family] !== undefined ? data.family : 'none', familyDesc: txt(data.familyDesc, 200), autoPoints: Boolean(data.autoPoints),
      };
      if (hasKids(setup)) { setup.rating = 'pg'; setup.romance = 'off'; } // kids in the party: always family-friendly
      if (!setup.name) fail('Give your hero a name.');
      if (setup.world === 'custom' && setup.premise.length < 20) fail('Describe your world in a sentence or two.');
      usage.check('chapter');
      const run = await withLock('text', BUSY, async () => {
        const fresh = { id: randomUUID(), created: Date.now(), title: '', setup, chapters: [], pending: { actions: [], steer: '' } };
        const { chapter, seriesTitle } = await writeChapter(fresh, null);
        fresh.title = seriesTitle || `The Rise of ${setup.name}`;
        fresh.chapters.push(chapter);
        await save(fresh); usage.add('chapter'); return fresh;
      });
      json(res, 200, { run: await view(run) }); return true;
    }
    if (p === '/api/forge/choose') {
      usage.check('chapter');
      const run = await withLock('text', BUSY, async () => {
        const r = await load(data.id), last = r.chapters.at(-1);
        if (!last || last.decision) fail('This chapter already has a decision.', 409);
        let decision;
        if (Number.isInteger(data.index) && last.choices[data.index]) decision = { text: last.choices[data.index], custom: false, index: data.index };
        else if (typeof data.custom === 'string' && data.custom.trim()) decision = { text: txt(data.custom, 300), custom: true };
        else fail('Pick a choice or describe your move.');
        if (last.decider) decision.by = last.decider;
        const actions = [...r.pending.actions];
        const beforeAuto = JSON.stringify(last.sheet);
        if (r.setup.autoPoints) { const a = autoAllocate(last.sheet); if (a) actions.push(a); }
        try {
          const { chapter } = await writeChapter(r, decision, { actions, steer: r.pending.steer });
          last.decision = decision;
          r.chapters.push(chapter);
          r.pending = { actions: [], steer: '' };
          await save(r); usage.add('chapter'); return r;
        } catch (e) { last.sheet = JSON.parse(beforeAuto); throw e; }
      });
      json(res, 200, { run: await view(run) }); return true;
    }
    if (p === '/api/forge/reroll') {
      usage.check('chapter');
      const run = await withLock('text', BUSY, async () => {
        const r = await load(data.id), old = r.chapters.at(-1);
        if (!old || old.decision) fail('Only the newest chapter can be rewritten.', 409);
        const base = { ...r, chapters: r.chapters.slice(0, -1) };
        const { chapter, seriesTitle } = await writeChapter(base, base.chapters.at(-1)?.decision || null, old.applied || { actions: [], steer: '' });
        if (chapter.n === 1 && seriesTitle && !r.customTitle) r.title = seriesTitle;
        r.chapters = [...base.chapters, chapter];
        r.pending.actions = []; // changes made to the replaced chapter's sheet are gone with it
        await save(r); usage.add('chapter');
        for (const k of ['c', 'q']) await rm(path.join(dirOf(r.id), `${k}-${old.uid}.mp3`), { force: true });
        return r;
      });
      json(res, 200, { run: await view(run) }); return true;
    }
    if (p === '/api/forge/names') {
      const r = await load(data.id), cur = state(r), who = txt(data.who, 40);
      usage.check('ideas');
      const entry = (cur.codex || []).find(e => e.name === who);
      const out = await withLock('text', BUSY, () => structured(
        `${settingBlock(r.setup)}\nSTORY SO FAR: ${cur.summary}\nCHARACTER TO RENAME: ${who}${entry ? ` (${entry.note})` : ''}\nSuggest 6 fresh, distinctive names that fit this character, the world and the tone. Mix styles (one can be a nickname or title). Avoid common everyday first names and anything under NAMES TO AVOID. Each with a few words on why it fits.`,
        'name_ideas', obj({ names: { type: 'array', items: obj({ name: str, why: str }) } }), 800, 'You name characters for an interactive LitRPG story. Names must be original, never from published novels.'));
      usage.add('ideas');
      json(res, 200, { names: (out.names || []).slice(0, 6).map(n => ({ name: txt(n.name, 40), why: txt(n.why, 120) })).filter(n => n.name) }); return true;
    }
    if (p === '/api/forge/ideas') {
      const r = await load(data.id), cur = state(r);
      usage.check('ideas');
      const out = await withLock('text', BUSY, () => structured(
        `${settingBlock(r.setup)}
STORY SO FAR: ${cur.summary}
DIRECTOR'S BIBLE: ${JSON.stringify(cur.bible)}
CURRENT SHEET: ${JSON.stringify(cur.sheet)}
LATEST CHAPTER: ${r.chapters.at(-1) ? plain(r.chapters.at(-1)) : ''}
Pitch 4 exciting, distinct directions the story could take over the next few chapters: for example a new threat or species, a faction or rival, a mystery or twist, a companion or relationship development, a new place to explore. Each needs a punchy title (under 8 words) and a 1-2 sentence pitch written to the player ("you"). Fit the world, tone and rating, build on what has happened, and do not spoil the bible's secrets outright.`,
        'story_ideas', ideasSchema, 1500,
        'You are the story director for an interactive LitRPG. You pitch the player ideas for where their story could go next.'));
      const ideas = (out.ideas || []).slice(0, 4).map(i => ({ title: txt(i?.title, 80), pitch: txt(i?.pitch, 400) })).filter(i => i.title);
      usage.add('ideas');
      json(res, 200, { ideas }); return true;
    }
    if (p === '/api/forge/portrait') {
      const r = await load(data.id);
      usage.check('portrait');
      await withLock('image', 'A portrait is already being painted. Please wait.', () => paint(r));
      await save(r); usage.add('portrait');
      json(res, 200, { run: await view(r) }); return true;
    }
    if (p === '/api/forge/narrate') {
      const run = await load(data.id);
      usage.check('narration');
      const made = await withLock('audio', 'Narration is already being recorded. Please wait.', () => narrate(run, Number(data.chapter), Boolean(data.choices), Boolean(data.force)));
      if (made) usage.add('narration');
      // Save any new character voice assignments without clobbering other changes.
      const fresh = await load(run.id); fresh.cast = { ...(fresh.cast || {}), ...(run.cast || {}) }; await save(fresh);
      json(res, 200, { run: await view(fresh) }); return true;
    }
    json(res, 404, { error: 'Not found.' }); return true;
  };
}

// src/skillList.ts
export const SKILLS = [
  "Attack",
  "Constitution",
  "Mining",
  "Strength",
  "Agility",
  "Smithing",
  "Defence",
  "Herblore",
  "Fishing",
  "Ranged",
  "Thieving",
  "Cooking",
  "Prayer",
  "Crafting",
  "Firemaking",
  "Magic",
  "Fletching",
  "Woodcutting",
  "Runecrafting",
  "Slayer",
  "Farming",
  "Construction",
  "Hunter",
  "Summoning",
  "Dungeoneering",
  "Divination",
  "Invention",
  "Necromancy",
  "Archaeology"
] as const;

export type SkillName = (typeof SKILLS)[number];

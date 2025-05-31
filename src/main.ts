// src/main.ts

import "./styles.css";
import { SKILLS, type SkillName } from "./skillList";
import { buildCheckboxUI, updateCheckboxUI } from "./ui";

/**
 * We do NOT import alt1/base or alt1/chatbox via ESM.
 * Instead, at runtime Alt1 injects window.alt1. We’ll poll until it exists
 * and has requestAnimationFrame() before we ever call init().
 */
let alt1Api: any = null; // Will hold window.alt1 once injected

// A Set to track which skills have been marked complete
const completedSkills: Set<SkillName> = new Set<SkillName>();

// Sidebar HTML references
let checkboxListEl: HTMLUListElement;
let resetButtonEl: HTMLButtonElement;

// Overlay canvas & 2D rendering context
let overlayCanvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

/**
 * Called once alt1Api is available. Builds the sidebar UI and starts the loop.
 */
function init() {
  console.log("⚙️ Running init()");

  // 1) Grab sidebar container elements
  checkboxListEl = document.getElementById("checkbox-list") as HTMLUListElement;
  resetButtonEl  = document.getElementById("reset-btn")    as HTMLButtonElement;

  // 2) Build initial sidebar checkboxes
  buildCheckboxUI(SKILLS, completedSkills, checkboxListEl, onCheckboxToggle);

  // 3) “Reset All” clears the Set and updates the sidebar UI
  resetButtonEl.addEventListener("click", () => {
    completedSkills.clear();
    updateCheckboxUI(SKILLS, completedSkills, checkboxListEl);
  });

  // 4) Grab overlay canvas & 2D context
  overlayCanvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
  ctx = overlayCanvas.getContext("2d")!;

  // 5) Kick off the Alt1 loop
  alt1Api.requestAnimationFrame(mainLoop);
}

/**
 * Called whenever a user toggles a checkbox manually in the sidebar.
 */
function onCheckboxToggle(skill: SkillName, isChecked: boolean) {
  if (isChecked) completedSkills.add(skill);
  else            completedSkills.delete(skill);

  updateCheckboxUI(SKILLS, completedSkills, checkboxListEl);
}

/**
 * RegExp matching ANY “X/Y skills for your Jack of Trades aura.” Example:
 *   “You gain experience in Magic and have now completed 7/15 skills for your Jack of Trades aura.”
 *   “You gain experience in Thieving and have now completed 12/25 skills for your Jack of Trades aura.”
 * Captures the skill name in group 1.
 */
const jotRegex =
  /You gain experience in ([A-Za-z]+) and have now completed \d+\/\d+ skills for your Jack of Trades aura\./;

/**
 * Each frame, read up to 5 lines of chat (0=newest). If any matches jotRegex,
 * extract skill name and mark it completed.
 */
function pollChatboxForJoT() {
  const chatboxApi = alt1Api.chatbox;

  for (let i = 0; i < 5; i++) {
    const line = chatboxApi.getChatLine(i);
    if (!line) continue;

    const match = jotRegex.exec(line.text);
    if (match) {
      const skillName = match[1] as SkillName;
      if (SKILLS.includes(skillName) && !completedSkills.has(skillName)) {
        completedSkills.add(skillName);
        updateCheckboxUI(SKILLS, completedSkills, checkboxListEl);
      }
    }
  }
}

/**
 * Stub for locating a skill icon on screen. Returns dummy coords so we can test overlay.
 * Replace this with real alt1Api.image.findSubimage() logic later.
 */
async function findSkillIconPosition(
  skill: SkillName
): Promise<{ x: number; y: number; w: number; h: number }> {
  return {
    x: 50 + SKILLS.indexOf(skill) * 40,
    y: 100,
    w: 32,
    h: 32,
  };
}

/**
 * Clears the overlay canvas, then draws a red rectangle over each completed skill’s icon.
 */
async function highlightCompletedSkills() {
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  for (const skill of completedSkills) {
    const { x, y, w, h } = await findSkillIconPosition(skill);
    if (w > 0 && h > 0) {
      ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
    }
  }
}

/**
 * The main Alt1 loop (~60 FPS): resize canvas, poll chat, draw overlays, schedule next frame.
 */
function mainLoop() {
  // a) Resize overlay canvas to match the game window
  const w = alt1Api.canvasWidth();
  const h = alt1Api.canvasHeight();
  if (overlayCanvas.width !== w || overlayCanvas.height !== h) {
    overlayCanvas.width  = w;
    overlayCanvas.height = h;
  }

  // b) Poll chatbox for Jack of Trades lines
  pollChatboxForJoT();

  // c) Draw red rectangles over completed skills
  highlightCompletedSkills();

  // d) Schedule next frame
  alt1Api.requestAnimationFrame(mainLoop);
}

/**
 * Called on DOMContentLoaded. We keep checking every 500 ms until
 * window.alt1 exists AND window.alt1.requestAnimationFrame is a function.
 * Only then do we assign alt1Api = window.alt1 and call init().
 */
window.addEventListener("DOMContentLoaded", () => {
  function waitForAlt1() {
    if (typeof (window as any).alt1 !== "undefined" &&
        typeof (window as any).alt1.requestAnimationFrame === "function") {
      alt1Api = (window as any).alt1;
      console.log("🔵 Alt1 detected. Starting init().");
      init();
    } else {
      console.log("⏳ Waiting for Alt1... (window.alt1 =", (window as any).alt1, ")");
      setTimeout(waitForAlt1, 500);
    }
  }

  waitForAlt1();
});

// src/main.ts

import "./styles.css";
import { SKILLS, type SkillName } from "./skillList";
import { buildCheckboxUI, updateCheckboxUI } from "./ui";

/**
 * We do NOT import alt1/base or alt1/chatbox via ESM.
 * Instead, at runtime Alt1 injects window.alt1. We poll until it exists
 * and provides screenWidth(), screenHeight(), and chatbox.getChatLine().
 */
let alt1Api: any = null; // Will hold window.alt1 once injected

// A Set tracking which skills have been marked complete
const completedSkills: Set<SkillName> = new Set<SkillName>();

// Sidebar HTML references
let checkboxListEl: HTMLUListElement;
let resetButtonEl: HTMLButtonElement;

// Overlay canvas & 2D rendering context
let overlayCanvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

/**
 * Called once alt1Api (window.alt1) is available. Builds UI and starts the loop.
 */
function init() {
  console.log("⚙️ Running init()");

  // 1) Grab sidebar container elements
  checkboxListEl = document.getElementById("checkbox-list") as HTMLUListElement;
  resetButtonEl  = document.getElementById("reset-btn")    as HTMLButtonElement;

  // 2) Build initial sidebar checkboxes (all start unchecked)
  buildCheckboxUI(SKILLS, completedSkills, checkboxListEl, onCheckboxToggle);

  // 3) “Reset All” clears the Set and updates the sidebar UI
  resetButtonEl.addEventListener("click", () => {
    completedSkills.clear();
    updateCheckboxUI(SKILLS, completedSkills, checkboxListEl);
  });

  // 4) Grab overlay canvas & its 2D context
  overlayCanvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
  ctx = overlayCanvas.getContext("2d")!;

  // 5) Kick off our mainLoop via the browser’s requestAnimationFrame
  window.requestAnimationFrame(mainLoop);
}

/**
 * Callback when the user manually toggles a checkbox in the sidebar.
 */
function onCheckboxToggle(skill: SkillName, isChecked: boolean) {
  if (isChecked) completedSkills.add(skill);
  else            completedSkills.delete(skill);

  updateCheckboxUI(SKILLS, completedSkills, checkboxListEl);
}

/**
 * RegExp to match ANY “X/Y skills for your Jack of Trades aura.”
 * Examples:
 *   “You gain experience in Magic and have now completed 7/15 skills for your Jack of Trades aura.”
 *   “You gain experience in Cooking and have now completed 12/25 skills for your Jack of Trades aura.”
 * Captures the skill name in group 1.
 */
const jotRegex =
  /You gain experience in ([A-Za-z]+) and have now completed \d+\/\d+ skills for your Jack of Trades aura\./;

/**
 * Each frame, read up to 5 lines of chat (0=newest). If any match jotRegex,
 * extract the skill name and mark it complete.
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
 * Stub for locating a skill icon on screen. Returns dummy coords so
 * we can test overlay drawing. Later, replace with real image‐matching:
 *
 *   const iconImg = await alt1Api.image.loadFile(`skill-icons/${skill}-icon.png`);
 *   const found   = await alt1Api.image.findSubimage(iconImg, 0.85);
 *   if (found) return { x: found.x, y: found.y, w: iconImg.width, h: iconImg.height };
 *   else       return { x: 0, y: 0, w: 0, h: 0 };
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
 * Clears the overlay canvas, then draws a red rectangle over each
 * completed skill’s icon (using dummy coords for now).
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
 * Our main loop, called ~60 FPS via window.requestAnimationFrame.
 * 1) Resize our overlay canvas if the game window size changed
 * 2) Poll the chatbox for new Jack of Trades messages
 * 3) Draw red rectangles over any completed skills
 * 4) Schedule the next frame
 */
function mainLoop() {
  // a) Resize the overlay canvas to match the client window
  const w = alt1Api.screenWidth();   // use screenWidth() instead of canvasWidth()
  const h = alt1Api.screenHeight();  // use screenHeight() instead of canvasHeight()
  if (overlayCanvas.width !== w || overlayCanvas.height !== h) {
    overlayCanvas.width  = w;
    overlayCanvas.height = h;
  }

  // b) Poll chatbox for Jack of Trades lines
  pollChatboxForJoT();

  // c) Draw overlays for completed skills
  highlightCompletedSkills();

  // d) Schedule the next frame
  window.requestAnimationFrame(mainLoop);
}

/**
 * Called on DOMContentLoaded. We keep checking every 500ms until
 * window.alt1 exists AND window.alt1.requestAnimationFrame is a function.
 * Only then do we assign alt1Api = window.alt1 and call init().
 */
window.addEventListener("DOMContentLoaded", () => {
  function waitForAlt1() {
    if (
      typeof (window as any).alt1 !== "undefined" &&
      typeof (window as any).alt1.screenWidth === "function" &&
      typeof (window as any).alt1.chatbox === "object"
    ) {
      // Alt1 has injected the runtime API. Grab it now:
      alt1Api = (window as any).alt1;
      console.log("🔵 Alt1 detected. Starting init().");
      init();
    } else {
      console.log(
        "⏳ Waiting for Alt1... (window.alt1 =",
        (window as any).alt1,
        ")"
      );
      setTimeout(waitForAlt1, 500);
    }
  }

  waitForAlt1();
});

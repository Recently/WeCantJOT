// src/main.ts

import "./styles.css";
import { SKILLS, type SkillName } from "./skillList";
import { buildCheckboxUI, updateCheckboxUI } from "./ui";

/**
 * We do NOT import any alt1/* modules via ES imports.
 * Instead, at runtime Alt1 injects a global window.alt1 object.
 * We’ll poll until window.alt1 is defined, then use it.
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
  // 1) Grab sidebar container elements from the DOM
  checkboxListEl = document.getElementById("checkbox-list") as HTMLUListElement;
  resetButtonEl  = document.getElementById("reset-btn")    as HTMLButtonElement;

  // 2) Build initial sidebar checkboxes (unchecked initially)
  buildCheckboxUI(SKILLS, completedSkills, checkboxListEl, onCheckboxToggle);

  // 3) “Reset All” clears the Set and updates checkboxes
  resetButtonEl.addEventListener("click", () => {
    completedSkills.clear();
    updateCheckboxUI(SKILLS, completedSkills, checkboxListEl);
  });

  // 4) Grab overlay canvas & 2D context
  overlayCanvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
  ctx = overlayCanvas.getContext("2d")!;

  // 5) Kick off the Alt1 loop (we know alt1Api.requestAnimationFrame exists now)
  alt1Api.requestAnimationFrame(mainLoop);
}

/**
 * Called whenever the user manually toggles a checkbox in the sidebar.
 */
function onCheckboxToggle(skill: SkillName, isChecked: boolean) {
  if (isChecked) completedSkills.add(skill);
  else            completedSkills.delete(skill);

  updateCheckboxUI(SKILLS, completedSkills, checkboxListEl);
}

/**
 * RegExp that matches ANY “X/Y skills for your Jack of Trades aura.”
 *   Example matches:
 *     “You gain experience in Magic and have now completed 5/15 skills for your Jack of Trades aura.”
 *     “You gain experience in Thieving and have now completed 12/25 skills for your Jack of Trades aura.”
 *
 * Captures the skill name in group 1.
 */
const jotRegex =
  /You gain experience in ([A-Za-z]+) and have now completed \d+\/\d+ skills for your Jack of Trades aura\./;

/**
 * Each frame, read the top few chat lines via alt1Api.chatbox.getChatLine(i).
 * If any line matches our jotRegex, extract the skill name and mark it complete.
 */
function pollChatboxForJoT() {
  const chatboxApi = alt1Api.chatbox;

  // Up to 5 lines per frame (0=newest, 4=older)
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
 * Stub that returns dummy coordinates for a given skill icon,
 * so we can test overlay drawing. Later, replace this with
 * real alt1Api.image.findSubimage(...) logic.
 */
async function findSkillIconPosition(
  skill: SkillName
): Promise<{ x: number; y: number; w: number; h: number }> {
  // Dummy horizontal row, 40px apart, at y=100
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
 * The main Alt1 loop (~60 FPS). We:
 *  1) Resize the overlay canvas if the game window size changed
 *  2) Poll chatbox for new Jack of Trades lines
 *  3) Draw red rectangles over completed skills
 *  4) Schedule the next frame
 */
function mainLoop() {
  // a) Resize overlay canvas to match game window size
  const w = alt1Api.canvasWidth();
  const h = alt1Api.canvasHeight();
  if (overlayCanvas.width !== w || overlayCanvas.height !== h) {
    overlayCanvas.width  = w;
    overlayCanvas.height = h;
  }

  // b) Check for new Jack of Trades messages
  pollChatboxForJoT();

  // c) Draw overlays for any completed skills
  highlightCompletedSkills();

  // d) Schedule next frame
  alt1Api.requestAnimationFrame(mainLoop);
}

/**
 * Called when DOMContentLoaded fires. We repeatedly check whether
 * window.alt1 exists. As soon as it does, we grab it into `alt1Api`
 * and call `init()`. Otherwise, we retry after 500ms.
 */
window.addEventListener("DOMContentLoaded", () => {
  function waitForAlt1() {
    if ((window as any).alt1) {
      // Once Alt1 has injected, store it in alt1Api
      alt1Api = (window as any).alt1;
      init();
    } else {
      setTimeout(waitForAlt1, 500);
    }
  }
  waitForAlt1();
});

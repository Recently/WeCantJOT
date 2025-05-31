// src/main.ts

import "./styles.css";
import { SKILLS, type SkillName } from "./skillList";
import { buildCheckboxUI, updateCheckboxUI } from "./ui";

/**
 * No ESM imports from "alt1/*"—we rely on the real runtime object injected into window.alt1.
 */
let alt1Api: any = null; // Will be set to window.alt1 once it’s ready

// Tracks which skills have been completed
const completedSkills: Set<SkillName> = new Set<SkillName>();

// Sidebar HTML references
let checkboxListEl: HTMLUListElement;
let resetButtonEl: HTMLButtonElement;

// Overlay canvas & 2D context
let overlayCanvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

/**
 * Called once alt1Api is fully available. Builds the sidebar UI and starts the main loop.
 */
function init() {
  console.log("⚙️ Running init()");

  // 1) Grab DOM elements for the sidebar
  checkboxListEl = document.getElementById("checkbox-list") as HTMLUListElement;
  resetButtonEl  = document.getElementById("reset-btn")    as HTMLButtonElement;

  // 2) Build initial sidebar checkboxes (all unchecked)
  buildCheckboxUI(SKILLS, completedSkills, checkboxListEl, onCheckboxToggle);

  // 3) Hook up the “Reset All” button
  resetButtonEl.addEventListener("click", () => {
    completedSkills.clear();
    updateCheckboxUI(SKILLS, completedSkills, checkboxListEl);
  });

  // 4) Grab the overlay canvas & 2D drawing context
  overlayCanvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
  ctx = overlayCanvas.getContext("2d")!;

  // 5) Kick off the main Alt1 loop using window.requestAnimationFrame
  window.requestAnimationFrame(mainLoop);
}

/**
 * Called when the user toggles a skill checkbox manually.
 */
function onCheckboxToggle(skill: SkillName, isChecked: boolean) {
  if (isChecked) completedSkills.add(skill);
  else            completedSkills.delete(skill);

  updateCheckboxUI(SKILLS, completedSkills, checkboxListEl);
}

/**
 * Matches ANY “You gain experience in [SKILL] and have now completed X/Y skills for your Jack of Trades aura.”
 *    e.g. “... have now completed 7/15 skills ...” or “... have now completed 12/25 skills ...”
 *
 * Captures the skill name in group 1.
 */
const jotRegex =
  /You gain experience in ([A-Za-z]+) and have now completed \d+\/\d+ skills for your Jack of Trades aura\./;

/**
 * Each frame, read up to 5 lines of chat (newest = index 0). If a line matches jotRegex,
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
 * Dummy stub for locating a skill icon’s on-screen position.
 * Returns example coordinates so we can test the overlay drawing.
 * Replace with alt1Api.image.findSubimage(...) once you want real matching.
 */
async function findSkillIconPosition(
  skill: SkillName
): Promise<{ x: number; y: number; w: number; h: number }> {
  // Just place them in a horizontal row, 40px apart, at y = 100
  return {
    x: 50 + SKILLS.indexOf(skill) * 40,
    y: 100,
    w: 32,
    h: 32,
  };
}

/**
 * Clears the overlay canvas, then draws a red rectangle over each completed skill icon.
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
 * The main loop (called ~60 FPS via window.requestAnimationFrame):
 *   a) Resize the overlay canvas to match the client window
 *   b) Poll the chatbox for new Jack of Trades messages
 *   c) Draw red rectangles over completed skills
 *   d) Request the next frame
 */
function mainLoop() {
  // a) Resize overlay canvas if game window size changed
  const w = alt1Api.screenWidth();   // getter property returning number
  const h = alt1Api.screenHeight();  // getter property returning number
  if (overlayCanvas.width !== w || overlayCanvas.height !== h) {
    overlayCanvas.width  = w;
    overlayCanvas.height = h;
  }

  // b) Poll chatbox
  pollChatboxForJoT();

  // c) Draw overlays
  highlightCompletedSkills();

  // d) Schedule next frame
  window.requestAnimationFrame(mainLoop);
}

/**
 * On DOMContentLoaded, repeatedly check (every 500 ms) until:
 *   – window.alt1 exists,
 *   – window.alt1.chatbox.getChatLine is a function,
 *   – window.alt1.screenWidth is a number—a sign that the API is fully ready.
 * Once all are true, grab alt1 into alt1Api and call init().
 */
window.addEventListener("DOMContentLoaded", () => {
  function waitForAlt1() {
    const wAlt = (window as any).alt1;
    if (
      typeof wAlt !== "undefined" &&
      typeof wAlt.chatbox === "object" &&
      typeof wAlt.chatbox.getChatLine === "function" &&
      typeof wAlt.screenWidth === "number"
    ) {
      // The real Alt1 API is ready:
      alt1Api = wAlt;
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

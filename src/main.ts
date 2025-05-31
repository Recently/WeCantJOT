// src/main.ts
import * as a1lib from "alt1";
import { ImgRefBind, ImgRefData } from "alt1";
import ChatBoxReader from "alt1/chatbox";

// List of all Jack‐of‐Trades skills
const skillNames = [
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
  "Runecraft",
  "Slayer",
  "Farming",
  "Construction",
  "Hunter",
  "Summoning",
  "Dungeoneering",
  "Divination",
  "Invention",
  "Necromancy",
  "Archaeology",
];

/**
 * Renders a simple “manual tracker” UI into <body>:
 *   - One checkbox per skill.
 *   - Saves each checkbox state to localStorage under key "jot-manual-<SkillName>".
 *   - Includes a “Reset All” button which clears all manual checkmarks.
 */
function renderManualTracker(): void {
  document.body.innerHTML = "";

  const container = document.createElement("div");
  container.id = "manualTracker";
  container.style.padding = "1rem";
  container.style.fontFamily = "sans-serif";

  const header = document.createElement("h2");
  header.innerText = "Manual Jack‐of‐Trades Tracker";
  container.appendChild(header);

  const desc = document.createElement("p");
  desc.innerText =
    "Alt1 is not available (or RS window is not linked). Use these checkboxes to track your Jack‐of‐Trades steps manually. Changes are saved in localStorage.";
  container.appendChild(desc);

  const form = document.createElement("div");
  form.style.display = "grid";
  form.style.gridTemplateColumns = "repeat(auto‐fill, minmax(150px, 1fr))";
  form.style.gap = "0.5rem";

  skillNames.forEach((name) => {
    const field = document.createElement("label");
    field.style.display = "flex";
    field.style.alignItems = "center";
    field.style.cursor = "pointer";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `chk‐${name}`;
    checkbox.style.marginRight = "0.5rem";

    const saved = localStorage.getItem(`jot‐manual‐${name}`);
    if (saved === "true") {
      checkbox.checked = true;
    }

    checkbox.addEventListener("change", () => {
      localStorage.setItem(`jot‐manual‐${name}`, checkbox.checked.toString());
    });

    field.appendChild(checkbox);
    field.appendChild(document.createTextNode(name));
    form.appendChild(field);
  });

  container.appendChild(form);

  const resetBtn = document.createElement("button");
  resetBtn.innerText = "Reset All";
  resetBtn.style.marginTop = "1rem";
  resetBtn.style.padding = "0.5rem 1rem";
  resetBtn.style.cursor = "pointer";
  resetBtn.addEventListener("click", () => {
    skillNames.forEach((n) => {
      localStorage.removeItem(`jot‐manual‐${n}`);
      const cb = document.getElementById(`chk‐${n}`) as HTMLInputElement | null;
      if (cb) cb.checked = false;
    });
  });
  container.appendChild(resetBtn);

  document.body.appendChild(container);
}

(async () => {
  // If Alt1 isn’t injected, or the game isn’t linked, show fallback checkboxes.
  if (!window.alt1 || typeof window.alt1.rsLinked !== "boolean") {
    console.warn("Alt1 not detected. Rendering manual‐tracker fallback.");
    renderManualTracker();
    return;
  }
  if (!window.alt1.rsLinked) {
    console.warn("RuneScape window is not linked. Showing manual fallback.");
    renderManualTracker();
    return;
  }

  console.log("✅ Alt1 injected and RS3 is linked.");

  // 1) Read the RS window’s rectangle
  const rsX = (window.alt1.rsX as number) || 0;
  const rsY = (window.alt1.rsY as number) || 0;
  const rsWidth = (window.alt1.rsWidth as number) || 0;
  const rsHeight = (window.alt1.rsHeight as number) || 0;
  console.log("rsX, rsY, rsWidth, rsHeight ➞", rsX, rsY, rsWidth, rsHeight);

  // 2) Bind the full RS window so we can capture OCR on demand
  let fullHandle: number;
  try {
    fullHandle = await window.alt1.bindRegion(rsX, rsY, rsWidth, rsHeight);
  } catch (bindErr: any) {
    console.error("Could not bind full RS window:", bindErr);
    renderManualTracker();
    return;
  }
  const fullImgRef = new ImgRefBind(fullHandle, rsX, rsY, rsWidth, rsHeight);
  console.log(">> BOUND fullImgRef:", fullImgRef);

  // 3) Take a one‐time snapshot of the full RS window => ImgRefData
  let fullSnapshot: ImgRefData;
  try {
    // We cast to ImgRefData because TS currently thinks .read(...) returns ImageData
    fullSnapshot = (await fullImgRef.read(0, 0, rsWidth, rsHeight)) as unknown as ImgRefData;
  } catch (readErr: any) {
    console.error("Could not read fullImgRef:", readErr);
    renderManualTracker();
    return;
  }

  // 4) Use ChatBoxReader once on that snapshot to locate the chatbox UI
  const chatbox = new ChatBoxReader();
  let initData: any;
  try {
    initData = await chatbox.find(fullSnapshot);
  } catch (chatErr: any) {
    console.error("Initial chatbox.find(...) failed:", chatErr);
    renderManualTracker();
    return;
  }
  if (!initData || !chatbox.pos || !chatbox.pos.mainbox) {
    console.error(
      "ChatBoxReader failed to locate chat UI. Fallback to manual tracker."
    );
    renderManualTracker();
    return;
  }
  console.log(">> chatbox.find(fullSnapshot) returned:", initData);
  console.log(">> chatbox.pos:", chatbox.pos);

  // 5) We no longer need the full bind anymore
  window.alt1.clearBinds?.();

  // 6) Compute the small “chat strip” region based on chatbox.pos.mainbox
  const mbRect = chatbox.pos.mainbox.rect; // { x, y, width, height } in RS coords
  const mbBot = chatbox.pos.mainbox.botleft; // { x, y } in RS coords
  const chatHeight = 30; // fix to 30px high
  const chatX = rsX + mbRect.x;
  const chatY = rsY + mbBot.y - chatHeight;
  const chatWidth = mbBot.x - mbRect.x;
  console.log("→ chat‐only region:", { chatX, chatY, chatWidth, chatHeight });

  // 7) Bind just that small chat area so we can run OCR every frame
  let chatHandle: number;
  try {
    chatHandle = await window.alt1.bindRegion(
      chatX,
      chatY,
      chatWidth,
      chatHeight
    );
  } catch (bindErr: any) {
    console.error("Could not bind chat region:", bindErr);
    renderManualTracker();
    return;
  }
  const chatImgRef = new ImgRefBind(chatHandle, chatX, chatY, chatWidth, chatHeight);
  console.log(">> BOUND chatImgRef:", chatImgRef);

  // 8) Load all skill‐icon images from skill‐icons/*.png and build ImgRefData for each
  type Template = { name: string; iconRef: ImgRefData };
  const templates: Template[] = [];

  for (const name of skillNames) {
    // 8a) Create a DOM <img> to load the PNG file
    const imgEl = new Image();
    imgEl.src = `skill‐icons/${name}‐icon.png`;
    await new Promise<void>((resolve, reject) => {
      imgEl.onload = () => resolve();
      imgEl.onerror = () =>
        reject(new Error(`Failed to load skill‐icon: ${name}‐icon.png`));
    });

    // 8b) Convert that <img> into ImgRefData (force through “any” so TS is happy)
    const iconRef = new (ImgRefData as any)(imgEl as any) as ImgRefData;
    console.log(`→ Loaded ImgRefData("${name}") w=${imgEl.width}`);

    templates.push({ name, iconRef });
  }
  console.log(
    `→ Loaded ${templates.length}/${skillNames.length} skill‐icon templates.`
  );

  // 9) One‐time template‐match of each skill icon on the *full* RS window
  //     (we “read” the full window again since we need pixel data for template matching).
  //     We kept fullImgRef bound until now, so we can do findSubimage() on it.
  const skillMap: Record<string, { x: number; y: number }> = {};
  for (const { name, iconRef } of templates) {
    try {
      const hits = await (fullImgRef as any).findSubimage(iconRef as any, 0.9);
      if (hits.length > 0) {
        const absX = rsX + hits[0].x;
        const absY = rsY + hits[0].y;
        skillMap[name] = { x: absX, y: absY };
        console.log(`Found "${name}" icon at screen coords:`, { absX, absY });
      } else {
        console.warn(`Could not locate "${name}" icon on screen.`);
      }
    } catch (subErr: any) {
      console.error(`Error matching "${name}" icon:`, subErr);
    }
  }

  const doneSkills = new Set<string>();
  console.log("→ skillMap keys:", Object.keys(skillMap));

  // 10) Every animation frame, OCR the small chat strip to look for JOT messages.
  function loop(): void {
    chatbox
      // We must again cast to ImgRefData so TS is happy
      .find((chatImgRef.read(0, 0, chatWidth, chatHeight) as unknown) as ImgRefData)
      .then((chatData: any) => {
        if (chatData && Array.isArray(chatData.rawWords)) {
          for (const token of chatData.rawWords as string[]) {
            // match “You gain experience in <Skill> and have now completed …”
            const m = token.match(
              /You\s+gain\s+experience\s+in\s+(\w+)\s+and\s+have\s+now\s+completed/
            );
            if (m) {
              const skillName = m[1];
              if (!doneSkills.has(skillName) && skillMap[skillName]) {
                doneSkills.add(skillName);
                const { x: absX, y: absY } = skillMap[skillName];

                // Overlay a red “✘” at (absX, absY) for 2 seconds
                const ov: any = a1lib;
                ov.overlay.clearGroup("skills");
                ov.overlay.setGroup("skills");
                // RGBA = 0xRRGGBBAA: red=255, alpha=255 = 0xFF0000FF
                ov.overlay.text("✘", 0xFF0000FF, 16, absX, absY, 2000);
                ov.overlay.refreshGroup("skills");

                console.log(`Marked "${skillName}" at (${absX}, ${absY})`);
              }
            }
          }
        }
        window.requestAnimationFrame(loop);
      })
      .catch((err: any) => {
        console.error("Error during per‐frame chat.find:", err);
        window.requestAnimationFrame(loop);
      });
  }

  console.log("✅ Overlay + ChatBoxReader ready. Listening for chat…");
  window.requestAnimationFrame(loop);
})();

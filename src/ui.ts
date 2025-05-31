// src/ui.ts
import { type SkillName } from "./skillList";

/**
 * Build the HTML checkboxes under #skill-checkboxes ul.
 * - `skills`: array of all skill names
 * - `selected`: Set<SkillName> of currently completed skills
 * - `listEl`: the <ul> element to append <li> items to
 * - `onToggle`: callback (skill, isChecked) when user toggles one
 */
export function buildCheckboxUI(
  skills: readonly SkillName[],
  selected: Set<SkillName>,
  listEl: HTMLUListElement,
  onToggle: (skill: SkillName, isChecked: boolean) => void
) {
  listEl.innerHTML = ""; // clear

  skills.forEach((skill) => {
    const li = document.createElement("li");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `chk-${skill}`;
    checkbox.checked = selected.has(skill);
    checkbox.addEventListener("change", () => {
      onToggle(skill, checkbox.checked);
    });

    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = skill;

    li.appendChild(checkbox);
    li.appendChild(label);
    listEl.appendChild(li);
  });
}

/**
 * Update the checked state of all existing checkboxes.
 * Call this whenever `selected` changes.
 */
export function updateCheckboxUI(
  skills: readonly SkillName[],
  selected: Set<SkillName>,
  listEl: HTMLUListElement
) {
  skills.forEach((skill) => {
    const checkbox = document.getElementById(`chk-${skill}`) as HTMLInputElement | null;
    if (checkbox) {
      checkbox.checked = selected.has(skill);
    }
  });
}

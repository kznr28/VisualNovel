/* global Monogatari, monogatari */
'use strict';

// Monogatari saves a numeric step in each label. Attach sprite directions to
// the existing playable steps so saves from before the art update still work.
const characterSteps = new Map();
const stagedCharacters = new Set();

function scriptWithCharacterCues(labels) {
  const script = {};
  for (const [label, lines] of Object.entries(labels)) {
    const steps = [];
    const directions = [];
    const active = new Map();
    for (const line of lines) {
      const cue = typeof line === 'string' && line.match(/^(?:show|hide) character ([\w-]+)(?: |$)/);
      if (cue) {
        stagedCharacters.add(cue[1]);
        active.set(cue[1], line);
      } else {
        if (typeof line === 'string' && line.startsWith('show scene ')) active.clear();
        steps.push(line);
        directions.push(new Map(active));
      }
    }
    script[label] = steps;
    characterSteps.set(label, directions);
  }
  return script;
}

class CharacterStage extends Monogatari.Action {
  static id = 'CharacterStage';
  static loadingOrder = 9; // Restore after the engine has restored scene and sprites.

  static async renderStep(step) {
    const directions = characterSteps.get(monogatari.state('label'))?.[step];
    if (!directions) return;

    for (const id of stagedCharacters) {
      const cue = directions.get(id) || `hide character ${id}`;
      const visible = document.querySelector(`[data-screen="game"] [data-character="${id}"]:not([data-visibility="invisible"])`);
      if (cue.startsWith('hide') ? !visible : visible && monogatari.state('characters').includes(cue)) continue;

      const action = monogatari.prepareAction(cue, { cycle: 'Application' });
      await action.willApply();
      await action.apply();
      // Each step already knows its sprite. Keep native save state without
      // appending redundant character history when loading or rolling back.
      await action.didApply({ updateHistory: false, updateState: true });
    }
  }

  static afterRun({ advance }) {
    return advance ? Promise.resolve() : this.renderStep(monogatari.state('step'));
  }

  static afterRevert({ advance, step }) {
    // The engine decrements the step after these hooks have resolved.
    return advance ? Promise.resolve() : this.renderStep(monogatari.state('step') - Number(step));
  }

  static onLoad() {
    return this.renderStep(monogatari.state('step'));
  }
}

monogatari.registerAction(CharacterStage);

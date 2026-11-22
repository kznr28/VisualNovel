/* global monogatari */
'use strict';

monogatari.assets('music', {
  title_theme: 'title_theme.mp3',
  library_twilight: 'library_twilight.mp3',
  rooftop_night: 'rooftop_night.mp3',
  library_night: 'library_night.mp3'
});

// Keep artwork available offline, but fetch each score only when first used.
monogatari.action('Preload').blocks({
  default: {
    scenes: ['library_twilight', 'rooftop_night', 'library_night'],
    characters: Object.fromEntries(Object.entries(monogatari.characters()).map(
      ([id, character]) => [id, Object.keys(character.sprites || {})]
    ))
  }
});

const sceneMusic = {
  'library_twilight.webp': 'library_twilight',
  'rooftop_night.webp': 'rooftop_night',
  'library_night.webp': 'library_night'
};

// Scene already persists and rolls back its own statement. Derive the BGM
// from it (including legacy colour aliases) without inserting numbered steps.
async function syncSceneMusic(scene) {
  const image = scene && monogatari.asset('scenes', scene);
  const wanted = sceneMusic[image];
  const players = monogatari.mediaPlayers('music', true);
  if (wanted && players[wanted]) return;

  // These native actions only perform playback. Scene owns persistence, so
  // no separate Play/Stop history is needed when a slot is restored.
  async function apply(statement) {
    const action = monogatari.prepareAction(statement, { cycle: 'Application' });
    await action.willApply();
    await action.apply();
  }

  for (const track of Object.values(sceneMusic)) {
    if (players[track]) await apply(`stop music ${track} with fade 0.25`);
  }
  if (wanted) {
    await apply(`play music ${wanted} with loop`);
    // The MP3 carries its entrance fade. Honour a slider change made while
    // the native player was downloading or decoding the track.
    monogatari.mediaPlayer('music', wanted).volume = Number(monogatari.preference('Volume').Music);
  }
}

// Resume within the initiating gesture, before fetching/decoding loses the
// activation on browsers with stricter autoplay rules.
document.addEventListener('click', event => {
  const context = monogatari.audioContext;
  if (!context || context.state === 'running' || !event.isTrusted) return;
  if (event.target.closest?.('[data-action="start"], load-screen save-slot, game-screen')) {
    context.resume().catch(error => console.warn('Audio resume deferred', error));
  }
}, true);

let musicUpdate = Promise.resolve();
function queueSceneMusic(scene) {
  musicUpdate = musicUpdate.then(() => syncSceneMusic(scene)).catch(error => {
    // A missing offline asset must not block this scene or a later transition.
    console.warn(`Could not update scene music (${scene || 'reset'})`, error);
  });
  return musicUpdate;
}

const Scene = monogatari.action('Scene');
class ScoredScene extends Scene {
  static async reset() {
    // A load or quit may arrive while Play is still decoding the old scene.
    await queueSceneMusic();
    await super.reset();
  }

  static async onLoad() {
    monogatari.stopAmbient();
    document.querySelectorAll('[data-content="allow-playback"]').forEach(prompt => prompt.remove());
    await super.onLoad();
  }

  async didApply(options) {
    const result = await super.didApply(options);
    await queueSceneMusic(this.scene);
    return result;
  }

  async didRevert() {
    const result = await super.didRevert();
    await queueSceneMusic(monogatari.state('scene').split(' ')[2]);
    return result;
  }
}
monogatari.unregisterAction('Scene');
monogatari.registerAction(ScoredScene);

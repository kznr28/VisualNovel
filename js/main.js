'use strict';
/* global Monogatari, monogatari */

const { $_ready } = Monogatari;

// Localize the title even for returning players with the original English UI
// preference. Keep Monogatari's button actions and stored preferences intact.
const titleLabels = {
	TitleStart: 'はじめから',
	TitleLoad: 'ロード',
	TitleSettings: '設定',
	TitleHelp: '遊び方',
	AllowPlayback: '音楽を再生',
	NewContent: '更新があります。タップして再読み込み'
};
for (const language of ['日本語', 'English']) {
	monogatari.translation(language, titleLabels);
}
const menu = monogatari.configuration('main-menu');
const titleKeys = { Start: 'TitleStart', Load: 'TitleLoad', Settings: 'TitleSettings', Help: 'TitleHelp' };
monogatari.configuration('main-menu', {
	buttons: menu.buttons.map(button => ({ ...button, string: titleKeys[button.string] || button.string }))
});

monogatari.debug.level(5);
$_ready(() => {
	// The engine inserts a clickable broadcast after an autoplay rejection.
	// A native button also activates its delegated click handler via keyboard.
	const root = document.querySelector('visual-novel');
	// When autoplay was blocked, let the first title interaction activate the
	// engine's existing retry within the same browser gesture. Start goes
	// directly to the scene score and the playback button handles itself.
	const playbackPrompt = '[data-content="allow-playback"]';
	root.addEventListener('click', event => {
		if (!event.isTrusted || !event.target.closest?.('main-screen.active')) return;
		if (event.target.closest('[data-action="start"]')) return;
		root.querySelector(playbackPrompt)?.click();
	}, true);

	const observer = new MutationObserver(records => {
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (!node.matches?.(playbackPrompt)) continue;
				const button = document.createElement('button');
				button.type = 'button';
				button.textContent = monogatari.string('AllowPlayback');
				node.replaceChildren(button);
			}
		}
	});
	observer.observe(root, { childList: true });
	monogatari.init('#monogatari');
});

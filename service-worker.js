'use strict';

// The name of your game, no spaces or special characters.
const name = 'Monogatari';

// The cache version.
const version = '0.1.3';

// Name of the Cache Storage bucket this worker owns.
const cacheName = `${name}-v${version}`;

// Bump this revision when replacing an MP3 with the same filename.
const musicCache = 'VisualNovel-music-v1';

// Files precached on install so the game can boot offline. Game media
// other than the title artwork and app icons is cached on demand at runtime.
const files = [

	'./',

	// General Files
	'manifest.json',

	// Engine Files
	'engine/core/monogatari.css',
	'engine/core/monogatari.js',

	// HTML Files
	'index.html',

	// Style Sheets
	'style/main.css',

	// JavaScript Files
	'js/options.js',
	'js/storage.js',
	'js/script.js',
	'js/character-cues.js',
	'js/main.js',
	'js/music.js',

	// App Images
	'favicon.ico',
	'assets/icons/hoshi-180.png',
	'assets/icons/hoshi-192.png',
	'assets/icons/hoshi-512.png',
	'assets/scenes/rooftop_night.webp'
];

// Offline fallback, only ever returned for navigations that can't be served
// from network or cache.
function offlinePage () {
	return new Response (`
		<!DOCTYPE html><html lang=en><title>Bad Request</title><meta charset=UTF-8><meta content="width=device-width,initial-scale=1"name=viewport><style>body,html{width:100%;height:100%}body{text-align:center;color:#545454;margin:0;display:flex;justify-content:center;align-items:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,"Open Sans","Fira Sans","Droid Sans","Helvetica Neue",sans-serif}h1,h2{font-weight:lighter}h1{font-size:4em}h2{font-size:2em}</style><div><h1>Service Unavailable</h1><h2>Sorry, the server is currently unavailable or under maintenance, try again later.</h2></div>
	`, {
		status: 503,
		statusText: 'Service Unavailable',
		headers: new Headers ({
			'Content-Type': 'text/html'
		})
	});
}

// Only store our own successful, non-opaque responses. This keeps 404/500
// pages and opaque cross-origin responses out of the cache.
function isCacheable (request, response) {
	return (
		request.method === 'GET' &&
		!!response &&
		response.status === 200 &&
		response.type === 'basic'
	);
}

function putInCache (request, response) {
	if (!isCacheable (request, response)) {
		return;
	}

	const copy = response.clone ();
	caches.open (cacheName).then ((cache) => cache.put (request, copy));
}

// Network-first: prefer fresh, fall back to cache, then the offline page for
// navigations. Used for HTML/navigations and anything uncategorised so code and
// markup updates reach players as soon as they are online.
async function networkFirst (request) {
	try {
		const response = await fetch (request);
		putInCache (request, response);
		return response;
	} catch (error) {
		const cached = await caches.match (request);

		if (cached) {
			return cached;
		}

		if (request.mode === 'navigate') {
			return offlinePage ();
		}

		throw error;
	}
}

// Stale-while-revalidate: serve cache immediately for speed, refresh it in the
// background for the next load. Used for engine and game code so updates land
// without anyone having to bump the cache version.
async function staleWhileRevalidate (request) {
	const cached = await caches.match (request);

	const network = fetch (request)
		.then ((response) => {
			putInCache (request, response);
			return response;
		})
		.catch (() => undefined);

	const response = cached || (await network);

	if (response) {
		return response;
	}

	if (request.mode === 'navigate') {
		return offlinePage ();
	}

	// Both cache and network failed: surface a real network error.
	return Response.error ();
}

// Cache-first: serve from cache, fetch and store on a miss. Used for large,
// effectively immutable game media under assets/.
async function cacheFirst (request) {
	const cached = await caches.match (request);

	if (cached) {
		return cached;
	}

	try {
		const response = await fetch (request);
		putInCache (request, response);
		return response;
	} catch (error) {
		if (request.mode === 'navigate') {
			return offlinePage ();
		}

		throw error;
	}
}

// Store one complete MP3 per URL. The menu's HTML audio element can request
// byte ranges, while the story's Web Audio player requests the entire file.
async function serveMusic (request) {
	const cache = await caches.open (musicCache);
	let audio = await cache.match (request.url);
	if (!audio) {
		// On first install a streaming player may already be using the network.
		// Finish its open stream there instead of fetching a second full copy.
		const range = request.headers.get ('Range');
		if (range && !range.startsWith ('bytes=0-')) return fetch (request);
		audio = await fetch (request.url);
		if (audio.status !== 200) return audio;
		try {
			await cache.put (request.url, audio.clone ());
		} catch (error) {
			// Playback can still proceed when persistent storage is full.
			console.warn ('Music cache unavailable', error);
		}
	}

	const range = request.headers.get ('Range');
	if (!range) return audio;
	const match = /^bytes=(\d*)-(\d*)$/.exec (range);
	if (!match || (!match[1] && !match[2])) return audio;

	const blob = await audio.blob ();
	const start = match[1] ? Number (match[1]) : Math.max (0, blob.size - Number (match[2]));
	const end = match[1] && match[2] ? Math.min (Number (match[2]), blob.size - 1) : blob.size - 1;
	if (start > end || start >= blob.size) {
		return new Response (null, { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } });
	}
	return new Response (blob.slice (start, end + 1), {
		status: 206,
		headers: {
			'Content-Type': 'audio/mpeg',
			'Accept-Ranges': 'bytes',
			'Content-Range': `bytes ${start}-${end}/${blob.size}`,
			'Content-Length': String (end - start + 1)
		}
	});
}

self.addEventListener ('install', (event) => {
	self.skipWaiting ();
	event.waitUntil (
		caches.open (cacheName).then ((cache) => {
			return cache.addAll (files.map (url => new Request (url, { cache: 'reload' })));
		})
	);
});

self.addEventListener ('activate', (event) => {
	event.waitUntil (
		caches.keys ().then ((keyList) => {
			return Promise.all (keyList.map ((key) => {
				// Drop only this worker's own outdated caches; leave any other
				// Cache Storage buckets untouched.
				if ((key.startsWith (`${name}-v`) && key !== cacheName) ||
					(key.startsWith ('VisualNovel-music-v') && key !== musicCache)) {
					return caches.delete (key);
				}
			}));
		}).then (() => self.clients.claim ())
	);
});

self.addEventListener ('fetch', (event) => {
	const { request } = event;

	if (request.method !== 'GET') {
		return;
	}

	// Navigations / documents: network-first so fresh markup and CSP reach
	// players immediately, with a cache (then offline page) fallback.
	if (request.mode === 'navigate') {
		event.respondWith (networkFirst (request));
		return;
	}

	const url = new URL (request.url);
	const sameOrigin = url.origin === self.location.origin;

	if (sameOrigin) {
		if (url.pathname.startsWith (new URL ('assets/music/', self.registration.scope).pathname)) {
			event.respondWith (serveMusic (request));
			return;
		}

		// Game media: cache-first (large and effectively immutable per release).
		if (url.pathname.startsWith (new URL ('assets/', self.registration.scope).pathname)) {
			event.respondWith (cacheFirst (request));
			return;
		}

		// Engine + game code (JS/CSS outside assets/): stale-while-revalidate so
		// updates land on the next load without a version bump.
		if (/\.(?:js|css)$/.test (url.pathname)) {
			event.respondWith (staleWhileRevalidate (request));
			return;
		}
	}

	// Everything else (manifest, favicon, cross-origin requests, ...).
	event.respondWith (networkFirst (request));
});

// Message handlers for communication with main thread
// Message format: { type: string, data: object }
// Response format varies by type
self.addEventListener ('message', async (event) => {
	const { type, data } = event.data || {};
	const respond = (response, transfer) => {
		event.ports[0]?.postMessage (response, transfer);
	};

	switch (type) {
		// Cache multiple assets on demand
		// data: { urls: string[] }
		// response: { success: boolean, cached?: number, total?: number, error?: string }
		case 'CACHE_ASSETS': {
			const { urls } = data || {};
			if (!Array.isArray (urls)) {
				respond ({ success: false, error: 'urls must be an array' });
				return;
			}
			try {
				const cache = await caches.open (cacheName);
				const results = await Promise.allSettled (
					urls.map ((assetUrl) => cache.add (assetUrl))
				);
				const successCount = results.filter ((r) => r.status === 'fulfilled').length;
				respond ({ success: true, cached: successCount, total: urls.length });
			} catch (error) {
				respond ({ success: false, error: error.message });
			}
			break;
		}

		// Check if a single asset is in cache
		// data: { url: string }
		// response: { cached: boolean, error?: string }
		case 'CHECK_CACHE': {
			const { url } = data || {};
			if (!url) {
				respond ({ cached: false, error: 'url is required' });
				return;
			}
			try {
				const cache = await caches.open (cacheName);
				const response = await cache.match (url);
				respond ({ cached: !!response });
			} catch (error) {
				respond ({ cached: false, error: error.message });
			}
			break;
		}

		// Get raw cached response for an asset (for decoding)
		// data: { url: string }
		// response: { found: boolean, data?: ArrayBuffer, error?: string }
		case 'GET_CACHED': {
			const { url } = data || {};
			if (!url) {
				respond ({ found: false, error: 'url is required' });
				return;
			}
			try {
				const cache = await caches.open (cacheName);
				const response = await cache.match (url);
				if (response) {
					const arrayBuffer = await response.arrayBuffer ();
					respond ({ found: true, data: arrayBuffer }, [arrayBuffer]);
				} else {
					respond ({ found: false });
				}
			} catch (error) {
				respond ({ found: false, error: error.message });
			}
			break;
		}

		default:
			respond ({ error: `Unknown message type: ${type}` });
	}
});

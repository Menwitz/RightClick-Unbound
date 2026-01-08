(function() {
	'use strict';

	if (typeof window === 'undefined') {
		return;
	}

	function ensureOverlayStyle() {
		if (document.getElementById('rcu-overlay-style')) {
			return;
		}
		var style = document.createElement('style');
		style.id = 'rcu-overlay-style';
		style.textContent = `
			[data-rcu-overlay-muted] {
				pointer-events: none !important;
			}
		`;
		(document.head || document.documentElement).appendChild(style);
	}

	function parseAlpha(color) {
		if (!color) {
			return 1;
		}
		if (color === 'transparent') {
			return 0;
		}
		var match = color.match(/rgba?\(([^)]+)\)/i);
		if (!match) {
			return 1;
		}
		var parts = match[1].split(',').map(function(part) {
			return part.trim();
		});
		if (parts.length < 4) {
			return 1;
		}
		var alpha = parseFloat(parts[3]);
		return isNaN(alpha) ? 1 : alpha;
	}

	function hasPaywallKeywords(text) {
		if (!text) {
			return false;
		}
		var lowered = text.toLowerCase();
		return lowered.indexOf('subscribe') !== -1 ||
			lowered.indexOf('sign in') !== -1 ||
			lowered.indexOf('log in') !== -1 ||
			lowered.indexOf('login') !== -1 ||
			lowered.indexOf('member') !== -1 ||
			lowered.indexOf('paywall') !== -1;
	}

	function isLikelyOverlay(element, rect, style) {
		if (style.display === 'none' || style.visibility === 'hidden') {
			return false;
		}
		if (style.pointerEvents === 'none') {
			return false;
		}
		if (style.position !== 'fixed' && style.position !== 'absolute') {
			return false;
		}
		if (rect.width < window.innerWidth * 0.5 || rect.height < window.innerHeight * 0.5) {
			return false;
		}
		var text = (element.textContent || '').trim();
		if (text.length > 80) {
			return false;
		}
		if (hasPaywallKeywords(text)) {
			return false;
		}
		if (element.querySelector && element.querySelector('input, button, form, video')) {
			return false;
		}
		var alpha = parseAlpha(style.backgroundColor);
		if (alpha > 0.2 && text.length > 0) {
			return false;
		}
		return true;
	}

	function muteOverlays() {
		ensureOverlayStyle();
		var candidates = document.body ? document.body.querySelectorAll('*') : [];
		var muted = 0;
		for (var i = 0; i < candidates.length; i++) {
			var el = candidates[i];
			if (!el || el.nodeType !== 1) {
				continue;
			}
			if (el.hasAttribute('data-rcu-overlay-muted')) {
				continue;
			}
			var rect = el.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) {
				continue;
			}
			var style = window.getComputedStyle(el);
			if (!style) {
				continue;
			}
			if (isLikelyOverlay(el, rect, style)) {
				el.setAttribute('data-rcu-overlay-muted', 'true');
				el.style.pointerEvents = 'none';
				el.style.userSelect = 'text';
				el.style.webkitUserSelect = 'text';
				el.style.MozUserSelect = 'text';
				el.style.msUserSelect = 'text';
				muted += 1;
			}
		}
		showToast(muted ? ('Muted ' + muted + ' overlay' + (muted > 1 ? 's' : '') + '.') : 'No removable overlays found.');
	}

	function showToast(message) {
		var existing = document.getElementById('rcu-overlay-toast');
		if (existing) {
			existing.remove();
		}
		var toast = document.createElement('div');
		toast.id = 'rcu-overlay-toast';
		toast.textContent = message;
		toast.style.position = 'fixed';
		toast.style.bottom = '18px';
		toast.style.left = '18px';
		toast.style.background = '#0b3d3e';
		toast.style.color = '#ffffff';
		toast.style.padding = '8px 12px';
		toast.style.borderRadius = '999px';
		toast.style.fontFamily = '"Avenir Next", "Avenir", "Gill Sans", "Trebuchet MS", sans-serif';
		toast.style.fontSize = '11px';
		toast.style.zIndex = '2147483647';
		toast.style.boxShadow = '0 12px 26px rgba(11, 61, 62, 0.18)';
		(document.body || document.documentElement).appendChild(toast);
		setTimeout(function() {
			if (toast && toast.parentNode) {
				toast.parentNode.removeChild(toast);
			}
		}, 2400);
	}

	muteOverlays();

})();

(function() {
	'use strict';

	if (typeof window === 'undefined') {
		return;
	}

	if (window.__rcuInspector && window.__rcuInspector.teardown) {
		window.__rcuInspector.teardown();
		return;
	}

	var state = {
		active: true,
		current: null
	};

	var style = document.createElement('style');
	style.id = 'rcu-inspector-style';
	style.textContent = `
		#rcu-inspector-box {
			position: fixed;
			border: 2px solid #f29559;
			background: rgba(242, 149, 89, 0.12);
			pointer-events: none;
			z-index: 2147483646;
			border-radius: 6px;
			box-shadow: 0 8px 18px rgba(11, 61, 62, 0.2);
		}
		#rcu-inspector-tip {
			position: fixed;
			max-width: 260px;
			background: #ffffff;
			border: 1px solid #e6ded5;
			border-radius: 8px;
			padding: 8px 10px;
			font-family: "Avenir Next", "Avenir", "Gill Sans", "Trebuchet MS", sans-serif;
			font-size: 11px;
			color: #0b3d3e;
			pointer-events: none;
			z-index: 2147483647;
			box-shadow: 0 12px 26px rgba(11, 61, 62, 0.18);
		}
		#rcu-inspector-tip .rcu-title {
			font-size: 10px;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: #7c7871;
		}
		#rcu-inspector-tip .rcu-line {
			margin-top: 4px;
			line-height: 1.3;
		}
		#rcu-inspector-tip .rcu-hint {
			margin-top: 6px;
			color: #7c7871;
		}
	`;
	(document.head || document.documentElement).appendChild(style);

	var box = document.createElement('div');
	box.id = 'rcu-inspector-box';
	var tip = document.createElement('div');
	tip.id = 'rcu-inspector-tip';
	(document.body || document.documentElement).appendChild(box);
	(document.body || document.documentElement).appendChild(tip);

	var unlockStyle = null;

	window.__rcuInspector = { teardown: teardown };

	function teardown() {
		state.active = false;
		document.removeEventListener('mousemove', handleMove, true);
		document.removeEventListener('click', handleClick, true);
		document.removeEventListener('keydown', handleKeydown, true);
		document.removeEventListener('scroll', handleScroll, true);
		window.removeEventListener('resize', handleScroll, true);
		if (box && box.parentNode) {
			box.parentNode.removeChild(box);
		}
		if (tip && tip.parentNode) {
			tip.parentNode.removeChild(tip);
		}
		if (style && style.parentNode) {
			style.parentNode.removeChild(style);
		}
		if (window.__rcuInspector) {
			delete window.__rcuInspector;
		}
	}

	function handleKeydown(event) {
		if (event.key === 'Escape') {
			teardown();
		}
	}

	function handleScroll() {
		if (!state.current || !state.current.element) {
			return;
		}
		updateHighlight(state.current);
	}

	function handleMove(event) {
		if (!state.active) {
			return;
		}
		var target = document.elementFromPoint(event.clientX, event.clientY);
		if (!target) {
			return;
		}
		var info = findBlockingElement(target);
		state.current = info;
		updateHighlight(info);
		updateTip(info, event.clientX, event.clientY);
	}

	function handleClick(event) {
		if (!state.active || !state.current || !state.current.element) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		unlockElement(state.current.element);
		updateTip(state.current, event.clientX, event.clientY, true);
	}

	function updateHighlight(info) {
		if (!info || !info.element) {
			return;
		}
		var rect = info.element.getBoundingClientRect();
		box.style.left = rect.left + 'px';
		box.style.top = rect.top + 'px';
		box.style.width = Math.max(rect.width, 4) + 'px';
		box.style.height = Math.max(rect.height, 4) + 'px';
	}

	function updateTip(info, x, y, clicked) {
		var label = elementLabel(info.element);
		var reasonText = formatReasons(info);
		var message = clicked ? 'Unlocked selection on this element.' : 'Click to unlock this element.';
		tip.innerHTML = `
			<div class="rcu-title">Lock Inspector</div>
			<div class="rcu-line"><strong>${label}</strong></div>
			<div class="rcu-line">${reasonText}</div>
			<div class="rcu-line rcu-hint">${message} Press Esc to exit.</div>
		`;
		var offset = 12;
		var tipRect = tip.getBoundingClientRect();
		var left = x + offset;
		var top = y + offset;
		if (left + tipRect.width > window.innerWidth) {
			left = x - tipRect.width - offset;
		}
		if (top + tipRect.height > window.innerHeight) {
			top = y - tipRect.height - offset;
		}
		tip.style.left = Math.max(8, left) + 'px';
		tip.style.top = Math.max(8, top) + 'px';
	}

	function elementLabel(element) {
		if (!element || !element.tagName) {
			return 'Unknown element';
		}
		var label = element.tagName.toLowerCase();
		if (element.id) {
			label += '#' + element.id;
		}
		if (element.classList && element.classList.length) {
			var classes = Array.prototype.slice.call(element.classList, 0, 2).join('.');
			if (classes) {
				label += '.' + classes;
			}
		}
		return label;
	}

	function getBlockingReasons(element) {
		var reasons = [];
		if (!element || !element.getAttribute) {
			return reasons;
		}
		var style = window.getComputedStyle(element);
		if (style) {
			if (style.userSelect === 'none' ||
				style.webkitUserSelect === 'none' ||
				style.MozUserSelect === 'none' ||
				style.msUserSelect === 'none') {
				reasons.push('user-select: none');
			}
		}
		if (element.getAttribute('oncontextmenu') || element.oncontextmenu) {
			reasons.push('contextmenu handler');
		}
		if (element.getAttribute('onselectstart') || element.onselectstart) {
			reasons.push('selectstart handler');
		}
		if (element.getAttribute('onmousedown') || element.onmousedown) {
			reasons.push('mousedown handler');
		}
		if (element.getAttribute('oncopy') || element.oncopy) {
			reasons.push('copy handler');
		}
		return reasons;
	}

	function findBlockingElement(start) {
		var current = start;
		while (current) {
			var reasons = getBlockingReasons(current);
			if (reasons.length) {
				return { element: current, reasons: reasons, isAncestor: current !== start };
			}
			if (!current.parentElement || current === document.documentElement) {
				break;
			}
			current = current.parentElement;
		}
		return { element: start, reasons: [], isAncestor: false };
	}

	function formatReasons(info) {
		if (!info || !info.reasons || !info.reasons.length) {
			return 'No obvious blockers detected.';
		}
		var suffix = info.isAncestor ? ' (ancestor)' : '';
		return 'Blockers: ' + info.reasons.map(function(reason) {
			return reason + suffix;
		}).join(', ');
	}

	function ensureUnlockStyle() {
		if (unlockStyle) {
			return;
		}
		unlockStyle = document.createElement('style');
		unlockStyle.id = 'rcu-unlock-style';
		unlockStyle.textContent = `
			[data-rcu-unlocked] {
				-webkit-user-select: text !important;
				-moz-user-select: text !important;
				-ms-user-select: text !important;
				user-select: text !important;
			}
		`;
		(document.head || document.documentElement).appendChild(unlockStyle);
	}

	function unlockElement(element) {
		if (!element) {
			return;
		}
		ensureUnlockStyle();
		element.setAttribute('data-rcu-unlocked', 'true');
		element.style.userSelect = 'text';
		element.style.webkitUserSelect = 'text';
		element.style.MozUserSelect = 'text';
		element.style.msUserSelect = 'text';
		element.oncontextmenu = null;
		element.onselectstart = null;
		element.onmousedown = null;
		element.oncopy = null;
		element.oncut = null;
		element.onpaste = null;
	}

	document.addEventListener('mousemove', handleMove, true);
	document.addEventListener('click', handleClick, true);
	document.addEventListener('keydown', handleKeydown, true);
	document.addEventListener('scroll', handleScroll, true);
	window.addEventListener('resize', handleScroll, true);

})();

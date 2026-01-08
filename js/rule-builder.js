(function() {
	'use strict';

	if (typeof window === 'undefined' || !chrome || !chrome.storage) {
		return;
	}

	if (window.__rcuRuleBuilder && window.__rcuRuleBuilder.teardown) {
		window.__rcuRuleBuilder.teardown();
		return;
	}

	var state = {
		active: true,
		current: null
	};

	var style = document.createElement('style');
	style.id = 'rcu-rule-builder-style';
	style.textContent = `
		#rcu-rule-builder-box {
			position: fixed;
			border: 2px solid #f29559;
			background: rgba(242, 149, 89, 0.12);
			pointer-events: none;
			z-index: 2147483646;
			border-radius: 6px;
			box-shadow: 0 8px 18px rgba(11, 61, 62, 0.2);
		}
		#rcu-rule-builder-tip {
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
		#rcu-rule-builder-tip .rcu-title {
			font-size: 10px;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: #7c7871;
		}
		#rcu-rule-builder-tip .rcu-line {
			margin-top: 4px;
			line-height: 1.3;
		}
		#rcu-rule-builder-tip .rcu-hint {
			margin-top: 6px;
			color: #7c7871;
		}
	`;
	(document.head || document.documentElement).appendChild(style);

	var box = document.createElement('div');
	box.id = 'rcu-rule-builder-box';
	var tip = document.createElement('div');
	tip.id = 'rcu-rule-builder-tip';
	(document.body || document.documentElement).appendChild(box);
	(document.body || document.documentElement).appendChild(tip);

	window.__rcuRuleBuilder = { teardown: teardown };

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
		if (window.__rcuRuleBuilder) {
			delete window.__rcuRuleBuilder;
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
		state.current = { element: target };
		updateHighlight(state.current);
		updateTip(state.current, event.clientX, event.clientY);
	}

	function handleClick(event) {
		if (!state.active || !state.current || !state.current.element) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		var selector = buildSelector(state.current.element);
		if (!selector) {
			showToast('Could not build a selector.');
			return;
		}
		var css = selector + ' {\n' +
			'  -webkit-user-select: text !important;\n' +
			'  -moz-user-select: text !important;\n' +
			'  -ms-user-select: text !important;\n' +
			'  user-select: text !important;\n' +
			'}\n';
		saveDraft(css);
		applyPreview(css);
		updateTip(state.current, event.clientX, event.clientY, selector);
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

	function updateTip(info, x, y, selector) {
		var label = elementLabel(info.element);
		var message = selector ? ('Drafted selector: ' + selector) : 'Click an element to draft a rule.';
		tip.innerHTML = `
			<div class="rcu-title">Rule Builder</div>
			<div class="rcu-line"><strong>${label}</strong></div>
			<div class="rcu-line">${message}</div>
			<div class="rcu-line rcu-hint">Press Esc to exit.</div>
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

	function escapeSelector(value) {
		if (window.CSS && window.CSS.escape) {
			return window.CSS.escape(value);
		}
		return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
	}

	function isUnique(selector) {
		try {
			return document.querySelectorAll(selector).length === 1;
		} catch (error) {
			return false;
		}
	}

	function buildSelector(element) {
		if (!element || !element.tagName) {
			return '';
		}
		if (element.id) {
			return '#' + escapeSelector(element.id);
		}
		var tag = element.tagName.toLowerCase();
		var selector = tag;
		if (element.classList && element.classList.length) {
			var classes = Array.prototype.slice.call(element.classList, 0, 2)
				.map(function(name) { return '.' + escapeSelector(name); })
				.join('');
			selector += classes;
		}
		if (isUnique(selector)) {
			return selector;
		}
		var parent = element.parentElement;
		if (parent && parent.id) {
			var prefixed = '#' + escapeSelector(parent.id) + ' > ' + selector;
			if (isUnique(prefixed)) {
				return prefixed;
			}
		}
		var nth = getNthOfType(element);
		if (nth) {
			return selector + nth;
		}
		return selector;
	}

	function getNthOfType(element) {
		if (!element || !element.parentElement) {
			return '';
		}
		var tag = element.tagName;
		var siblings = element.parentElement.children;
		var index = 0;
		var count = 0;
		for (var i = 0; i < siblings.length; i++) {
			if (siblings[i].tagName === tag) {
				count += 1;
				if (siblings[i] === element) {
					index = count;
				}
			}
		}
		return count > 1 ? ':nth-of-type(' + index + ')' : '';
	}

	function saveDraft(css) {
		var draft = {
			host: location.hostname,
			css: css,
			js: '',
			createdAt: Date.now()
		};
		chrome.storage.local.set({ rule_builder_draft: draft }, function() {
			showToast('Rule draft saved. Open Settings to review.');
		});
	}

	function applyPreview(css) {
		var preview = document.getElementById('rcu-rule-preview');
		if (!preview) {
			preview = document.createElement('style');
			preview.id = 'rcu-rule-preview';
			(document.head || document.documentElement).appendChild(preview);
		}
		preview.textContent = css;
	}

	function showToast(message) {
		var existing = document.getElementById('rcu-rule-toast');
		if (existing) {
			existing.remove();
		}
		var toast = document.createElement('div');
		toast.id = 'rcu-rule-toast';
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

	document.addEventListener('mousemove', handleMove, true);
	document.addEventListener('click', handleClick, true);
	document.addEventListener('keydown', handleKeydown, true);
	document.addEventListener('scroll', handleScroll, true);
	window.addEventListener('resize', handleScroll, true);

})();

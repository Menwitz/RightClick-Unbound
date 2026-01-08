(function() {
	'use strict';

	if (typeof chrome === 'undefined' || !chrome.runtime) {
		return;
	}

	var existing = document.getElementById('rcu-panel');
	if (existing) {
		existing.remove();
		var oldStyle = document.getElementById('rcu-panel-style');
		if (oldStyle) {
			oldStyle.remove();
		}
		return;
	}

	var style = document.createElement('style');
	style.id = 'rcu-panel-style';
	style.textContent = `
		#rcu-panel {
			position: fixed;
			right: 18px;
			bottom: 18px;
			width: 220px;
			background: #ffffff;
			border: 1px solid #e6ded5;
			border-radius: 12px;
			box-shadow: 0 12px 26px rgba(11, 61, 62, 0.18);
			font-family: "Avenir Next", "Avenir", "Gill Sans", "Trebuchet MS", sans-serif;
			color: #0b3d3e;
			z-index: 2147483647;
		}
		#rcu-panel .rcu-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 10px 12px;
			background: #f7f5f0;
			border-bottom: 1px solid #e6ded5;
		}
		#rcu-panel .rcu-title {
			font-size: 10px;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: #7c7871;
		}
		#rcu-panel .rcu-close {
			border: none;
			background: transparent;
			color: #7c7871;
			font-size: 16px;
			line-height: 1;
			cursor: pointer;
		}
		#rcu-panel .rcu-actions {
			display: grid;
			gap: 6px;
			padding: 10px 12px 6px;
		}
		#rcu-panel .rcu-button {
			appearance: none;
			border: 1px solid #e6ded5;
			background: #ffffff;
			color: #445c5c;
			border-radius: 999px;
			padding: 6px 8px;
			font-size: 11px;
			cursor: pointer;
			transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;
		}
		#rcu-panel .rcu-button:hover {
			border-color: #d7cfc4;
			color: #0b3d3e;
		}
		#rcu-panel .rcu-button.is-active {
			background: #0b3d3e;
			border-color: #0b3d3e;
			color: #ffffff;
		}
		#rcu-panel .rcu-footer {
			padding: 0 12px 12px;
			font-size: 10px;
			color: #7c7871;
		}
	`;
	(document.head || document.documentElement).appendChild(style);

	var panel = document.createElement('div');
	panel.id = 'rcu-panel';
	panel.setAttribute('role', 'dialog');
	panel.setAttribute('aria-label', 'RightClick Unbound');
	panel.innerHTML = `
		<div class="rcu-header">
			<span class="rcu-title">RightClick Unbound</span>
			<button class="rcu-close" type="button" data-action="close" aria-label="Close">×</button>
		</div>
		<div class="rcu-actions">
			<button class="rcu-button" type="button" data-action="unlock">Unlock Copy</button>
			<button class="rcu-button" type="button" data-action="force">Force Mode</button>
			<button class="rcu-button" type="button" data-action="session">Session Only</button>
			<button class="rcu-button" type="button" data-action="inspect">Inspect Locks</button>
			<button class="rcu-button" type="button" data-action="disable">Disable</button>
		</div>
		<div class="rcu-footer">Disabling may require a reload.</div>
	`;
	(document.body || document.documentElement).appendChild(panel);

	var state = { c: false, a: false, session: false };

	function updateButtons() {
		toggleActive('unlock', state.c);
		toggleActive('force', state.a);
		toggleActive('session', state.session);
	}

	function toggleActive(action, enabled) {
		var button = panel.querySelector('[data-action="' + action + '"]');
		if (!button) {
			return;
		}
		if (enabled) {
			button.classList.add('is-active');
		} else {
			button.classList.remove('is-active');
		}
	}

	function handleAction(action) {
		if (action === 'close') {
			removePanel();
			return;
		}
		if (action === 'unlock') {
			chrome.runtime.sendMessage({ text: state.c ? 'c-false' : 'c-true' });
			requestState();
			return;
		}
		if (action === 'force') {
			chrome.runtime.sendMessage({ text: state.a ? 'a-false' : 'a-true' });
			requestState();
			return;
		}
		if (action === 'session') {
			chrome.runtime.sendMessage({ text: 'session-toggle', enabled: !state.session });
			requestState();
			return;
		}
		if (action === 'inspect') {
			chrome.runtime.sendMessage({ text: 'inspect-locks' });
			return;
		}
		if (action === 'disable') {
			chrome.runtime.sendMessage({ text: 'c-false' });
			chrome.runtime.sendMessage({ text: 'a-false' });
			requestState();
		}
	}

	function handleMessage(request) {
		if (typeof request.c === 'boolean') {
			state.c = request.c;
		}
		if (typeof request.a === 'boolean') {
			state.a = request.a;
		}
		if (typeof request.session === 'boolean') {
			state.session = request.session;
		}
		updateButtons();
	}

	function handleKeydown(event) {
		if (event.key === 'Escape') {
			removePanel();
		}
	}

	function requestState() {
		chrome.runtime.sendMessage({ text: 'state' });
	}

	function removePanel() {
		chrome.runtime.onMessage.removeListener(handleMessage);
		document.removeEventListener('keydown', handleKeydown);
		var panelEl = document.getElementById('rcu-panel');
		if (panelEl) {
			panelEl.remove();
		}
		var styleEl = document.getElementById('rcu-panel-style');
		if (styleEl) {
			styleEl.remove();
		}
	}

	panel.addEventListener('click', function(event) {
		var target = event.target;
		if (!target || !target.getAttribute) {
			return;
		}
		var action = target.getAttribute('data-action');
		if (action) {
			handleAction(action);
		}
	});

	document.addEventListener('keydown', handleKeydown);
	chrome.runtime.onMessage.addListener(handleMessage);
	requestState();

})();

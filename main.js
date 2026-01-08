(function() {

	var c = false;
	var a = false;
	var r = false;
	var isBlocked = false;
	var sessionOnly = false;
	var stateEl = document.querySelector('.state');
	var stateLabel = document.querySelector('.state-label');
	var stateValue = document.querySelector('.state-value');
	var sessionEl = document.querySelector('.session-mode');
	var failureEl = document.querySelector('.failure');
	var failureText = document.querySelector('.failure-text');
	var profileButtons = document.querySelectorAll('.profile-btn');

	chrome.runtime.sendMessage({
		text: 'state'
	});

	chrome.runtime.onMessage.addListener(function(request) {
		if (typeof request.c === 'boolean') {
			c = request.c;
		} else if (request.c === 'true') {
			c = true;
		} else if (request.c === 'false') {
			c = false;
		}
		if (typeof request.a === 'boolean') {
			a = request.a;
		} else if (request.a === 'true') {
			a = true;
		} else if (request.a === 'false') {
			a = false;
		}
		if (typeof request.session === 'boolean') {
			sessionOnly = request.session;
			updateSessionUI();
		}
		if (request.error !== undefined) {
			updateFailure(request.error);
		}
		state();
	});

	document.querySelector('.enable-copy').onclick = function () {
		enableCopy();
	};

	document.querySelector('.abs-mode').onclick = function () {
		absoluteMode();
	};

	if (sessionEl) {
		sessionEl.onclick = function () {
			toggleSessionOnly();
		};
	}

	if (profileButtons.length) {
		profileButtons.forEach(function(button) {
			button.addEventListener('click', function() {
				applyProfile(button.getAttribute('data-profile'));
			});
		});
	}

	document.querySelector('.reload').onclick = function () {
		chrome.tabs.reload();
		window.close();
	};

	document.querySelector('.settings').addEventListener('click', function() {
		chrome.tabs.create({
			url: 'pages/options.html'
		});
		window.close();
	});

	document.addEventListener('dragstart', function(e) {
		e.preventDefault();
		return false;
	});

	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		var url = tabs[0].url;
		if (!/^https?:\/\//i.test(url)) {
			document.querySelector('.enable-copy').remove();
			document.querySelector('.abs-mode').remove();
			if (sessionEl) {
				sessionEl.remove();
			}
			var profiles = document.querySelector('.profiles');
			if (profiles) {
				profiles.remove();
			}
			document.querySelector('.description').remove();
			stateEl.classList.add('state--blocked');
			stateLabel.textContent = 'Unavailable';
			stateValue.textContent = 'This page cannot be modified';
			isBlocked = true;
			updateFailure(null);
		}
	});

	function enableCopy(message) {
		if (c === false) {
			c = true;
			message = {
				text: 'c-true'
			};
			chrome.runtime.sendMessage(message);
		} else {
			c = false;
			r = true;
			message = {
				text: 'c-false'
			};
			chrome.runtime.sendMessage(message);
		}
		state(r);
		updateFailure(null);
	}

	function absoluteMode(message) {
		if (a == false) {
			a = true;
			message = {
				text: 'a-true'
			};
			chrome.runtime.sendMessage(message);
		} else {
			a = false;
			r = true;
			message = {
				text: 'a-false'
			};
			chrome.runtime.sendMessage(message);
		}
		state(r);
		updateFailure(null);
	}

	function toggleSessionOnly() {
		if (isBlocked) {
			return;
		}
		sessionOnly = !sessionOnly;
		updateSessionUI();
		chrome.runtime.sendMessage({
			text: 'session-toggle',
			enabled: sessionOnly
		});
		chrome.runtime.sendMessage({
			text: 'state'
		});
	}

	function state(r) {
		if (isBlocked) {
			return;
		}
		if (c === true) {
			document.querySelector('.enable-copy img').src = 'images/on.png';
		} else {
			document.querySelector('.enable-copy img').src = 'images/off.png';
			if (r == true)
				reload();
		}
		if (a === true) {
			document.querySelector('.abs-mode img').src = 'images/on.png';
		} else {
			document.querySelector('.abs-mode img').src = 'images/off.png';
			if (r == true)
				reload();
		}
		if (c === false && a === false) {
			stateValue.textContent = 'Not Enabled';
			stateEl.classList.remove('is-enabled');
		} else {
			stateValue.textContent = 'Enabled';
			stateEl.classList.add('is-enabled');
		}
		updateProfileUI();
	}

	function updateSessionUI() {
		if (!sessionEl) {
			return;
		}
		sessionEl.querySelector('img').src = sessionOnly ? 'images/on.png' : 'images/off.png';
	}

	function updateFailure(error) {
		if (!failureEl || !failureText) {
			return;
		}
		if (!error || !error.hint || isBlocked) {
			failureEl.classList.remove('is-visible');
			failureText.textContent = '';
			return;
		}
		failureText.textContent = error.hint;
		failureEl.classList.add('is-visible');
	}

	function reload() {
		document.querySelector('.reload').style.display = 'flex';
	}

	function applyProfile(profile) {
		if (isBlocked || !profile) {
			return;
		}
		var targets = getProfileTargets(profile);
		if (!targets) {
			return;
		}
		var reloadNeeded = false;
		reloadNeeded = updateToggleState('c', targets.c) || reloadNeeded;
		reloadNeeded = updateToggleState('a', targets.a) || reloadNeeded;
		if (reloadNeeded) {
			r = true;
		}
		state(r);
		updateFailure(null);
		chrome.runtime.sendMessage({
			text: 'state'
		});
	}

	function updateToggleState(mode, enabled) {
		if (mode === 'c') {
			if (c === enabled) {
				return false;
			}
			c = enabled;
			chrome.runtime.sendMessage({
				text: enabled ? 'c-true' : 'c-false'
			});
			return !enabled;
		}
		if (mode === 'a') {
			if (a === enabled) {
				return false;
			}
			a = enabled;
			chrome.runtime.sendMessage({
				text: enabled ? 'a-true' : 'a-false'
			});
			return !enabled;
		}
		return false;
	}

	function getProfileTargets(profile) {
		if (profile === 'light') {
			return { c: true, a: false };
		}
		if (profile === 'force') {
			return { c: false, a: true };
		}
		if (profile === 'dual') {
			return { c: true, a: true };
		}
		return null;
	}

	function updateProfileUI() {
		if (!profileButtons.length) {
			return;
		}
		var active = null;
		if (c && a) {
			active = 'dual';
		} else if (c) {
			active = 'light';
		} else if (a) {
			active = 'force';
		}
		profileButtons.forEach(function(button) {
			var profile = button.getAttribute('data-profile');
			if (profile === active) {
				button.classList.add('is-active');
			} else {
				button.classList.remove('is-active');
			}
		});
	}

})();

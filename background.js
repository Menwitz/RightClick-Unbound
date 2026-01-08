(function() {

	var websites_List = [];
	var websites_Meta = {};
	var custom_Rules = {};
	var hostname;

	function loadWebsites(callback) {
		chrome.storage.local.get(['websites_List', 'websites_Meta', 'custom_rules'], function(value) {
			var rawList = Array.isArray(value.websites_List) ? value.websites_List : [];
			var normalized = normalizeWebsitesList(rawList);
			var metaInfo = normalizeWebsitesMeta(value.websites_Meta, normalized);
			websites_List = normalized;
			websites_Meta = metaInfo.meta;
			custom_Rules = normalizeCustomRules(value.custom_rules);
			if (rawList.length !== normalized.length || metaInfo.changed) {
				saveData();
			}
			callback();
		});
	}

	function normalizeWebsitesList(list) {
		var normalized = [];
		var seen = {};
		if (!Array.isArray(list)) {
			return normalized;
		}
		for (var i = 0; i < list.length; i++) {
			var entry = list[i];
			if (typeof entry !== 'string') {
				continue;
			}
			if (!/#[ac]$/.test(entry)) {
				continue;
			}
			if (seen[entry]) {
				continue;
			}
			seen[entry] = true;
			normalized.push(entry);
		}
		return normalized;
	}

	function normalizeWebsitesMeta(meta, list) {
		var normalized = {};
		var changed = false;
		if (!meta || typeof meta !== 'object') {
			return { meta: normalized, changed: meta !== undefined && meta !== null };
		}
		for (var i = 0; i < list.length; i++) {
			var entry = list[i];
			var stamp = meta[entry];
			if (typeof stamp === 'number' && isFinite(stamp)) {
				normalized[entry] = stamp;
			} else if (stamp !== undefined) {
				changed = true;
			}
		}
		for (var key in meta) {
			if (Object.prototype.hasOwnProperty.call(meta, key) && list.indexOf(key) === -1) {
				changed = true;
			}
		}
		return { meta: normalized, changed: changed };
	}

	function normalizeCustomRules(rules) {
		var normalized = {};
		if (!rules || typeof rules !== 'object') {
			return normalized;
		}
		for (var host in rules) {
			if (!Object.prototype.hasOwnProperty.call(rules, host)) {
				continue;
			}
			var rule = rules[host];
			if (!rule || typeof rule !== 'object') {
				continue;
			}
			var css = typeof rule.css === 'string' ? rule.css : '';
			var js = typeof rule.js === 'string' ? rule.js : '';
			if (!css && !js) {
				continue;
			}
			normalized[host] = {
				css: css,
				js: js,
				updatedAt: typeof rule.updatedAt === 'number' ? rule.updatedAt : Date.now()
			};
		}
		return normalized;
	}

	function removeEntry(entry) {
		var before = websites_List.length;
		websites_List = websites_List.filter(function(item) {
			return item !== entry;
		});
		var changed = websites_List.length !== before;
		if (websites_Meta[entry] !== undefined) {
			delete websites_Meta[entry];
			changed = true;
		}
		return changed;
	}

	function updateMeta(entry) {
		websites_Meta[entry] = Date.now();
	}

	function loadSessionData(callback) {
		chrome.storage.session.get(['session_entries', 'session_scope', 'session_errors'], function(value) {
			var entries = normalizeSessionEntries(value.session_entries);
			var scope = normalizeSessionScope(value.session_scope);
			var errors = normalizeSessionErrors(value.session_errors);
			callback({
				entries: entries,
				scope: scope,
				errors: errors
			});
		});
	}

	function saveSessionData(sessionData, callback) {
		chrome.storage.session.set({
			session_entries: sessionData.entries,
			session_scope: sessionData.scope
		}, function() {
			if (callback) {
				callback();
			}
		});
	}

	function normalizeSessionEntries(entries) {
		if (!Array.isArray(entries)) {
			return [];
		}
		return entries.filter(function(entry) {
			return entry &&
				typeof entry.tabId === 'number' &&
				typeof entry.host === 'string' &&
				(entry.mode === 'c' || entry.mode === 'a');
		});
	}

	function normalizeSessionScope(scope) {
		if (!Array.isArray(scope)) {
			return [];
		}
		return scope.filter(function(entry) {
			return entry &&
				typeof entry.tabId === 'number' &&
				typeof entry.host === 'string' &&
				typeof entry.enabled === 'boolean';
		});
	}

	function normalizeSessionErrors(errors) {
		if (!errors || typeof errors !== 'object') {
			return {};
		}
		return errors;
	}

	function hasSessionEntry(entries, tabId, host, mode) {
		return entries.some(function(entry) {
			return entry.tabId === tabId && entry.host === host && entry.mode === mode;
		});
	}

	function setSessionEntry(entries, tabId, host, mode, enabled) {
		var updated = false;
		if (enabled) {
			if (!hasSessionEntry(entries, tabId, host, mode)) {
				entries.push({ tabId: tabId, host: host, mode: mode });
				updated = true;
			}
			return updated;
		}
		var filtered = entries.filter(function(entry) {
			return !(entry.tabId === tabId && entry.host === host && entry.mode === mode);
		});
		if (filtered.length !== entries.length) {
			entries.length = 0;
			Array.prototype.push.apply(entries, filtered);
			updated = true;
		}
		return updated;
	}

	function isSessionScoped(scope, tabId, host) {
		return scope.some(function(entry) {
			return entry.tabId === tabId && entry.host === host && entry.enabled;
		});
	}

	function setSessionScope(scope, tabId, host, enabled) {
		var updated = false;
		var found = false;
		for (var i = 0; i < scope.length; i++) {
			if (scope[i].tabId === tabId && scope[i].host === host) {
				found = true;
				if (scope[i].enabled !== enabled) {
					scope[i].enabled = enabled;
					updated = true;
				}
			}
		}
		if (!found && enabled) {
			scope.push({ tabId: tabId, host: host, enabled: true });
			updated = true;
		}
		if (!enabled) {
			var cleaned = scope.filter(function(entry) {
				return !(entry.tabId === tabId && entry.host === host);
			});
			if (cleaned.length !== scope.length) {
				scope.length = 0;
				Array.prototype.push.apply(scope, cleaned);
				updated = true;
			}
		}
		return updated;
	}

	function clearSessionForTab(sessionData, tabId) {
		sessionData.entries = sessionData.entries.filter(function(entry) {
			return entry.tabId !== tabId;
		});
		sessionData.scope = sessionData.scope.filter(function(entry) {
			return entry.tabId !== tabId;
		});
	}

	function getEffectiveState(tabId, host, sessionData) {
		var sessionEnabled = isSessionScoped(sessionData.scope, tabId, host);
		if (sessionEnabled) {
			return {
				session: true,
				c: hasSessionEntry(sessionData.entries, tabId, host, 'c'),
				a: hasSessionEntry(sessionData.entries, tabId, host, 'a')
			};
		}
		return {
			session: false,
			c: websites_List.indexOf(host + '#c') !== -1,
			a: websites_List.indexOf(host + '#a') !== -1
		};
	}

	function recordInjectionError(tabId, tabUrl, message) {
		var errorInfo = buildErrorHint(tabUrl, message);
		chrome.storage.session.get(['session_errors'], function(value) {
			var errors = normalizeSessionErrors(value.session_errors);
			errors[tabId] = errorInfo;
			chrome.storage.session.set({ session_errors: errors });
		});
		chrome.runtime.sendMessage({ error: errorInfo });
	}

	function clearInjectionError(tabId) {
		chrome.storage.session.get(['session_errors'], function(value) {
			var errors = normalizeSessionErrors(value.session_errors);
			if (errors[tabId]) {
				delete errors[tabId];
				chrome.storage.session.set({ session_errors: errors });
				chrome.runtime.sendMessage({ error: null });
			}
		});
	}

	function buildErrorHint(tabUrl, message) {
		var hint = 'This page blocked script injection. Try another site or page.';
		if (typeof tabUrl === 'string') {
			if (/^chrome:\/\//i.test(tabUrl) || /^chrome-extension:\/\//i.test(tabUrl)) {
				hint = 'Chrome system pages cannot be modified.';
			} else if (/^file:\/\//i.test(tabUrl)) {
				hint = 'Enable "Allow access to file URLs" in chrome://extensions for this extension.';
			} else if (/chrome\.google\.com\/webstore/i.test(tabUrl)) {
				hint = 'The Chrome Web Store cannot be modified.';
			}
		}
		if (typeof message === 'string') {
			if (/extensions gallery cannot be scripted/i.test(message)) {
				hint = 'The Chrome Web Store cannot be modified.';
			} else if (/cannot access a chrome:\/\//i.test(message)) {
				hint = 'Chrome system pages cannot be modified.';
			} else if (/cannot access contents of the page/i.test(message)) {
				hint = 'This page blocks extension scripts. Try another page.';
			}
		}
		return {
			hint: hint,
			message: message || ''
		};
	}

	function isHttpUrl(url) {
		return typeof url === 'string' && /^https?:\/\//i.test(url);
	}

	function sendState(tab, host, sessionData) {
		var state = getEffectiveState(tab.id, host, sessionData);
		var error = sessionData.errors && sessionData.errors[tab.id] ? sessionData.errors[tab.id] : null;
		chrome.runtime.sendMessage({
			c: state.c,
			a: state.a,
			session: state.session,
			error: error
		});
	}

	function handleSessionToggle(tab, host, sessionData, enabled) {
		enabled = !!enabled;
		var changed = false;
		if (enabled) {
			changed = setSessionScope(sessionData.scope, tab.id, host, true) || changed;
			if (websites_List.indexOf(host + '#c') !== -1) {
				changed = setSessionEntry(sessionData.entries, tab.id, host, 'c', true) || changed;
			}
			if (websites_List.indexOf(host + '#a') !== -1) {
				changed = setSessionEntry(sessionData.entries, tab.id, host, 'a', true) || changed;
			}
			if (changed) {
				saveSessionData(sessionData);
			}
			sendState(tab, host, sessionData);
			return;
		}
		changed = setSessionScope(sessionData.scope, tab.id, host, false) || changed;
		changed = setSessionEntry(sessionData.entries, tab.id, host, 'c', false) || changed;
		changed = setSessionEntry(sessionData.entries, tab.id, host, 'a', false) || changed;
		if (changed) {
			saveSessionData(sessionData);
		}
		sendState(tab, host, sessionData);
	}

	function injectCustomJs(code) {
		try {
			var script = document.createElement('script');
			script.textContent = code;
			(document.head || document.documentElement).appendChild(script);
			script.remove();
		} catch (error) {
		}
	}

	function applyCustomRules(tabId, host, tabUrl) {
		var rule = custom_Rules[host];
		if (!rule) {
			return;
		}
		if (rule.css) {
			chrome.scripting.insertCSS({
				target: { tabId: tabId, allFrames: true },
				css: rule.css
			}, function() {
				var checkError = chrome.runtime.lastError;
				if (checkError) {
					recordInjectionError(tabId, tabUrl, checkError.message);
				}
			});
		}
		if (rule.js) {
			chrome.scripting.executeScript({
				target: { tabId: tabId, allFrames: true },
				func: injectCustomJs,
				args: [rule.js]
			}, function() {
				var checkError = chrome.runtime.lastError;
				if (checkError) {
					recordInjectionError(tabId, tabUrl, checkError.message);
				}
			});
		}
	}

	chrome.runtime.onMessage.addListener(function(request) {
		var text = request.text;
		if (text === 'delete-url') {
			loadWebsites(function() {
				if (removeEntry(request.url)) {
					saveData();
				}
			});
			return;
		}
		loadWebsites(function() {
			loadSessionData(function(sessionData) {
				chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
					var tab = tabs[0];
					if (!tab || !isHttpUrl(tab.url)) {
						return;
					}
					var host = (new URL(tab.url)).hostname;
					if (text === 'state') {
						sendState(tab, host, sessionData);
						return;
					}
					if (text === 'session-toggle') {
						handleSessionToggle(tab, host, sessionData, request.enabled);
						return;
					}
					enableCopy(host, text, tab, sessionData);
				});
			});
		});
	});

	chrome.commands.onCommand.addListener(function(command) {
		chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
			var tab = tabs[0];
			if (!tab || !tab.url) {
				return;
			}
			if (!isHttpUrl(tab.url)) {
				recordInjectionError(tab.id, tab.url, 'Unsupported page');
				return;
			}
			loadWebsites(function() {
				loadSessionData(function(sessionData) {
					var host = (new URL(tab.url)).hostname;
					if (command === 'toggle-session') {
						var nextSession = !isSessionScoped(sessionData.scope, tab.id, host);
						handleSessionToggle(tab, host, sessionData, nextSession);
						return;
					}
					if (command === 'toggle-unlock') {
						var state = getEffectiveState(tab.id, host, sessionData);
						enableCopy(host, state.c ? 'c-false' : 'c-true', tab, sessionData);
						sendState(tab, host, sessionData);
						return;
					}
					if (command === 'toggle-force') {
						var forceState = getEffectiveState(tab.id, host, sessionData);
						enableCopy(host, forceState.a ? 'a-false' : 'a-true', tab, sessionData);
						sendState(tab, host, sessionData);
					}
				});
			});
		});
	});

	chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
		if (changeInfo.status === 'complete' && tab && isHttpUrl(tab.url)) {
			loadWebsites(function() {
				loadSessionData(function(sessionData) {
					getHostName(tab.url, tabId, sessionData);
				});
			});
		}
	});

	chrome.tabs.onRemoved.addListener(function(tabId) {
		loadSessionData(function(sessionData) {
			clearSessionForTab(sessionData, tabId);
			saveSessionData(sessionData);
			clearInjectionError(tabId);
		});
	});

	function getHostName(url, tabId, sessionData) {
		hostname = (new URL(url)).hostname;
		inject(tabId, hostname, url, sessionData);
	}

	function enableCopy(url, text, tab, sessionData) {
		var sessionEnabled = isSessionScoped(sessionData.scope, tab.id, url);
		if (text === 'c-true') {
			var copyEntry = url + '#c';
			if (sessionEnabled) {
				if (setSessionEntry(sessionData.entries, tab.id, url, 'c', true)) {
					saveSessionData(sessionData);
				}
			} else {
				if (websites_List.indexOf(copyEntry) === -1) {
					websites_List.push(copyEntry);
				}
				updateMeta(copyEntry);
				saveData();
			}
			inject(tab.id, url, tab.url, sessionData);
		}
		if (text === 'c-false') {
			if (sessionEnabled) {
				if (setSessionEntry(sessionData.entries, tab.id, url, 'c', false)) {
					saveSessionData(sessionData);
				}
			} else {
				if (removeEntry(url + '#c')) {
					saveData();
				}
			}
		}
		if (text === 'a-true') {
			var absEntry = url + '#a';
			if (sessionEnabled) {
				if (setSessionEntry(sessionData.entries, tab.id, url, 'a', true)) {
					saveSessionData(sessionData);
				}
			} else {
				if (websites_List.indexOf(absEntry) === -1) {
					websites_List.push(absEntry);
				}
				updateMeta(absEntry);
				saveData();
			}
			inject(tab.id, url, tab.url, sessionData);
		}
		if (text === 'a-false') {
			if (sessionEnabled) {
				if (setSessionEntry(sessionData.entries, tab.id, url, 'a', false)) {
					saveSessionData(sessionData);
				}
			} else {
				if (removeEntry(url + '#a')) {
					saveData();
				}
			}
		}
	}

	function inject(tabId, url, tabUrl, sessionData) {
		if (url !== undefined && url !== null) {
			if (tabId !== undefined) {
				var state = getEffectiveState(tabId, url, sessionData);
				if (state.c) {
					chrome.scripting.executeScript({
						target: { tabId: tabId, allFrames: true },
						files: ['js/enable.js'],
						world: 'MAIN'
					}, function(results) {
						var checkError = chrome.runtime.lastError;
						if (checkError && (!results || results.length === 0)) {
							recordInjectionError(tabId, tabUrl, checkError.message);
						} else {
							clearInjectionError(tabId);
						}
						}
					);
				}
				if (state.a) {
					chrome.scripting.executeScript({
						target: { tabId: tabId, allFrames: true },
						files: ['js/enableA.js'],
						world: 'MAIN'
					}, function(results) {
						var checkError = chrome.runtime.lastError;
						if (checkError && (!results || results.length === 0)) {
							recordInjectionError(tabId, tabUrl, checkError.message);
						} else {
							clearInjectionError(tabId);
						}
						}
					);
				}
				if (state.c || state.a) {
					applyCustomRules(tabId, url, tabUrl);
				}
			}
		}
	}

	function saveData() {
		chrome.storage.local.set({
			'websites_List' : websites_List,
			'websites_Meta' : websites_Meta
		});
	}

})();

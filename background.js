(function() {

	var websites_List = [];
	var websites_Meta = {};
	var custom_Rules = {};
	var profile_Suggestions = {};
	var session_Prefs = {
		defaultEnabled: false,
		autoDisableMinutes: 0,
		disableOnNavigate: false,
		disableOnReload: false
	};
	var hostname;

	function loadWebsites(callback) {
		chrome.storage.local.get(['websites_List', 'websites_Meta', 'custom_rules', 'session_prefs', 'profile_suggestions'], function(value) {
			var rawList = Array.isArray(value.websites_List) ? value.websites_List : [];
			var normalized = normalizeWebsitesList(rawList);
			var metaInfo = normalizeWebsitesMeta(value.websites_Meta, normalized);
			websites_List = normalized;
			websites_Meta = metaInfo.meta;
			custom_Rules = normalizeCustomRules(value.custom_rules);
			session_Prefs = normalizeSessionPrefs(value.session_prefs);
			profile_Suggestions = normalizeProfileSuggestions(value.profile_suggestions);
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

	function normalizeSessionPrefs(prefs) {
		var normalized = {
			defaultEnabled: false,
			autoDisableMinutes: 0,
			disableOnNavigate: false,
			disableOnReload: false
		};
		if (!prefs || typeof prefs !== 'object') {
			return normalized;
		}
		normalized.defaultEnabled = !!prefs.defaultEnabled;
		normalized.disableOnNavigate = !!prefs.disableOnNavigate;
		normalized.disableOnReload = !!prefs.disableOnReload;
		var minutes = parseInt(prefs.autoDisableMinutes, 10);
		if (!isNaN(minutes) && isFinite(minutes)) {
			normalized.autoDisableMinutes = Math.max(0, minutes);
		}
		return normalized;
	}

	function normalizeProfileSuggestions(suggestions) {
		var normalized = {};
		if (!suggestions || typeof suggestions !== 'object') {
			return normalized;
		}
		for (var host in suggestions) {
			if (!Object.prototype.hasOwnProperty.call(suggestions, host)) {
				continue;
			}
			var entry = suggestions[host];
			if (!entry || typeof entry !== 'object') {
				continue;
			}
			if (entry.mode !== 'c' && entry.mode !== 'a' && entry.mode !== 'dual') {
				continue;
			}
			normalized[host] = {
				mode: entry.mode,
				updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : Date.now()
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
		chrome.storage.session.get(['session_entries', 'session_scope', 'session_errors', 'session_activity'], function(value) {
			var entries = normalizeSessionEntries(value.session_entries);
			var scope = normalizeSessionScope(value.session_scope);
			var errors = normalizeSessionErrors(value.session_errors);
			var activity = normalizeSessionActivity(value.session_activity);
			callback({
				entries: entries,
				scope: scope,
				errors: errors,
				activity: activity
			});
		});
	}

	function saveSessionData(sessionData, callback) {
		chrome.storage.session.set({
			session_entries: sessionData.entries,
			session_scope: sessionData.scope,
			session_activity: sessionData.activity
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

	function normalizeSessionActivity(activity) {
		var normalized = {};
		if (!activity || typeof activity !== 'object') {
			return normalized;
		}
		for (var key in activity) {
			if (!Object.prototype.hasOwnProperty.call(activity, key)) {
				continue;
			}
			var value = activity[key];
			if (typeof value === 'number' && isFinite(value)) {
				normalized[key] = value;
			}
		}
		return normalized;
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
		if (sessionData.activity) {
			delete sessionData.activity[String(tabId)];
		}
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

	function hasSessionForTab(sessionData, tabId) {
		var entryMatch = sessionData.entries.some(function(entry) {
			return entry.tabId === tabId;
		});
		if (entryMatch) {
			return true;
		}
		return sessionData.scope.some(function(entry) {
			return entry.tabId === tabId && entry.enabled;
		});
	}

	function shouldTrackSessionActivity() {
		return session_Prefs.autoDisableMinutes > 0;
	}

	function touchSessionActivity(sessionData, tabId) {
		if (!shouldTrackSessionActivity()) {
			return false;
		}
		if (!sessionData.activity) {
			sessionData.activity = {};
		}
		sessionData.activity[String(tabId)] = Date.now();
		return true;
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
		var suggestion = profile_Suggestions[host] ? profile_Suggestions[host].mode : null;
		chrome.runtime.sendMessage({
			c: state.c,
			a: state.a,
			session: state.session,
			error: error,
			suggested: suggestion
		});
	}

	function saveProfileSuggestions() {
		chrome.storage.local.set({
			profile_suggestions: profile_Suggestions
		});
	}

	function updateProfileSuggestion(host, tabId, sessionData) {
		var state = getEffectiveState(tabId, host, sessionData);
		if (!state.c && !state.a) {
			return;
		}
		var mode = state.c && state.a ? 'dual' : (state.a ? 'a' : 'c');
		if (profile_Suggestions[host] && profile_Suggestions[host].mode === mode) {
			return;
		}
		profile_Suggestions[host] = { mode: mode, updatedAt: Date.now() };
		saveProfileSuggestions();
	}

	function shouldAutoDisableSession(tabId, changeInfo, sessionData) {
		if (!session_Prefs.disableOnNavigate && !session_Prefs.disableOnReload) {
			return false;
		}
		if (!hasSessionForTab(sessionData, tabId)) {
			return false;
		}
		if (session_Prefs.disableOnNavigate && changeInfo.url) {
			return true;
		}
		if (session_Prefs.disableOnReload && changeInfo.status === 'loading' && !changeInfo.url) {
			return true;
		}
		return false;
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
			changed = touchSessionActivity(sessionData, tab.id) || changed;
			if (changed) {
				saveSessionData(sessionData);
			}
			sendState(tab, host, sessionData);
			return;
		}
		changed = setSessionScope(sessionData.scope, tab.id, host, false) || changed;
		changed = setSessionEntry(sessionData.entries, tab.id, host, 'c', false) || changed;
		changed = setSessionEntry(sessionData.entries, tab.id, host, 'a', false) || changed;
		if (sessionData.activity && sessionData.activity[String(tab.id)]) {
			delete sessionData.activity[String(tab.id)];
			changed = true;
		}
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

	function resolveMessageTab(sender, callback) {
		if (sender && sender.tab) {
			callback(sender.tab);
			return;
		}
		chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
			callback(tabs[0]);
		});
	}

	var menuIds = {
		root: 'rcu-root',
		unlock: 'rcu-unlock',
		force: 'rcu-force',
		session: 'rcu-session',
		panel: 'rcu-panel',
		inspect: 'rcu-inspect',
		overlays: 'rcu-overlays',
		cleanCopy: 'rcu-clean-copy',
		mdCopy: 'rcu-md-copy',
		settings: 'rcu-settings'
	};

	function setupContextMenus() {
		if (!chrome.contextMenus) {
			return;
		}
		chrome.contextMenus.removeAll(function() {
			chrome.contextMenus.create({
				id: menuIds.root,
				title: 'RightClick Unbound',
				contexts: ['all']
			});
			chrome.contextMenus.create({
				id: menuIds.unlock,
				parentId: menuIds.root,
				title: 'Unlock Copy',
				type: 'checkbox',
				contexts: ['all']
			});
			chrome.contextMenus.create({
				id: menuIds.force,
				parentId: menuIds.root,
				title: 'Force Mode',
				type: 'checkbox',
				contexts: ['all']
			});
			chrome.contextMenus.create({
				id: menuIds.session,
				parentId: menuIds.root,
				title: 'Session Only',
				type: 'checkbox',
				contexts: ['all']
			});
			chrome.contextMenus.create({
				id: menuIds.panel,
				parentId: menuIds.root,
				title: 'Show Quick Panel',
				contexts: ['all']
			});
			chrome.contextMenus.create({
				id: menuIds.inspect,
				parentId: menuIds.root,
				title: 'Lock Inspector',
				contexts: ['all']
			});
			chrome.contextMenus.create({
				id: menuIds.overlays,
				parentId: menuIds.root,
				title: 'Remove Selection Overlays',
				contexts: ['all']
			});
			chrome.contextMenus.create({
				id: menuIds.cleanCopy,
				parentId: menuIds.root,
				title: 'Copy Clean Text',
				contexts: ['all']
			});
			chrome.contextMenus.create({
				id: menuIds.mdCopy,
				parentId: menuIds.root,
				title: 'Copy as Markdown',
				contexts: ['all']
			});
			chrome.contextMenus.create({
				id: menuIds.settings,
				parentId: menuIds.root,
				title: 'Open Settings',
				contexts: ['all']
			});
		});
	}

	function updateContextMenuState(tab, sessionData) {
		if (!chrome.contextMenus) {
			return;
		}
		var enabled = tab && tab.url && isHttpUrl(tab.url);
		if (!enabled) {
			chrome.contextMenus.update(menuIds.unlock, { checked: false, enabled: false });
			chrome.contextMenus.update(menuIds.force, { checked: false, enabled: false });
			chrome.contextMenus.update(menuIds.session, { checked: false, enabled: false });
			chrome.contextMenus.update(menuIds.panel, { enabled: false });
			chrome.contextMenus.update(menuIds.inspect, { enabled: false });
			chrome.contextMenus.update(menuIds.overlays, { enabled: false });
			chrome.contextMenus.update(menuIds.cleanCopy, { enabled: false });
			chrome.contextMenus.update(menuIds.mdCopy, { enabled: false });
			chrome.contextMenus.refresh();
			return;
		}
		var host = (new URL(tab.url)).hostname;
		var state = getEffectiveState(tab.id, host, sessionData);
		var sessionEnabled = isSessionScoped(sessionData.scope, tab.id, host);
		chrome.contextMenus.update(menuIds.unlock, { checked: state.c, enabled: true });
		chrome.contextMenus.update(menuIds.force, { checked: state.a, enabled: true });
		chrome.contextMenus.update(menuIds.session, { checked: sessionEnabled, enabled: true });
		chrome.contextMenus.update(menuIds.panel, { enabled: true });
		chrome.contextMenus.update(menuIds.inspect, { enabled: true });
		chrome.contextMenus.update(menuIds.overlays, { enabled: true });
		chrome.contextMenus.update(menuIds.cleanCopy, { enabled: true });
		chrome.contextMenus.update(menuIds.mdCopy, { enabled: true });
		chrome.contextMenus.refresh();
	}

	function showQuickPanel(tabId, tabUrl) {
		chrome.scripting.executeScript({
			target: { tabId: tabId },
			files: ['js/overlay.js']
		}, function() {
			var checkError = chrome.runtime.lastError;
			if (checkError) {
				recordInjectionError(tabId, tabUrl, checkError.message);
			} else {
				clearInjectionError(tabId);
			}
		});
	}

	function showInspector(tabId, tabUrl) {
		chrome.scripting.executeScript({
			target: { tabId: tabId },
			files: ['js/inspector.js']
		}, function() {
			var checkError = chrome.runtime.lastError;
			if (checkError) {
				recordInjectionError(tabId, tabUrl, checkError.message);
			} else {
				clearInjectionError(tabId);
			}
		});
	}

	function removeSelectionOverlays(tabId, tabUrl) {
		chrome.scripting.executeScript({
			target: { tabId: tabId },
			files: ['js/overlays.js']
		}, function() {
			var checkError = chrome.runtime.lastError;
			if (checkError) {
				recordInjectionError(tabId, tabUrl, checkError.message);
			} else {
				clearInjectionError(tabId);
			}
		});
	}

	function runCleanCopy(tabId, tabUrl, mode) {
		chrome.scripting.executeScript({
			target: { tabId: tabId },
			func: function(copyMode) {
				if (document && document.documentElement) {
					document.documentElement.setAttribute('data-rcu-copy-mode', copyMode);
				}
			},
			args: [mode || 'text']
		}, function() {
			var checkError = chrome.runtime.lastError;
			if (checkError) {
				recordInjectionError(tabId, tabUrl, checkError.message);
				return;
			}
			chrome.scripting.executeScript({
				target: { tabId: tabId },
				files: ['js/clean-copy.js']
			}, function() {
				var checkCopyError = chrome.runtime.lastError;
				if (checkCopyError) {
					recordInjectionError(tabId, tabUrl, checkCopyError.message);
				} else {
					clearInjectionError(tabId);
				}
			});
		});
	}

	var sessionAlarmName = 'rcu-session-expiry';

	function setupSessionAlarm() {
		if (!chrome.alarms) {
			return;
		}
		chrome.alarms.create(sessionAlarmName, { periodInMinutes: 1 });
	}

	function handleSessionExpiry() {
		loadWebsites(function() {
			if (!shouldTrackSessionActivity()) {
				return;
			}
			var expiryMs = session_Prefs.autoDisableMinutes * 60 * 1000;
			if (!expiryMs) {
				return;
			}
			loadSessionData(function(sessionData) {
				var now = Date.now();
				var expiredTabs = [];
				for (var tabId in sessionData.activity) {
					if (!Object.prototype.hasOwnProperty.call(sessionData.activity, tabId)) {
						continue;
					}
					var lastActive = sessionData.activity[tabId];
					if (now - lastActive >= expiryMs) {
						expiredTabs.push(parseInt(tabId, 10));
					}
				}
				if (!expiredTabs.length) {
					return;
				}
				expiredTabs.forEach(function(tabId) {
					clearSessionForTab(sessionData, tabId);
					clearInjectionError(tabId);
				});
				saveSessionData(sessionData);
				chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
					var tab = tabs[0];
					if (tab && expiredTabs.indexOf(tab.id) !== -1 && isHttpUrl(tab.url)) {
						var host = (new URL(tab.url)).hostname;
						sendState(tab, host, sessionData);
					}
				});
			});
		});
	}

	chrome.runtime.onInstalled.addListener(function() {
		setupContextMenus();
		setupSessionAlarm();
	});

	chrome.runtime.onStartup.addListener(function() {
		setupContextMenus();
		setupSessionAlarm();
	});

	chrome.runtime.onMessage.addListener(function(request, sender) {
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
				resolveMessageTab(sender, function(tab) {
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
					if (text === 'inspect-locks') {
						showInspector(tab.id, tab.url);
						return;
					}
					if (text === 'overlay-clean') {
						removeSelectionOverlays(tab.id, tab.url);
						return;
					}
					if (text === 'clean-copy') {
						runCleanCopy(tab.id, tab.url, 'text');
						return;
					}
					if (text === 'markdown-copy') {
						runCleanCopy(tab.id, tab.url, 'markdown');
						return;
					}
					enableCopy(host, text, tab, sessionData);
				});
			});
		});
	});

	chrome.contextMenus.onShown.addListener(function(info, tab) {
		loadWebsites(function() {
			loadSessionData(function(sessionData) {
				updateContextMenuState(tab, sessionData);
			});
		});
	});

	chrome.contextMenus.onClicked.addListener(function(info, tab) {
		if (info.menuItemId === menuIds.settings) {
			chrome.tabs.create({ url: 'pages/options.html' });
			return;
		}
		if (!tab || !tab.url) {
			return;
		}
		if (info.menuItemId === menuIds.panel) {
			if (isHttpUrl(tab.url)) {
				showQuickPanel(tab.id, tab.url);
			} else {
				recordInjectionError(tab.id, tab.url, 'Unsupported page');
			}
			return;
		}
		if (info.menuItemId === menuIds.inspect) {
			if (isHttpUrl(tab.url)) {
				showInspector(tab.id, tab.url);
			} else {
				recordInjectionError(tab.id, tab.url, 'Unsupported page');
			}
			return;
		}
		if (info.menuItemId === menuIds.overlays) {
			if (isHttpUrl(tab.url)) {
				removeSelectionOverlays(tab.id, tab.url);
			} else {
				recordInjectionError(tab.id, tab.url, 'Unsupported page');
			}
			return;
		}
		if (info.menuItemId === menuIds.cleanCopy) {
			if (isHttpUrl(tab.url)) {
				runCleanCopy(tab.id, tab.url, 'text');
			} else {
				recordInjectionError(tab.id, tab.url, 'Unsupported page');
			}
			return;
		}
		if (info.menuItemId === menuIds.mdCopy) {
			if (isHttpUrl(tab.url)) {
				runCleanCopy(tab.id, tab.url, 'markdown');
			} else {
				recordInjectionError(tab.id, tab.url, 'Unsupported page');
			}
			return;
		}
		if (!isHttpUrl(tab.url)) {
			recordInjectionError(tab.id, tab.url, 'Unsupported page');
			return;
		}
		loadWebsites(function() {
			loadSessionData(function(sessionData) {
				var host = (new URL(tab.url)).hostname;
				if (info.menuItemId === menuIds.session) {
					handleSessionToggle(tab, host, sessionData, !!info.checked);
					return;
				}
				if (info.menuItemId === menuIds.unlock) {
					enableCopy(host, info.checked ? 'c-true' : 'c-false', tab, sessionData);
					sendState(tab, host, sessionData);
					return;
				}
				if (info.menuItemId === menuIds.force) {
					enableCopy(host, info.checked ? 'a-true' : 'a-false', tab, sessionData);
					sendState(tab, host, sessionData);
				}
			});
		});
	});

	chrome.alarms.onAlarm.addListener(function(alarm) {
		if (alarm && alarm.name === sessionAlarmName) {
			handleSessionExpiry();
		}
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
		if (!tab) {
			return;
		}
		loadWebsites(function() {
			loadSessionData(function(sessionData) {
				if (shouldAutoDisableSession(tabId, changeInfo, sessionData)) {
					clearSessionForTab(sessionData, tabId);
					saveSessionData(sessionData);
					clearInjectionError(tabId);
					if (isHttpUrl(tab.url)) {
						var host = (new URL(tab.url)).hostname;
						sendState(tab, host, sessionData);
					}
				}
				if (changeInfo.status === 'complete' && isHttpUrl(tab.url)) {
					getHostName(tab.url, tabId, sessionData);
				}
			});
		});
	});

	chrome.tabs.onActivated.addListener(function(activeInfo) {
		loadWebsites(function() {
			loadSessionData(function(sessionData) {
				if (hasSessionForTab(sessionData, activeInfo.tabId)) {
					if (touchSessionActivity(sessionData, activeInfo.tabId)) {
						saveSessionData(sessionData);
					}
				}
			});
		});
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
		if ((text === 'c-true' || text === 'a-true') && session_Prefs.defaultEnabled && !sessionEnabled) {
			handleSessionToggle(tab, url, sessionData, true);
			sessionEnabled = true;
		}
		if (text === 'c-true') {
			var copyEntry = url + '#c';
			if (sessionEnabled) {
				var changed = setSessionEntry(sessionData.entries, tab.id, url, 'c', true);
				changed = touchSessionActivity(sessionData, tab.id) || changed;
				if (changed) {
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
				var changedAbs = setSessionEntry(sessionData.entries, tab.id, url, 'a', true);
				changedAbs = touchSessionActivity(sessionData, tab.id) || changedAbs;
				if (changedAbs) {
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
		if (!sessionEnabled) {
			updateProfileSuggestion(url, tab.id, sessionData);
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

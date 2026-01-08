(function() {

	var websites_List = [];
	var websites_Meta = {};
	var hostname;

	function loadWebsites(callback) {
		chrome.storage.local.get(['websites_List', 'websites_Meta'], function(value) {
			var rawList = Array.isArray(value.websites_List) ? value.websites_List : [];
			var normalized = normalizeWebsitesList(rawList);
			var metaInfo = normalizeWebsitesMeta(value.websites_Meta, normalized);
			websites_List = normalized;
			websites_Meta = metaInfo.meta;
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

	function isHttpUrl(url) {
		return typeof url === 'string' && /^https?:\/\//i.test(url);
	}

	chrome.runtime.onMessage.addListener(function(request) {
		loadWebsites(function() {
			var text = request.text;
			if (text === 'delete-url') {
				if (removeEntry(request.url)) {
					saveData();
				}
				return;
			}
			chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
				var tab = tabs[0];
				if (!tab || !isHttpUrl(tab.url)) {
					return;
				}
				var url = (new URL(tab.url)).hostname;
				if (text === 'state') {
					chrome.runtime.sendMessage({
						c: websites_List.indexOf(url + '#c') !== -1,
						a: websites_List.indexOf(url + '#a') !== -1
					});
					return;
				}
				enableCopy(url, text, tab.id);
			});
		});
	});

	chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
		if (changeInfo.status === 'complete' && tab && isHttpUrl(tab.url)) {
			loadWebsites(function() {
				getHostName(tab.url, tabId);
			});
		}
	});

	function getHostName(url, tabId) {
		hostname = (new URL(url)).hostname;
		inject(tabId, hostname);
	}

	function enableCopy(url, text, tabId) {
		if (text === 'c-true') {
			var copyEntry = url + '#c';
			if (websites_List.indexOf(copyEntry) === -1) {
				websites_List.push(copyEntry);
			}
			updateMeta(copyEntry);
			saveData();
			inject(tabId, url);
		}
		if (text === 'c-false') {
			if (removeEntry(url + '#c')) {
				saveData();
			}
		}
		if (text === 'a-true') {
			var absEntry = url + '#a';
			if (websites_List.indexOf(absEntry) === -1) {
				websites_List.push(absEntry);
			}
			updateMeta(absEntry);
			saveData();
			inject(tabId, url);
		}
		if (text === 'a-false') {
			if (removeEntry(url + '#a')) {
				saveData();
			}
		}
	}

	function inject(tabId, url) {
		if (url !== undefined && url !== null) {
			if (tabId !== undefined) {
				if (websites_List.indexOf(url + '#c') !== -1) {
					chrome.scripting.executeScript({
						target: { tabId: tabId, allFrames: true },
						files: ['js/enable.js']
					}, function() {
						var checkError = chrome.runtime.lastError;
						if (checkError)
							console.log('Error::', 'url:', hostname, '- tabId:', tabId, '\n', JSON.stringify(checkError));
						}
					);
				}
				if (websites_List.indexOf(url + '#a') !== -1) {
					chrome.scripting.executeScript({
						target: { tabId: tabId, allFrames: true },
						files: ['js/enableA.js']
					}, function() {
						var checkError = chrome.runtime.lastError;
						if (checkError)
							console.log('Error::', 'url:', hostname, '- tabId:', tabId, '\n', JSON.stringify(checkError));
						}
					);
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

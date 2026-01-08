(function() {
	var rulesCache = {};
	var editingHost = null;

	function callback() {
		loadUserList();
		initRules();
		initBackup();
	}

	function loadUserList() {
		var u = document.querySelector('#user-list');
		if (u) {
			u.innerHTML = '';
		}
		chrome.storage.local.get(['websites_List', 'websites_Meta'], function(value) {
			if (value.websites_List !== undefined) {
				var seen = {};
				var meta = value.websites_Meta && typeof value.websites_Meta === 'object' ? value.websites_Meta : {};
				for (var i = 0; i < value.websites_List.length; i++) {
					var entry = value.websites_List[i];
					if (typeof entry !== 'string') {
						continue;
					}
					if (seen[entry]) {
						continue;
					}
					seen[entry] = true;
					getData(u, entry, meta);
				}
				empty(u);
			} else {
				return;
			}
		});
	}

	function getData(u, url, meta) {
		var hostname = url;
		var entryKey = url;
		var modeLabel = 'Force Mode';
		var mode = 'absolute-mode';
		var d = document.createElement('div');
		u.appendChild(d);
		d.className = 'table-row';
		var urlFilter;
		if (url.indexOf('#c') !== -1) {
			url = url.replace('#c', '');
			urlFilter = url + '##enable-copy';
			mode = 'enable-copy';
			modeLabel = 'Unlock Copy';
		} else {
			url = url.replace('#a', '');
			urlFilter = url + '##absolute-mode';
			mode = 'absolute-mode';
		}
		var lastEnabled = formatLastEnabled(meta[entryKey]);
		d.innerHTML = `
			<div class="row-label" url="${url}" mode="${mode}">
				<div class="row-primary" title="${urlFilter}">${urlFilter}</div>
				<div class="row-meta">Last enabled: ${lastEnabled} | Mode: ${modeLabel}</div>
			</div>
			<i class="row-delete" name="${mode}" title="Delete"></i>
		`;
		d.querySelector('.row-delete').addEventListener('click', function () {
			chrome.runtime.sendMessage({
				text: 'delete-url',
				url: hostname
			});
			d.remove();
			empty(u);
		});
	}

	function formatLastEnabled(timestamp) {
		if (typeof timestamp !== 'number' || !isFinite(timestamp)) {
			return 'Not recorded';
		}
		var date = new Date(timestamp);
		if (isNaN(date.getTime())) {
			return 'Not recorded';
		}
		return date.toLocaleString();
	}

	function initRules() {
		if (!document.querySelector('#rule-host')) {
			return;
		}
		bindRuleForm();
		loadRules();
	}

	function initBackup() {
		if (!document.querySelector('#export-settings')) {
			return;
		}
		var exportButton = document.querySelector('#export-settings');
		var copyButton = document.querySelector('#copy-settings');
		var downloadButton = document.querySelector('#download-settings');
		var importButton = document.querySelector('#import-settings');
		var importFile = document.querySelector('#import-file');
		if (exportButton) {
			exportButton.addEventListener('click', exportSettings);
		}
		if (copyButton) {
			copyButton.addEventListener('click', copySettings);
		}
		if (downloadButton) {
			downloadButton.addEventListener('click', downloadSettings);
		}
		if (importButton) {
			importButton.addEventListener('click', importSettingsFromText);
		}
		if (importFile) {
			importFile.addEventListener('change', handleImportFile);
		}
	}

	function bindRuleForm() {
		var saveButton = document.querySelector('#rule-save');
		var clearButton = document.querySelector('#rule-clear');
		if (!saveButton || !clearButton) {
			return;
		}
		saveButton.addEventListener('click', saveRule);
		clearButton.addEventListener('click', clearRuleForm);
	}

	function loadRules() {
		chrome.storage.local.get('custom_rules', function(value) {
			rulesCache = normalizeRules(value.custom_rules);
			renderRules();
		});
	}

	function normalizeRules(rules) {
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

	function exportSettings() {
		buildExportText(function() {
			setBackupStatus('Export ready.');
		});
	}

	function copySettings() {
		buildExportText(function(text) {
			copyTextToClipboard(text, function() {
				setBackupStatus('Copied to clipboard.');
			});
		});
	}

	function downloadSettings() {
		buildExportText(function(text) {
			if (!text) {
				setBackupStatus('Nothing to download.', true);
				return;
			}
			var blob = new Blob([text], { type: 'application/json' });
			var url = URL.createObjectURL(blob);
			var link = document.createElement('a');
			link.href = url;
			link.download = 'rightclick-unbound-settings.json';
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
			setBackupStatus('Download started.');
		});
	}

	function buildExportText(callback) {
		var exportField = document.querySelector('#export-json');
		chrome.storage.local.get(['websites_List', 'websites_Meta', 'custom_rules'], function(value) {
			var payload = {
				version: 1,
				exportedAt: new Date().toISOString(),
				websites_List: Array.isArray(value.websites_List) ? value.websites_List : [],
				websites_Meta: value.websites_Meta && typeof value.websites_Meta === 'object' ? value.websites_Meta : {},
				custom_rules: normalizeRules(value.custom_rules)
			};
			var text = JSON.stringify(payload, null, 2);
			if (exportField) {
				exportField.value = text;
			}
			if (callback) {
				callback(text);
			}
		});
	}

	function copyTextToClipboard(text, callback) {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(function() {
				if (callback) {
					callback();
				}
			}).catch(function() {
				fallbackCopy(text, callback);
			});
			return;
		}
		fallbackCopy(text, callback);
	}

	function fallbackCopy(text, callback) {
		var exportField = document.querySelector('#export-json');
		if (!exportField) {
			return;
		}
		exportField.focus();
		exportField.select();
		document.execCommand('copy');
		if (callback) {
			callback();
		}
	}

	function handleImportFile(event) {
		var file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
		if (!file) {
			return;
		}
		var reader = new FileReader();
		reader.onload = function(loadEvent) {
			var text = loadEvent.target.result || '';
			var importField = document.querySelector('#import-json');
			if (importField) {
				importField.value = text;
			}
			applyImport(text);
		};
		reader.readAsText(file);
		event.target.value = '';
	}

	function importSettingsFromText() {
		var importField = document.querySelector('#import-json');
		var text = importField ? importField.value.trim() : '';
		if (!text) {
			setBackupStatus('Paste JSON to import.', true);
			return;
		}
		applyImport(text);
	}

	function applyImport(text) {
		var data;
		try {
			data = JSON.parse(text);
		} catch (error) {
			setBackupStatus('Invalid JSON.', true);
			return;
		}
		var source = data && data.websites_List !== undefined ? data : (data && data.settings ? data.settings : null);
		if (!source || (source.websites_List === undefined && source.websites_Meta === undefined && source.custom_rules === undefined)) {
			setBackupStatus('Missing settings payload.', true);
			return;
		}
		var list = normalizeWebsitesList(source.websites_List);
		var meta = normalizeWebsitesMeta(source.websites_Meta, list);
		var rules = normalizeRules(source.custom_rules);
		chrome.storage.local.set({
			websites_List: list,
			websites_Meta: meta,
			custom_rules: rules
		}, function() {
			loadUserList();
			loadRules();
			setBackupStatus('Settings imported.');
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
		if (!meta || typeof meta !== 'object') {
			return normalized;
		}
		for (var i = 0; i < list.length; i++) {
			var entry = list[i];
			var stamp = meta[entry];
			if (typeof stamp === 'number' && isFinite(stamp)) {
				normalized[entry] = stamp;
			}
		}
		return normalized;
	}

	function renderRules() {
		var list = document.querySelector('#rules-list');
		if (!list) {
			return;
		}
		list.innerHTML = '';
		var hosts = Object.keys(rulesCache).sort();
		if (!hosts.length) {
			var empty = document.createElement('div');
			empty.className = 'rules-empty';
			empty.textContent = 'No custom rules yet.';
			list.appendChild(empty);
			return;
		}
		hosts.forEach(function(host) {
			var rule = rulesCache[host];
			var item = document.createElement('div');
			item.className = 'rule-item';

			var main = document.createElement('div');
			main.className = 'rule-main';

			var hostEl = document.createElement('div');
			hostEl.className = 'rule-host';
			hostEl.textContent = host;

			var metaEl = document.createElement('div');
			metaEl.className = 'rule-meta';
			metaEl.textContent = buildRuleMeta(rule);

			main.appendChild(hostEl);
			main.appendChild(metaEl);

			var actions = document.createElement('div');
			actions.className = 'rule-actions';

			var editButton = document.createElement('button');
			editButton.type = 'button';
			editButton.className = 'rule-edit';
			editButton.textContent = 'Edit';
			editButton.addEventListener('click', function() {
				editRule(host);
			});

			var deleteButton = document.createElement('button');
			deleteButton.type = 'button';
			deleteButton.className = 'rule-delete';
			deleteButton.textContent = 'Delete';
			deleteButton.addEventListener('click', function() {
				deleteRule(host);
			});

			actions.appendChild(editButton);
			actions.appendChild(deleteButton);

			item.appendChild(main);
			item.appendChild(actions);
			list.appendChild(item);
		});
	}

	function buildRuleMeta(rule) {
		var tags = [];
		if (rule.css) {
			tags.push('CSS');
		}
		if (rule.js) {
			tags.push('JS');
		}
		var updated = rule.updatedAt ? new Date(rule.updatedAt).toLocaleString() : 'Not set';
		return (tags.length ? tags.join(', ') : 'No content') + ' | Updated: ' + updated;
	}

	function saveRule() {
		var hostInput = document.querySelector('#rule-host');
		var cssInput = document.querySelector('#rule-css');
		var jsInput = document.querySelector('#rule-js');
		if (!hostInput || !cssInput || !jsInput) {
			return;
		}
		var host = normalizeHost(hostInput.value);
		var css = cssInput.value.trim();
		var js = jsInput.value.trim();
		if (!host) {
			setRuleError('Enter a valid hostname.');
			return;
		}
		if (!css && !js) {
			setRuleError('Add CSS or JS to save a rule.');
			return;
		}
		if (editingHost && editingHost !== host) {
			delete rulesCache[editingHost];
		}
		rulesCache[host] = {
			css: css,
			js: js,
			updatedAt: Date.now()
		};
		chrome.storage.local.set({ custom_rules: rulesCache }, function() {
			clearRuleForm();
			renderRules();
		});
	}

	function editRule(host) {
		var rule = rulesCache[host];
		if (!rule) {
			return;
		}
		var hostInput = document.querySelector('#rule-host');
		var cssInput = document.querySelector('#rule-css');
		var jsInput = document.querySelector('#rule-js');
		if (!hostInput || !cssInput || !jsInput) {
			return;
		}
		hostInput.value = host;
		cssInput.value = rule.css || '';
		jsInput.value = rule.js || '';
		editingHost = host;
		setRuleError('');
		setRuleButtonLabel('Update Rule');
	}

	function deleteRule(host) {
		if (!rulesCache[host]) {
			return;
		}
		delete rulesCache[host];
		chrome.storage.local.set({ custom_rules: rulesCache }, function() {
			if (editingHost === host) {
				clearRuleForm();
			}
			renderRules();
		});
	}

	function clearRuleForm() {
		var hostInput = document.querySelector('#rule-host');
		var cssInput = document.querySelector('#rule-css');
		var jsInput = document.querySelector('#rule-js');
		if (hostInput) {
			hostInput.value = '';
		}
		if (cssInput) {
			cssInput.value = '';
		}
		if (jsInput) {
			jsInput.value = '';
		}
		editingHost = null;
		setRuleError('');
		setRuleButtonLabel('Save Rule');
	}

	function setRuleButtonLabel(label) {
		var saveButton = document.querySelector('#rule-save');
		if (saveButton) {
			saveButton.textContent = label;
		}
	}

	function setRuleError(message) {
		var errorEl = document.querySelector('#rule-error');
		if (errorEl) {
			errorEl.textContent = message || '';
		}
	}

	function setBackupStatus(message, isError) {
		var status = document.querySelector('#backup-status');
		if (!status) {
			return;
		}
		status.textContent = message || '';
		if (isError) {
			status.classList.add('is-error');
		} else {
			status.classList.remove('is-error');
		}
	}

	function normalizeHost(value) {
		var host = (value || '').trim().toLowerCase();
		host = host.replace(/^https?:\/\//, '');
		host = host.replace(/\/.*$/, '');
		host = host.replace(/:\d+$/, '');
		host = host.replace(/\s+/g, '');
		if (host === 'localhost' || /\./.test(host)) {
			return host;
		}
		return '';
	}

	function empty(u) {
		var empty = document.querySelector('.list-empty')
		if (empty !== null && u.querySelectorAll('.table-row')[0] !== null) {
			empty.style.display = 'none';
		}
		if (u.querySelector('.table-row') === undefined || u.querySelector('.table-row') === null ) {
			empty.style.display = 'block';
		}
	}

	window.onload = callback;

})();

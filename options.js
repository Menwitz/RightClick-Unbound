(function() {
	var rulesCache = {};
	var editingHost = null;
	var vaultCache = [];
	var vaultSearchTerm = '';
	var scheduleCache = [];
	var editingScheduleId = null;

	function callback() {
		loadUserList();
		initRules();
		initBackup();
		initSessionPrefs();
		initVault();
		initDomainTools();
		initSchedules();
		initDiagnostics();
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
		loadRuleDraft();
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

	function initVault() {
		var searchInput = document.querySelector('#vault-search');
		var clearButton = document.querySelector('#vault-clear');
		if (!searchInput) {
			return;
		}
		searchInput.addEventListener('input', function() {
			vaultSearchTerm = searchInput.value.trim().toLowerCase();
			renderVault();
		});
		if (clearButton) {
			clearButton.addEventListener('click', function() {
				if (!confirm('Clear all saved snippets?')) {
					return;
				}
				vaultCache = [];
				chrome.storage.local.set({ snippet_vault: [] }, function() {
					renderVault();
				});
			});
		}
		loadVault();
	}

	function initDomainTools() {
		var hostInput = document.querySelector('#domain-host');
		var enableCopy = document.querySelector('#domain-enable-copy');
		var enableForce = document.querySelector('#domain-enable-force');
		var disableAll = document.querySelector('#domain-disable');
		var applyTabs = document.querySelector('#domain-apply');
		if (!hostInput) {
			return;
		}
		if (enableCopy) {
			enableCopy.addEventListener('click', function() {
				handleDomainAction(hostInput.value, 'c', true);
			});
		}
		if (enableForce) {
			enableForce.addEventListener('click', function() {
				handleDomainAction(hostInput.value, 'a', true);
			});
		}
		if (disableAll) {
			disableAll.addEventListener('click', function() {
				handleDomainAction(hostInput.value, 'all', false);
			});
		}
		if (applyTabs) {
			applyTabs.addEventListener('click', function() {
				var host = normalizeHost(hostInput.value);
				if (!host) {
					setDomainStatus('Enter a valid hostname.', true);
					return;
				}
				chrome.runtime.sendMessage({
					text: 'domain-apply',
					host: host
				});
				setDomainStatus('Applying to open tabs.');
			});
		}
	}

	function initSchedules() {
		if (!document.querySelector('#schedule-host')) {
			return;
		}
		bindScheduleForm();
		loadSchedules();
	}

	function initDiagnostics() {
		var runButton = document.querySelector('#diagnostics-run');
		if (!runButton) {
			return;
		}
		runButton.addEventListener('click', function() {
			setDiagnosticsOutput('Running diagnostics...');
			chrome.runtime.sendMessage({ text: 'diagnostics-run' });
		});
		loadDiagnostics();
	}

	function handleDomainAction(value, mode, enabled) {
		var host = normalizeHost(value);
		if (!host) {
			setDomainStatus('Enter a valid hostname.', true);
			return;
		}
		chrome.runtime.sendMessage({
			text: 'domain-action',
			host: host,
			mode: mode,
			enabled: enabled
		});
		if (enabled) {
			setDomainStatus('Enabled for all open tabs.');
		} else {
			setDomainStatus('Disabled. Reload open tabs to apply.');
		}
	}

	function initSessionPrefs() {
		if (!document.querySelector('#session-default')) {
			return;
		}
		loadSessionPrefs();
		var defaultToggle = document.querySelector('#session-default');
		var reloadToggle = document.querySelector('#session-disable-reload');
		var navigateToggle = document.querySelector('#session-disable-navigate');
		var timeoutInput = document.querySelector('#session-timeout');
		if (defaultToggle) {
			defaultToggle.addEventListener('change', saveSessionPrefs);
		}
		if (reloadToggle) {
			reloadToggle.addEventListener('change', saveSessionPrefs);
		}
		if (navigateToggle) {
			navigateToggle.addEventListener('change', saveSessionPrefs);
		}
		if (timeoutInput) {
			timeoutInput.addEventListener('change', saveSessionPrefs);
		}
	}

	function bindRuleForm() {
		var saveButton = document.querySelector('#rule-save');
		var clearButton = document.querySelector('#rule-clear');
		var builderButton = document.querySelector('#rule-builder');
		if (!saveButton || !clearButton) {
			return;
		}
		saveButton.addEventListener('click', saveRule);
		clearButton.addEventListener('click', clearRuleForm);
		if (builderButton) {
			builderButton.addEventListener('click', function() {
				chrome.runtime.sendMessage({ text: 'rule-builder' });
				setRuleBuilderStatus('Rule Builder active. Select an element on the page.');
			});
		}
	}

	function loadRules() {
		chrome.storage.local.get('custom_rules', function(value) {
			rulesCache = normalizeRules(value.custom_rules);
			renderRules();
		});
	}

	function loadVault() {
		chrome.storage.local.get('snippet_vault', function(value) {
			vaultCache = Array.isArray(value.snippet_vault) ? value.snippet_vault : [];
			renderVault();
		});
	}

	function loadRuleDraft() {
		chrome.storage.local.get('rule_builder_draft', function(value) {
			var draft = value.rule_builder_draft;
			if (!draft || !draft.host) {
				return;
			}
			var hostInput = document.querySelector('#rule-host');
			var cssInput = document.querySelector('#rule-css');
			var jsInput = document.querySelector('#rule-js');
			if (!hostInput || !cssInput || !jsInput) {
				return;
			}
			if (!hostInput.value && !cssInput.value && !jsInput.value) {
				hostInput.value = draft.host;
				cssInput.value = draft.css || '';
				jsInput.value = draft.js || '';
				editingHost = draft.host;
				setRuleButtonLabel('Save Draft');
				setRuleBuilderStatus('Draft loaded from Rule Builder.');
			} else {
				setRuleBuilderStatus('Draft ready. Clear the form to load it.');
			}
		});
	}

	function bindScheduleForm() {
		var saveButton = document.querySelector('#schedule-save');
		var clearButton = document.querySelector('#schedule-clear');
		if (saveButton) {
			saveButton.addEventListener('click', saveSchedule);
		}
		if (clearButton) {
			clearButton.addEventListener('click', clearScheduleForm);
		}
	}

	function loadSchedules() {
		chrome.storage.local.get('schedule_rules', function(value) {
			scheduleCache = normalizeScheduleRules(value.schedule_rules);
			renderSchedules();
		});
	}

	function normalizeScheduleRules(rules) {
		if (!Array.isArray(rules)) {
			return [];
		}
		return rules.filter(function(rule) {
			return rule && typeof rule === 'object' && rule.id && rule.host;
		});
	}

	function saveSchedule() {
		var hostInput = document.querySelector('#schedule-host');
		var modeInput = document.querySelector('#schedule-mode');
		var startInput = document.querySelector('#schedule-start');
		var endInput = document.querySelector('#schedule-end');
		var durationInput = document.querySelector('#schedule-duration');
		if (!hostInput || !modeInput || !startInput || !endInput || !durationInput) {
			return;
		}
		var host = normalizeHost(hostInput.value);
		var mode = modeInput.value;
		var start = startInput.value.trim();
		var end = endInput.value.trim();
		var duration = parseInt(durationInput.value, 10);
		if (!host) {
			setScheduleError('Enter a valid hostname.');
			return;
		}
		if (!isTimeValue(start)) {
			setScheduleError('Enter a valid start time.');
			return;
		}
		if ((!duration || duration <= 0) && !isTimeValue(end)) {
			setScheduleError('Enter a valid end time or duration.');
			return;
		}
		var rule = {
			id: editingScheduleId || (String(Date.now()) + '-' + Math.random().toString(16).slice(2)),
			host: host,
			mode: mode,
			start: start,
			end: end,
			durationMinutes: isNaN(duration) ? 0 : Math.max(0, duration)
		};
		if (editingScheduleId) {
			scheduleCache = scheduleCache.map(function(item) {
				return item.id === editingScheduleId ? rule : item;
			});
		} else {
			scheduleCache.push(rule);
		}
		chrome.storage.local.set({ schedule_rules: scheduleCache }, function() {
			clearScheduleForm();
			renderSchedules();
			chrome.runtime.sendMessage({ text: 'schedule-refresh' });
		});
	}

	function renderSchedules() {
		var list = document.querySelector('#schedule-list');
		if (!list) {
			return;
		}
		list.innerHTML = '';
		if (!scheduleCache.length) {
			var empty = document.createElement('div');
			empty.className = 'rules-empty';
			empty.textContent = 'No schedules yet.';
			list.appendChild(empty);
			return;
		}
		scheduleCache.forEach(function(rule) {
			var item = document.createElement('div');
			item.className = 'rule-item';

			var main = document.createElement('div');
			main.className = 'rule-main';

			var hostEl = document.createElement('div');
			hostEl.className = 'rule-host';
			hostEl.textContent = rule.host;

			var metaEl = document.createElement('div');
			metaEl.className = 'rule-meta';
			metaEl.textContent = formatSchedule(rule);

			main.appendChild(hostEl);
			main.appendChild(metaEl);

			var actions = document.createElement('div');
			actions.className = 'rule-actions';

			var editButton = document.createElement('button');
			editButton.type = 'button';
			editButton.textContent = 'Edit';
			editButton.addEventListener('click', function() {
				editSchedule(rule.id);
			});

			var deleteButton = document.createElement('button');
			deleteButton.type = 'button';
			deleteButton.textContent = 'Delete';
			deleteButton.addEventListener('click', function() {
				deleteSchedule(rule.id);
			});

			actions.appendChild(editButton);
			actions.appendChild(deleteButton);

			item.appendChild(main);
			item.appendChild(actions);
			list.appendChild(item);
		});
	}

	function formatSchedule(rule) {
		var modeLabel = rule.mode === 'c' ? 'Unlock Copy' : (rule.mode === 'a' ? 'Force Mode' : 'Dual');
		var windowLabel = rule.start + ' - ' + (rule.durationMinutes > 0 ? ('+' + rule.durationMinutes + 'm') : rule.end);
		return modeLabel + ' | ' + windowLabel;
	}

	function editSchedule(id) {
		var rule = scheduleCache.find(function(item) {
			return item.id === id;
		});
		if (!rule) {
			return;
		}
		var hostInput = document.querySelector('#schedule-host');
		var modeInput = document.querySelector('#schedule-mode');
		var startInput = document.querySelector('#schedule-start');
		var endInput = document.querySelector('#schedule-end');
		var durationInput = document.querySelector('#schedule-duration');
		if (!hostInput || !modeInput || !startInput || !endInput || !durationInput) {
			return;
		}
		hostInput.value = rule.host;
		modeInput.value = rule.mode;
		startInput.value = rule.start;
		endInput.value = rule.end || '';
		durationInput.value = rule.durationMinutes ? String(rule.durationMinutes) : '';
		editingScheduleId = rule.id;
		setScheduleError('');
	}

	function deleteSchedule(id) {
		scheduleCache = scheduleCache.filter(function(item) {
			return item.id !== id;
		});
		chrome.storage.local.set({ schedule_rules: scheduleCache }, function() {
			renderSchedules();
			chrome.runtime.sendMessage({ text: 'schedule-refresh' });
		});
	}

	function clearScheduleForm() {
		var hostInput = document.querySelector('#schedule-host');
		var modeInput = document.querySelector('#schedule-mode');
		var startInput = document.querySelector('#schedule-start');
		var endInput = document.querySelector('#schedule-end');
		var durationInput = document.querySelector('#schedule-duration');
		if (hostInput) {
			hostInput.value = '';
		}
		if (modeInput) {
			modeInput.value = 'c';
		}
		if (startInput) {
			startInput.value = '';
		}
		if (endInput) {
			endInput.value = '';
		}
		if (durationInput) {
			durationInput.value = '';
		}
		editingScheduleId = null;
		setScheduleError('');
	}

	function setScheduleError(message) {
		var errorEl = document.querySelector('#schedule-error');
		if (errorEl) {
			errorEl.textContent = message || '';
		}
	}

	function isTimeValue(value) {
		return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
	}

	function loadDiagnostics() {
		chrome.storage.local.get('diagnostics_report', function(value) {
			if (value.diagnostics_report) {
				renderDiagnostics(value.diagnostics_report);
			}
		});
	}

	function renderDiagnostics(report) {
		var lines = [];
		lines.push('Compatibility score: ' + report.score + '/100');
		lines.push('URL: ' + (report.url || 'Unknown'));
		lines.push('Frames: ' + report.frameCount + ' (accessible), iframes: ' + report.iframeCount + ', blocked: ' + report.blockedFrames);
		lines.push('Shadow roots: ' + report.shadowCount);
		lines.push('Selection blockers (sample): ' + report.blockedStyleCount);
		lines.push('Inline handlers (sample): ' + report.inlineHandlerCount);
		lines.push('Overlay candidates (sample): ' + report.overlayCount);
		lines.push('Context menu blocked: ' + (report.contextMenuBlocked ? 'Yes' : 'No'));
		if (report.lastError) {
			lines.push('Last error: ' + report.lastError);
		}
		if (report.hint) {
			lines.push('Hint: ' + report.hint);
		}
		setDiagnosticsOutput(lines.join('\n'));
	}

	function setDiagnosticsOutput(text) {
		var output = document.querySelector('#diagnostics-output');
		if (output) {
			output.textContent = text || '';
		}
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

	function renderVault() {
		var list = document.querySelector('#vault-list');
		var empty = document.querySelector('#vault-empty');
		if (!list || !empty) {
			return;
		}
		list.innerHTML = '';
		var items = vaultCache;
		if (vaultSearchTerm) {
			items = vaultCache.filter(function(item) {
				var text = (item.text || '').toLowerCase();
				var tags = Array.isArray(item.tags) ? item.tags.join(', ').toLowerCase() : '';
				return text.indexOf(vaultSearchTerm) !== -1 || tags.indexOf(vaultSearchTerm) !== -1;
			});
		}
		if (!items.length) {
			empty.style.display = 'block';
			return;
		}
		empty.style.display = 'none';
		items.forEach(function(item) {
			var row = document.createElement('div');
			row.className = 'vault-item';

			var textEl = document.createElement('div');
			textEl.className = 'vault-text';
			textEl.textContent = item.text || '';

			var metaEl = document.createElement('div');
			metaEl.className = 'vault-meta';
			metaEl.textContent = buildVaultMeta(item);

			var tagInput = document.createElement('input');
			tagInput.className = 'vault-tags';
			tagInput.type = 'text';
			tagInput.placeholder = 'tags (comma separated)';
			tagInput.value = Array.isArray(item.tags) ? item.tags.join(', ') : '';
			tagInput.addEventListener('change', function() {
				updateSnippetTags(item.id, tagInput.value);
			});

			var buttons = document.createElement('div');
			buttons.className = 'vault-buttons';

			var copyButton = document.createElement('button');
			copyButton.type = 'button';
			copyButton.textContent = 'Copy';
			copyButton.addEventListener('click', function() {
				copySnippetText(item.text || '');
			});

			var deleteButton = document.createElement('button');
			deleteButton.type = 'button';
			deleteButton.className = 'vault-delete';
			deleteButton.textContent = 'Delete';
			deleteButton.addEventListener('click', function() {
				deleteSnippet(item.id);
			});

			buttons.appendChild(copyButton);
			buttons.appendChild(deleteButton);

			row.appendChild(textEl);
			row.appendChild(metaEl);
			row.appendChild(tagInput);
			row.appendChild(buttons);
			list.appendChild(row);
		});
	}

	function buildVaultMeta(item) {
		var host = '';
		if (item.url) {
			try {
				host = (new URL(item.url)).hostname;
			} catch (error) {
			}
		}
		var date = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown date';
		return (host ? host + ' · ' : '') + date;
	}

	function updateSnippetTags(id, value) {
		var tags = value.split(',').map(function(tag) {
			return tag.trim();
		}).filter(function(tag) {
			return tag.length > 0;
		});
		var updated = false;
		vaultCache = vaultCache.map(function(item) {
			if (item.id === id) {
				updated = true;
				item.tags = tags;
			}
			return item;
		});
		if (updated) {
			chrome.storage.local.set({ snippet_vault: vaultCache }, function() {
				renderVault();
			});
		}
	}

	function deleteSnippet(id) {
		var next = vaultCache.filter(function(item) {
			return item.id !== id;
		});
		vaultCache = next;
		chrome.storage.local.set({ snippet_vault: vaultCache }, function() {
			renderVault();
		});
	}

	function copySnippetText(text) {
		if (!text) {
			return;
		}
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).catch(function() {
				fallbackCopySnippet(text);
			});
			return;
		}
		fallbackCopySnippet(text);
	}

	function fallbackCopySnippet(text) {
		var textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.style.position = 'fixed';
		textarea.style.top = '-9999px';
		textarea.style.left = '-9999px';
		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();
		document.execCommand('copy');
		textarea.remove();
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

	function loadSessionPrefs() {
		chrome.storage.local.get('session_prefs', function(value) {
			var prefs = normalizeSessionPrefs(value.session_prefs);
			updateSessionPrefsUI(prefs);
		});
	}

	function updateSessionPrefsUI(prefs) {
		var defaultToggle = document.querySelector('#session-default');
		var reloadToggle = document.querySelector('#session-disable-reload');
		var navigateToggle = document.querySelector('#session-disable-navigate');
		var timeoutInput = document.querySelector('#session-timeout');
		if (defaultToggle) {
			defaultToggle.checked = !!prefs.defaultEnabled;
		}
		if (reloadToggle) {
			reloadToggle.checked = !!prefs.disableOnReload;
		}
		if (navigateToggle) {
			navigateToggle.checked = !!prefs.disableOnNavigate;
		}
		if (timeoutInput) {
			timeoutInput.value = prefs.autoDisableMinutes ? String(prefs.autoDisableMinutes) : '';
		}
	}

	function saveSessionPrefs() {
		var prefs = collectSessionPrefs();
		chrome.storage.local.set({ session_prefs: prefs }, function() {
			setSessionStatus('Session settings saved.');
		});
	}

	function collectSessionPrefs() {
		var defaultToggle = document.querySelector('#session-default');
		var reloadToggle = document.querySelector('#session-disable-reload');
		var navigateToggle = document.querySelector('#session-disable-navigate');
		var timeoutInput = document.querySelector('#session-timeout');
		var rawMinutes = timeoutInput ? parseInt(timeoutInput.value, 10) : 0;
		return normalizeSessionPrefs({
			defaultEnabled: defaultToggle ? defaultToggle.checked : false,
			disableOnReload: reloadToggle ? reloadToggle.checked : false,
			disableOnNavigate: navigateToggle ? navigateToggle.checked : false,
			autoDisableMinutes: isNaN(rawMinutes) ? 0 : rawMinutes
		});
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
		chrome.storage.local.get(['websites_List', 'websites_Meta', 'custom_rules', 'session_prefs', 'schedule_rules'], function(value) {
			var payload = {
				version: 1,
				exportedAt: new Date().toISOString(),
				websites_List: Array.isArray(value.websites_List) ? value.websites_List : [],
				websites_Meta: value.websites_Meta && typeof value.websites_Meta === 'object' ? value.websites_Meta : {},
				custom_rules: normalizeRules(value.custom_rules),
				session_prefs: normalizeSessionPrefs(value.session_prefs),
				schedule_rules: normalizeScheduleRules(value.schedule_rules)
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
		if (!source || (source.websites_List === undefined && source.websites_Meta === undefined && source.custom_rules === undefined && source.session_prefs === undefined && source.schedule_rules === undefined)) {
			setBackupStatus('Missing settings payload.', true);
			return;
		}
		var list = normalizeWebsitesList(source.websites_List);
		var meta = normalizeWebsitesMeta(source.websites_Meta, list);
		var rules = normalizeRules(source.custom_rules);
		var prefs = normalizeSessionPrefs(source.session_prefs);
		var schedules = normalizeScheduleRules(source.schedule_rules);
		chrome.storage.local.set({
			websites_List: list,
			websites_Meta: meta,
			custom_rules: rules,
			session_prefs: prefs,
			schedule_rules: schedules
		}, function() {
			loadUserList();
			loadRules();
			updateSessionPrefsUI(prefs);
			scheduleCache = schedules;
			renderSchedules();
			setBackupStatus('Settings imported.');
			chrome.runtime.sendMessage({ text: 'schedule-refresh' });
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
			chrome.storage.local.remove('rule_builder_draft');
			setRuleBuilderStatus('Rule saved.');
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

	function setRuleBuilderStatus(message) {
		var statusEl = document.querySelector('#rule-builder-status');
		if (statusEl) {
			statusEl.textContent = message || '';
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

	function setSessionStatus(message, isError) {
		var status = document.querySelector('#session-status');
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

	function setDomainStatus(message, isError) {
		var status = document.querySelector('#domain-status');
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

	chrome.runtime.onMessage.addListener(function(request) {
		if (request.text === 'diagnostics-result' && request.report) {
			renderDiagnostics(request.report);
			chrome.storage.local.set({ diagnostics_report: request.report });
		}
	});

})();

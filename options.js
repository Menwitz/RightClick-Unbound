(function() {
	var rulesCache = {};
	var editingHost = null;

	function callback() {
		loadUserList();
		initRules();
	}

	function loadUserList() {
		var u = document.querySelector('#user-list');
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

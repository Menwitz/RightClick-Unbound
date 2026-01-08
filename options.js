(function() {

	function callback(u) {
		u = document.querySelector('#user-list');
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

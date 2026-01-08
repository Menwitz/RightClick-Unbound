(function() {
	'use strict';

	if (typeof window === 'undefined') {
		return;
	}

	var mode = document.documentElement.getAttribute('data-rcu-copy-mode') || 'text';
	document.documentElement.removeAttribute('data-rcu-copy-mode');

	function getSelectionInfo() {
		var selection = window.getSelection();
		if (selection && selection.rangeCount > 0) {
			var text = selection.toString();
			if (text && text.trim()) {
				return { text: text, range: selection.getRangeAt(0) };
			}
		}
		var active = document.activeElement;
		if (active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && /^(text|search|url|email|tel|password)$/i.test(active.type)))) {
			var start = active.selectionStart;
			var end = active.selectionEnd;
			if (typeof start === 'number' && typeof end === 'number' && start !== end) {
				return { text: active.value.substring(start, end), range: null };
			}
		}
		return { text: '', range: null };
	}

	function cleanText(text) {
		if (!text) {
			return '';
		}
		var cleaned = text.replace(/\r/g, '');
		cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
		cleaned = cleaned.replace(/[ \t]+/g, ' ');
		cleaned = cleaned.replace(/[ \t]+\n/g, '\n');
		cleaned = cleaned.replace(/\n[ \t]+/g, '\n');
		cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
		return cleaned.trim();
	}

	function nodeToMarkdown(node) {
		if (!node) {
			return '';
		}
		if (node.nodeType === Node.TEXT_NODE) {
			return node.nodeValue || '';
		}
		if (node.nodeType !== Node.ELEMENT_NODE) {
			return '';
		}
		var tag = node.tagName.toLowerCase();
		var children = '';
		for (var i = 0; i < node.childNodes.length; i++) {
			children += nodeToMarkdown(node.childNodes[i]);
		}
		if (tag === 'a') {
			var href = node.getAttribute('href') || '';
			return href ? ('[' + children.trim() + '](' + href + ')') : children;
		}
		if (tag === 'strong' || tag === 'b') {
			return '**' + children.trim() + '**';
		}
		if (tag === 'em' || tag === 'i') {
			return '*' + children.trim() + '*';
		}
		if (tag === 'code') {
			return '`' + children.replace(/`/g, '\\`').trim() + '`';
		}
		if (tag === 'pre') {
			return '\n```\n' + node.textContent.trim() + '\n```\n';
		}
		if (tag === 'br') {
			return '\n';
		}
		if (tag === 'li') {
			return '- ' + children.trim() + '\n';
		}
		if (tag === 'p' || tag === 'div') {
			return children.trim() + '\n\n';
		}
		return children;
	}

	function selectionToMarkdown(range) {
		if (!range) {
			return '';
		}
		var fragment = range.cloneContents();
		var container = document.createElement('div');
		container.appendChild(fragment);
		return nodeToMarkdown(container);
	}

	function copyText(text) {
		if (!text) {
			return false;
		}
		var textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.setAttribute('readonly', 'readonly');
		textarea.style.position = 'fixed';
		textarea.style.top = '-9999px';
		textarea.style.left = '-9999px';
		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();
		var success = false;
		try {
			success = document.execCommand('copy');
		} catch (error) {
			success = false;
		}
		textarea.remove();
		return success;
	}

	function showToast(message) {
		var existing = document.getElementById('rcu-copy-toast');
		if (existing) {
			existing.remove();
		}
		var toast = document.createElement('div');
		toast.id = 'rcu-copy-toast';
		toast.textContent = message;
		toast.style.position = 'fixed';
		toast.style.bottom = '18px';
		toast.style.right = '18px';
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

	var selectionInfo = getSelectionInfo();
	if (!selectionInfo.text) {
		showToast('Select text to copy.');
		return;
	}
	var output = selectionInfo.text;
	if (mode === 'markdown' && selectionInfo.range) {
		output = selectionToMarkdown(selectionInfo.range);
	}
	output = cleanText(output);
	var copied = copyText(output);
	showToast(copied ? ('Copied clean ' + (mode === 'markdown' ? 'Markdown' : 'text') + '.') : 'Copy failed.');

})();

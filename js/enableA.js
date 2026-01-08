(function() {
	'use strict';

	var cssText = `* {
		-webkit-user-select: text !important;
		-moz-user-select: text !important;
		-ms-user-select: text !important;
		 user-select: text !important;
	}`;
	var guardEvents = ['contextmenu', 'copy', 'cut', 'paste', 'mouseup', 'mousedown', 'keyup', 'keydown', 'drag', 'dragstart', 'select', 'selectstart'];

	function allowInlineSelect(element) {
		if (!element || !element.style) {
			return;
		}
		if (element.style.userSelect === 'none') {
			element.style.userSelect = 'text';
		}
		if (element.style.webkitUserSelect === 'none') {
			element.style.webkitUserSelect = 'text';
		}
		if (element.style.MozUserSelect === 'none') {
			element.style.MozUserSelect = 'text';
		}
		if (element.style.msUserSelect === 'none') {
			element.style.msUserSelect = 'text';
		}
	}

	function relaxSelection(root) {
		if (!root || !root.querySelectorAll) {
			return;
		}
		var elements = root.querySelectorAll('*');
		for (var i = 0; i < elements.length; i++) {
			allowInlineSelect(elements[i]);
		}
	}

	function ensureStyle(root) {
		if (!root) {
			return;
		}
		var isShadow = typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot;
		var scope = isShadow ? root : document;
		if (scope.querySelector('style[data-rcu-style]')) {
			return;
		}
		var style = document.createElement('style');
		style.setAttribute('data-rcu-style', 'true');
		style.type = 'text/css';
		style.innerText = cssText;
		if (isShadow) {
			root.appendChild(style);
		} else {
			(document.head || document.documentElement).appendChild(style);
		}
	}

	function addEventGuards(target) {
		if (!target || target.__rcuGuarded) {
			return;
		}
		target.__rcuGuarded = true;
		guardEvents.forEach(function(event) {
			target.addEventListener(event, function(e) {
				e.stopPropagation();
			}, true);
		});
	}

	function applyRoot(root) {
		ensureStyle(root);
		relaxSelection(root);
		addEventGuards(root);
	}

	function observeRoot(root) {
		if (!root || root.__rcuObserver) {
			return;
		}
		var observer = new MutationObserver(function(mutations) {
			for (var i = 0; i < mutations.length; i++) {
				var mutation = mutations[i];
				if (mutation.type === 'attributes') {
					allowInlineSelect(mutation.target);
					continue;
				}
				if (mutation.type !== 'childList') {
					continue;
				}
				for (var j = 0; j < mutation.addedNodes.length; j++) {
					handleAddedNode(mutation.addedNodes[j]);
				}
			}
		});
		observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
		root.__rcuObserver = observer;
	}

	function installShadow(root) {
		if (!root || root.__rcuShadowApplied) {
			return;
		}
		root.__rcuShadowApplied = true;
		applyRoot(root);
		observeRoot(root);
	}

	function scanShadowRoots(container) {
		if (!container || !container.querySelectorAll) {
			return;
		}
		var nodes = container.querySelectorAll('*');
		for (var i = 0; i < nodes.length; i++) {
			if (nodes[i].shadowRoot) {
				installShadow(nodes[i].shadowRoot);
			}
		}
	}

	function handleAddedNode(node) {
		if (!node || node.nodeType !== 1) {
			return;
		}
		allowInlineSelect(node);
		if (node.shadowRoot) {
			installShadow(node.shadowRoot);
		}
		if (node.querySelectorAll) {
			var nodes = node.querySelectorAll('*');
			for (var i = 0; i < nodes.length; i++) {
				allowInlineSelect(nodes[i]);
				if (nodes[i].shadowRoot) {
					installShadow(nodes[i].shadowRoot);
				}
			}
		}
	}

	function patchAttachShadow() {
		if (!Element.prototype.attachShadow || Element.prototype.__rcuShadowPatched) {
			return;
		}
		var original = Element.prototype.attachShadow;
		Element.prototype.attachShadow = function(init) {
			var shadow = original.call(this, init);
			try {
				installShadow(shadow);
			} catch (error) {
			}
			return shadow;
		};
		Element.prototype.__rcuShadowPatched = true;
	}

	function clearHandlers() {
		var body = document.body || document.documentElement;
		document.oncontextmenu = null;
		document.onselectstart = null;
		document.ondragstart = null;
		document.onmousedown = null;
		if (body) {
			body.oncontextmenu = null;
			body.onselectstart = null;
			body.ondragstart = null;
			body.onmousedown = null;
			body.oncut = null;
			body.oncopy = null;
			body.onpaste = null;
		}
	}

	clearHandlers();
	applyRoot(document);
	var rootElement = document.documentElement || document.body;
	if (rootElement) {
		observeRoot(rootElement);
	}
	scanShadowRoots(document);
	patchAttachShadow();

})();

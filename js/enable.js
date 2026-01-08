(function() {
	'use strict';

	var cssText = `* {
		-webkit-user-select: text !important;
		-moz-user-select: text !important;
		-ms-user-select: text !important;
		 user-select: text !important;
	}`;
	var guardEvents = ['copy', 'cut', 'paste', 'select', 'selectstart', 'contextmenu'];

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

	setTimeout(function() {
		document.oncontextmenu = null;
	}, 2000);

	window.addEventListener('contextmenu', function handleEvent(event) {
		event.stopPropagation();
		event.stopImmediatePropagation();
		var handler = new EventHandler(event);
		window.removeEventListener(event.type, handleEvent, true);
		var EventsCallBback = new EventsCall(function() {});
		handler.fire();
		window.addEventListener(event.type, handleEvent, true);
		if (handler.isCanceled && (EventsCallBback.isCalled)) {
			event.preventDefault();
		}
	}, true);

	function EventsCall(callback) {
		this.events = ['DOMAttrModified', 'DOMNodeInserted', 'DOMNodeRemoved', 'DOMCharacterDataModified', 'DOMSubtreeModified'];
		this.bind();
	}

	EventsCall.prototype.bind = function() {
		this.events.forEach(function(event) {
			document.addEventListener(event, this, true);
		}.bind(this));
	};

	EventsCall.prototype.handleEvent = function() {
		this.isCalled = true;
	};

	EventsCall.prototype.unbind = function() {
		this.events.forEach(function(event) {}.bind(this));
	};

	function EventHandler(event) {
		this.event = event;
		this.contextmenuEvent = this.createEvent(this.event.type);
	}

	EventHandler.prototype.createEvent = function(type) {
		var target = this.event.target;
		var event = target.ownerDocument.createEvent('MouseEvents');
		event.initMouseEvent(
			type, this.event.bubbles, this.event.cancelable,
			target.ownerDocument.defaultView, this.event.detail,
			this.event.screenX, this.event.screenY, this.event.clientX, this.event.clientY,
			this.event.ctrlKey, this.event.altKey, this.event.shiftKey, this.event.metaKey,
			this.event.button, this.event.relatedTarget
		);
		return event;
	};

	EventHandler.prototype.fire = function() {
		var target = this.event.target;
		var contextmenuHandler = function(event) {
			event.preventDefault();
		}.bind(this);
		target.dispatchEvent(this.contextmenuEvent);
		this.isCanceled = this.contextmenuEvent.defaultPrevented;
	};

})();

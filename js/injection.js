(function() {
    'use strict';

	var script = document.createElement('script');

	script.src = chrome.runtime.getURL('js/enable.js');

	document.body.appendChild(script);

	let inject = {
		code: script,
		allFrames: true
	};

})();

process.env.NODE_PATH = "/usr/lib/node_modules/";
require('module').Module._initPaths();

networkCore = require("/opt/beocreate/beocreate_essentials/networking");
iwconfig = require('wireless-tools/iwconfig');
ifconfig = require('wireless-tools/ifconfig');

/*networkCore.getWifiStatus(function(status, error) {
	console.log("Status of Wi-Fi connection:", status, "Errors:", error);
});*/

ifconfig.up({interface: 'wlan0'}, function(err) {
	if (err) {
		// The system has no Wi-Fi capabilities.
		console.error(err);
	} else {
		console.log("wlan0 on.");
	}
});

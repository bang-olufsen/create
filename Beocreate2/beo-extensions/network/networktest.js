process.env.NODE_PATH = "/usr/lib/node_modules/";
require('module').Module._initPaths();

networkCore = require("/opt/beocreate/beocreate_essentials/networking");

networkCore.getEthernetStatus(function(status, error) {
	console.log("Status of Ethernet connection:", status, "Errors:", error);
});

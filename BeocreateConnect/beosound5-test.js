var BS5 = require("node-hid/src/beosound5.js");

Beosound5 = new BS5.Beosound5();

Beosound5.powerState(0);

Beosound5.on('data', function() {
	console.log("Data here");
});
/*Copyright 2021 Bang & Olufsen A/S
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.*/

// BEOCREATE GENERAL SETTINGS


	var version = require("./package.json").version;
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (beo.extensions.interact) beo.extensions.interact.runTrigger("general-settings", "systemBoot");
		}
		
	});

	
	beo.bus.on('general-settings', function(event) {
		
		
		
		if (event.header == "restartProduct") {
			if (debug) console.error("User-requested product reboot...");
			beo.bus.emit("general", {header: "requestReboot", content: {extension: "general-settings"}});
			
		}
		
		if (event.header == "shutdownProduct") {
			if (debug) console.error("User-requested product shutdown...");
			beo.bus.emit("general", {header: "requestShutdown", content: {extension: "general-settings"}});
			
		}
		
		
		
	});
	
	
	
interact = {
	actions: {
		power: function(interactData) {
			if (interactData.option == "shutdown") {
				beo.bus.emit("general", {header: "requestShutdown", content: {extension: "interact"}});
			}
			if (interactData.option == "restart") {
				beo.bus.emit("general", {header: "requestReboot", content: {extension: "interact"}});
			}
		}
	},
	triggers: {
		systemBoot: function(data, interactData) {
			return true;
		}
	}
}
	
module.exports = {
	version: version,
	interact: interact
};





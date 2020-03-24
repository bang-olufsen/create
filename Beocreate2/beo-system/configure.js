/*Copyright 2017-2019 Bang & Olufsen A/S
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

// BEOCREATE 2 SETTINGS FILE EDITOR
/* This allows writing settings to the Beocreate settings files.

Usage: node /path/to/program.js extension parameter value
*/


var fs = require('fs');
var dataDirectory = "/etc/beocreate/";

processPath = process.argv[1];
cmdArgs = process.argv.slice(2);
if (!cmdArgs[2]) {
	console.log("Usage: node "+processPath+" [extension] [parameter] [value]\nValue supports JSON data types.");
} else {
	// [0] extension [1] parameter [2+] value
	value = cmdArgs.slice(2).join(" ");
	settings = null;
	if (fs.existsSync(dataDirectory+cmdArgs[0]+".json")) {
		createSettings = false;
		try {
			settings = JSON.parse(fs.readFileSync(dataDirectory+cmdArgs[0]+".json"));
		} catch (error) {
			console.error("The file does not contain valid JSON:", error);
		}
	} else {
		// No settings exist, start from scratch.
		createSettings = true;
		settings = {};
	}
	if (settings != null) {
		[returnValue, error] = getValueJSON(value);
		if (error) { // There was an error.
			console.log("Value could not be interpreted as JSON, falling back to old method.");
			settings[cmdArgs[1]] = getValue(value);
		} else {
			settings[cmdArgs[1]] = returnValue;
		}
		try {
			fs.writeFileSync(dataDirectory+cmdArgs[0]+".json", JSON.stringify(settings));
			if (createSettings == false) {
				console.log("Settings updated for '"+cmdArgs[0]+"'.");
			} else {
				console.log("Settings created for '"+cmdArgs[0]+"'.");
			}
		} catch (error) {
			console.error("Unable to write file:", error);
		}
	}
}
process.exit(0);

function getValueJSON(value) {
	try {
		return [JSON.parse("{\"data\": "+value+"}").data, null];
	} catch (error) {
		return [null, error];
	}
}

function getValue(value) {
	if (value == "true" || value == "false") {
	 	return (value == "true") ? true : false;
	} else if (value == "null") {
		return null;
	} else if (isNaN(value)) {
		return value;
	} else {
		return Number(value);
	}
}
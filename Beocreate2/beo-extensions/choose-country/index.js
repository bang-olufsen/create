/*Copyright 2018 Bang & Olufsen A/S
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

// BEOCREATE COUNTRY SELECTOR

var countryList = require('country-list');

	var extensions = beo.extensions;
	var currentCountryCode = null;
	var debug = beo.debug;
	
	var version = require("./package.json").version;
	
	var orderedCountries = {};
	
	beo.bus.on('general', function(event) {
		// See documentation on how to use beo.bus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
			if (extensions["network"] && extensions["network"].getCountry) {
				country = extensions["network"].getCountry();
				if (country == undefined) {
					if (extensions["setup"] && extensions["setup"].joinSetupFlow) {
						extensions["setup"].joinSetupFlow("choose-country", {after: null, before: ["network", "speaker-preset", "product-information"]});
					}
				}
			}
			
			// Get country names and sort them.
			countryNames = countryList.getCodeList();
			countryArray = [];
			for (code in countryNames) {
				countryArray.push([code, countryNames[code]]);
			}
			countryArray.sort(function(a, b)
			{
				var x = a[1].toLowerCase(),
					y = b[1].toLowerCase();
				return x < y ? -1 : x > y ? 1 : 0;
			});
			for (var i = 0; i < countryArray.length; i++) {
				orderedCountries[countryArray[i][0]] = countryArray[i][1];
			}
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "choose-country") {
				beo.bus.emit("ui", {target: "choose-country", header: "showList", content: {countries: orderedCountries}});
				getAndShowCurrentCountry();
			}
			
			if (event.content.extension == "network") {
				getAndShowCurrentCountry();
			}
		}
	});
	
	beo.bus.on('choose-country', function(event) {
		
		if (event.header == "currentCountry") {
			
			if (event.content.country != undefined) currentCountryCode = event.content.country;
			countryName = (currentCountryCode != null) ? countryList.getName(currentCountryCode) : null;
			beo.bus.emit("ui", {target: "choose-country", header: "showCurrent", content: {countryCode: currentCountryCode, countryName: countryName}});
			
			
		}
		
		if (event.header == "setCountry" && event.content.country) {
			if (event.content.country != currentCountryCode) {
				if (extensions["network"] && extensions["network"].setCountry) {
					if (debug) console.log("Setting Wi-Fi country to "+event.content.country.toUpperCase()+"...");
					newCountry = extensions["network"].setCountry(event.content.country);
					if (newCountry) {
						currentCountryCode = newCountry;
						countryName = (currentCountryCode != null) ? countryList.getName(currentCountryCode) : null;
						beo.bus.emit("ui", {target: "choose-country", header: "showCurrent", content: {countryCode: currentCountryCode, countryName: countryName}});
						if (extensions["setup"] && extensions["setup"].allowAdvancing) {
							extensions["setup"].allowAdvancing("choose-country", true);
						}
					}
				}
			}
		}
		
	});
	
	function getAndShowCurrentCountry() {
		if (extensions["network"] && extensions["network"].getCountry) {
			country = extensions["network"].getCountry();
			if (country != undefined) currentCountryCode = country;
			countryName = (currentCountryCode != null) ? countryList.getName(currentCountryCode) : null;
			beo.bus.emit("ui", {target: "choose-country", header: "showCurrent", content: {countryCode: currentCountryCode, countryName: countryName}});
		}
	}
	
	
module.exports = {
	version: version
};





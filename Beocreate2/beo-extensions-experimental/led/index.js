/*Copyright 2018-2019 Bang & Olufsen A/S
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

// BEOCREATE STATUS LED CONTROL

var pigpio = require('pigpio'); // For GPIO control.


module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var debug = globals.debug;
	
	var version = require("./package.json").version;
	
	var ledR = null;
	var ledG = null;
	var ledB = null;
	var ledInitialised = false;
	
	var defaultSettings = {
		"calibratedWhite": [255,255,255],
		"pins": [5,6,12]
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	
	var calibrationOverride = null;
	
	var persistentColour = [0,0,0] // If a persistent colour is set, this colour will be restored after another effect is complete, instead of fading out. Should be used sparingly, only by major system functions (e.g. standby/on state).
	var previousColour = [0,0,0];
	var selectedColour = [0,0,0]; // Stores the set colour value. Most functions change this colour; notable exception is the tempFlash, which flashes another colour temporarily and then restores the earlier colour.
	var actualColour = [0,0,0]; // Stores the actual colour value that's currently active.
	
	
	beoBus.on('general', function(event) {
		// See documentation on how to use BeoBus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
			initialise(settings.pins[0], settings.pins[1], settings.pins[2]);
			/*setTimeout(function() {
				fadeTo({colour: "white", then: {action: "fadeTo", colour: "red", after: 2, speed: "slow"}});
			}, 500);*/
		}
		
		if (event.header == "shutdown") {
			if (ledInitialised) terminate();
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "led") {
				beoBus.emit("ui", {target: "led", header: "calibratedWhite", content: {white: settings.calibratedWhite}});
			}
		}
	});
	
	
	beoBus.on("led", function(event) {
		
		switch (event.header) {
			case "settings":
				if (event.content.settings) {
					settings = event.content.settings;
				}
				break;
			case "calibratedWhite":
				if (event.content.white && event.content.white.length == 3) {
					settings.calibratedWhite = event.content.white;
					clearTimeout(calibrationOverride);
					calibrationOverride = setTimeout(function() {
						calibrationOverride = null;
						actualColour = selectedColour.slice(0);
						updateLED();
					}, 3000);
					actualColour = settings.calibratedWhite.slice(0);
					updateLED();
					beoBus.emit("settings", {header: "saveSettings", content: {extension: "led", settings: settings}});
				}
				break;
			case "fadeTo":
				if (event.content.options) {
					options = event.content.options;
					if (event.content.then) options.then = event.content.then;
					fadeTo(options);
				}
				break;
			case "fadeOut":
				if (event.content.options) {
					fadeOut(event.content.options);
				}
			case "blink":
				if (event.content.options) {
					blink(event.content.options);
				}
				break;
			case "getActiveSources":
				break;
		}
	});
	
	// Initialises the LEDs for operation. 
	function initialise(red, green, blue) {
		if (red && green && blue) {
			pigpio.configureClock(10, pigpio.CLOCK_PWM); // Configures PiGPIO to use PWM as clock source (by default it uses PCM which conflicts with BeoCreate 4-Channel Amplifier).
			pigpio.initialize(); // pigpio C library initialized here
			
			ledR = new pigpio.Gpio(red, {mode: pigpio.Gpio.OUTPUT});
			ledG = new pigpio.Gpio(green, {mode: pigpio.Gpio.OUTPUT});
			ledB = new pigpio.Gpio(blue, {mode: pigpio.Gpio.OUTPUT});
			ledInitialised = true;
			beoBus.emit("general", {header: "requestShutdownTime", content: {extension: "led"}});
			return true;
		} else {
			return false;
		}
	}
	
	function terminate() {
		turnOff();
		pigpio.terminate(); // pigpio C library terminated here
		beoBus.emit("general", {header: "shutdownComplete", content: {extension: "led"}});
	}
	
	
	function colourWithCalibratedWhite(rgb) {
		return [Math.round(settings.calibratedWhite[0]/255 * rgb[0]), Math.round(settings.calibratedWhite[1]/255 * rgb[1]), Math.round(settings.calibratedWhite[2]/255 * rgb[2])];
	}
	
	// Converts plain-language colour names to RGB values with calibrated white.
	function colourNameToRGB(colourName) {
		switch (colourName) {
			case "red":
				rgb = [255,0,0];
				break;
			case "green":
				rgb = [0,255,0];
				break;
			case "blue":
				rgb = [0,50,255];
				break;
			case "white":
				rgb = [255,255,255];
				break;
			case "yellow":
				rgb = [255,255,0];
				break;
			case "orange":
				rgb = [255,50,0];
				break;
			case "turquoise":
				rgb = [0,255,160];
				break;
			case "purple":
				rgb = [200,0,255];
				break;
		}
		return colourWithCalibratedWhite(rgb);
	}
	
	var fadeInterval = null;
	var ledDelay = null;
	var flashOverride = false;
	var calibrationOverride = false;
	
	function fadeTo(options) {
		// If a fade is in progress, stop it and use the present value as the starting point for transition (previousColour).
		if (fadeInterval != null || blinkInterval != null) {
			stopIntervals();
			previousColour = actualColour.slice(0);
		} else {
			previousColour = selectedColour.slice(0);
		}
		
		// If fadeOutAfter is set, fade out the LED after a number of seconds.
		clearTimeout(ledDelay);
		if (options.then && options.then.action && options.then.after) {
			
			switch (options.then.action) {
				case "fadeOut":
					ledDelay = setTimeout(function() {
						fadeOut(options.then);
					}, 1000*options.then.after);
					break;
				case "fadeTo":
					ledDelay = setTimeout(function() {
						fadeTo(options.then);
					}, 1000*options.then.after);
					break;
			}
			
		}
		
		// If colour values have been provided in RGB, use them. Otherwise convert colour name.
		if (options.rgbDirect) {
			selectedColour = options.rgbDirect; // Do not use calibrated white point.
		} else if (options.rgb) {
			selectedColour = colourWithCalibratedWhite(options.rgb);
		} else if (options.colour) {
			selectedColour = colourNameToRGB(options.colour);
		}
		
		if (options.persistent != undefined) {
			if (options.persistent = true) {
				persistentColour = selectedColour.slice(0);
			} else {
				// Clears the persistent colour.
				persistentColour = [0,0,0];
			}
		}
		
		// Determine the transition steps based on the largest colour value difference, so that all colours reach the end value at the same time.
		
		// Find largest colour difference, or the amount of steps in the transition.
		colourDifference = [selectedColour[0] - previousColour[0], selectedColour[1] - previousColour[1], selectedColour[2] - previousColour[2]];
		
		//console.log(previousColour);
		//console.log(colourDifference);
		//console.log(selectedColour);
		
		steps = 0;
		for (var i = 0; i < 3; i++) {
			if (steps < Math.abs(colourDifference[i])) {
				steps = Math.abs(colourDifference[i]);
			}
		}
		
		
		
		if (steps != 0) {
		
			if (options.speed) {
				switch (options.speed) {
					case "slow":
						// Do nothing; this is the slowest speed we need
						break;
					case "fast":
						steps = steps * 0.1;
						break;
					default:
						steps = steps * 0.4;
						break;
				}
				steps = Math.round(steps);
			} else {
				steps = Math.round(steps * 0.4);
			}
			
			//console.log(steps);
			currentStep = 0;
			
			fadeInterval = setInterval(function() {
			
			
				transitionCompletion = currentStep/steps;
				
				stepValues = [Math.round(transitionCompletion*colourDifference[0]),Math.round(transitionCompletion*colourDifference[1]),Math.round(transitionCompletion*colourDifference[2])];
				
				actualColour[0] = previousColour[0]+stepValues[0];
				actualColour[1] = previousColour[1]+stepValues[1];
				actualColour[2] = previousColour[2]+stepValues[2];
				//console.log(previousColour[1], colourDifference[1], transitionCompletion*colourDifference[1]);
				if (!flashOverride && !calibrationOverride) updateLED();
				
				currentStep++;
				if (currentStep == steps || currentStep > 255) {
					actualColour = selectedColour;
					clearInterval(fadeInterval);
					fadeInterval = null;
					updateLED();
				}
				
			}, 20);
		}
	}
	
	function fadeOut(options) {
		if (options) {
			options.rgb = [0, 0, 0];
		} else {
			options = {rgb: [0, 0, 0]};
		}
		fadeTo(options);
	}
	
	function tempFlash(options) {
		flashOverride = true;
		actualColour = options.rgb;
		updateLED();
		setTimeout(function() {
			actualColour = selectedColour;
			flashOverride = false;
			updateLED();
		}, 100);
	}
	
	function turnOff() {
		stopIntervals();
		if (persistentColour != [0,0,0]) {
			selectedColour = persistentColour.slice(0);
		} else {
			selectedColour = [0,0,0];
		}
		actualColour = selectedColour.slice(0);
		updateLED();
	}
	
	var blinkInterval = null;
	var blinkState = false;
	function blink(options) {
		if (options.interval && (options.colour || options.rgb || options.rgbDirect)) {
			stopIntervals();
			
			// If colour values have been provided in RGB, use them. Otherwise convert colour name.
			if (options.rgbDirect) {
				selectedColour = options.rgbDirect; // Do not use calibrated white point.
			} else if (options.rgb) {
				selectedColour = colourWithCalibratedWhite(options.rgb);
			} else if (options.colour) {
				selectedColour = colourNameToRGB(options.colour);
			}
			
			blinkInterval = setInterval(function() {
				if (!blinkState) {
					blinkState = true;
					actualColour = selectedColour.slice(0);
				} else {
					blinkState = false;
					actualColour = [0,0,0];
				}
				updateLED();
			}, options.interval*1000);
		}
	}
	
	function stopIntervals() {
		// If a fade is in progress, stop it.
		if (fadeInterval != null) {
			clearInterval(fadeInterval);
			fadeInterval = null;
		}
		if (blinkInterval != null) {
			clearInterval(blinkInterval);
			blinkInterval = null;
			blinkState = false;
		}
	}
	
	// Writes the actualColour values to the GPIO.
	function updateLED() {
		ledR.pwmWrite(actualColour[0]);
		ledG.pwmWrite(actualColour[1]);
		ledB.pwmWrite(actualColour[2]);
	}
	
	
	return {
		version: version
	};
};





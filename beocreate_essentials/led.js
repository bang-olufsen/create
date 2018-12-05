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

// Status LED Module

// Abstracts the control of an RGB status LED that can be directly installed to the GPIO pins of BeoCreate 4-Channel Amplifier. Offers different effects for use in various situations.

var pigpio = require('pigpio'); // For GPIO control.


var led = module.exports = {
	initialise: initialise,
	terminate: terminate,
	fadeTo: fadeTo,
	fadeOut: fadeOut,
	tempFlash: tempFlash,
	turnOff: turnOff
	/*fadeOut: fadeOut,
	tempFlash: tempFlash,
	breathe: breathe,
	turnOn: turnOn,
	turnOff: turnOff*/
};

var ledR = null;
var ledG = null;
var ledB = null;
var ledInitialised = false;

var previousColour = [0,0,0];
var selectedColour = [0,0,0]; // Stores the set colour value. Most functions change this colour; notable exception is the tempFlash, which flashes another colour temporarily and then restores the earlier colour.
var actualColour = [0,0,0]; // Stores the actual colour value that's currently active.

// Initialises the LEDs for operation. 
function initialise(red, green, blue) {
	if (red, green, blue) {
		pigpio.configureClock(10, pigpio.CLOCK_PWM); // Configures PiGPIO to use PWM as clock source (by default it uses PCM which conflicts with BeoCreate 4-Channel Amplifier).
		ledR = new pigpio.Gpio(red, {mode: pigpio.Gpio.OUTPUT});
		ledG = new pigpio.Gpio(green, {mode: pigpio.Gpio.OUTPUT});
		ledB = new pigpio.Gpio(blue, {mode: pigpio.Gpio.OUTPUT});
		ledInitialised = true;
		return true;
	} else {
		return false;
	}
}

function terminate() {
	turnOff();
	pigpio.terminate(); // pigpio C library terminated here
}

// Converts plain-language colour names to RGB values.
function colourNameToRGB(colourName) {

}

var fadeInterval = null;
var ledDelay = null;
var flashOverride = false;

function fadeTo(options) {
	// If a fade is in progress, stop it and use the present value as the starting point for transition (previousColour).
	if (fadeInterval != null) {
		clearInterval(fadeInterval);
		fadeInterval = null;
		previousColour = actualColour.slice(0);
	} else {
		previousColour = selectedColour.slice(0);
	}
	
	// If fadeOutAfter is set, fade out the LED after a number of seconds.
	clearTimeout(ledDelay);
	if (options.fadeOutAfter) {
		ledDelay = setTimeout(function() {
			fadeOut();
		}, 1000*options.fadeOutAfter);
	}
	
	// If colour values have been provided in RGB, use them. Otherwise convert colour name.
	if (options.rgb) {
		selectedColour = options.rgb;
	} else if (options.colour) {
		selectedColour = colourNameToRGB(options.colour);
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
			if (!flashOverride) updateLED();
			
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
	// If a fade is in progress, stop it.
	if (fadeInterval != null) {
		clearInterval(fadeInterval);
		fadeInterval = null;
	}
	selectedColour = [0,0,0];
	actualColour = [0,0,0];
	updateLED();
}

// Writes the actualColour values to the GPIO.
function updateLED() {
	ledR.pwmWrite(actualColour[0]);
	ledG.pwmWrite(actualColour[1]);
	ledB.pwmWrite(actualColour[2]);
}
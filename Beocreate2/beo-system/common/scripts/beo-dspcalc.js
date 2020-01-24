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

// Volume conversion functions ported from HiFiBerry DSP: https://github.com/hifiberry/hifiberry-dsp/


// FILTER CALCULATION FUNCTIONS

beoDSP = (function() {
// Cache Pi
var mathPI = Math.PI;

// BIQUAD FILTER CALCULATION FUNCTIONS

// Peak filter
function peak(Fs, Fc, dBBoost, Q, gain = 0) {
	// Equivalent to the "Parametric" 2nd order filter in SigmaStudio
	w0 = 2 * mathPI * Fc / Fs;
	gainLinear = Math.pow(10, (gain / 20));
	
	A = Math.pow(10, (dBBoost / 40));
	alpha = Math.sin(w0) / (2 * Q);
	
	// Calculate initial coefficients
	a0i =   1 + alpha / A;
	a1i =  -2 * Math.cos(w0);
	a2i =   1 - alpha / A;
	b0i =  (1 + alpha * A) * gainLinear;
	b1i = -(2 * Math.cos(w0)) * gainLinear;
	b2i =  (1 - alpha * A) * gainLinear;
	
	// Loop coefficients through normalisation function
	return normaliseCoeffs(a0i, a1i, a2i, b0i, b1i, b2i);
	
}


// 2nd order lowpass
function lowPass(Fs, Fc, gain, Q = 1 / Math.sqrt(2)) {
	// If Q is not defined, calculate filter as Butterworth.
	
	w0 = 2 * mathPI * Fc / Fs;
	gainLinear = Math.pow(10, (gain / 20));
	
	alpha = Math.sin(w0) / (2.0 * Q);
	
	// Calculate initial coefficients
	a0i =  1 + alpha;
	a1i = -2 * Math.cos(w0);
	a2i =  1 - alpha;
	b0i = (1 - Math.cos(w0)) * gainLinear / 2;
	b1i = (1 - Math.cos(w0)) * gainLinear;
	b2i = (1 - Math.cos(w0)) * gainLinear / 2;
	
	// Loop coefficients through normalisation function
	return normaliseCoeffs(a0i, a1i, a2i, b0i, b1i, b2i);
	
}


// 2nd order highpass
function highPass(Fs, Fc, gain, Q = 1 / Math.sqrt(2)) {
	// If Q is not defined, calculate filter as Butterworth.
	
	w0 = 2 * mathPI * Fc / Fs;
	gainLinear = Math.pow(10, (gain / 20));
	
	alpha = Math.sin(w0) / (2.0 * Q);
	
	// Calculate initial coefficients
	a0i =   1 + alpha;
	a1i =  -2 * Math.cos(w0);
	a2i =   1 - alpha;
	b0i =  (1 + Math.cos(w0)) * gainLinear / 2;
	b1i = -(1 + Math.cos(w0)) * gainLinear;
	b2i =  (1 + Math.cos(w0)) * gainLinear / 2;
	
	// Loop coefficients through normalisation function
	return normaliseCoeffs(a0i, a1i, a2i, b0i, b1i, b2i);
	
}

// Low-shelf filter
function lowShelf(Fs, Fc, dBBoost, slope, gain = 0) {
	// 2nd-order low-shelf filter
	w0 = 2 * mathPI * Fc / Fs;
	gainLinear = Math.pow(10, (gain / 20));
	
	A = Math.pow(10, (dBBoost / 40));
	alpha = Math.sin(w0) / 2 * Math.sqrt((A + 1/A)*(1/slope - 1) + 2);

	// Calculate initial coefficients
	a0i =          (A+1) + (A-1) * Math.cos(w0) + 2 * Math.sqrt(A) * alpha;
	a1i =    -2 * ((A-1) + (A+1) * Math.cos(w0));
	a2i =          (A+1) + (A-1) * Math.cos(w0) - 2 * Math.sqrt(A) * alpha;
	b0i =     A * ((A+1) - (A-1) * Math.cos(w0) + 2 * Math.sqrt(A) * alpha);
	b1i = 2 * A * ((A-1) - (A+1) * Math.cos(w0));
	b2i =     A * ((A+1) - (A-1) * Math.cos(w0) - 2 * Math.sqrt(A) * alpha);
	
	// Loop coefficients through normalisation function
	return normaliseCoeffs(a0i, a1i, a2i, b0i, b1i, b2i);
	
}

// High-shelf filter
function highShelf(Fs, Fc, dBBoost, slope, gain = 0) {
	// 2nd-order high-shelf filter
	w0 = 2 * mathPI * Fc / Fs;
	gainLinear = Math.pow(10, (gain / 20));
	
	A = Math.pow(10, (dBBoost / 40));
	alpha = Math.sin(w0) / 2 * Math.sqrt((A + 1/A)*(1/slope - 1) + 2);

	// Calculate initial coefficients
	a0i =           (A+1) - (A-1) * Math.cos(w0) + 2 * Math.sqrt(A) * alpha;
	a1i =      2 * ((A-1) - (A+1) * Math.cos(w0));
	a2i =           (A+1) - (A-1) * Math.cos(w0) - 2 * Math.sqrt(A) * alpha;
	b0i =      A * ((A+1) + (A-1) * Math.cos(w0) + 2 * Math.sqrt(A) * alpha);
	b1i = -2 * A * ((A-1) + (A+1) * Math.cos(w0));
	b2i =      A * ((A+1) + (A-1) * Math.cos(w0) - 2 * Math.sqrt(A) * alpha);
	
	// Loop coefficients through normalisation function
	return normaliseCoeffs(a0i, a1i, a2i, b0i, b1i, b2i);
	
}


// Normalise coefficients so that a0 is always 1.
function normaliseCoeffs(a0i, a1i, a2i, b0i, b1i, b2i) {
	a0 = 1;
	a1 = a1i / a0i;
	a2 = a2i / a0i;
	b0 = b0i / a0i;
	b1 = b1i / a0i;
	b2 = b2i / a0i;
	
	return [a0, a1, a2, b0, b1, b2];
}



// VOLUME CONVERSION FUNCTIONS
function convertVolume(from, to, value, range) {
	if (from == "amplification" && to == "dB") {
		return amplificationTodB(value);
	} else if (from == "dB" && to == "amplification") {
		return dBToAmplification(value);
	} else if (from == "%" && to == "amplification") {
		return percentageToAmplification(value, range);
	} else if (from == "amplification" && to == "%") {
		return amplificationToPercentage(value, range);
	} else if (from == "%" && to == "dB") {
		return amplificationTodB(percentageToAmplification(value, range));
	} else {
		return null;
	}
}

function amplificationTodB(value) {
	if (value > 0) {
		return Math.log10(value) * 20;
	} else {
		return "-inf";
	}
}

function dBToAmplification(value) {
	return Math.pow(10, value / 20);
}

function percentageToAmplification(value, range) {
	if (value <= 0) {
		return 0;
	} else {
		if (!range) range = 60;
		coeffs = logCoefficients(range);
		return coeffs[0] * Math.exp(coeffs[1] * value/100);
	}
}

function amplificationToPercentage(value, range) {
	if (value <= 0) {
		return 0;
	} else if (value >= 1) {
		return 100;
	} else {
		if (!range) range = 60;
		coeffs = logCoefficients(range);
		return (Math.log(value / coeffs[0]) / coeffs[1]) * 100;
	}
}

function logCoefficients(range) {
	if (range <= 50) {
		a = 0.0031623;
		b = 5.757;
	} else if (range <= 60) {
		a = 0.001;
		b = 6.908;
	} else if (range <= 70) {
		a = 0.00031623;
		b = 8.059;
	} else if (range <= 80) {
		a = 0.0001;
		b = 9.210;
	} else if (range <= 90) {
		a = 0.000031623;
		b = 10.36;
	} else {
		a = 0.00001;
		b = 11.51;
	}
	return [a, b];
}

return {
	peak: peak,
	lowPass: lowPass,
	highPass: highPass,
	lowShelf: lowShelf,
	highShelf: highShelf,
	convertVolume: convertVolume
}

})();

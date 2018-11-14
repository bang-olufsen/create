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

// DSP
// Communicates with the SigmaTcpDaemon, available at https://github.com/bang-olufsen/create/

var net = require("net"); // for communication over TCP
var fs = require('fs'); // for filesystem access
var child_process = require('child_process');


var dictionary = {}; // Stores the DSP parameter addresses.

var sigmaServerPortNumber = 8086;
var sigmaCommandReadCode = 0x0a;
var sigmaCommandWriteCode = 0x09;
var sigmaCommandEEPROMCode = 0xf0;
var sigmaCommandHeaderSize = 14;
const m_FullScaleIntValue = 16777216;
var openReadRequests = {};
var flashCallback = null;
var checksumCallback = null;

// EXPORT FUNCTIONS

var dsp = module.exports = {
	readDictionary: readDictionary,
	connectDSP: connectDSP,
	disconnectDSP: disconnectDSP,
	getChecksum: getChecksum,
	writeDSP: writeDSP,
	readDSP: readDSP,
	flashEEPROM: flashEEPROM,
	lowPass: lowPass,
	highPass: highPass,
	peak: peak
	//serverRunning: serverRunning,
	//startServer: startServer,
	//stopServer: stopServer,
	//dspEvents: dspEvents
};


// FILTER CALCULATION FUNCTIONS

// Cache Pi
var mathPI = Math.PI;

// BIQUAD FILTER CALCULATION FUNCTIONS

// Peak filter
function peak(Fs, Fc, dBBoost, Q, gain) {
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
	return normaliseCoeffs(a0i, a1i, a2i, b0i, b1i, b2i)
	
}


// Butterworth lowpass
function lowPass(Fs, Fc, gain) {
	// Equivalent to the "Butterworth LP" 2nd order filter in SigmaStudio
	w0 = 2 * mathPI * Fc / Fs;
	gainLinear = Math.pow(10, (gain / 20));
	
	alpha = Math.sin(w0) / (2.0 * 1 / Math.sqrt(2));
	
	// Calculate initial coefficients
	a0i =  1 + alpha;
	a1i = -2 * Math.cos(w0);
	a2i =  1 - alpha;
	b0i = (1 - Math.cos(w0)) * gainLinear / 2;
	b1i = (1 - Math.cos(w0)) * gainLinear;
	b2i = (1 - Math.cos(w0)) * gainLinear / 2;
	
	// Loop coefficients through normalisation function
	return normaliseCoeffs(a0i, a1i, a2i, b0i, b1i, b2i)
	
}


// Butterworth highpass
function highPass(Fs, Fc, gain) {
	// Equivalent to the "Butterworth HP" 2nd order filter in SigmaStudio
	w0 = 2 * mathPI * Fc / Fs;
	gainLinear = Math.pow(10, (gain / 20));
	
	alpha = Math.sin(w0) / (2.0 * 1 / Math.sqrt(2));
	
	// Calculate initial coefficients
	a0i =   1 + alpha;
	a1i =  -2 * Math.cos(w0);
	a2i =   1 - alpha;
	b0i =  (1 + Math.cos(w0)) * gainLinear / 2;
	b1i = -(1 + Math.cos(w0)) * gainLinear;
	b2i =  (1 + Math.cos(w0)) * gainLinear / 2;
	
	// Loop coefficients through normalisation function
	return normaliseCoeffs(a0i, a1i, a2i, b0i, b1i, b2i)
	
}

// Low-shelf filter
function lowShelf(Fs, Fc, dBBoost, slope, gain) {
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
	return normaliseCoeffs(a0i, a1i, a2i, b0i, b1i, b2i)
	
}

// High-shelf filter
function highShelf(Fs, Fc, dBBoost, slope, gain) {
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
	return normaliseCoeffs(a0i, a1i, a2i, b0i, b1i, b2i)
	
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




// SOCKET to the TCP Daemon
var dspClient = new net.Socket();
var dspConnected = false;
var connectCallback;

function connectDSP(callback, socketAddress) {
	if (!socketAddress) socketAddress = 'localhost';
	if (callback) connectCallback = callback;
	dspClient.connect(8086, socketAddress, function() {
		//if (callback) callback(true);
	});
}

function disconnectDSP() {
	dspClient.end();
	console.log("Disconnecting from DSP");
}



dspClient.on('error', function(error) {
	console.log(error);
});

dspClient.on('close', function(error) {
	console.log("Disconnected from DSP");
});

dspClient.on('connect', function(error) {
	console.log("Connected to DSP");
	dspConnected = true;
	if (connectCallback) connectCallback(true);
});

dspClient.on('data', function(data) {
	intRead = data.readInt8(0);
	
	/*if (intRead == 1 || intRead == 0) {
		// A response from EEPROM flash.
		if (flashCallback) flashCallback(intRead);
		flashCallback = null;
	} else {*/
		response = getSigmaReadResponse(data);
		addr = response.addr
		if (openReadRequests.addr) { // Find the callback from the list of open requests.
			openReadRequests.addr(response); // Run the callback, feeding the response into it.
			delete openReadRequests.addr;
		} else {

		}
	//}
	//console.log(data.readInt8(0));
});

dspClient.on('close', function() {
	console.log('Connection closed');
	dspConnected = false;
});


// READ AND PARSE DICTIONARY

function readDictionary(path) {
	dictionaryFile = fs.readFileSync(path, 'utf8');
	//console.log(dictionaryFile);
	lines = dictionaryFile.split("\n");
	for(var i = 0; i < lines.length; i++){
		keyValues = lines[i].split("\t");
		if (keyValues[0]) {
			dictionary[keyValues[0]] = parseInt(keyValues[1]);
		}
	}
	return dictionary;
}



// INTERMEDIARY R/W FUNCTIONS that are visible from outside

function writeDSP(parameterName, value, forceDecimal, direct) {
	if (!dspConnected) return false;
	if (direct) {
		address = parameterName; // If "direct" is set, don't do dictionary matching, use parameterName as address directly.
	} else {
		address = dictionary[parameterName]; // Match parameter name with address.
	}
	//console.log("Writing "+value+" to "+address);
	writeValue(address, value, forceDecimal);
}

function readDSP(parameterName, callback, direct) {
	if (!dspConnected) return false;
	if (direct) {
		address = parameterName; // If "direct" is set, don't do dictionary matching, use parameterName as address directly.
	} else {
		address = dictionary[parameterName]; // Match parameter name with address.
	}
	
	readValue(address, callback);
}

function flashEEPROM(filePath, callback) {
	//if (!dspConnected) return false;
	flashCallback = callback;
	//EEPROMRequest = new Buffer(createSigmaEEPROMRequest(filePath))
	//dspClient.write(EEPROMRequest);
	command = "dsptoolkit install-profile"+filePath;
	child_process.exec(command, function(error, stdout, stderr) {
		if (error) {
			callback(null, error);
		} else {
			if (stdout.indexOf(" installed") != -1) {
				flashCallback(true);
				flashCallback = null;
			} else if (stdout.indexOf("Failed ") != -1) {
				flashCallback(false);
				flashCallback = null;
			}
		}
	});
}

function getChecksum(callback) {
	checksumCallback = callback;
	command = "dsptoolkit get-checksum";
	child_process.exec(command, function(error, stdout, stderr) {
		if (error) {
			checksumCallback(null);
			checksumCallback = null;
		} else {
			if (stdout.indexOf("None") != -1) {
				checksumCallback(null);
				checksumCallback = null;
			} else {
				checksumCallback(stdout);
				checksumCallback = null;
			}
		}
	});
}


// SIGMADSP FUNCTIONS

function readValue(addr, callback) {
	openReadRequests.addr = callback; // Store the callback for this request as an open read request.
	readRequest = new Buffer(createSigmaReadRequest(addr, 4));
	dspClient.write(readRequest);
}

function writeValue(addr, value, forceDecimal) {
	if (!Number.isInteger(value) || forceDecimal) {
		value = ((value * m_FullScaleIntValue) + 0.5);
	}
	var memValue = [];
	//memValue[4] = [0];
	memValue[0] = (value >> 24);
	memValue[1] = (value >> 16);
	memValue[2] = (value >> 8);
	memValue[3] = value;
	
	writeMemory(addr, 4, memValue);
}

function writeMemory(addr, length, data, safeload) {
	writeRequest = new Buffer(createSigmaWriteRequest(addr, length, data));
	dspClient.write(writeRequest);
}

// SIGMADSP Data Formatters

function createSigmaWriteRequest(addr, length, data) {
	var sigmaWriteRequest = new Uint8Array(sigmaCommandHeaderSize + length);
	sigmaWriteRequest[0] = sigmaCommandWriteCode;
	//if (safeload) sigmaWriteRequest[1] = 0x0001;
	sigmaWriteRequest[6] = (sigmaCommandHeaderSize + length); // Request length, as required by the new SigmaTCPServer.
	sigmaWriteRequest[10] = ((length & 0xFF00) >> 8);
	sigmaWriteRequest[11] = (length & 0x00FF);
	
	sigmaWriteRequest[12] = ((addr & 0xFF00) >> 8);
	sigmaWriteRequest[13] = (addr & 0x00FF);
	
	sigmaWriteRequest.set(data, 14);
	
	return sigmaWriteRequest;
}

function createSigmaReadRequest(addr, length) {
	var sigmaReadRequest = new Uint8Array(sigmaCommandHeaderSize);
	sigmaReadRequest[0] = sigmaCommandReadCode;
	sigmaReadRequest[8] = ((length & 0xFF00) >> 8);
	sigmaReadRequest[9] = (length & 0x00FF);
	
	sigmaReadRequest[10] = ((addr & 0xFF00) >> 8);
	sigmaReadRequest[11] = (addr & 0x00FF);
	
	return sigmaReadRequest;
}

function createSigmaEEPROMRequest(pathToFile) {
	bl = Buffer.byteLength(pathToFile, "utf8");
	var sigmaEEPROMRequest = new Uint8Array(sigmaCommandHeaderSize + 1 + bl);
	sigmaEEPROMRequest[0] = sigmaCommandEEPROMCode;
	sigmaEEPROMRequest[1] = Buffer.byteLength(pathToFile, "utf8");
	
	sigmaEEPROMRequest.set(new Buffer(pathToFile, bl), sigmaCommandHeaderSize);
	
	return sigmaEEPROMRequest;
}

function getSigmaReadResponse(rawDataResponse) {
	len = (rawDataResponse[8] << 8) | rawDataResponse[9];
	addr = (rawDataResponse[10] << 8) | rawDataResponse[11];
	readResponse = {};
	readResponse.addr = addr;
	readResponse.length = len;
	readResponse.hex = null;
	readResponse.int = null;
	readResponse.dec = null;
	
	if (len < 1024) {
		// Return the data in all different types. The desired type can then be accessed later.
		rawData = rawDataResponse.slice(14, 14+len);
		readResponse.hex = rawData.toString('hex');
		var resultValInt = 0;
		resultValInt |= (rawData[0] << 24);
		resultValInt |= (rawData[1] << 16);
		resultValInt |= (rawData[2] << 8);
		resultValInt |= rawData[3];
		readResponse.int = resultValInt;
		readResponse.dec = resultValInt / m_FullScaleIntValue;
	}
	return readResponse;
}


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

// DSP
// Communicates with the SigmaTCPServer, available at https://github.com/hifiberry/hifiberry-dsp

var net = require("net"); // for communication over TCP
var fs = require('fs'); // for filesystem access
var exec = require('child_process').exec;


var dictionary = {}; // Stores the DSP parameter addresses.

var sigmaServerPortNumber = 8086;

const sigmaCommandReadCode = 0x0a;
const sigmaCommandWriteCode = 0x09;
const sigmaCommandEEPROMCode = 0xf0;

const hifiberryCommandChecksumCode = 0xf1;
const hifiberryCommandChecksumResponseCode = 0xf2;
const hifiberryCommandXMLCode = 0xf4;
const hifiberryCommandXMLResponseCode = 0xf5;

const sigmaCommandHeaderSize = 14;
const m_FullScaleIntValue = 16777216;
var flashCallback = null;
var keepAlive = true;

// EXPORT FUNCTIONS

var dsp = module.exports = {
	connectDSP: connectDSP,
	disconnectDSP: disconnectDSP,
	isConnected: isConnected,
	getChecksum: getChecksum,
	checkEEPROM: checkEEPROM,
	resetDSP: resetDSP,
	getXML: getXML,
	writeDSP: writeDSP,
	readDSP: readDSP,
	writeRegister: writeRegister,
	readRegister: readRegister,
	safeloadWrite: safeloadWrite,
	flashEEPROM: flashEEPROM,
	storeAdjustments: storeAdjustments,
	lowPass: lowPass,
	highPass: highPass,
	peak: peak,
	lowShelf: lowShelf,
	highShelf: highShelf,
	convertVolume: convertVolume
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
	return normaliseCoeffs(a0i, a1i, a2i, b0i, b1i, b2i);
	
}


// 2nd order lowpass
function lowPass(Fs, Fc, gain, Q) {
	// If Q is not defined, calculate filter as Butterworth.
	if (Q == undefined) {
		Q = 1 / Math.sqrt(2);
	}
	
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
function highPass(Fs, Fc, gain, Q) {
	// If Q is not defined, calculate filter as Butterworth.
	if (Q == undefined) {
		Q = 1 / Math.sqrt(2);
	}
	
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
	return normaliseCoeffs(a0i, a1i, a2i, b0i, b1i, b2i);
	
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



// SOCKET to the TCP Daemon
var dspClient = new net.Socket();
var dspConnected = false;
var connectCallback;
var connectTimeout = null;
var connectTimeoutCycle = 0;

function connectDSP(callback, socketAddress) {
	if (!dspConnected) {
		keepAlive = true;
		if (!socketAddress) socketAddress = '127.0.1.1';
		if (callback) connectCallback = callback;
		dspClient.connect(8086, socketAddress);
	} else {
		// Connection is already open.
		if (callback) callback(true);
	}
}

function disconnectDSP(callback) {
	keepAlive = false;
	dspClient.end(null, null, function() {
		if (callback) callback();
	});
	//console.log("Disconnecting from the DSP server...");
}

function isConnected() {
	return dspConnected;
}

// Event listeners.
dspClient.on('connect', onConnect);
dspClient.on('error', onError);
dspClient.on('close', onClose);
dspClient.on('data', onData);
dspClient.on('end', onEnd);

dataLength = null;
currentDataLength = 0;
bufferArray = [];

function onConnect(error) {
	console.log("Connected to the DSP server.");
	clearTimeout(connectTimeout);
	dspConnected = true;
	if (connectCallback) connectCallback(true);
	connectCallback = null;
	connectTimeoutCycle = 0;
	if (sendRequestsAfterConnecting) {
		sendRequestsAfterConnecting = false;
		if (checksumCallback) {
			console.log("Trying to get checksum again...");
			getChecksum();
		}
		if (xmlCallback) {
			console.log("Trying to get XML again...");
			getXML();
		}
	}
}

function onEnd() {
	//console.log("DSP connection ended.");
	dspConnected = false;
}

function onClose(hadError) {
	dspConnected = false;
	closedError = (hadError) ? " due to an error" : "";
	if (keepAlive && connectTimeoutCycle < 10) {
		if (!dspClient.connecting && !dspConnected) {
			connectTimeout = setTimeout(function() {
				connectTimeoutCycle++;
				console.log("Connection to the DSP was closed"+closedError+". Reconnecting (attempt "+connectTimeoutCycle+")...");
				if (!dspConnected && !dspClient.connecting) connectDSP();
			}, 2000);
		}
	} else {
		keepAlive = false;
		console.log("Connection to the DSP was closed"+closedError+".");
		connectTimeoutCycle = 0;
		connectCallback = null;
	}
};

function onData(data) {
	if (checksumCallback && data[0] == hifiberryCommandChecksumResponseCode) {
			checksumCallback(data.slice(14).toString('hex').toUpperCase());
			checksumCallback = null;
			
	} else if (xmlCallback) {
		if (data[0] == hifiberryCommandXMLResponseCode) {
			dataLength = parseInt(data.slice(6,10).toString("hex"), 16);
			currentDataLength = 0;
			data = data.slice(sigmaCommandHeaderSize);
		}
		bufferArray.push(data);
		currentDataLength += data.length;
		if (dataLength == currentDataLength) {
			theXML = Buffer.concat(bufferArray).toString('utf8');
			xmlCallback(theXML);
			xmlCallback = null;
			clearTimeout(xmlTimeout);
			bufferArray = []; // Clear buffer.
		}
	} else {
	
		intRead = data.readInt8(0);
		
		/*if (intRead == 1 || intRead == 0) {
			// A response from EEPROM flash.
			if (flashCallback) flashCallback(intRead);
			flashCallback = null;
		} else {*/
			response = getSigmaReadResponse(data);
			addr = response.addr;
			if (openReadRequests[addr]) { // Find the open read request for this address.
				if (openReadRequests[addr].multiRead) { // Is this a multi-read?
					if (multiReads[openReadRequests[addr].multiRead]) {
						multiReads[openReadRequests[addr].multiRead].responses[response.addr] = response;
						if (multiReads[openReadRequests[addr].multiRead].addresses.length > 1) {
							//console.log(multiReads[openReadRequests[addr].multiRead].addresses.length +" reads remaining.");
							// More reads remaining in this multi-read.
							addressIndex = multiReads[openReadRequests[addr].multiRead].addresses.indexOf(response.addr);
							multiReads[openReadRequests[addr].multiRead].addresses.splice(addressIndex, 1);
						} else {
							// Last multi-read, run callback with responses.
							if (multiReads[openReadRequests[addr].multiRead].callback) {
								multiReads[openReadRequests[addr].multiRead].callback(multiReads[openReadRequests[addr].multiRead].responses);
							}
							delete multiReads[openReadRequests[addr].multiRead];
						}
					}
				} else {
					openReadRequests[addr].callback(response); // Run the callback, feeding the response into it.
				}
				delete openReadRequests[addr];
				if (readQueue.length > 0) {
					processReadQueue();
				}
			} else {
	
			}
	}
	
	//}
	//console.log(data.readInt8(0));
};

sendRequestsAfterConnecting = false;
function onError(error) {
	console.error("Error with DSP server connection (connection attempt "+(connectTimeoutCycle+1)+"):", error);
	sendRequestsAfterConnecting = true;
	if (checksumCallback) {
		console.log("Couldn't get checksum because of DSP connection error. Attempting again after re-establishing connection.");
	}
	if (xmlCallback) {
		console.log("Couldn't get XML because of DSP connection error. Attempting again after re-establishing connection.");
	}
}



// INTERMEDIARY R/W FUNCTIONS that are visible from outside

function writeDSP(address, value, forceDecimal) {
	if (!dspConnected) return false;
	writeValue(address, value, forceDecimal);
}

function readDSP(address, callback, length = 4) {
	if (!dspConnected) return false;
	if (typeof address == "object") {
		// Read multiple registers.
		id = address.join(""); // Join addresses to form a common id.
		multiReads[id] = {addresses: address, responses: {}, callback: callback, length: length};
		myMultiRead = [];
		for (var i = 0; i < address.length; i++) {
			myMultiRead.push({address: address[i], callback: null, length: length, multiRead: id});
		}
		readQueue = readQueue.concat(myMultiRead);
		if (Object.size(openReadRequests) == 0) processReadQueue();
	} else {
		// Read one one register.
		if (callback) {
			if (Object.size(openReadRequests) > 0) {
				// Read requests are being fulfilled, put this into the queue.
				readQueue.push({address: address, callback: callback, length: length});
			} else {
				// No requests in the queue, read right away.
				readValue(address, callback, length);
			}
		}
	}
	
}

function writeRegister(address, value, forceDecimal) {
	if (!dspConnected) return false;
	writeValue(address, value, forceDecimal, 2);
}

function readRegister(address, callback) {
	readDSP(address, callback, 2);
}

var openReadRequests = {};
var multiReads = {};
var readQueue = [];
function processReadQueue() {
	
	if (readQueue.length > 0) {
		// If there are read requests in the queue, send the next one.
		item = readQueue.shift();
		readValue(item.address, item.callback, item.length, item.multiRead);
	}
}


// Software safeload, for loading multiple parameters at the same time.
function safeloadWrite(parameterAddress, values, forceDecimal) {
	// safeloadDataRegister = 24576; // Temporary data storage address.	
	// safeloadDataAddressRegister = 24581; // Target address for the data.
	// safeloadDataNumberRegister = 24582; // Number of words to safeload.
	
	if (!forceDecimal) forceDecimal = false;
	
	if (parameterAddress != undefined && values != undefined) {
	
		// Write to safeload registers (safeloadDataRegister):
		for (var i = 0; i < values.length; i++) {
			writeDSP(24576+i, values[i], true, forceDecimal); 
		}
		// Write the start address for the data (safeloadDataAddressRegister):
		writeDSP(24581, parameterAddress, false, false);
		// Write the number of words to safeload (safeloadDataNumberRegister):
		writeDSP(24582, values.length, false, false);
		
	}
}


// HIFIBERRY DSPTOOLKIT FUNCTIONS

function flashEEPROM(filePath, callback) {
	//if (!dspConnected) return false;
	flashCallback = callback;
	//EEPROMRequest = new Buffer(createSigmaEEPROMRequest(filePath))
	//dspClient.write(EEPROMRequest);
	exec("dsptoolkit --timeout 60 install-profile "+filePath, function(error, stdout, stderr) {
		if (error) {
			flashCallback(null, error);
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

function storeAdjustments(callback) {
	if (callback) {
		exec("dsptoolkit --timeout 60 store", function(error, stdout, stderr) {
			if (error) {
				callback(null, error);
			} else {
				if (stdout.indexOf("Stored filter settings") != -1) {
					callback(true);
				} else if (stdout.toLowerCase().indexOf("failed") != -1) {
					callback(false);
				}
			}
		});
	}
}

var checksumCallback = null;
function getChecksum(callback) {
	if (callback) checksumCallback = callback;
	/*command = "dsptoolkit get-checksum";
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
	});*/
	checksumRequest = Buffer.from(createHifiberryRequest(hifiberryCommandChecksumCode));
	if (dspConnected) {
		dspClient.write(checksumRequest);
	} else {
		console.log("Couldn't get checksum because DSP is not connected. Attempting again after connection is opened.");
		sendRequestsAfterConnecting = true;
	}
}

function checkEEPROM(callback) {
	exec("dsptoolkit check-eeprom", function(error, stdout, stderr) {
		if (error) {
			callback(null, error);
		} else {
			if (stdout.indexOf("EEPROM content matches") != -1) {
				callback(true);
			} else {
				callback(false);
			}
		}
	});
}

function resetDSP(callback) {
	exec("dsptoolkit reset", function(error, stdout, stderr) {
		if (error) {
			callback(null, error);
		} else {
			if (stdout.indexOf("Resetting DSP") != -1) {
				callback(true);
			} else {
				callback(false);
			}
		}
	});
}

var xmlCallback = null;
var xmlTimeout = null;
function getXML(callback) {
	if (callback) xmlCallback = callback;
	xmlRequest = Buffer.from(createHifiberryRequest(hifiberryCommandXMLCode));
	if (dspConnected) {
		dspClient.write(xmlRequest);
		xmlTimeout = setTimeout(function() {
			if (xmlCallback) xmlCallback(null);
			console.log("DSP request for program XML timed out.");
			xmlCallback = null;
		}, 10000);
	} else {
		console.log("Couldn't get XML because DSP is not connected. Attempting again after connection is opened.");
		sendRequestsAfterConnecting = true;
	}
}



// Generic HiFiBerry DSPToolkit request generator function.
function createHifiberryRequest(commandCode) {
	var hifiberryRequest = new Uint8Array(sigmaCommandHeaderSize);
	hifiberryRequest[0] = commandCode;
	return hifiberryRequest;
}


// SIGMADSP FUNCTIONS

function readValue(addr, callback, length = 4, multiRead = null) {
	openReadRequests[addr] = {callback: callback, multiRead: multiRead}; // Store the callback for this request as an open read request.
	readRequest = Buffer.from(createSigmaReadRequest(addr, length));
	dspClient.write(readRequest);
}

function writeValue(addr, value, forceDecimal, length = 4) {
	if (!Number.isInteger(value) || forceDecimal) {
		value = ((value * m_FullScaleIntValue) + 0.5);
	}
	var memValue = [];
	//memValue[4] = [0];
	if (length == 2) {
		memValue[0] = (value >> 8);
		memValue[1] = value;
	} else if (length == 4) {
		memValue[0] = (value >> 24);
		memValue[1] = (value >> 16);
		memValue[2] = (value >> 8);
		memValue[3] = value;
	}
	
	writeMemory(addr, length, memValue);
}

function writeMemory(addr, length, data, safeload) {
	writeRequest = Buffer.from(createSigmaWriteRequest(addr, length, data));
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
	
	sigmaEEPROMRequest.set(Buffer.from(pathToFile, bl), sigmaCommandHeaderSize);
	
	return sigmaEEPROMRequest;
}

function getSigmaReadResponse(rawDataResponse) {
	len = (rawDataResponse[8] << 8) | rawDataResponse[9];
	addr = (rawDataResponse[10] << 8) | rawDataResponse[11];
	readResponse = {};
	readResponse.addr = addr;
	readResponse.length = len;
	readResponse.raw = rawDataResponse.slice(14, 14+len);
	readResponse.hex = null;
	readResponse.int = null;
	readResponse.dec = null;
	
	if (len < 1024) {
		// Return the data in all different types. The desired type can then be accessed later.
		readResponse.hex = readResponse.raw.toString('hex');
		var resultValInt = 0;
		resultValInt |= (readResponse.raw[0] << 24);
		resultValInt |= (readResponse.raw[1] << 16);
		resultValInt |= (readResponse.raw[2] << 8);
		resultValInt |= readResponse.raw[3];
		readResponse.int = resultValInt;
		readResponse.dec = resultValInt / m_FullScaleIntValue;
	}
	return readResponse;
}



// SUPPORTING FUNCTIONS
// https://stackoverflow.com/questions/5223/length-of-a-javascript-object

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};
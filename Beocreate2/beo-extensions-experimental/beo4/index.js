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

// BEO4 INTERFACING FOR BEOCREATE 2

//var SerialPort = require('serialport'); // for communicating through serial ports
//var Readline = SerialPort.parsers.Readline;

var beo4Directory = {
  "address": {
    "0": "VIDEO",
    "1": "AUDIO",
    "5": "VIDEOTAPE",
    "18": "LIGHT"
  },
  "source": {
    "44": "SPEAKER",
    "80": "TV",
    "81": "RADIO",
    "83": "A.AUX",
    "85": "V.MEM",
    "86": "DVD",
    "91": "A.MEM",
    "92": "CD",
    "93": "N.RADIO",
    "94": "N.MUSIC",
    "8A": "DTV",
    "9B": "LIGHT",
    "8B": "PC"
  },
  "command": {
    "0": 0,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "32": "LEFT",
    "34": "RIGHT",
    "35": "GO",
    "36": "STOP",
    "37": "RECORD",
    "58": "LIST",
    "60": "VOL UP",
    "64": "VOL DOWN",
    "88": "TEXT",
    "C": "STANDBY",
    "7F": "EXIT",
    "D": "MUTE",
    "D5": "GREEN",
    "D4": "YELLOW",
    "D9": "RED",
    "D8": "BLUE",
    "1E": "UP",
    "1F": "DOWN",
    "5C": "MENU",
    "C1": "RANDOM",
    "C3": "REPEAT"
  }
};


	
	var beo4Address = "";
	var beo4Source = "";
	var beo4Command = "";
	var beo4LastAVSource = "";
	
	beo.bus.on('general', function(event) {
		// See documentation on how to use BeoBus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
			
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "beo4") {
				
			}
		}
	});
	
	
	// BEO4 SUPPORT
	var beo4Addresses = beo4Directory.address;
	var beo4Sources = beo4Directory.source;
	var beo4Commands = beo4Directory.command;
	
	/*if (SerialPort) {
	
		var port = new SerialPort("/dev/ttyACM0");
		var parser = port.pipe(new Readline({ delimiter: '\n' }))
		
		port.on('open', function() {
			console.log('Serial Port to the IR Eye Opened.');
		});
		
		parser.on('data', function(data) {
			beo4 = data.slice(0, -1).split("*");
			processBeo4Command(beo4[0], beo4[1], beo4[2]);
		});
		
		port.on('error', function(err) {
			//console.log('Error: ', err.message);
		})
	
	}*/
	
	
	function processBeo4Command(link, addressCode, commandCode) {
	
	
		beo4Address = beo4Addresses[addressCode];
		if (beo4Address == "LIGHT") {
			beo4LastAVSource = beo4Source;
		} else {
			if (beo4LastAVSource) {
				beo4Source = beo4LastAVSource;
				beo4LastAVSource = null;
			}
		}
	
		beo4SourceFind = beo4Sources[commandCode];
		if (!beo4SourceFind) {
			if (commandCode == 0) {
				beo4Command = 0;
				beo4CommandFind = 0;
			} else {
				beo4CommandFind = beo4Commands[commandCode];
				if (beo4CommandFind != undefined) beo4Command = beo4CommandFind;
			}
		} else {
			beo4Source = beo4SourceFind;
			beo4Command = "ACTIVATE";
		}
	
		//if (!beo4SourceFind && beo4CommandFind == undefined) {
		//console.log("Beo4 Command: L" + link + " A" + addressCode + " C" + commandCode);
		//}
		//console.log("Beo4: address: "+beo4Address+", source: "+beo4Source+", command: "+beo4Command);
	
		// Source-specific commands. Actual sources that respond to these commands are determined by Unified Source Management.
		switch (beo4Source) {
			case "A.MEM": // Controls A.MEM.
				switch (beo4Command) {
					case "ACTIVATE":
						
						break;
					case "GO":
						
						break;
				}
				break;
			case "CD": // Controls CD.
				switch (beo4Command) {
					case "ACTIVATE":
						
						break;
					case "GO":
						
						break;
				}
				break;
			case "N.MUSIC": // Controls N.MUSIC.
				switch (beo4Command) {
					case "ACTIVATE":
						
						break;
					case "GO":
						
						break;
				}
				break;
			case "A.AUX": // Controls A.AUX.
				switch (beo4Command) {
					case "ACTIVATE":
						
						break;
					case "GO":
						
						break;
				}
				break;
		}
	
		// Global commands
		switch (beo4Command) {
			case "VOL UP":
				// Turn up volume.
				if (beo.extensions.sound) beo.extensions.sound.setVolume("+2");
				break;
			case "VOL DOWN":
				// Turn down volume.
				if (beo.extensions.sound) beo.extensions.sound.setVolume("-2");
				break;
			case "MUTE":
				// Mute or unmute the device.
				if (beo.extensions.sound) beo.extensions.sound.mute();
				break;
			case "STOP":
				if (beo.extensions.sources) beo.extensions.sources.transport("pause");
				break;
			case "UP":
				
				break;
			case "DOWN":
				
				break;
			case "STANDBY":
				// Put everything into standby. This includes lights.
				break;
			case "MENU": 
				// This is just to demo the setup mode, because there are no buttons on BeoLab S.
				break;
			case 0: // Numpad input
			case 1:
			case 2:
			case 3:
			case 4:
			case 5:
			case 6:
			case 7:
			case 8:
			case 9:
				
				break;
			case "GO":
				//if (beo4NumberInputInProgress) beo4NumberInput(3);
				if (beo.extensions.sources) beo.extensions.sources.transport("play");
				break;
		}
	
		beo.sendToUI("beo4", {header: "lastCommand", content: {source: beo4Source, command: beo4Command}});
		
	}

interact = {
	actions: {
		beo4: function(data, triggerResult) {
			slices = triggerResult.split("*");
			if (slices.length == 4) {
				processBeo4Command(slices[1], slices[2], slices[3]);
			} else if (slices.length == 3) {
				processBeo4Command(slices[0], slices[1], slices[2]);
			}
		}
	}
}

module.exports = {
	interact: interact
}



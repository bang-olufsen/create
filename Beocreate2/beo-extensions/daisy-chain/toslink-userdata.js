var fs = require("fs");
if (fs.existsSync('/opt/beocreate/beocreate_essentials/dsp.js')) {
	var beoDSP = require('/opt/beocreate/beocreate_essentials/dsp');
} else {
	var beoDSP = require('/home/pi/beocreate_essentials/dsp');
}
cmdArgs = process.argv.slice(2);

beoDSP.connectDSP(function(success) {  
	if (success) {
		console.log("DSP connected successfully.");
		if (cmdArgs[0] == "rx") {
			beoDSP.readRegister(62991, function(response) {
				if (response.raw != null) {
					console.log("Auxiliary bits ready (62991): "+response.hex);
				}
				console.log("Reading daisy-chain command bits from S/PDIF receiver...");
				beoDSP.readRegister([63024, 63025, 63040, 63041], function(responses) {
					for (reg in responses) {
						console.log("Register", reg+":", responses[reg].hex);
					}
					console.log("Read complete.");
					daisyChainOn = (cmdArgs[1]) ? parseInt(cmdArgs[1]) : 0;
					beoDSP.readDSP(daisyChainOn, function(response) {
						if (response.raw != null) {
							console.log("Daisy-chain on ("+daisyChainOn+"): "+response.hex);
						}
						console.log("Reading daisy-chain channel assignment bits...");
						beoDSP.readRegister([63026, 63027, 63028, 63029], function(responses) {
							for (reg in responses) {
								console.log("Register", reg+":", responses[reg].hex);
							}
							console.log("Read complete.");
							beoDSP.disconnectDSP(function() {
								console.log("DSP was disconnected.");
								process.exit(0);
							});
						});
					});
				});
			});
		} else if (cmdArgs[0] == "tx") {
			if (!cmdArgs[1]) {
				beoDSP.readRegister(63135, function(response) {
					if (response.raw != null) {
						console.log("Auxiliary bits source (63135, 0 = internal): "+response.hex);
					}
					console.log("Reading daisy-chain command bits from S/PDIF transmitter...");
					beoDSP.readRegister([63168, 63169, 63184, 63185], function(responses) {
						for (reg in responses) {
							console.log("Register", reg+":", responses[reg].hex);
						}
						console.log("Read complete.");
						console.log("Reading daisy-chain channel assignment bits...");
						beoDSP.readRegister([63170, 63171, 63172, 63173], function(responses) {
							for (reg in responses) {
								console.log("Register", reg+":", responses[reg].hex);
							}
							console.log("Read complete.");
							beoDSP.disconnectDSP(function() {
								console.log("DSP was disconnected.");
								process.exit(0);
							});
						});
					});
				});
			} else {
				if (cmdArgs[1] == "on") {
					console.log("Setting daisy-chain command bits to on...");
					beoDSP.writeRegister(63168, 3);
					beoDSP.writeRegister(63169, 4);
					beoDSP.writeRegister(63184, 5);
					beoDSP.writeRegister(63185, 6);
					beoDSP.writeRegister(63135, 0); // Source
					
					if (cmdArgs[2] && !isNaN(cmdArgs[2])) {
						start = 63170;
						chString = "ABCD";
						chRoles = ["left", "right", "mid", "side"];
						for (var i = 0; i < cmdArgs[2].length; i++) {
							chIndex = parseInt(cmdArgs[2].charAt(i));
							console.log("Setting slave channel "+chString.charAt(i)+" to "+chRoles[chIndex]+"...");
							beoDSP.writeRegister(start+i, chIndex);
						}
					}
				} else if (cmdArgs[1] == "off") {
					console.log("Setting daisy-chain command bits to off...");
					beoDSP.writeRegister(63168, 0);
					beoDSP.writeRegister(63169, 0);
					beoDSP.writeRegister(63184, 0);
					beoDSP.writeRegister(63185, 0);
					beoDSP.writeRegister(63135, 1);
				}
				setTimeout(function() {
					console.log("Write complete.");
					beoDSP.disconnectDSP(function() {
						console.log("DSP was disconnected.");
						process.exit(0);
					});
				}, 600);
			}
		}
	}
}); // Opens a link with the SigmaDSP daemon.
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

// BEOCREATE TV CONTROL (HDMI-CEC)

var CECMonitor = require("@senzil/cec-monitor").CECMonitor;
var CEC = require("@senzil/cec-monitor").CEC;

var debug = beo.debug;
var sound = (beo.extensions['sound']) ? beo.extensions['sound'] : null;
var version = require("./package.json").version;
	
	var monitor = null;
	
	beo.bus.on('general', function(event) {
		// See documentation on how to use BeoBus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			startCEC("Beocreate");
		}
		
		if (event.header == "shutdown") {
			if (monitor) monitor.Stop();
			beo.bus.emit("general", {header: "shutdownComplete", content: {extension: "tv-control"}});
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "tv-control") {
				
			}
		}
	});
	
	
	var status = CEC.PowerStatus.UNKNOWN;
	
	function startCEC(withName) {
		if (debug) console.log("Starting CEC...");
		beo.bus.emit("general", {header: "requestShutdownTime", content: {extension: "tv-control"}});
		
		monitor = new CECMonitor(withName, {
			debug: false,
			audio: true,
			recorder: false,
			processManaged: true,
			no_serial: {
				reconnect: true,
				wait_time: 10
			}
		});
		
		monitor.on(CECMonitor.EVENTS._OPCODE, function(packet) {
			if (packet.event.indexOf("AUDIO" != -1)) {
				//console.log(packet.event);
			}
			if (packet.event == 'USER_CONTROL_PRESSED') {
				//if (debug) console.log(packet);
				if (packet.data.str == 'VOLUME_DOWN') {
					if (sound && sound.setVolume) {
						sound.setVolume("-1", false, function(systemVolume) {
							monitor.WriteRawMessage("tx 50:7A:"+systemVolume.toString(16));
						});
					}
					//beoBus.emit("sound", {header: "setVolume", content: {step: "-1%"}});
					//reportAudioStatus(100, "Volume down");
				}
				if (packet.data.str == 'VOLUME_UP') {
					if (sound && sound.setVolume) {
						sound.setVolume("+1", false, function(systemVolume) {
							monitor.WriteRawMessage("tx 50:7A:"+systemVolume.toString(16));
						});
					}
					//beoBus.emit("sound", {header: "setVolume", content: {step: "+1%"}});
					//reportAudioStatus(100, "Volume up");
				}
				
			}
		});
		
		
		monitor.once(CECMonitor.EVENTS.GIVE_AUDIO_STATUS, function() {
			reportAudioStatus();
			//monitor.SendMessage('AUDIOSYSTEM','TV','REPORT_AUDIO_STATUS',64);
		});
		
		monitor.once(CECMonitor.EVENTS.GIVE_SYSTEM_AUDIO_MODE_STATUS, function() {
			if (debug) console.log( 'Reporting the product to HDMI devices as audio system.' );
			monitor.SendMessage('AUDIOSYSTEM','BROADCAST','SYSTEM_AUDIO_MODE_STATUS',1);
			reportAudioStatus();
		});
		
		monitor.once(CECMonitor.EVENTS.SYSTEM_AUDIO_MODE_REQUEST, function() {
			if (debug) console.log( 'System audio mode requested.' );
			monitor.SendMessage('AUDIOSYSTEM','BROADCAST','SET_SYSTEM_AUDIO_MODE',1);
		});
		
		monitor.once(CECMonitor.EVENTS._READY, function() {
		  if (debug) console.log( 'CEC ready.' );
		  //monitor.SendMessage("AUDIOSYSTEM", "BROADCAST", "SYSTEM_AUDIO_MODE_STATUS", 1);
		  //reportAudioStatus();
			//monitor.WriteRawMessage("tx 50:7E:01"); // System Audio Mode Status
			
		});
		
		
		//beoBus.emit("sound", {header: "updateVolume"});
		
		monitor.on(CECMonitor.EVENTS._OPCODE, function(packet) {
		  //console.log(packet);
		});
		
		
		monitor.on(CECMonitor.EVENTS._ERROR, console.error);
		
		monitor.on(CECMonitor.EVENTS.REPORT_POWER_STATUS, function (packet, _status) {
		  var keys = Object.keys(CEC.PowerStatus);
		
		  for (var i = keys.length - 1; i >= 0; i--) {
		    if (CEC.PowerStatus[keys[i]] === _status) {
		      status = _status;
		      if (debug) console.log('POWER_STATUS:', keys[i], status);
		      break;
		    }
		  }
		});
		
		
		monitor.on(CECMonitor.EVENTS.ROUTING_CHANGE, function(packet, from, to) {
		  //if (debug) console.log('--ROUTING CHANGE--');
		  //if (debug) console.log(packet, from, to);
		});
		
		monitor.on(CECMonitor.EVENTS.STANDBY, function (packet) {
		  if (packet.source === CEC.LogicalAddress.TV) {
		    status = CEC.PowerStatus.STANDBY;
			if (debug) console.log("Standby command received from the TV.");
		  }
		});
		
	}
	
	function reportAudioStatus(text) {
		if (sound && sound.getVolume) {
			sound.getVolume(function(systemVolume) {
				if (debug == 2) {
					if (text) {
						console.log(text+". Reporting audio status to TV: "+systemVolume.percentage+" %.");
					} else {
						console.log("Reporting audio status to TV: "+systemVolume.percentage+" %.");
					}
				}
				monitor.WriteRawMessage("tx 50:7A:"+systemVolume.percentage.toString(16));
			});
		}
	}
	


module.exports = {
	version: version
}




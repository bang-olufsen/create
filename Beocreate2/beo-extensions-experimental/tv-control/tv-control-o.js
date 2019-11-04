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

module.exports = function(beoBus) {
	var module = {};
	var beoBus = beoBus;
	
	var monitor = null;
	
	beoBus.on('general', function(event) {
		// See documentation on how to use BeoBus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
			startCEC(event.content.systemName);
			
			
		}
		
		if (event.header == "activatedElement") {
			if (event.content == "tv-control") {
				
			}
		}
	});
	
	
	var status = CEC.PowerStatus.UNKNOWN;
	
	function startCEC(withName) {
		
		monitor = new CECMonitor(withName, {
			debug: false,
			audio: true,
			recorder: false,
			no_serial: {
				reconnect: true,
				wait_time: 10
			}
		});
		
		monitor.on(CECMonitor.EVENTS._OPCODE, function(packet) {
			if (packet.event.indexOf("AUDIO" != -1)) {
				//console.log(packet);
			}
			if (packet.event == 'USER_CONTROL_PRESSED') {
				console.log(packet);
				if (packet.data.str == 'VOLUME_DOWN') {
					beoBus.emit("player", {header: "setVolume", content: {step: "down"}});
				}
				if (packet.data.str == 'VOLUME_UP') {
					beoBus.emit("player", {header: "setVolume", content: {step: "up"}});
					//monitor.WriteRawMessage("tx 50:64:00:56:6F:6C:75:6D:65");
				}
				
			}
		});
		
		
		monitor.once(CECMonitor.EVENTS.GIVE_AUDIO_STATUS, function() {
			//monitor.SendMessage('AUDIOSYSTEM','TV','REPORT_AUDIO_STATUS',64);
		});
		
		monitor.once(CECMonitor.EVENTS._READY, function() {
		  console.log( ' -- READY -- ' );
		  //monitor.SendMessage("AUDIOSYSTEM", "BROADCAST", "SYSTEM_AUDIO_MODE_STATUS", 1);
		  	setTimeout(function() {
		  		//monitor.WriteRawMessage("tx 50:7A:A5"); // Report Audio Status
		  	}, 3000)
			//monitor.WriteRawMessage("tx 50:7E:01"); // System Audio Mode Status
			
		});
		
		monitor.once(CECMonitor.EVENTS._NOTICE, function() {
		  console.log( ' -- NOTICE -- ' );
		});
		
		monitor.once(CECMonitor.EVENTS._WARNING, function() {
		  console.log( ' -- WARNING -- ' );
		});
		
		monitor.once(CECMonitor.EVENTS._DEBUG, function() {
		  console.log( ' -- DEBUG -- ' );
		});
		
		monitor.once(CECMonitor.EVENTS._TRAFFIC, function() {
		  console.log( ' -- TRAFFIC -- ' );
		});
		
		monitor.on(CECMonitor.EVENTS._NOSERIALPORT, function() {
		  console.log( ' -- NO SERIAL PORT -- ' );
		});
		
		monitor.on(CECMonitor.EVENTS._STOP, function() {
		  console.log( ' -- STOP -- ' );
		});
		
		monitor.on(CECMonitor.EVENTS._ERROR, console.error);
		
		monitor.on(CECMonitor.EVENTS.REPORT_POWER_STATUS, function (packet, _status) {
		  var keys = Object.keys(CEC.PowerStatus);
		
		  for (var i = keys.length - 1; i >= 0; i--) {
		    if (CEC.PowerStatus[keys[i]] === _status) {
		      status = _status;
		      console.log('POWER_STATUS:', keys[i], status);
		      break;
		    }
		  }
		});
		
		monitor.on(CECMonitor.EVENTS.ROUTING_CHANGE, function(packet, from, to) {
		  console.log('--ROUTING CHANGE--');
		  console.log(packet, from, to);
		});
		
		monitor.on(CECMonitor.EVENTS.STANDBY, function (packet) {
		  if (packet.source === CEC.LogicalAddress.TV) {
		    status = CEC.PowerStatus.STANDBY;
		  }
		});
		
	}
	
	return module;
};





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

var simulation = false;

var productConnection;
var productAddress = "";
var connecting = false;
var connected = false;
var connectionAttempts = 0;
var maxConnectionAttempts = 5;
var noConnectionNotifications = false;
var reloadOnReconnect = false;

beoCom = (function() {

var productConnectionTimeout;
var productReconnectTimeout;

var productConnectionNotificationTimeout = null;


function connectToCurrentProduct() {
	// Although the UI markup and assets are served over HTTP directly from the product, WebSocket protocol is then used for realtime communication between the UI and the product.
	productAddress = window.location.host;
	//if (productAddress.indexOf(":") == -1) productAddress += ":80";
	if (!simulation && noExtensions == false && productAddress) connectProduct();
	//beo.notify(false, "connection");
}

function connectProduct() {
	
	if (connected) productConnection.close();
	
	connected = false;
	connecting = true;
	
	if (window.location.protocol.indexOf("https") != -1) {
		// Use secure websockets:
		wsProtocol = "wss://";
	} else {
		// Use unencrypted websockets:
		wsProtocol = "ws://";
	}
	
	console.log("Connecting to " + productAddress + "...");
	productConnection = new WebSocket(wsProtocol + productAddress, ["beocreate"]);
	
	productConnectionNotificationTimeout = setTimeout(function() {
		// Show "Connecting..." with a timeout so that it doesn't flash every time the UI loads.
		if (!noConnectionNotifications) beo.notify({title: "Connecting...", icon: "attention", timeout: false, id: "connection"});
	}, 1000);
	$(document).trigger("general", {header: "connection", content: {status: "connecting"}});
	beo.sendToProductView({header: "connection", content: {status: "connecting"}});
	
	productConnectionTimeout = setTimeout(function() {
		productConnection.close();
	}, 5000);
	
	// CONNECTED
	productConnection.onopen = function() {
		connected = true;
		connecting = false;
		connectionAttempts = 0;
		maxConnectionAttempts = 5; // Reset this to 5 at reconnect.
		
		clearTimeout(productConnectionTimeout);
		clearTimeout(productConnectionNotificationTimeout);
		console.log("Succesfully connected to " + productAddress + ".");
		$("body").addClass("connected").removeClass("disconnected connecting");
		beo.notify(false, "connection");
		noConnectionNotifications = false;
		$(document).trigger("general", {header: "connection", content: {status: "connected"}});
		beo.sendToProductView({header: "connection", content: {status: "connected"}});
		//if (!stateRestored) beo.restoreState();
		if (reloadOnReconnect) window.location.reload();
	};
	
	// DISCONNECTED
	productConnection.onclose = function() {
		$(document).trigger("general", {header: "connection", content: {status: "disconnected"}});
		if (connected) {
			connected = false;
			console.log("Disconnected from " + productAddress + ", reconnecting...");
			beo.sendToProductView({header: "connection", content: {status: "disconnected", reconnecting: true}});
			$("body").addClass("connecting").removeClass("connected disconnected");
			connectProduct();
		} else {
			if (connectionAttempts < maxConnectionAttempts) {
				connectionAttempts++;
				productReconnectTimeout = setTimeout(function() {
					connectProduct();
				}, 5000);
				console.log("No response from " + productAddress + ", trying again in a moment...");
			} else {
				console.log("Stopping attempts to connect to " + productAddress + ".");
				clearTimeout(productConnectionNotificationTimeout);
				$("body").addClass("disconnected").removeClass("connecting connected");
				beo.sendToProductView({header: "connection", content: {status: "disconnected", reconnecting: false}});
				if (maxConnectionAttempts > 0 && !noConnectionNotifications) beo.notify({title: "Product is unreachable", message: "Make sure the product is on and that the product and your "+os[1]+" are connected to the same network.", buttonAction: "beoCom.connectToCurrentProduct();", buttonTitle: "Try Again", id: "connection", timeout: false});
				clearTimeout(productConnectionTimeout);
				connectionAttempts = 0;
				connecting = false;
			}
		}
	};
	
	// RECEIVING A MESSAGE
	productConnection.onmessage = function(message) {
		processReceivedData(JSON.parse(message.data));
	};
}


function processReceivedData(data) {
	if (debug) console.log(data);
	if (data.target && data.header && data.content) {
		$(document).trigger(data.target, {header: data.header, content: data.content});
	} else if (data.target && data.header) {
		$(document).trigger(data.target, {header: data.header});
	}
}

function send(data) {
	if (productConnection && connected) {
		productConnection.send(JSON.stringify(data));
	} else if (simulation) {
		console.log("Simulated send of data:"+data);
	}
}

function sendToProduct(target, header, content = undefined) {
	if (productConnection && connected) {
		if (typeof header == "string") {
			send({target: target, header: header, content: content});
		} else {
			// Legacy way of sending data, supported. 'Header' used to be 'data'.
			header.target = target;
			send(header);
		}
	} else {
		return "Product is not connected, could not send data.";
	}
}


beo.send = send;
beo.sendToProduct = sendToProduct

return {
	connectToCurrentProduct: connectToCurrentProduct,
	send: send,
	sendToProduct: sendToProduct
}

})();

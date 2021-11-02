/*Copyright 2020 Bang & Olufsen A/S
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
	if (!simulation && productAddress) connectProduct();
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
		if (!noConnectionNotifications && beo.notify) beo.notify({title: "Connecting...", icon: "attention", timeout: false, id: "connection"});
	}, 1000);
	document.dispatchEvent(new CustomEvent("general", {detail: {content: {status: "connecting"}, header: "connection"}}));
	if (beo.sendToProductView) beo.sendToProductView({header: "connection", content: {status: "connecting"}});
	
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
		document.body.classList.add("connected");
		document.body.classList.remove("disconnected", "connecting");
		if (beo.notify) beo.notify(false, "connection");
		noConnectionNotifications = false;
		document.dispatchEvent(new CustomEvent("general", {detail: {content: {status: "connected"}, header: "connection"}}));
		if (beo.sendToProductView) beo.sendToProductView({header: "connection", content: {status: "connected"}});
		//if (!stateRestored) beo.restoreState();
		if (reloadOnReconnect) window.location.reload();
	};
	
	// DISCONNECTED
	productConnection.onclose = function() {
		document.dispatchEvent(new CustomEvent("general", {detail: {content: {status: "disconnected"}, header: "connection"}}));
		if (connected) {
			connected = false;
			console.log("Disconnected from " + productAddress + ", reconnecting...");
			if (beo.sendToProductView) beo.sendToProductView({header: "connection", content: {status: "disconnected", reconnecting: true}});
			document.body.classList.add("connecting");
			document.body.classList.remove("disconnected", "connected");
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
				document.body.classList.add("disconnected");
				document.body.classList.remove("connecting", "connected");
				if (beo.sendToProductView) beo.sendToProductView({header: "connection", content: {status: "disconnected", reconnecting: false}});
				if (maxConnectionAttempts > 0 && !noConnectionNotifications && beo.notify) beo.notify({title: "Product is unreachable", message: "Make sure the product is on and that the product and your "+os[1]+" are connected to the same network.", buttonAction: "beoCom.connectToCurrentProduct();", buttonTitle: "Try Again", id: "connection", timeout: false});
				clearTimeout(productConnectionTimeout);
				connectionAttempts = 0;
				connecting = false;
			}
		}
	};
	
	// RECEIVING A MESSAGE
	productConnection.onmessage = function(message) {
		if (message != "reload") {
			processReceivedData(JSON.parse(message.data));
		} else {
			window.location.reload(); // Remote reload function.
		}
	};
}


function processReceivedData(data) {
	if (debug) console.log(data);
	if (data.target && data.header && data.content) {
		document.dispatchEvent(new CustomEvent(data.target, {detail: {content: data.content, header: data.header}}));
		if (data.target == "general" && data.header == "reload" && beo.appearance) {
			if (data.content == beo.appearance) window.location.reload();
		}
	} else if (data.target && data.header) {
		document.dispatchEvent(new CustomEvent(data.target, {detail: {header: data.header}}));
		if (data.target == "general" && data.header == "reload") window.location.reload();
	}
}

var encoder = new TextEncoder();

function sendToProduct(target, header, content = undefined) {
	if (productConnection && connected) {
		var serialisedData = JSON.stringify({target: target, header: header, content: content});
		//console.log(serialisedData);
		productConnection.send(encoder.encode(serialisedData));
	} else if (simulation) {
		console.log("Simulated send of data:"+{target: target, header: header, content: content});
	} else {
		return "Product is not connected, could not send data.";
	}
}

return {
	connectToCurrentProduct: connectToCurrentProduct,
	sendToProduct: sendToProduct
}

})();

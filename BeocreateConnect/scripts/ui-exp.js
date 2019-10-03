var knownProducts = {
"beovox-cx50": "Beovox CX 50", 
"beovox-cx100": "Beovox CX 100", 
"beocreate-core-mk1": "BeoCreate Core"};

const ipc = require('electron').ipcRenderer;

// OPEN LINKS IN BROWSER
// This works for links directly in the UI, for links within the product view there is code in main.js.
var shell = require('electron').shell;
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    shell.openExternal(this.href);
});




// WINDOW EVENTS

ipc.on('windowEvent', (event, message) => {
	if (message == "activate") {
		$("body").addClass("active").removeClass("inactive");
	}
	if (message == "resignActive") {
		$("body").removeClass("active").addClass("inactive");
	}
});

windowTitle = "";
function setWindowTitle(title) {
	if (!title) {
		$("#title-bar").removeClass("title");
	} else {
		windowTitle = title;
		$("#window-title").text(title);
	}
}

function showWindowTitle(show) {
	if (show && windowTitle) {
		$("#title-bar").addClass("title");
	} else {
		$("#title-bar").removeClass("title");
	}
}


// MAIN MENU

var menuOpen = true;
var menuTimeout;
function toggleMenu(force) {
	clearTimeout(menuTimeout);
	if (force != undefined) {
		if (force == true) menuOpen = false;
		if (force == false) menuOpen = true;
	}
	if (menuOpen == false) {
		$("#main-menu").addClass("show");
		menuTimeout = setTimeout(function() {
			$("#main-menu").addClass("visible");
			$("#main-menu-back-shadow").addClass("visible");
		}, 20)
		$("#menu-button").addClass("menu-open");
		menuOpen = true;
		showWindowTitle(false);
	} else {
		//startLoadRowAnimation();
		$("#main-menu").removeClass("visible");
		$("#main-menu-back-shadow").removeClass("visible");
		$("#menu-button").removeClass("menu-open");
		menuTimeout = setTimeout(function() {
			$("#main-menu").removeClass("show");
			$("body").removeClass("first-menu-visit").addClass("second-menu-visit");
		}, 1050);
		menuOpen = false;
		showWindowTitle(true);
	}
}

function showMenuButton(show) {
	if (show) {
		$("#menu-button").removeClass("hide");
	} else {
		$("#menu-button").addClass("hide");
	}
}

function showSection(sectionID, closeMenu, screenID) {
	if (screenID) showScreen(screenID);
	$(".app-section").removeClass("show");
	$("#"+sectionID).addClass("show");
	if (closeMenu) toggleMenu(false);
}

function showScreen(screenID, direction) {
	if (!direction) {
		$("#"+screenID).removeClass("left right");
		$("#"+screenID).siblings(".menu-screen.visible").removeClass("left right");
	} else if (direction == "left-right") {
		$("#"+screenID).addClass("left").removeClass("right");
		$("#"+screenID).siblings(".menu-screen.visible").addClass("right").removeClass("left");
	} else if (direction == "right-left") {
		$("#"+screenID).addClass("right").removeClass("left");
		$("#"+screenID).siblings(".menu-screen.visible").addClass("left").removeClass("right");
	}
	$("#"+screenID).siblings(".menu-screen.visible").removeClass("visible");
	setTimeout(function() {
		$("#"+screenID).siblings(".menu-screen").removeClass("show");
		$("#"+screenID).addClass("show");
		setTimeout(function() {
			$("#"+screenID).addClass("visible");
		}, 50);
	}, 500);
}

function disclosure(disclosureID) {
	if (!$("#"+disclosureID).hasClass("show")) {
		$("#"+disclosureID).addClass("show");
	} else {
		$("#"+disclosureID).removeClass("show");
	}
}


// PRODUCT DISCOVERY

// Receives discovered products from the app.
products = [];
selectedProduct = null;
connectOnDiscovery = {identifierType: null, identifier: null};

ipc.on('discoveredProducts', (event, message) => {
	products = message;
	console.log(products);
	updateProductLists();
});

function updateProductLists() {
	$(".found-products .discovered, .found-products .spacer").remove();
	$(".no-products").removeClass("hidden");
	for (var i = 0; i < products.length; i++) {
		productKnown = false;
		if (products[i].txt) {
			if (products[i].txt.device_type) {
				if (knownProducts[products[i].txt.device_type]) {
					speakerIcon = products[i].txt.device_type + ".png";
					productKnown = true;
				}
			}
		}
		if (productKnown) {
			$(".found-products").append('<div class="collection-item product-item discovered configure product-item-'+i+'" onclick="configureProduct('+i+');"><img class="square-helper" src="images/square-helper.png"><div class="collection-item-content"><img class="collection-icon" src="images/product-images/'+speakerIcon+'"><div class="collection-item-text"><div class="collection-label upper product-type">'+knownProducts[products[i].txt.device_type]+'</div><div class="product-name collection-label lower">'+products[i].name+'</div></div></div>');
		} else {
			$(".found-products").append('<div class="collection-item product-item discovered configure product-item-'+i+'" onclick="configureProduct('+i+');"><img class="square-helper" src="images/square-helper.png"><div class="collection-item-content"><img class="collection-icon" src="images/product-images/4ca.png"><div class="collection-item-text"><div class="collection-label upper product-type">&nbsp;</div><div class="product-name collection-label lower">'+products[i].name+'</div></div></div>');
		}
	}
	for (var i = 0; i < 3; i++) {
		$(".found-products").append('<div class="collection-item spacer"></div>');
	}
	if (products.length != 0) {
		$(".no-products").addClass("hidden");
	}
}


function configureProduct(productIndex) {
	endAssistant();
	setWindowTitle("Configure");
	showMenuButton(true);
	productIP = products[productIndex].addresses[0];
	if ($("#product-view").attr("src") != "http://"+productIP) {
		$("#product-view").attr("src", "http://"+productIP);
	}
	showSection("product-view", true);
	//ipc.send("selectedProduct", productIndex);
}

function setUpNew() {
	endAssistant();
	setWindowTitle("Set Up New");
	showMenuButton(true);
	showSection('set-up-new', true, 'set-up-new-start');
}

// ASSISTANT FLOW

var currentAssistant = null;
function startAssistant(assistant) {
	currentAssistant = assistant;
	$("body").addClass("assistant");
	switch (assistant) {
		case "createCard":
			break;
		case "findAndSetUp":
			setWindowTitle("First-Time Setup");
			assistantFlow();
			break;
	}
}

function assistantButtons(previousText, nextText) {
	$("#assistant-previous").text(previousText);
	$("#assistant-next").text(nextText);
}

function enableAssistantButtons(previousEnabled, nextEnabled) {

	if (previousEnabled) {
		$("#assistant-previous").removeClass("disabled");
	} else {
		$("#assistant-previous").addClass("disabled");	
	}
	if (nextEnabled) {
		$("#assistant-next").removeClass("disabled");
	} else {
		$("#assistant-next").addClass("disabled");	
	}
}

function endAssistant() {
	$("body").removeClass("assistant");
	currentAssistant = null;
}

var assistantStep = 0;
function assistantFlow(step) {
	if (step != undefined) {
		if (isNaN(step)) {
			if (step == "next") {
				assistantStep++;
				direction = "right-left";
			}
			if (step == "previous") {
				assistantStep--;
				direction = "left-right";
			}
		} else {
			assistantStep = step;
			direction = false;
		}
	} else {
		assistantStep = 0;
		direction = false;
	}

	switch (currentAssistant) {
		case "findAndSetUp":
			switch (assistantStep) {
				case -1:
					//toggleMenu(true);
					showScreen('set-up-new-start');
					setWindowTitle("Set Up New");
					endAssistant();
					break;
				case 0:
					assistantButtons("Back to Start", "Next Step");
					enableAssistantButtons(true, true);
					showScreen('sd-to-product', direction);
					showMenuButton(true);
					break;
				case 1:
					assistantButtons("Previous Step", "Next Step");
					showScreen('connect-power', direction);
					enableAssistantButtons(true, true);
					break;
				case 2:
					assistantButtons("Previous Step", "Next Step");
					enableAssistantButtons(true, false);
					showScreen('wait-for-discovery', direction);
					break;
			}
			break;
	}
}

// COMMUNICATIONS FROM THE PRODUCT UI
window.addEventListener("message", function(event) {
	data = JSON.parse(event.data);
	
	if (data.header != undefined) {
	
		switch (data.header) {
			case "isShownInBeoApp":
				// The product asks if its UI is shown in the BeoCreate app.
				sendToProductUI({header: "isShownInBeoApp", content: true});
				break;
			case "autoReconnectLegacyProduct":
				// When a BeoCreate 1 product changes name, make note of its new name and wait until it drops connection. Wait for it to be discovered under the new name and automatically connect to it.
				if (data.newName) {
					connectOnDiscovery = {identifierType: "name", identifier: data.newName};
				}
				break;
		}
	
	}
});

function sendToProductUI(data) {
	document.getElementById("product-view").contentWindow.postMessage(JSON.stringify(data), "*");
}
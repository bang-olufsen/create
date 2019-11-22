var inElectron = false;
var debug = true;

var ipc;
var shell;
var remote;
if (typeof require !== 'undefined') {
	ipc = require('electron').ipcRenderer;
	shell = require('electron').shell;
	remote = require('electron').remote;
	var {Menu, MenuItem} = remote;
	inElectron = true;
}

var darkAppearance = false;
var windows = false;

window.matchMedia("(prefers-color-scheme: dark)").addListener(e => e.matches && setAppearance(true))
window.matchMedia("(prefers-color-scheme: light)").addListener(e => e.matches && setAppearance(false))

function setAppearance(dark) {
	if (dark == undefined) {
		dark = false;
		dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	}
	if (dark == true) {
		console.log("Setting appearance to dark.");
		$("body").addClass("dark");
		darkAppearance = true;
	} else if (dark == false) {
		console.log("Setting appearance to light.");
		$("body").removeClass("dark");
		darkAppearance = false;
	}
}

// OPEN LINKS IN BROWSER
// This works for links directly in the UI, for links within the product view there is code in main.js.

$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    if (shell) shell.openExternal(this.href);
});

$( document ).ready(function() {
	// FASTCLICK
	if (inElectron) $("body").addClass("electron");
	setAppearance();
	$("body").addClass("first-menu-visit");
	titleBarMode("normal");
	toggleMenu(true);
	setTimeout(function() {
		$("body").removeClass("no-dark-ui-animation");
	}, 500);
});

// WINDOW EVENTS

if (ipc) {
	ipc.on('windowEvent', (event, message) => {
		if (message == "activate") {
			$("body").addClass("active").removeClass("inactive");
		}
		if (message == "resignActive") {
			$("body").removeClass("active").addClass("inactive");
		}
		if (message == "fullScreen") {
			$("body").addClass("full-screen").removeClass("windowed");
		}
		if (message == "windowed") {
			$("body").addClass("windowed").removeClass("full-screen");
		}
	});
	ipc.on('colourSchemeIsDark', (event, message) => {
		setAppearance(message);
		sendToProductUI({header: "hasDarkAppearance", content: darkAppearance});
	});
	ipc.on('styleForWindows', (event, message) => {
		if (message == true) {
			windows = true;
			$("body").addClass("windows").removeClass("mac");
		} else {
			windows = false;
			$("body").removeClass("windows").addClass("mac");
		}
	});
	
	ipc.on('reloadProductView', (event) => {
		$("#product-view").attr("src", $("#product-view").attr("src"));
	});
}

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


// TITLE BAR

function titleBarMode(mode) {
	switch (mode) {
		case "normal":
			$("#title-bar").addClass("visible").removeClass("dark");
			break;
	}
}


(function handleWindowControls() {
    // When document has loaded, initialise
    document.onreadystatechange = () => {
        if (document.readyState == "complete") {
            init();
        }
    };

    function init() {
        if (remote) {
			window = remote.getCurrentWindow();
		}
        const minButton = document.getElementById('min-button'),
            maxButton = document.getElementById('max-button'),
            restoreButton = document.getElementById('restore-button'),
            closeButton = document.getElementById('close-button');

        minButton.addEventListener("click", event => {
            if (remote) {
				window = remote.getCurrentWindow();
				window.minimize();
			}
        });

        maxButton.addEventListener("click", event => {
            if (remote) {
				window = remote.getCurrentWindow();
				window.maximize();
				toggleMaxRestoreButtons();
			}
        });

        restoreButton.addEventListener("click", event => {
            if (remote) {
				window = remote.getCurrentWindow();
				window.unmaximize();
				toggleMaxRestoreButtons();
			}
        });

        // Toggle maximise/restore buttons when maximisation/unmaximisation
        // occurs by means other than button clicks e.g. double-clicking
        // the title bar:
        toggleMaxRestoreButtons();
        window.on('maximize', toggleMaxRestoreButtons);
        window.on('unmaximize', toggleMaxRestoreButtons);

        closeButton.addEventListener("click", event => {
            window = remote.getCurrentWindow();
            window.close();
        });

        function toggleMaxRestoreButtons() {
			if (remote && windows) {
	            window = remote.getCurrentWindow();
	            if (window.isMaximized()) {
	                maxButton.style.display = "none";
	                restoreButton.style.display = "flex";
	            } else {
	                restoreButton.style.display = "none";
	                maxButton.style.display = "flex";
	            }
			}
        }
    }
})();


// MAIN MENU

// Beautiful and bold colours designed by Polly Bosworth. Use them in fun combinations!
var menuColourThemes = [
	["mariner", "waterleaf", "spindle"],
	["turquoise", "waxflower", "yellow"],
	["turquoise", "waterleaf", "spindle"],
	["turquoise", "spindle", "cherub"],
	["carnation", "cherub", "spindle"]
];

var menuOpen = true;
var menuTimeout;
function toggleMenu(force) {
	clearTimeout(menuTimeout);
	if (force != undefined) {
		if (force == true) menuOpen = false;
		if (force == false) menuOpen = true;
	}
	if (menuOpen == false) {
		applyColourTheme();
		$("#main-menu").addClass("show");
		$("body").addClass("animating-menu in-menu");
		if (currentAssistant) endAssistant(true);
		menuTimeout = setTimeout(function() {
			$("#main-menu").addClass("visible");
			$("#main-menu-back-shadow").addClass("visible");
			menuTimeout = setTimeout(function() {
				$("body").removeClass("animating-menu");
			}, 1000);
		}, 20);
		$(".menu-button").addClass("menu-open");
		menuOpen = true;
		showWindowTitle(false);
		connectOnDiscovery = {identifier: null, productName: null};
	} else {
		//startLoadRowAnimation();
		connectOnDiscovery = {identifier: null, productName: null};
		if (currentAssistant) startAssistant();
		$("body").addClass("animating-menu");
		$("body").removeClass("in-menu")
		$("#main-menu").removeClass("visible");
		$("#main-menu-back-shadow").removeClass("visible");
		$(".menu-button").removeClass("menu-open");
		menuTimeout = setTimeout(function() {
			$("#main-menu").removeClass("show");
			$("body").removeClass("first-menu-visit animating-menu").addClass("second-menu-visit");
		}, 1050);
		menuOpen = false;
		showWindowTitle(true);
	}
}

function applyColourTheme(theme) {
	if (theme == undefined) theme = Math.floor((Math.random() * menuColourThemes.length));
	//console.log(theme);
	$("#main-menu .colour-background .element-1").css("background-color", "var(--"+menuColourThemes[theme][0]+")");
	$("#main-menu .colour-background .element-2").css("background-color", "var(--"+menuColourThemes[theme][1]+")");
	$("#main-menu .colour-background .element-3").css("background-color", "var(--"+menuColourThemes[theme][2]+")");
}

function showMenuButton(show) {
	if (show) {
		$(".menu-button").removeClass("disabled");
		//$("#title-bar-drag").removeClass("menu-button-hide");
	} else {
		$(".menu-button").addClass("disabled");
		//$("#title-bar-drag").addClass("menu-button-hide");
	}
}

function productNotification(title, description) {
	if (!title && !description) {
		$("#product-notification").addClass("hidden");
	} else {
		$("#product-notification").removeClass("hidden");
		$("#product-notification h3").text(title);
		$("#product-notification p").text(description);
	}
}

document.addEventListener("scroll", function(event) {
	if (event.target.id == "main-menu-scroll-area") {
		scrollPos = $("#main-menu-scroll-area").scrollTop();
		$("#main-menu .colour-background .element-2").css("transform", "translateY("+scrollPos*-0.5+"px)");
		$("#main-menu .colour-background .element-3").css("transform", "translateY("+scrollPos*-0.2+"px)");
	}
}, true);


inProductView = false;
sectionChangeTimeout = null;

function showSection(sectionID, closeMenu, screenID) {
	inProductView = (sectionID == "product-view") ? true : false;
	if (screenID) showScreen(screenID);
	$(".app-section").removeClass("visible");
	setTimeout(function() {
		$(".app-section").removeClass("show");
		$("#"+sectionID).addClass("show");
		setTimeout(function() {
			$("#"+sectionID).addClass("visible");
		}, 50);
	}, 500);
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

function toggle(inElement, outElement) {
	$(inElement).removeClass("hidden");
	$(outElement).addClass("hidden");
}



// PRODUCT DISCOVERY

// Receives discovered products from the app.
products = {};
selectedProduct = null;
connectOnDiscovery = {identifier: null, systemName: null};


if (ipc) {
	setTimeout(function() {
		ipc.send("getAllProducts");
	}, 1000);
	
	ipc.on('discoveredProducts', (event, message) => {
		products = message;
		updateProductLists();
	});
	
	
	ipc.on('addProduct', (event, product) => {
		products[product.fullname] = product;
		addProduct(product);
		$(".no-products").addClass("hidden");
		//updateProductLists();
	});
	
	ipc.on('updateProduct', (event, product) => {
		products[product.fullname] = product;
		updateProduct(product);
		//updateProductLists();
	});
	
	refreshing = false;
	ipc.on('removeProduct', (event, product) => {
		//if (!refreshing) {
			fullname = product.fullname;
			$(".found-products .discovered[data-product-fullname=\""+fullname+"\"]").addClass("animated-hide");
			setTimeout(function() {
				$(".found-products .discovered[data-product-fullname=\""+fullname+"\"]").remove();
			}, 400);
			delete products[fullname];
			if (Object.keys(products).length == 0) {
				setTimeout(function() {
					$(".no-products").removeClass("hidden").addClass("fade-hide");
					setTimeout(function() {
						$(".no-products").removeClass("fade-hide");
					}, 100);
					$(".found-products .discovered[data-product-fullname=\""+fullname+"\"]").remove();
				}, 400);
			}
			if (debug) console.log("Removing", fullname);
		//}
		//updateProductLists();
	});
}

function updateProductLists() {
	refreshing = true;
	$(".found-products .discovered").remove();
	for (fullname in products) {
		addProduct(products[fullname]);
	}
	/*for (var i = 0; i < 3; i++) {
		$(".found-products").append('<div class="collection-item spacer"></div>');
	}*/
	if (Object.keys(products).length != 0) {
		$(".no-products").addClass("hidden");
		if (debug) console.log("Products:", Object.keys(products).length);
	} else {
		$(".no-products").removeClass("hidden");
		if (debug) console.log("No products.");
	}
	refreshing = false;
}

function addProduct(product) {
	info = getProductInfo(product);
	console.log(connectOnDiscovery.identifier, product.systemID);
	if (connectOnDiscovery.identifier != null) {
		// Check if this product is the one that should be automatically reconnected.
		if (product.systemID == connectOnDiscovery.identifier) {
			configureProduct(product.fullname, true);
			productNotification();
		}
	}
	if ($(".found-products .discovered[data-product-fullname=\""+product.fullname+"\"]")) {
		$(".found-products .discovered[data-product-fullname=\""+product.fullname+"\"]").remove();
	}
	$(".found-products .spacer.first").before('<div class="collection-item product-item discovered animated-hide '+info.classes.join(" ")+'" onclick="configureProduct(\''+product.fullname+'\');" data-product-fullname="'+product.fullname+'"><img class="square-helper" src="images/square-helper.png"><div class="collection-item-content"><img class="collection-icon" src="'+info.image+'"><div class="collection-item-text"><div class="collection-label upper product-type">'+info.model+'</div><div class="product-name collection-label lower">'+product.name+'</div></div></div>');
	setTimeout(function() {
		$(".found-products .discovered").removeClass("animated-hide");
	}, 100);
	if (debug) console.log("Adding", product.fullname);
}

function updateProduct(product) {
	info = getProductInfo(product);
	$('.product-item[data-product-fullname="'+product.fullname+'"]').removeClass("normal yellow red legacy configure");
	$('.product-item[data-product-fullname="'+product.fullname+'"]').addClass(info.classes.join(" "));
	$('.product-item[data-product-fullname="'+product.fullname+'"] .product-type').text(info.model);
	$('.product-item[data-product-fullname="'+product.fullname+'"] .collection-icon').attr("src", info.image);
}

function getProductInfo(product) {
	image = "images/product-images/beocreate.png";
	model = "Beocreate";
	classes = [];
	if (product.legacyProduct) {
		classes.push("legacy", "configure");
	} else {
		if (product.productImage != null) image = "http://"+product.addresses[0]+":"+product.port+product.productImage;
		if (product.modelName != null) model = product.modelName;
		if (model.toLowerCase() == "beocreate 4-channel amplifier") model = "Beocreate";
		classes.push("configure");
		if (product.systemStatus) {
			switch (product.systemStatus) {
				case "normal":
					// No need to add any classes.
					break;
				case "yellow":
				case "red":
					classes.push(product.systemStatus);
					break;
			}
		}
	}
	return {model: model, image: image, classes: classes};
}

var productConnectionStatus = "disconnected";

function configureProduct(fullname, fromDiscovery) {
	if (products[fullname]) {
		endAssistant();
		setWindowTitle(products[fullname].name);
		showMenuButton(true);
		connectOnDiscovery = {identifier: null, productName: null};
		setTimeout(function() {
			productNotification();
		}, 600);
		productIP = products[fullname].addresses[0]+":"+products[fullname].port;
		selectedProduct = JSON.parse(JSON.stringify(products[fullname]));
		src = $("#product-view").attr("src");
		if (!src || fromDiscovery || src.indexOf("http://"+productIP+"/") == -1 || productConnectionStatus == "disconnected") {
			/*
			Reload if any of the following is true:
			- Product view has no source
			- This is a "connect on discovery" request
			- The product view URL is not the requested URL
			- The product currently in view is disconnected (maybe it was shut down last time)
			*/
			$("#product-view").attr("src", "http://"+productIP+"/");
		}
		showSection("product-view", true);
	}
}

function setUpNew() {
	endAssistant();
	setWindowTitle("Set Up New");
	showMenuButton(true);
	showSection('set-up-new', true, 'set-up-new-start');
}


// Right-click menu for products
if (remote) {
	const productContextMenu = new Menu();
	productContextMenu.append(new MenuItem({ label: 'Copy Link', click() { console.log('item 1 clicked') } }));
	productContextMenu.append(new MenuItem({ label: 'Open in Web Browser', click() { console.log('item 1 clicked') } }));
	productContextMenu.append(new MenuItem({ type: 'separator' }));
	productContextMenu.append(new MenuItem({ label: 'Hide Product...', click() { console.log('item 1 clicked') } }));
	//menu.append(new MenuItem({ type: 'separator' }));
	//menu.append(new MenuItem({ label: 'MenuItem2', type: 'checkbox', checked: true }));
	
	window.addEventListener('contextmenu', (e) => {
	  e.preventDefault();
	  productContextMenu.popup({ window: remote.getCurrentWindow() });
	}, false);
}

// ASSISTANT FLOW

var currentAssistant = null;
function startAssistant(assistant) {
	if (assistant) currentAssistant = assistant;
	setTimeout(function() {
		$("#assistant-bar").addClass("show");
		setTimeout(function() {
			$("body").addClass("assistant");
		}, 100);
	}, 500);
	if (assistant) {
		switch (assistant) {
			case "createCard":
				setWindowTitle("Prepare a MicroSD Card");
				assistantFlow();
				break;
			case "findAndSetUp":
				setWindowTitle("First-Time Setup");
				assistantFlow();
				break;
		}
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

function endAssistant(hideOnly) {
	$("body").removeClass("assistant");
	setTimeout(function() {
		$("#assistant-bar").removeClass("show");
	}, 500);
	if (!hideOnly) currentAssistant = null;
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
					assistantButtons("Cancel", "Next Step");
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
					ipc.send("refreshProducts");
					break;
			}
			break;
			
		case "createCard":
			switch (assistantStep) {
				case -1:
					//toggleMenu(true);
					showScreen('set-up-new-start');
					setWindowTitle("Set Up New");
					endAssistant();
					break;
				case 0:
					assistantButtons("Stop Writing", "Next Step");
					enableAssistantButtons(true, false);
					showScreen('writing-card', direction);
					showMenuButton(true);
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
				sendToProductUI({header: "hasDarkAppearance", content: darkAppearance});
				break;
			case "systemName":
				// The product sends its name, update it to the header.
				if (inProductView) setWindowTitle(data.content.name);
				break;
			case "autoReconnect":
				connectOnDiscovery = {identifier: data.content.systemID, systemName: data.content.systemName};
				productNotification(data.content.systemName+" will be automatically reconnected", "Make sure this computer is connected to the same network as the product.");
				break;
			case "connection":
				// Websocket connection status.
				if (data.content.status) productConnectionStatus = data.content.status;
				break;
			case "powerStatus":
				if (data.content.status == "rebooting") {
					if (debug) console.log("Product is starting a reboot.");
					connectOnDiscovery = {identifierType: "systemID", identifier: data.content.systemID, systemName: data.content.systemName};
					//productNotification(data.content.systemName+" is restarting", "Please wait for automatic reconnection...");
				} else if (data.content.status == "shuttingDown") {
					if (debug) console.log("Product is starting a shutdown.");
					//productNotification(data.content.systemName+" is shutting down", "Please wait for at least 20 seconds before disconnecting power.");
				}
				//toggleMenu(true);
				//showMenuButton(false);
				break;
		}
	
	}
});

function sendToProductUI(data) {
	document.getElementById("product-view").contentWindow.postMessage(JSON.stringify(data), "*");
}


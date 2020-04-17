const {app, Menu, BrowserWindow, ipcMain, systemPreferences} = require('electron');
const windowStateKeeper = require('electron-window-state');
const dnssd = require('dnssd2');
const drivelist = require('drivelist');
const request = require('request');
const os = require('os');
var shell = require('electron').shell;

var debug = false;
var activeWindow = true;

// MENU

const template = [
  {
    label: 'Product',
    submenu: [
      { label: 'Discover Products Again',
      click () { startDiscovery(); startManualDiscovery(); }},
	  { type: 'separator' },
	  { label: 'Reload Product View',
	  click () { win.webContents.send('reloadProductView') }, accelerator: "CmdOrCtrl+R"}
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'pasteandmatchstyle' },
      { role: 'delete' },
      { role: 'selectall' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'resetzoom' },
      { role: 'zoomin' },
      { role: 'zoomout' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  {
	label: 'Develop',
    submenu: [
      { role: 'reload', accelerator: false },
      { role: 'forcereload', accelerator: false },
      { role: 'toggledevtools' }
    ]
  },
  {
    role: 'window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' }
    ]
  },
  {
    role: 'help',
    submenu: [
		{ label: 'Guides && Documentation',
		click () { shell.openExternal('https://www.hifiberry.com/beocreate/beocreate-doc/') }},
		{ type: 'separator' },
		{ label: 'Visit Bang && Olufsen',
        click () { shell.openExternal('https://www.bang-olufsen.com') }},
		{ label: 'Visit HiFiBerry',
		click () { shell.openExternal('https://www.hifiberry.com') }},
		{ label: 'View Source Code',
		click () { shell.openExternal('https://github.com/bang-olufsen/create') }},
    ]
  }
]

if (process.platform === 'darwin') {
  template.unshift({
    label: app.getName(),
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideothers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  })

  // Edit menu
  template[2].submenu.push(
    { type: 'separator' },
    {
      label: 'Speech',
      submenu: [
        { role: 'startspeaking' },
        { role: 'stopspeaking' }
      ]
    }
  )

  // Window menu
  template[5].submenu = [
    { role: 'close' },
    { role: 'minimize' },
    { role: 'zoom' },
    { type: 'separator' },
    { role: 'front' }
  ]
};

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);


// WINDOW
  
  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  let win
  
  function createWindow () {
    // Create the browser window.
	let mainWindowState = windowStateKeeper({
	    defaultWidth: 820,
	    defaultHeight: 600
	  });
    //win = new BrowserWindow({width: 800, height: 600, minWidth: 450, minHeight: 300, acceptFirstMouse: true, titleBarStyle: 'hiddenInset', title: "Bang & Olufsen Create", webPreferences: { scrollBounce: false }});
	hasFrame = true;
	if (process.platform !== 'darwin') {
	  hasFrame = false;
	}
	win = new BrowserWindow({
		x: mainWindowState.x,
		y: mainWindowState.y,
		width: mainWindowState.width,
		height: mainWindowState.height, 
		minWidth: 450, 
		minHeight: 300, 
		//acceptFirstMouse: true, 
		titleBarStyle: "hiddenInset", 
		title: "Beocreate Connect",
		frame: false,
		show: false,
		fullscreenWindowTitle: true,
		//vibrancy: "sidebar",
		//fullscreenable: false,
		backgroundColor: '#FFFFFF', 
		//transparent: true,
		webPreferences: { experimentalFeatures: false, nodeIntegration: true}
	});
	
	mainWindowState.manage(win);
  
    // and load the index.html of the app.
    win.loadFile('index.html')
    
    win.webContents.on('did-finish-load', () => {
		if (process.platform == 'darwin') {
			win.webContents.send('colourSchemeIsDark', systemPreferences.isDarkMode());
		}
		win.webContents.send('styleForWindows', process.platform !== 'darwin');
		setTimeout(function() {
			win.show();
			setTimeout(function() {
				startDiscovery();
				startCheckingIPAddress();
				startManualDiscovery();
			}, 500);
			
		}, 100);
	
      //listDrives();
    })
	
	win.once('ready-to-show', () => {
		//console.log("Showing window.");
		//win.show();
	})
  
    // Open the DevTools.
    //win.webContents.openDevTools()
  
    // Emitted when the window is closed.
    win.on('closed', () => {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
	  win = null;
	  stopManualDiscovery();
	  clearInterval(ipCheckInterval);
	  stopDiscovery();
    })
    
    win.on('focus', () => {
    	win.webContents.send('windowEvent', "activate");
		/*if (browser) {
			console.log("Products discovered: "+browser.list().length);
		} else {
			console.log("No browser.");
		}*/
		refreshProducts(null);
		activeWindow = true;
		//if (products.length == 0) startDiscovery();
    });
    
    win.on('blur', () => {
    	win.webContents.send('windowEvent', "resignActive");
		activeWindow = null;
    });
	
	win.on("enter-full-screen", () => {
		win.webContents.send('windowEvent', "fullScreen");
	});
	
	win.on("leave-full-screen", () => {
		win.webContents.send('windowEvent', "windowed");
	});
	
	win.webContents.on('new-window', function(event, url){
	  event.preventDefault();
	  shell.openExternal(url);
	});
}
  
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', createWindow)
  
  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
  
  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
    
  })
  
  app.on('before-quit', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    
	console.log("Quitting.");
    
  })


// DARK / LIGHT MODE
if (process.platform == "darwin") {
	systemPreferences.subscribeNotification(
	  'AppleInterfaceThemeChangedNotification',
	  function theThemeHasChanged () {
	  	console.log(systemPreferences.isDarkMode());
		win.webContents.send('colourSchemeIsDark', systemPreferences.isDarkMode());
	  }
	)
}
  
// FIND BEOCREATE SYSTEMS
var browser = null;
var startedOnce = false;
function startDiscovery(once) { // Start or restart discovery.
	if (!once || !startedOnce) {
	  	if (!browser) {
		  	browser = new dnssd.Browser(dnssd.tcp('beocreate'), {maintain: true});
	
	  		
	  		browser.on('serviceUp', service => discoveryEvent("up", service, false));
	  		browser.on('serviceDown', service => discoveryEvent("down", service, false));
	  		browser.on('serviceChanged', service => discoveryEvent("changed", service, false));
	  		browser.on('error', error => console.log("dnssd error: "+error));
	 
	  		
	  	} else {
	  		stopDiscovery();
	  	}
	  	console.log("Starting discovery.");
		browser.start();
		bonjourProductCount = 0;
		startedOnce = true;
  }
}

function stopDiscovery() {
	if (browser) {
		browser.stop();
		products = {};
		bonjourProductCount = 0;
		console.log("Stopping discovery.");
		if (win) win.webContents.send('discoveredProducts', products);
	}
}

var products = {};
var bonjourProductCount = 0;
function discoveryEvent(event, service, manual) {
	if (debug) console.log(event, new Date(Date.now()).toLocaleString(), service.fullname, service.addresses, service.txt);
	if (event == "up" || event == "down") {
		list = browser.list();
		//list = [];
		if (list) refreshProducts(list);
		bonjourProductCount = (list) ? list.length : 0;
	}
	
	if (event == "changed") {
		if (products[service.fullname]) {
			setProductInfo(service);
			win.webContents.send('updateProduct', products[service.fullname]);
		}
	}
	
}

function refreshProducts(services) {
	if (services == null) {
		services = [];
		if (browser) services = browser.list();
	}
	if (services.length == 0 && manuallyDiscoveredProduct) services.push(manuallyDiscoveredProduct);
	if (services) {
		// Find out which services have been added.
		for (var s = 0; s < services.length; s++) {
			if (!products[services[s].fullname]) {
				setProductInfo(services[s]); // Adds product.
				//console.log(products[services[s].fullname].addresses);
				win.webContents.send('addProduct', products[services[s].fullname]);
			}
		}
		
		// Find out which services have been removed.
		for (fullname in products) {
			serviceFound = -1;
			for (var s = 0; s < services.length; s++) {
				if (services[s].fullname == fullname) serviceFound = s;
			}
			if (serviceFound == -1) {
				win.webContents.send('removeProduct', products[fullname]);
				delete products[fullname]; // Removes product.
			}
		}
	}
}

function setProductInfo(service, manual) {
	modelID = null;
	modelName = null;
	systemID = null;
	systemStatus = null;
	productImage = null;
	for (var key in service.txt) {
	    if (service.txt.hasOwnProperty(key)) {
	        switch (key) {
				case "type":
				case "device_type":
					modelID = service.txt[key];
					break;
				case "typeui":
					modelName = service.txt[key];
					break;
				case "id":
				case "device_id":
					systemID = service.txt[key];
					break;
				case "status":
				case "device_status":
					systemStatus = service.txt[key];
					break;
				case "image":
					productImage = service.txt[key];
					break;
			}
	    }
	}
	product = {
		fullname: service.fullname,
		addresses: service.addresses,
		host: service.host,
		port: service.port,
		name: service.name,
		modelID: modelID,
		modelName: modelName,
		productImage: productImage,
		systemID: systemID,
		systemStatus: systemStatus
	};
	if (service.manual) product.manual = true;
	products[service.fullname] = product;
	return product;
}

ipcMain.on("getAllProducts", (event, arg) => {
	win.webContents.send('discoveredProducts', products);
});

ipcMain.on("refreshProducts", (event, arg) => {
	startDiscovery(); 
	startManualDiscovery();
});  

var manuallyDiscoveredProduct = null;
var manualDiscoveryInterval;
var manualDiscoveryAddress = "10.0.0.1";
function discoverProductAtAddress(address) {
	if (bonjourProductCount == 0) {
		request('http://'+address+'/product-information/discovery', { json: true }, (err, res, body) => {
			if (res && res.statusCode == 200) {
				service = {name: body.name, fullname: body.name+"._"+body.serviceType+"._tcp.local.", port: body.advertisePort, addresses: [address], host: address, txt: body.txtRecord, manual: true};
				if (!manuallyDiscoveredProduct) {
					manuallyDiscoveredProduct = service;
					refreshProducts();
				}
			} else {
				if (manuallyDiscoveredProduct != null) {
					manuallyDiscoveredProduct = null;
					refreshProducts();
				}
			}
		});
	} else {
		if (manuallyDiscoveredProduct != null) {
			manuallyDiscoveredProduct = null;
			refreshProducts();
		}
	}
}

function startManualDiscovery() {
	manuallyDiscoveredProduct = null;
	clearInterval(manualDiscoveryInterval);
	discoverProductAtAddress(manualDiscoveryAddress);
	manualDiscoveryInterval = setInterval(function() {
		discoverProductAtAddress(manualDiscoveryAddress);
	}, 10000);
}

function stopManualDiscovery() {
	clearInterval(manualDiscoveryInterval);
}

var ipCheckInterval;
function startCheckingIPAddress() {
	hasIPChanged();
	ipCheckInterval = setInterval(function() {
		if (activeWindow) {
			if (hasIPChanged()) {
				startDiscovery();
				startManualDiscovery();
			}
		}
	}, 10000);
}

oldIPs = [];
function hasIPChanged() {
	ifaces = os.networkInterfaces();
	newIPs = []
	for (iface in ifaces) {
		for (var i = 0; i < ifaces[iface].length; i++) {
			if (ifaces[iface][i].family == "IPv4") {
				newIPs.push(ifaces[iface][i].address);
			}
		}
	}
	if (oldIPs.equals(newIPs)) {
		return false;
	} else {
		oldIPs = newIPs;
		return true;
	}
}

// https://stackoverflow.com/questions/7837456/how-to-compare-arrays-in-javascript
// Warn if overriding existing method
if(Array.prototype.equals)
    console.warn("Overriding existing Array.prototype.equals. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array)
        return false;

    // compare lengths - can save a lot of time 
    if (this.length != array.length)
        return false;

    for (var i = 0, l=this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i]))
                return false;       
        }           
        else if (this[i] != array[i]) { 
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;   
        }           
    }       
    return true;
}
// Hide method from for-in loops
Object.defineProperty(Array.prototype, "equals", {enumerable: false});


// SD CARD LOGIC

function listDrives() {
	drivelist.list((error, drives) => {
		if (error) {
			throw error;
		}
		
		
		
		console.log(drives);
	});
}
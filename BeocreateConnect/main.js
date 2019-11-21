const {app, Menu, BrowserWindow, ipcMain, systemPreferences} = require('electron');
const windowStateKeeper = require('electron-window-state');
const dnssd = require('dnssd2');
const drivelist = require('drivelist');
var shell = require('electron').shell;

var debug = false;

// MENU

const template = [
  {
    label: 'File',
    submenu: [
      { label: 'Look for Products Again',
      click () { startDiscovery() }}
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
      { label: 'Reload Product View',
      click () { win.webContents.send('reloadProductView') }},
	  { type: 'separator' },
      { role: 'reload' },
      { role: 'forcereload' },
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
		title: "Bang & Olufsen Create",
		frame: false,
		show: false,
		fullscreenWindowTitle: true,
		//fullscreenable: false,
		backgroundColor: '#fff', 
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
		startDiscovery(true);
		setTimeout(function() {
			win.show();	
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
	  stopDiscovery();
      win = null;
    })
    
    win.on('focus', () => {
    	win.webContents.send('windowEvent', "activate");
		/*if (browser) {
			console.log("Products discovered: "+browser.list().length);
		} else {
			console.log("No browser.");
		}*/
		refreshProducts(null, false);
		refreshProducts(null, true);
		//if (products.length == 0) startDiscovery();
    });
    
    win.on('blur', () => {
    	win.webContents.send('windowEvent', "resignActive");
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


// DARK / LIGHT MODE
if (process.platform == "darwin") {
	systemPreferences.subscribeNotification(
	  'AppleInterfaceThemeChangedNotification',
	  function theThemeHasChanged () {
		win.webContents.send('colourSchemeIsDark', systemPreferences.isDarkMode());
	  }
	)
}
  
// FIND BEOCREATE SYSTEMS
var browser = null;
var browserLegacy = null; // for "BeoCreate 1" systems
var startedOnce = false;
function startDiscovery(once) { // Start or restart discovery.
	if (!once || !startedOnce) {
	  	if (!browser) {
		  	browser = new dnssd.Browser(dnssd.tcp('beocreate'), {maintain: true});
		  	browserLegacy = new dnssd.Browser(dnssd.tcp('beolink-open'), {maintain: true});
	  		
	  		browser.on('serviceUp', service => discoveryEvent("up", service, false));
	  		browser.on('serviceDown', service => discoveryEvent("down", service, false));
	  		browser.on('serviceChanged', service => discoveryEvent("changed", service, false));
	  		browser.on('error', error => console.log("dnssd error: "+error));
	  		
	  		browserLegacy.on('serviceUp', service => discoveryEvent("up", service, true));
	  		browserLegacy.on('serviceDown', service => discoveryEvent("down", service, true));
	  		browserLegacy.on('serviceChanged', service => discoveryEvent("changed", service, true));
	  		
	  	} else {
	  		stopDiscovery();
	  	}
	  	
		browser.start();
		browserLegacy.start();
		startedOnce = true;
  }
}

function stopDiscovery() {
	if (browser) {
		browser.stop();
		browserLegacy.stop();
		products = {};
		try {
			win.webContents.send('discoveredProducts', products);
		} catch (error) {
			
		}
	}
}

var products = {};
function discoveryEvent(event, service, legacyProduct) {
	if (debug) console.log(event, new Date(Date.now()).toLocaleString(), service.fullname, service.addresses, service.txt);
	if (event == "up" || event == "down") {
		
		if (!legacyProduct) {
			list = browser.list();
		} else {
			list = browserLegacy.list();
		}
		if (list) refreshProducts(list, legacyProduct);
	}
	
	if (event == "changed") {
		if (products[service.fullname]) {
			setProductInfo(service, legacyProduct);
			win.webContents.send('updateProduct', products[service.fullname]);
		}
	}
	
}

function refreshProducts(services, legacyProduct) {
	if (services == null) {
		if (!legacyProduct) {
			if (browser) services = browser.list();
		} else {
			if (browserLegacy) services = browserLegacy.list();
		}
	}
	if (services) {
		// Find out which services have been added.
		for (var s = 0; s < services.length; s++) {
			if (!products[services[s].fullname]) {
				setProductInfo(services[s], legacyProduct); // Adds product.
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
			if (serviceFound == -1 && legacyProduct == products[fullname].legacyProduct) {
				win.webContents.send('removeProduct', products[fullname]);
				delete products[fullname]; // Removes product.
			}
		}
	}
}

function setProductInfo(service, legacyProduct) {
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
		legacyProduct: legacyProduct,
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
	products[service.fullname] = product;
}

ipcMain.on("getAllProducts", (event, arg) => {
	win.webContents.send('discoveredProducts', products);
}); 





// SD CARD LOGIC

function listDrives() {
	drivelist.list((error, drives) => {
		if (error) {
			throw error;
		}
		
		
		
		console.log(drives);
	});
}
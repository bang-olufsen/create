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

// BEOCREATE ELEMENTS MODULE

var exec = require("child_process").exec;
var fs = require("fs");

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var extensions = globals.extensions;
	var debug = globals.debug;
	var download = globals.download;
	var downloadJSON = globals.downloadJSON;
	
	var installedExtensions = {};
	var availableExtensions = {};
	var extensionUpdates = {};
	
	var hasInternet = false;
	
	var version = require("./package.json").version;
	
	var extensionsDirectory = systemDirectory+"/../beo-extensions";
	if (!fs.existsSync(extensionsDirectory)) fs.mkdirSync(extensionsDirectory);
	
	var defaultSettings = {
		lists: [
			"https://www.tuomashamalainen.com/bang-olufsen/create/extensions/extensions.json"
		],
		extensionsCache: {}
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	beoBus.on('general', function(event) {
		// See documentation on how to use BeoBus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			// Grab the list of extensions.
			installedExtensions = event.content.extensions;
			for (extension in installedExtensions) {
				if (extensions[extension]) {
					if (extensions[extension].version) {
						installedExtensions[extension].version = extensions[extension].version;
					}
				}
			}
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "installer") {
				beoBus.emit("ui", {target: "installer", header: "listInstalled", content: {extensions: installedExtensions}});
				beoBus.emit("ui", {target: "installer", header: "extensionUpdatesAvailable", content: {updates: extensionUpdates}});
				/*downloadJSON(settings.lists[0].url, function(data) {
					console.log(data);
				});*/
			}
		}
	});
	
	beoBus.on('network', function(event) {
		
		if (event.header == "internetStatus") {
			if (event.content == true) {
				// If extensions list has not been cached, do so when internet connection is detected.
				if (!settings.extensionsCache) {
					shouldGetList = true;
				} else {
					size = 0;
					for (extension in settings.extensionsCache) {
						size++;
					}
					shouldGetList = (size > 0) ? false : true;
				}
				if (shouldGetList) {
					if (settings.lists && settings.lists.length > 0) {
						if (debug) console.log("Getting a list of downloadable extensions...");
						listAvailableExtensions(settings.lists, true, function(success) {
							
						});
					}
				}
				hasInternet = true;
			} else {
				hasInternet = false;
			}
		}
		
	});
	
	beoBus.on('installer', function(event) {
		
		
		if (event.header == "installFromURLProto") {
			if (event.content.fromURL) {
				downloadAndInstallExtension(event.content.fromURL, null, true);
			}
		}
		
		if (event.header == "installExtension") {
			if (event.content.extension) {
				getLatestVersionForExtension(event.content.extension, function(data, error) {
					if (data && 
						data.version && 
						data.url) {
						downloadExtension({url: data.url, installAs: event.content.extension}, function(downloaded, failed) {
							if (downloaded[0] && downloaded[0] == event.content.extension) {
								// Download and extraction succesful.
								installExtension(event.content.extension, function(installed, failed) {
									if (installed.length > 0) {
										// Succesful installation, restart server.
										beoBus.emit("general", {header: "requestServerRestart", content: {extension: "installer"}});
										beoBus.emit("ui", {target: "installer", header: "installed", content: {extensions: installed}});
										if (debug) console.log("All queued extensions installed.");
									}	
								});
							}
						});
					}
				});
			}
		}
		
		if (event.header == "checkForUpdates") {
			beoBus.emit("ui", {target: "installer", header: "checkingForUpdates"});
			if (hasInternet) {
				checkForExtensionUpdates(undefined, function(checked, failed) {
					beoBus.emit("ui", {target: "installer", header: "extensionUpdatesAvailable", content: {updates: extensionUpdates}});
				});
			} else {
				beoBus.emit("ui", {target: "installer", header: "updateCheckFailed", content: {internetStatus: hasInternet}});
			}
		}
		
		if (event.header == "removeExtension") {
			// Grab the list of extensions.
			if (event.content.extension) {
				removeExtension(event.content.extension, function(success) {
					if (success) {
						beoBus.emit("ui", {target: "installer", header: "removed", content: {extension: event.content.extension}});
						beoBus.emit("general", {header: "requestServerRestart", content: {extension: "installer"}});
					}
				});
			}
		}
		
		if (event.header == "getAvailableExtensions") {
			availableNotInstalled = {};
			for (extension in availableExtensions) {
				if (!installedExtensions[extension]) availableNotInstalled[extension] = availableExtensions[extension];
			}
			beoBus.emit("ui", {target: "installer", header: "availableExtensions", content: {extensions: availableNotInstalled}});
		}
	});

	
	
	// EXTENSION DOWNLOAD, INSTALLATION & REMOVAL
	/*
	
	1. Download: handles downloading extensions to the .install directory.
	2. Extract: unzips the extensions.
	3. Install: deals with any folders found in .install directory, by checking if they need treatment by NPM or simply need to be moved into place.
	4. Run NPM: performs either npm ci or npm install on the extension.
	5. Move to place: moves the complete extension out of the .install directory.
	6. Remove: executes possible uninstall scripts and removes the extension.
	
	*/
	
	function downloadExtension(queue, callback, downloaded, failed) {
		// Possible values for queue:
		// - an object containing the URL and the download name
		// - a URL string
		// - an array of many items of above type (an actual queue)
		
		fromURL = null;
		if (queue != false && queue != null) {
			if (typeof queue == "string") {
				fromURL = queue;
				queue = false;
			} else {
				if (Array.isArray(queue)) {
					// The queue is a queue, take the first item.
					fromURL = queue.shift();
					if (queue.length == 0) queue = false;
				} else {
					// The "queue" is an object (a single entry).
					fromURL = queue;
					queue = false;
				}
			}
		} else if (queue == false) {
			// No more queue items, trigger callback.
			if (callback) callback(downloaded, failed);
		} else {
			console.error("No extensions to download.");
			if (callback) callback(false);
		}
		if (downloaded == undefined) downloaded = [];
		if (failed == undefined) failed = [];

		if (fromURL) {
			filename = null;
			if (typeof fromURL != "string") {
				if (fromURL.installAs) filename = fromURL.installAs+".zip";
				if (fromURL.url) fromURL = fromURL.url;
			}
			if (fromURL.indexOf("http") != -1 && fromURL.indexOf(".zip") != -1) {
				// The URL appears to be valid.
				if (!filename) filename = fromURL.substring(fromURL.lastIndexOf('/') + 1);
				if (debug) console.log("Downloading extension '"+filename.slice(0, -4)+"'...");
				beoBus.emit("ui", {target: "installer", header: "downloading", content: {extension: filename.slice(0, -4)}});
				if (!fs.existsSync(extensionsDirectory+"/.install")) fs.mkdirSync(extensionsDirectory+"/.install"); // Create install directory if it doesn't exist.
				download(fromURL, extensionsDirectory+"/.install", filename, function(success, error) {
					if (success) {
						// The download function reports a succesful download.
						extractExtension(filename.slice(0, -4), function(extracted, error) {
							if (extracted) {
								downloaded.push(filename.slice(0, -4));
							} else {
								failed.push(filename.slice(0, -4));
							}
							downloadExtension(queue, callback, downloaded, failed);
						});
					} else {
						console.error("Downloading extension '"+filename.slice(0, -4)+"' failed: "+error);
						failed.push(filename.slice(0, -4));
						downloadExtension(queue, callback, downloaded, failed);
					}
				});
			} else {
				console.error("Extension download URLs must start with 'http' or 'https' and end with '.zip'.");
				failed.push(fromURL);
				downloadExtension(queue, callback, downloaded, failed);
			}
		}
	}
	
	
	function extractExtension(extension, callback) {
		// Extract a zip file that's in .install and delete it.
		if (extension) {
			exec("unzip -o "+extensionsDirectory+"/.install/"+extension+".zip", {cwd: extensionsDirectory+"/.install"}, function(error, stdout, stderr) {
				if (error) {
					beoBus.emit("ui", {target: "installer", header: "unzipFailed", content: {extension: extension}});
					console.error("Installer couldn't extract '"+extension+".zip': "+err);
					if (callback) callback(false, err);
				} else {
					try {
						fs.unlinkSync(extensionsDirectory+"/.install/"+filename); // Delete the zip file.
						if (fs.existsSync(extensionsDirectory+"/.install/__MACOSX")) {
							// Remove any junk left in the zip files by Mac OS X.
							exec("rm -rf "+extensionsDirectory+"/.install/__MACOSX", function(error, stdout, stderr) {
								if (callback) callback(true);
							});
						} else {
							if (callback) callback(true);
						}
					} catch(err) {
						console.error("Installer couldn't delete '"+extension+".zip': "+err);
						if (callback) callback(true, err);
					}
				}
			});
		}
	}
	
	
	function installExtension(queue, callback, installed, failed) {
		if (queue == undefined) {
			// If extension names are not provided, read the .install directory contents.
			installContents = fs.readdirSync(extensionsDirectory+"/.install");
			queue = [];
			for (var i = 0; i < installContents; i++) {
				if (fs.statSync(extensionsDirectory+"/.install/"+installContents[i]).isDirectory()) {
					// Check that this is a folder.
					queue.push(installContents[i]);
				}
			}
			if (queue.length == 0) queue = null;
		}
		extension = null;
		if (queue != false && queue != null) {
			if (typeof queue == "string") {
				extension = queue;
				queue = false;
			} else {
				if (Array.isArray(queue)) {
					// The queue is a queue, take the first item.
					extension = queue.shift();
					if (queue.length == 0) queue = false;
				}
			}
		} else if (queue == false) {
			// No more queue items, trigger callback.
			if (callback) callback(installed, failed);
		} else {
			console.error("No extensions to install.");
			if (callback) callback(false);
		}
		if (installed == undefined) installed = [];
		if (failed == undefined) failed = [];
		
		if (extension) {
			if (fs.existsSync(extensionsDirectory+"/.install/"+extension+"/menu.html")) {
				beoBus.emit("ui", {target: "installer", header: "installing", content: {extension: extension}});
				removeExtension(extension, function(removed) {
					// Remove existing extension with the same name, if exists.
					packageJSON = null;
					if (fs.existsSync(extensionsDirectory+"/.install/"+extension+"/package.json")) {
						try {
							packageJSON = JSON.parse(fs.readFileSync(extensionsDirectory+"/.install/"+extension+"/package.json"));
						} catch (error) {
							packageJSON = null;
						}
						if (packageJSON && packageJSON.beocreate && packageJSON.beocreate.install) {
							// A custom install script is included, run it.
							if (debug) console.log("Running install script for '"+extension+"'...");
							if (fs.existsSync(extensionsDirectory+"/.install/"+extension+"/"+packageJSON.beocreate.install)) {
								// If the script exists in the directory, set its permissions.
								fs.chmodSync(extensionsDirectory+"/.install/"+extension+"/"+packageJSON.beocreate.install, 0o755);
							}
							exec(packageJSON.beocreate.install, {cwd: extensionsDirectory+"/.install/"+extension}, function(error, stdout, stderr) {
								runNPMForExtension(extension, function(result, error) {
									if (!error) {
										moveExtensionToPlace(extension, function(result) {
											installed.push(extension);
											installExtension(queue, callback, installed, failed);
										});
									} else {
										failed.push(extension);
										installExtension(queue, callback, installed, failed);
									}
								});
							});
						} else {
							// No custom install script.
							runNPMForExtension(extension, function(result, error) {
								if (!error) {
									moveExtensionToPlace(extension, function(result) {
										installed.push(extension);
										installExtension(queue, callback, installed, failed);
									});
								} else {
									failed.push(extension);
									installExtension(queue, callback, installed, failed);
								}
							});
						}
					}
				});
				
			} else {
				failed.push(extension);
				if (debug) console.log("'"+extension+"' does not appear to be a Beocreate 2 extension, because 'menu.html' is not present.");
				installExtension(queue, callback, installed, failed);
			}
		}
	}
	
	function runNPMForExtension(extension, callback) {
		command = null;
		if (fs.existsSync(extensionsDirectory+"/.install/"+extension+"/package-lock.json")) {
			command = "ci";
		} else if (fs.existsSync(extensionsDirectory+"/.install/"+extension+"/package.json")) {
			command = "install";
		}
		if (command) {
			exec("npm "+command, {cwd: extensionsDirectory+"/.install/"+extension}, function(error, stdout, stderr) {
				if (error) {
					if (debug) console.error("NPM failed for extension '"+extension+"': "+error);
					if (callback) callback(false, error);
				} else {
					if (callback) callback(true, null);
				}
			});
		} else {
			if (callback) callback(false, null);
		}
	}
	
	function moveExtensionToPlace(extension, callback) {
		fs.renameSync(extensionsDirectory+"/.install/"+extension, extensionsDirectory+"/"+extension);
		fs.chownSync(extensionsDirectory+"/"+extension, 1000, 1000);
		exec("chown -R pi "+extensionsDirectory+"/"+extension, function(error, stdout, stderr) {
			if (error && debug) console.log("Failed to set permissions for '"+extension+"', but this is not dangerous. Error: "+error);
			if (debug) console.log("Extension '"+extension+"' was installed.");
			if (callback) callback(true);
		});
	}
		
	
	function removeExtension(extension, callback) {
		if (fs.existsSync(extensionsDirectory+"/"+extension)) {
			// Remove the extension.
			beoBus.emit("ui", {target: "installer", header: "removing", content: {extension: extension}});
			if (debug) console.log("Removing extension '"+extension+"'...");
			if (fs.existsSync(extensionsDirectory+"/"+extension+"/package.json")) {
				packageJSON = JSON.parse(fs.readFileSync(extensionsDirectory+"/"+extension+"/package.json"));
				if (packageJSON.beocreate && packageJSON.beocreate.uninstall) {
					if (debug) console.log("Running uninstall script for '"+extension+"'...");
					if (fs.existsSync(extensionsDirectory+"/"+extension+"/"+packageJSON.beocreate.uninstall)) {
						// If the script exists in the directory, set its permissions.
						fs.chmodSync(extensionsDirectory+"/.install/"+extension+"/"+packageJSON.beocreate.uninstall, 0o755);
					}
					exec(packageJSON.beocreate.uninstall, {cwd: extensionsDirectory+"/"+extension}, function(error, stdout, stderr) {
						// Run uninstallation script, if exists.
						exec("rm -rf "+extensionsDirectory+"/"+extension, function() {
							if (debug) console.log("Extension '"+extension+"' was removed.");
							if (callback) callback(true);
						});
					});
				} else {
					exec("rm -rf "+extensionsDirectory+"/"+extension, function() {
						if (debug) console.log("Extension '"+extension+"' was removed.");
						if (callback) callback(true);
					});
				}
			} else {
				exec("rm -rf "+extensionsDirectory+"/"+extension, function() {
					if (debug) console.log("Extension '"+extension+"' was removed.");
					if (callback) callback(true);
				});
			}
		} else {
			if (callback) callback(false);
		}
	}
	
	
	
	
	
	
	
	
	function listAvailableExtensions(lists, empty, callback) {
		if (!fs.existsSync(extensionsDirectory+"/installer/icon-cache")) fs.mkdirSync(extensionsDirectory+"/installer/icon-cache");
		if (empty) availableExtensions = {};
		listToGet = lists.shift();
		downloadJSON(listToGet, function(list, error) {
			if (list && list.extensions) {
				for (extension in list.extensions) {
					if (list.extensions[extension].name &&
						list.extensions[extension].description &&
						list.extensions[extension].url) {
						// Check that all the required information is there (icon and source flag are optional).
						//if (!availableExtensions[extension]) {
							availableExtensions[extension] = list.extensions[extension];
							baseURL = listToGet.split("/");
							baseURL.pop();
							baseURL = baseURL.join("/") + ("/");
							availableExtensions[extension].baseURL = baseURL;
							if (availableExtensions[extension].icon) {
								iconName = availableExtensions[extension].icon.substring(availableExtensions[extension].icon.lastIndexOf('/') + 1);
								availableExtensions[extension].iconName = iconName;
								if (!fs.existsSync(extensionsDirectory+"/installer/icon-cache/"+iconName)) {
									if (availableExtensions[extension].icon.indexOf("http") != -1) {
										iconURL = availableExtensions[extension].icon;
									} else {
										iconURL = baseURL+availableExtensions[extension].icon;
									}
									download(iconURL, extensionsDirectory+"/installer/icon-cache/", null, function(success) {
										//
									});
								} else {
									
								}
							}
							// Later lists can overwrite earlier extensions.
						//}
					}
				}
			}
			if (lists.length > 0) {
				// Go through the next list.
				listAvailableExtensions(lists, null, callback);
			} else {
				// Done.
				if (callback) callback(true);
			}
		});
	}

	
	function checkForExtensionUpdates(queue, callback, checked, failed) {
		if (queue == undefined) {
			// If extension names are not provided, read the .install directory contents.
			extensionUpdates = {};
			queue = [];
			for (installedExtension in availableExtensions) {
				queue.push(installedExtension);
			}
		}
		extension = null;
		if (queue != false && queue != null) {
			if (typeof queue == "string") {
				extension = queue;
				queue = false;
			} else {
				if (Array.isArray(queue)) {
					// The queue is a queue, take the first item.
					extension = queue.shift();
					if (queue.length == 0) queue = false;
				}
			}
		} else if (queue == false) {
			// No more queue items, trigger callback.
			if (callback) callback(checked, failed);
		} else {
			console.error("No extensions to check updates for.");
			if (callback) callback(false);
		}
		if (checked == undefined) checked = [];
		if (failed == undefined) failed = [];
		
		if (extension) {
			if (installedExtensions[extension]) {
				if (installedExtensions[extension].version) {
					getLatestVersionForExtension(extension, function(data) {
						if (data) {
							// Succesfully got the new version information, compare to the installed version.
							availableVersion = data.version.split(".");
							currentVersion = installedExtensions[extension].version.split(".");
							hasNewVersion = false;
							for (var v = 0; v < availableVersion.length; v++) {
								try {
									vCurrent = parseInt(currentVersion[v]);
									vAvailable = parseInt(availableVersion[v])
									if (vAvailable > vCurrent) hasNewVersion = true;
								} catch (error) {
									// This version number component is not a number, ignore.
								}
							}
							if (hasNewVersion) {
								if (fs.existsSync(extensionsDirectory+"/installer/icon-cache/"+availableExtensions[extension].iconName)) {
									iconName = availableExtensions[extension].iconName;
								} else {
									iconName = null;
								}
								extensionUpdates[extension] = {
									name: availableExtensions[extension].name, 
									id: extension, 
									version: data.version, 
									notes: data.notes,
									url: data.url,
									iconName: iconName,
									downloadAs: data.downloadAs};
								if (debug) console.log("Update available for '"+extension+"' ("+installedExtensions[extension].version+" -> "+data.version+").");
							}
							checked.push(extension);
							checkForExtensionUpdates(queue, callback, checked, failed);
						} else {
							if (debug) console.error("Couldn't check for updates to '"+extension+"'. Data was invalid or not returned.");
							failed.push(extension);
							checkForExtensionUpdates(queue, callback, checked, failed);
						}
					});
				} else {
					if (debug) console.error("Couldn't check for updates to '"+extension+"'. This extension has no version number specified.");
					failed.push(extension);
					checkForExtensionUpdates(queue, callback, checked, failed);
				}
			} else {
				if (debug) console.error("Couldn't check for updates to '"+extension+"'. The extension is not installed on the system.");
				failed.push(extension);
				checkForExtensionUpdates(queue, callback, checked, failed);
			}
		}
	}
	
	function getLatestVersionForExtension(extension, callback) {
		if (availableExtensions[extension]) {
			downloadJSON(availableExtensions[extension].baseURL+availableExtensions[extension].url, function(data, error) {
				if (data) {
					if (data.versions[0].file.indexOf("http") != -1) {
						extensionURL = data.versions[0].file;
					} else {
						extensionDirectory = availableExtensions[extension].url.split("/");
						extensionDirectory.pop();
						extensionDirectory = extensionDirectory.join("/") + ("/");
						extensionURL = availableExtensions[extension].baseURL+extensionDirectory+data.versions[0].file;
					}
					//console.log(data.versions[0].version, extensionURL);
					if (callback) callback({version: data.versions[0].version, url: extensionURL, notes: data.versions[0].notes, downloadAs: data.downloadAs});
				} else {
					if (callback) callback(null);
				}
			});
		}
	}
	
	
	return {
		version: version
	};
};


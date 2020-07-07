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

// MPD CONTROL FOR BEOCREATE

var express = require('express');
var exec = require("child_process").exec;
var path = require("path");
var fs = require("fs");
var mpdAPI = require("mpd-api");
var mpdCmd = mpdAPI.mpd;
const util = require('util');
const execPromise = util.promisify(exec);
const dnssd = require("dnssd2"); // for service discovery.

var debug = beo.debug;

var version = require("./package.json").version;


var defaultSettings = {
	coverNames: ["cover", "artwork", "folder", "front", "albumart"],
	mpdSocketPath: "/var/run/mpd/socket"
};
var settings = JSON.parse(JSON.stringify(defaultSettings));

var sources = null;

var mpdEnabled = false;

var client;
var connected = false;

var libraryPath = null;
var cache = {};

beo.bus.on('general', function(event) {
	
	if (event.header == "startup") {
		
		if (beo.extensions.sources &&
			beo.extensions.sources.setSourceOptions &&
			beo.extensions.sources.sourceDeactivated) {
			sources = beo.extensions.sources;
		}
		
		if (beo.extensions.music && beo.extensions.music.registerProvider) beo.extensions.music.registerProvider("mpd");
		
		if (sources) {
			getMPDStatus(function(enabled) {
				sources.setSourceOptions("mpd", {
					enabled: enabled,
					usesHifiberryControl: true,
					transportControls: true,
					backgroundService: true,
					childSources: ["radio", "music"],
					determineChildSource: determineChildSource
				});
				
				sources.setSourceOptions("radio", {
					enabled: enabled,
					transportControls: ["play", "stop"],
					allowChangingTransportControls: false
				});
				
				if (mpdEnabled) {
					connectMPD();
				}
			});
		}
		
		
	}
	
	if (event.header == "activatedExtension") {
		if (event.content.extension == "mpd") {
			beo.bus.emit("ui", {target: "mpd", header: "mpdSettings", content: {mpdEnabled: mpdEnabled}});
			listStorage().then(storageList => {
				beo.sendToUI("mpd", "mountedStorage", {storage: storageList});
			}).catch({
				// Error listing storage.
			});
			
		}
	}
});

beo.bus.on('mpd', function(event) {
	
	if (event.header == "settings") {
		if (event.content.settings) {
			settings = Object.assign(settings, event.content.settings);
		}
	}
	
	if (event.header == "mpdEnabled") {
		
		if (event.content.enabled != undefined) {
			setMPDStatus(event.content.enabled, function(newStatus, error) {
				beo.bus.emit("ui", {target: "mpd", header: "mpdSettings", content: {mpdEnabled: newStatus}});
				if (sources) {
					//sources.setSourceOptions("mpd", {enabled: newStatus});
					sources.setSourceOptions("radio", {enabled: newStatus});
				}
				if (newStatus == false) {
					//if (sources) sources.sourceDeactivated("mpd");
					if (sources) sources.sourceDeactivated("radio");
				}
				if (error) {
					beo.bus.emit("ui", {target: "mpd", header: "errorTogglingMPD", content: {}});
				}
			});
		}
	
	}
	
	if (event.header == "list") {
		if (client && event.content) {
			client.api.db.list(event.content.type).then(results => {
				beo.sendToUI("mpd", "list", results);
			})
			.catch(error => {
				console.error(error);
			});
		}
	}
	
	if (event.header == "find") {
		if (client && event.content) {
			client.api.db.find(event.content.filter, "window", "0:1").then(results => {
				beo.sendToUI("mpd", "find", results);
			})
			.catch(error => {
				console.error(error);
			});
		}
	}
	
	if (event.header == "update") {
		force = (event.content && (event.content.force || (event.content.extra && event.content.extra == "covers"))) ? true : false;
		updateCache(force);
	}
	
	
	if (event.header == "getNASShares") {
		getNASShares(event.content).then(results => {
			beo.sendToUI("mpd", "shares", results);
		}).catch({
			// Error listing shares.
		});
	}
	
	if (event.header == "addNAS") {
		console.log(event.content.share, event.content.path, cachedNASDetails);
	}
	
	if (event.header == "cancelNASAdd") {
		cachedNASDetails = {};
	}
	
});


function getMPDStatus(callback) {
	exec("systemctl is-active --quiet mpd.service").on('exit', function(code) {
		if (code == 0) {
			mpdEnabled = true;
			callback(true);
		} else {
			mpdEnabled = false;
			callback(false);
		}
	});
}

function setMPDStatus(enabled, callback) {
	if (enabled) {
		exec("systemctl enable --now mpd.service mpd-mpris.service ympd.service").on('exit', function(code) {
			if (code == 0) {
				mpdEnabled = true;
				if (debug) console.log("MPD enabled.");
				callback(true);
				connectMPD();
			} else {
				mpdEnabled = false;
				callback(false, true);
			}
		});
	} else {
		exec("systemctl disable --now mpd.service mpd-mpris.service ympd.service").on('exit', function(code) {
			mpdEnabled = false;
			if (code == 0) {
				callback(false);
				if (debug) console.log("MPD disabled.");
			} else {
				callback(false, true);
			}
		});
	}
}

function determineChildSource(data) {
	if (data && data.streamUrl) {
		if (data.streamUrl.indexOf("http") == 0) {
			return "radio";
		} else {
			return "music";
		}
	} else {
		return null;
	}
}

firstConnect = true;
async function connectMPD() {
	try {
		client = await mpdAPI.connect({path: settings.mpdSocketPath});
		if (debug >= 2) console.log("Connected to Music Player Daemon.");
		if (firstConnect) {
			try {
				config = await client.api.reflection.config();
				if (config.music_directory) {
					libraryPath = config.music_directory;
					// Create a route for serving album covers (and ONLY album covers):
					beo.expressServer.use('/mpd/covers/', (req, res, next) => {
						if (!req.url.match(/^.*\.(png|jpg|jpeg)$/ig)) return res.status(403).end('403 Forbidden');
						next();
					});
					beo.expressServer.use("/mpd/covers/", express.static(libraryPath));
					if (fs.existsSync(libraryPath+"/beo-cache.json")) {
						try {
							cache = JSON.parse(fs.readFileSync(libraryPath+"/beo-cache.json", "utf8"));
						} catch (error) {
							cache = {};
						}
					}
					firstConnect = false;
					updateCache();
				} else {
					console.error("MPD music library path is not available. Can't build a cache.");
				}
			} catch(error) {
				console.error("Couldn't get MPD music library path:", error);
			}
		}
	} catch(error) {
		client = null;
		console.error("Failed to connect to Music Player Daemon:", error);
	}
}


updatingCache = false;
async function updateCache(force = false) {
	if (!client) await connectMPD();
	if (client && !updatingCache) {
		try {
			status = await client.api.status.get();
			stats = await client.api.status.stats();
			if (status.updating_db && debug) console.log("MPD is currently updating its database, album cache will not be built at this time.");
			if (cache.lastUpdate == stats.db_update && !force && debug) console.log("MPD album cache appears to be up to date.");
			if ((!cache.lastUpdate || cache.lastUpdate != stats.db_update || force) && !status.updating_db) {
				// Start updating cache.
				updatingCache = true;
				if (beo.extensions.music && beo.extensions.music.setLibraryUpdateStatus) beo.extensions.music.setLibraryUpdateStatus("mpd", true);
				if (debug) console.log("Updating MPD album cache.");
				newCache = {
					data: {},
					lastUpdate: stats.db_update
				};
				createTiny = (beo.extensions["beosound-5"]) ? true : false;
				try {
					mpdAlbums = await client.api.db.list("album", null, "albumartist");
		
					for (artist in mpdAlbums) {
						newCache.data[mpdAlbums[artist].albumartist] = [];
						if (mpdAlbums[artist].album) {
							for (album in mpdAlbums[artist].album) {
								// Get a song from the album to get album art and other data.
								try {
									addAlbum = true;
									track = [];
									track = await client.api.db.find('((album == "'+escapeString(mpdAlbums[artist].album[album].album)+'") AND (albumartist == "'+escapeString(mpdAlbums[artist].albumartist)+'"))', 'window', '0:1');
									newAlbum = {
										name: mpdAlbums[artist].album[album].album, 
										artist: mpdAlbums[artist].albumartist, 
										date: null, 
										provider: "mpd",
										img: null
									};
									if (track[0]) {
										if (track[0].date) newAlbum.date = track[0].date.toString().substring(0,4);
										cover = await getCover(track[0].file, createTiny);
										if (cover.error != null) { // Cover fetching had errors, likely due to folder not existing.
											addAlbum = false;
										} else {
											newAlbum.img = cover.img;
											newAlbum.thumbnail = cover.thumbnail;
											newAlbum.tinyThumbnail = cover.tiny;
										}
									}
									if (addAlbum) {
										newCache.data[mpdAlbums[artist].albumartist].push(newAlbum);
										if (debug > 1) console.log("Album '"+mpdAlbums[artist].album[album].album+"' from artist '"+mpdAlbums[artist].albumartist+"' was added to the MPD cache.");
									}
								} catch (error) {
									console.error("Could not fetch data for album at index "+album+" from artist at index "+artist+".", error);
								}
							}
						} else {
							console.error("No album items for artist '"+artist+"'. This is probably an MPD (-API) glitch.");
						}
						newCache.data[mpdAlbums[artist].albumartist].sort(function(a, b) {
							if (a.date && b.date) {
								if (a.date >= b.date) {
									return 1;
								} else if (a.date < b.date) {
									return -1;
								}
							} else {
								return 0;
							}
						});
					}
					
					cache = Object.assign({}, newCache);
					fs.writeFileSync(libraryPath+"/beo-cache.json", JSON.stringify(cache));
					if (debug) console.log("MPD album cache update has finished.");
					if (beo.extensions.music && beo.extensions.music.setLibraryUpdateStatus) beo.extensions.music.setLibraryUpdateStatus("mpd", false);
				} catch (error) {
					console.error("Couldn't update MPD album cache:", error);
					if (error.code == "ENOTCONNECTED") client = null;
				}
				updatingCache = false;
				if ((albumsRequested || artistsRequested) &&
					beo.extensions.music &&
					beo.extensions.music.returnMusic) {
						if (albumsRequested) {
							if (debug) console.log("Sending updated list of albums from MPD.");
							albums = [];
							for (artist in cache.data) {
								albums = albums.concat(cache.data[artist]);
							}
							beo.extensions.music.returnMusic("mpd", "albums", albums, null);
						}
						if (artistsRequested) {
							if (debug) console.log("Sending updated list of artists from MPD.");
							mpdAlbums = await client.api.db.list("album", null, "albumartist");
							artists = [];
							for (artist in mpdAlbums) {
								artists.push({artist: mpdAlbums[artist].albumartist, albumLength: mpdAlbums[artist].album.length, provider: "mpd"})
							}
							beo.extensions.music.returnMusic("mpd", "artists", artists, null);
						}
				}
				//albumsRequested = false;
				//artistsRequested = false;
			}
		} catch (error) {
			console.error("Couldn't update MPD album cache:", error);
			if (error.code == "ENOTCONNECTED") client = null;
		}
	}
}

var albumsRequested = false;
var artistsRequested = false;

async function getMusic(type, context, noArt = false) {
	
	if (!client) await connectMPD();
	if (client) {
		switch (type) {
			case "albums":
				
				if (context && context.artist) {
					if (cache.data[context.artist]) {
						return cache.data[context.artist];
					} else {
						return [];
					}
	
				} else {
					albums = [];
					albumsRequested = true;
					for (artist in cache.data) {
						albums = albums.concat(cache.data[artist]);
					}
					return albums;
				}
				break;
			case "album":
				if (context && context.artist && context.album) {
					mpdTracks = [];
					album = {name: context.album, 
							time: 0,
							artist: context.artist, 
							date: null, 
							tracks: [],
							discs: [],
							provider: "mpd"
					};
					try {
						mpdTracks = await client.api.db.find("((album == '"+escapeString(context.album)+"') AND (albumartist == '"+escapeString(context.artist)+"'))", 'sort', 'track');
					} catch (error) {
						if (error.code == "ENOTCONNECTED") client = null;
						console.error("Could not get album from MPD:", error);
					}
					for (track in mpdTracks) {
						if (!album.date && mpdTracks[track].date) album.date = mpdTracks[track].date;
						if (track == 0 && !noArt) {
							cover = await getCover(mpdTracks[track].file);
							if (!cover.error) {
								album.img = cover.img;
								album.thumbnail = cover.thumbnail;
								album.tinyThumbnail = cover.thumbnail;
							}
						}
						trackData = {
							disc: 1,
							path: mpdTracks[track].file,
							number: mpdTracks[track].track,
							artist: mpdTracks[track].artist,
							name: mpdTracks[track].title,
							time: mpdTracks[track].time,
							provider: "mpd"
						}
						album.time += mpdTracks[track].time;
						if (mpdTracks[track].disc) {
							trackData.disc = mpdTracks[track].disc;
						}
						album.tracks.push(trackData);
					}
					// Sort tracks on multi-disc albums.
					album.tracks.sort(function(a, b) {
						if (a.disc && b.disc) {
							if (a.disc >= b.disc) {
								return 1;
							} else if (a.disc < b.disc) {
								return -1;
							}
						} else {
							return 0;
						}
					});
					for (t in album.tracks) {
						album.tracks[t].id = t;
						if (!album.discs[album.tracks[t].disc - 1]) {
							album.discs[album.tracks[t].disc - 1] = [];
						}
						album.discs[album.tracks[t].disc - 1].push(album.tracks[t]);
					}
					return album;
				} else {
					return false;
				}
				break;
			case "artists":
				try {
					artistsRequested = true;
					mpdAlbums = await client.api.db.list("album", null, "albumartist");
					artists = [];
					for (artist in mpdAlbums) {
						artists.push({artist: mpdAlbums[artist].albumartist, albumLength: mpdAlbums[artist].album.length, provider: "mpd"})
					}
					return artists;
				} catch (error) {
					if (error.code == "ENOTCONNECTED") client = null;
					console.error("Could not get artists from MPD:", error);
					return false
				}
				break;
			case "search":
				id = 0;
				trackPaths = [];
				tracks = [];
				artists = [];
				albums = [];
				escapedString = escapeString(context.searchString);
				mpdTracks = [];
				try {
					mpdTracks = await client.api.db.search("(title contains '"+escapedString+"')");
					mpdTracks = mpdTracks.concat(await client.api.db.search("(artist contains '"+escapedString+"')"));
					mpdTracks = mpdTracks.concat(await client.api.db.search("(album contains '"+escapedString+"')"));
					for (track in mpdTracks) {
						if (trackPaths.indexOf(mpdTracks[track].file) == -1) {
							trackPaths.push(mpdTracks[track].file);
							trackData = {
								id: id,
								path: mpdTracks[track].file,
								artist: mpdTracks[track].artist,
								name: mpdTracks[track].title,
								time: mpdTracks[track].time,
								provider: "mpd"
							}
							id++;
							tracks.push(trackData);
							albumFound = false;
							for (a in albums) {
								if (albums[a].artist == mpdTracks[track].albumartist &&
									albums[a].name == mpdTracks[track].album) {
									albumFound = true;
									break;
								}
							}
							if (!albumFound) {
								album = {
									name: mpdTracks[track].album, 
									artist: (mpdTracks[track].albumartist) ? mpdTracks[track].albumartist : mpdTracks[track].artist, 
									date: null, 
									provider: "mpd"
								};
								if (mpdTracks[track].date) album.date = mpdTracks[track].date;
								if (!noArt) {
									cover = await getCover(mpdTracks[track].file);
									if (!cover.error) {
										album.img = cover.img;
										album.thumbnail = cover.thumbnail;
										album.tinyThumbnail = cover.thumbnail;
									}
								}
								albums.push(album);
								
								artistFound = false;
								theArtist = (mpdTracks[track].albumartist) ? mpdTracks[track].albumartist : mpdTracks[track].artist;
								for (ar in artists) {
									if (artists[ar].artist == theArtist) {
										artistFound = true;
										break;
									}
								}
								if (!artistFound) {
									artists.push({artist: theArtist, provider: "mpd"});
								}
							}
						}
					}
					return {tracks: tracks, artists: artists, albums: albums};
				} catch (error) {
					if (error.code == "ENOTCONNECTED") client = null;
					console.error("Could not get search results from MPD:", error);
					return false;
				}
				break;
		}
	} else {
		return false;
	}
}

async function playMusic(index, type, context) {
	if (!client) await connectMPD();
	if (client && 
		index != undefined && 
		type && 
		context) {
		content = await getMusic(type, context, true);
		if (content.tracks) {
			try {
				await client.api.queue.clear();
				queueCommands = [];
				content.tracks.forEach(track => {
					queueCommands.push(client.api.queue.addid(track.path));
				});
				
				newQueue = await Promise.all(queueCommands);
				await client.api.playback.playid(newQueue[index]);
				return true;
			} catch (error) {
				if (error.code == "ENOTCONNECTED") client = null;
				console.error("Could not get start playback with MPD:", error);
				return false;
			}
		} else {
			return false;
		}
	}
}


async function getCover(trackPath, createTiny = false) {
	// If cover exists on the file system, return its path.
	if (libraryPath) {
		albumPath = path.dirname(trackPath);
		
		try {
			files = fs.readdirSync(libraryPath+"/"+albumPath);
			img = null;
			thumbnail = null;
			tiny = null;
			for (file in files) {
				if (path.extname(files[file]).match(/\.(jpg|jpeg|png)$/ig)) {
					// Is image file.
					if (!img && settings.coverNames.indexOf(path.basename(files[file], path.extname(files[file])).toLowerCase()) != -1) {
						img = files[file];
					}
					if (files[file] == "cover-thumb.jpg") thumbnail = "cover-thumb.jpg";
					if (files[file] == "cover-tiny.jpg") tiny = "cover-tiny.jpg";
				}
			}
			if (!tiny && 
				img &&
				createTiny) {
				try {
					if (debug) console.log("Creating tiny album artwork for '"+albumPath+"'...");
					await execPromise("convert \""+libraryPath+"/"+albumPath+"/"+img+"\" -resize 100x100\\> \""+libraryPath+"/"+albumPath+"/cover-tiny.jpg\"");
					tiny = "cover-tiny.jpg";
				} catch (error) {
					console.log("Error creating tiny album cover:", error);
				}
			}
			if (img || thumbnail || tiny) {
				encodedAlbumPath = encodeURIComponent(albumPath).replace(/[!'()*]/g, escape);
				return {error: null, 
						img: ((img) ? "/mpd/covers/"+encodedAlbumPath+"/"+img : null), 
						thumbnail: ((thumbnail) ? "/mpd/covers/"+encodedAlbumPath+"/"+thumbnail : null),
						tiny: ((tiny) ? "/mpd/covers/"+encodedAlbumPath+"/"+tiny : null)
					};
			} else {
				return {error: null};
			}
			
			
		} catch (error) {
			// The track/album probably doesn't exist on the file system.
			console.error(error);
			return {error: 404};
		}
	}
	return {error: 503};
}



function escapeString(string) {
	return string.replace(/'/g, "\\\\'").replace(/"/g, '\\\\"').replace(/\\/g, '\\');
}


var storageList = [];
async function listStorage() {
	startDiscovery();
	storageList = [];
	
	// List mounted USB storage.
	try {
		storageUSB = await execPromise("mount | awk '/dev/sd && "+libraryPath+"'");
		storageUSB = storageUSB.stdout.trim().split("\n");
		for (s in storageUSB) {
			storageList.push({name: storageUSB[s].substring(storageUSB[s].lastIndexOf("/")+1).split(" type ")[0], kind: "USB", id: null});
		}
	} catch (error) {
		console.error("Couldn't get a list of USB storage:", error);
	}
	
	// List configured NAS destinations.
	try {
		storageNAS = fs.readFileSync("/etc/smbmounts.conf", "utf8").split('\n');
		for (s in storageNAS) {
			nasItem = storageNAS[s].trim().split(";");
			if (nasItem[0].charAt(0) != "#") { // Not a comment.
				nasAddress = nasItem[0].substr(2).split("/")[0];
				nasName = nasAddress;
				for (n in discoveredNAS) {
					if (nasAddress == discoveredNAS[n].addresses[0] ||
						discoveredNAS[n].hostname.indexOf(nasAddress) != -1) {
						nasName = discoveredNAS[n].name;
					}
				}
				storageList.push({
					kind: "NAS",
					id: nasItem[0], 
					name: nasName,
					address: nasAddress,
					path: nasItem[0].substr(2).split("/").slice(1).join("/")
				});
			}
		}
	} catch (error) {
		console.log("Couldn't get a list of configured NAS storage:", error);
	}
	
	return storageList;
}


// Discover NAS storage.

var browser = null;
var discoveryStopDelay = null;
var discoveredNAS = {};

function startDiscovery() {
	discoveredNAS = {};
	beo.sendToUI("mpd", "discoveredNAS", {storage: {}});
	if (!browser) {
		browser = new dnssd.Browser(dnssd.tcp('smb'));
		
		browser.on('serviceUp', service => discoveryEvent("up", service));
		browser.on('serviceDown', service => discoveryEvent("down", service));
		browser.on('serviceChanged', service => discoveryEvent("changed", service));
		browser.on('error', error => console.log("dnssd error: ", error));
	} else {
		browser.stop();
	}
	browser.start();
	clearTimeout(discoveryStopDelay);
	discoveryStopDelay = setTimeout(function() {
		stopDiscovery();
	}, 60000);
}

function stopDiscovery() {
	if (browser) browser.stop();
}

function discoveryEvent(event, service) {
	if (event == "up") {
		discoveredNAS[service.name] = {name: service.name, hostname: service.host, addresses: service.addresses};
		var namesUpdated = false;
		for (s in storageList) {
			if (storageList[s].kind == "NAS") {
				if ((storageList[s].address == service.addresses[0] ||
					service.host.indexOf(storageList[s].address) != -1) &&
					storageList[s].name != service.name) {
					storageList[s].name = service.name;
					namesUpdated = true;
				}
			}
		}
		if (namesUpdated) beo.sendToUI("mpd", "mountedStorage", {storage: storageList});
	} else if (event == "down") {
		delete discoveredNAS[service.name];
	}
	beo.sendToUI("mpd", "discoveredNAS", {storage: discoveredNAS});
}

var cachedNASDetails = {};
async function getNASShares(details) {
	shareList = [];
	if (details.server && details.username && details.password != undefined) {
		cachedNASDetails = JSON.parse(JSON.stringify(details));
		try {
			sharesRaw = await execPromise("smbclient -N -L "+details.server.addresses[0]+" --user="+details.username+"%"+details.password+" -g | grep 'Disk|'");
			sharesRaw = sharesRaw.stdout.trim().split("\n");
			for (s in sharesRaw) {
				shareList.push(sharesRaw[s].slice(5, -1));
			}
		} catch (error) {
			console.error("Couldn't get a list of SMB shares:", error);
		}
	}
	return {server: details.server, shares: shareList};
}

	
module.exports = {
	version: version,
	isEnabled: getMPDStatus,
	getMusic: getMusic,
	playMusic: playMusic
};


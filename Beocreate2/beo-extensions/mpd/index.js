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

var debug = beo.debug;

var version = require("./package.json").version;


var defaultSettings = {
	coverNames: ["artwork", "folder", "cover", "front", "albumart"],
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
		updateCache();
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
async function updateCache() {
	if (client && !updatingCache) {
		if (!client) await connectMPD();
		status = await client.api.status.get();
		stats = await client.api.status.stats();
		if (status.updating_db && debug) console.log("MPD is currently updating its database, album cache will not be built at this time.");
		if (cache.lastUpdate == stats.db_update && debug) console.log("MPD album cache appears to be up to date.");
		if ((!cache.lastUpdate || cache.lastUpdate != stats.db_update) && !status.updating_db) {
			// Start updating cache.
			updatingCache = true;
			if (beo.extensions.music && beo.extensions.music.setLibraryUpdateStatus) beo.extensions.music.setLibraryUpdateStatus("mpd", true);
			if (debug) console.log("Updating MPD album cache.");
			newCache = {
				data: {},
				lastUpdate: stats.db_update
			};
			
			try {
				mpdAlbums = await client.api.db.list("album", null, "albumartist");
	
				for (artist in mpdAlbums) {
					newCache.data[mpdAlbums[artist].albumartist] = [];
					for (album in mpdAlbums[artist].album) {
						// Get a song from the album to get album art and other data.
						addAlbum = true;
						if (debug > 1) console.log(mpdAlbums[artist].album[album]);
						track = [];
						try {
							track = await client.api.db.find('((album == "'+escapeString(mpdAlbums[artist].album[album].album)+'") AND (albumartist == "'+escapeString(mpdAlbums[artist].albumartist)+'"))', 'window', '0:1');
						} catch (error) {
							console.error("Error getting a track from album '"+mpdAlbums[artist].album[album].album+"'.", error);
						}
						album = {
							name: mpdAlbums[artist].album[album].album, 
							artist: mpdAlbums[artist].albumartist, 
							date: null, 
							provider: "mpd",
							img: null
						};
						if (track[0]) {
							if (track[0].date) album.date = track[0].date.toString().substring(0,4);
							cover = await getCover(track[0].file);
							if (cover[1] != null) { // Cover fetching had errors, likely due to folder not existing.
								addAlbum = false;
							} else {
								album.img = cover[0];
							}
						}
						if (addAlbum) newCache.data[mpdAlbums[artist].albumartist].push(album);
					}
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
		}
	}
}


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
					for (artist in cache.data) {
						albums = albums.concat(cache.data[artist]);
					}
					return albums;
				}
				break;
			case "album":
				if (context && context.artist && context.album) {
					mpdTracks = [];
					album = {discs: 1, 
							name: context.album, 
							time: 0,
							artist: context.artist, 
							date: null, 
							tracks: [], 
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
							if (cover[0]) album.img = cover[0];
						}
						trackData = {
							id: track,
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
							if (mpdTracks[track].disc > album.discs) album.discs = mpdTracks[track].disc;
						}
						album.tracks.push(trackData);
					}
					return album;
				} else {
					return false;
				}
				break;
			case "artists":
				try {
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
								if (!noArt) album.img = await getCover(mpdTracks[track].file);
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


async function getCover(trackPath) {
	// If cover exists on the file system, return its path.
	if (libraryPath) {
		albumPath = path.dirname(trackPath);
		try {
			files = fs.readdirSync(libraryPath+"/"+albumPath);
			for (file in files) {
				if (path.extname(files[file]).match(/\.(jpg|jpeg|png)$/ig)) {
					// Is image file.
					if (settings.coverNames.indexOf(path.basename(files[file], path.extname(files[file])).toLowerCase()) != -1) {
						encoded = ("/mpd/covers/"+encodeURIComponent(albumPath).replace(/[!'()*]/g, escape)+"/"+files[file]);
						return [encoded, null]; //, escapeStringLight(encoded)];
					}
				}
			}
			// If we've gotten this far, there was no cover. Try to extract it from the file and put it onto the folder, then return its path.
			// This feature is not yet available in MPD.
		} catch (error) {
			// The track/album probably doesn't exist on the file system.
			console.error(error);
			return [null, 404];
		}
	}
	return [null, null];
}



function escapeString(string) {
	return string.replace(/'/g, "\\\\'").replace(/"/g, '\\\\"').replace(/\\/g, '\\');
}


	
module.exports = {
	version: version,
	isEnabled: getMPDStatus,
	getMusic: getMusic,
	playMusic: playMusic
};


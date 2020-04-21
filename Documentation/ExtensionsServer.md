# Implementing Server-Side Code

Beocreate 2 extensions consist of server-side and client-side code. On the server side, the code for an extension is essentially a standard Node.js module, and you have great flexibility in what and how you build.

However, there are a few specialties that you need to consider, and those will be outlined in this document.

See here for user interface-related documentation.

## The *beo* object

Beocreate 2 exposes several features that may be useful to your extension. These facilitate some common tasks, such as communication to/from your client-side code, to other extensions, and more. They are available in the global *beo* object.

### Features included in *beo*:

- **bus**: *Beobus* is a system-wide communications channel that allows you to send and receive data from different parts of the system.
- **sendToUI(target, header, content)**: A Beobus shortcut for sending information to the user interface.
- **extensions**: All loaded extensions on the system. If you need to call a public function of an extension, it is found here.
- **selectedExtension**: A string indicating which extension is currently or was last displayed in the user interface.
- **systemConfiguration**: Contains the sound card name (cardType), server port (port) and system language (language). cardType can be used to tailor a feature for a specific sound card, for example.
- **setup**: A boolean indicating whether or not the guided setup assistant is currently running.
- **debug**: An integer indicating the selected logging level of the system. Use this to determine which events to log to the system log. The range is from *major errors only* (0) to *very detailed* (3). This is controlled by supplying *v, vv,* or *vvv* as a command argument when starting Beocreate 2 server.
- **developerMode**: A boolean indicating whether or not the system has been started in developer mode. For example, in developer mode, the user interface is reloaded from disk every time a web browser loads it (to facilitate more rapid testing). You can use this to alter the behaviour of your extension if necessary for development. This is controlled by supplying *dev* as a command argument when starting Beocreate 2 server.
- **systemDirectory**: Path to the /opt/beocreate directory. In most cases you won't need to use this for anything. This directory gets overwritten in system updates.
- **dataDirectory**: Path to the /etc/beocreate directory. This is for storing settings or any other data that should persist over system upgrades.
- **getSettings(extensionID)**: Return settings for the specified extension. 
- **saveSettings(extensionID, settings)**: Save settings for the specified extension.
- **requestShutdownTime(extensionID)**: If the extension needs to do "housekeeping" before the system shuts down or reboots, you can request up to 5 seconds of additional shutdown time at any point during runtime.
- **shutdownComplete(extensionID)**: If the extension has requested shutdown time and has completed any necessary shutdown activities, this will allow the system to continue shutdown.
- **download(url, destinationDirectory, destinationFilename, callback)**: Downloads a file from the internet into the specified path. Callback gets *true* if download was successful.
- **downloadJSON(url, callback)**: Downloads and parses a JSON file, returning it as an object.
- **addDownloadRoute(extensionID, urlPath, filePath, permanent)**: Allows assigning a download URL to a file on the file system. Returns the download URL. The URL will be along the lines of *http://system-address.local/extensionID/download/urlPath*.
- **removeDownloadRoute(extensionID, urlPath)**: Close a previously opened file download route.
- **underscore**: the Underscore library is available in this variable. It can come in handy in some situations.

Some of these features are detailed below.

## Beobus

*Beobus* is an essential part of a Beocreate 2 extension. It is a shared EventEmitter3 instance that can be used to communicate with your user interface as well as other extensions. Beobus is included in the **beo** object. It is free to use as long as guidelines are followed.

*Note:* Beobus was created as a frictionless way for extensions to work together and by themselves on Beocreate 2 system. It is not a secure or exclusive communication method. *Any extension can send and listen to any messages on it.* It is imperative that all extensions mind their manners for smooth coexistence.

### Sending Beobus Events

An event sent over Beobus should always conform to a common format:

	beo.bus.emit("channel", {
		header: "eventHeader", 
		content: {anyData: true, anyOtherData: false}
	});

- **channel** indicates the "channel" or "target" of the message (such as another extension).
- **header** is a simple description of what the event is about.
- **content** (optional) houses any other data that you want to deliver.

### Receiving Beobus Events

Listen to events on a channel like this:

	beo.bus.on("channel", function(event) {
		// Act on the event here.
	});

When all extensions adhere to the described format when sending events, it is trivial to check what kind of data is being sent and act on it – **header** and **content** are accessible within the **event** variable.

For communication specific to your extensions, listen to a channel with the identifier of your extension (**my-extension** in our examples):

	beo.bus.on("my-extension", function(event) {
		// Act on events specific to your extension.
	});

*Tip:* do not add multiple event listeners for the same channel in your extension. Instead, use *if* or *switch* statements to check the **header** and distinguish between different events.

### Restricted Channels

There are some channels that are used by the system and built-in extensions. You are welcome to listen in on the events, but it is recommended to not send anything on these channels:

#### 'general' channel

This channel broadcasts general system events with following headers:

- **startup**: broadcast when all extensions have been loaded and settings have been delivered. This is a good cue to start doing work in your extension.
- **shutdown**: broadcast when system shutdown has been requested for any reason.
- **activatedExtension**: broadcast when menus are accessed in the user interface. Its *content* object includes:
	- *extension:* the name of the extension that activated
	- *deepMenu:* the name of the deep menu (a menu within a menu), if any – returns `null` if the menu being accessed is the main menu of the extension.

#### 'dsp' channel

This channel broadcasts information about the DSP program that's running.

- **metadata**: contains all of the available sound adjustment registers in the DSP programs. Use this information to determine whether or not a sound adjustment feature is supported.


## Communicating with the User Interface

To send data to the user interface, you can use the following shorthand:

	beo.sendToUI("my-extension", header, content);

The first two arguments are mandatory. ***content*** argument is optional.

This data then arrives in the user interface of connected clients. The method of accessing it is described in the document detailing user interface implementation.

*Note:* The *sendToUI* syntax has been updated in April 2020 to be simpler to use. Old syntax will also continue to work.

When data is received from the user interface for your extension, it will be broadcast on your extension's channel and you can handle it like a normal Beobus event:

	beo.bus.on("my-extension", function(event) {
		// Act on events specific to your extension.
	});


## Access Functions or Properties from Other Extensions

Sometimes you need to call functions (or access variables) from other extensions. Which functions are available depends on the extension. You can publish functions for other extensions to use in **module.exports**, just like with normal Node modules.

Because you should not assume which extensions and functions are available, always check for the existence of both the extension and the function before calling it, implementing a fallback (if needed) in case it is not.

The public functions for each extension are in **beo.extensions**:

	if (beo.extensions["other-extension"] && 
		beo.extensions["other-extension"].functionToCall != undefined) {
		// The extension and the function exist, call it:
		beo.extensions["other-extension"].functionToCall(argument);
	} else {
		// The extension or function doesn't exist, deal with it.
	}


## Settings

Where possible, avoid having settings for your extension. Make reasonable choices on the user's behalf, using any other relevant information available on the system. Using Beocreate 2 should be an experience that doesn't burden the user with configuring the tiniest possible details.

When you need to save and load settings, Beocreate 2 makes this easy for you.

### Settings Format and Storage

Settings are stored as JSON files in **/etc/beocreate**, named after each extension identifier, and provided to you as JavaScript objects.

*Tip:* Choose descriptive but concise names for your settings keys, so that they can be understood by looking at the file.

### Default Settings

Even if your extension has configurable settings, always make sure it works without issues if these are not loaded from the disk – because the user started fresh or any other reason. This means including default settings within your code. This can look as follows:

	var defaultSettings = {
		"aSetting": true,
		"anotherSetting": 100
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
The last line clones the *defaultSettings* object into *settings* in such a way that the defaults will not be altered when settings are changed at runtime. 

Include this somewhere near the top of your extension code.

### Loading Settings

During startup, Beocreate 2 attempts to load settings for all extensions it finds. If your extension has settings, they will be broadcast over Beobus on your extension's channel. You can catch them as follows. How exactly you merge the received settings with defaults is up to you.

	beo.bus.on("my-extension", function(event) {
		if (event.header == "settings") {
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
			}
		}
	});
	
This event is broadcast *before* the **startup** event is broadcast on the **general** channel.

You can also listen to settings for other extensions, if they are useful to you, but please refrain from saving settings on their behalf.

Settings can be requested from disk manually as follows:

	settings = beo.getSettings("my-extension");

In most cases this is not needed – you should cache the settings you receive automatically over Beobus.

### Saving Settings

If you have changed your settings, remember to save them. Do this as follows:

	beo.saveSettings("my-extension", settings);
	
- **settings** should be your settings object. Do not convert it to JSON yourself.

Beocreate 2 will queue settings before writing them to disk. This ensures that changing settings in rapid succession (such as when adjusting an equaliser) doesn't result in unnecessary disk activity. After 10 seconds of no *saveSettings* calls from any extension, Beocreate 2 will write the latest queued settings from each extension to disk at once.

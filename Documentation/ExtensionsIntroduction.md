# Introduction to Extensions

Beocreate 2 is built on an extension architecture. In practice, this means that the "primary" Node.js application is very minimal in function, only taking care of basic housekeeping in the system, such as loading extensions, reading and saving settings and constructing the user interface. All actual features and screens in the user interface are segregated into independent extensions.

The main benefit of the architecture is its flexibility. Extensions can be added, removed, mixed and matched with ease to customise the sound system for different needs. This also means easier upgradability, as code for a single feature is concentrated in one place and can be (generally speaking) changed independently from the rest.


## Basics

In its simplest form, an extension is a directory within **/etc/beocreate/beo-extensions** (or /opt/beocreate/beo-extensions for system extensions) that has a *menu.html* file in it. Such extension will appear as a static screen in the user interface.

The *name of the directory* of your extension becomes the identifier associated with your extension in Beocreate 2. Make sure this is unique.

## File Structure

To create more useful extensions, a few more ingredients are needed. A typical, fully functional extension may have a file structure as follows:

	my-extension
	├╴ menu.html
	├╴ package.json
	├╴ index.js
	├╴ my-extension-client.js
	├╴ my-extension.css
	├╴ symbols-black
	│  └╴ my-extension.svg
	├╴ symbols-white
	│  └╴ my-extension.svg
	└╴ node_modules
	   └╴ ...
	   
*Note:* you can include any other necessary files, such as image assets in the directory as you wish.

### menu.html

**Required.** Describes the user interface of the extension. It also contains vital information about the extension, such as its human-readable name and preferred position in the menu system, if applicable. At this time, the file name is required to be *menu.html*.

The composition of this file is described in more detail [here].

### package.json

A file describing the Node.js module for NPM. It is strongly recommended to have it, to make it easier to install any possible dependencies, for example.


### index.js

The main Node.js (server-side) code for the extension that the system will attempt to load. Server-side code is not a technical requirement, but in most cases vital to implement any functionality. At this time, the file name is requried to be *index.js*.

Server-side code is described in more detail [here](ExtensionsServer.md).

### my-extension-client.js

The main client-side code that handles user interaction for your extension. Best practices for client-side code are described here.

### my-extension.css

Whilst Beocreate 2 has an extensive collection of standard, styled user interface elements, sometimes custom controls or views are needed. You can include a stylesheet for this purpose in your extension. Always use standard elements and standard styling when possible, to maintain a consistent user experience. 

When creating custom interface elements, target them in your stylesheet as specifically as possible to avoid your styles from "contaminating" other extensions. An easy way is to prefix your selectors with the identifier of your extension (*#my-extension*).

How to include a stylesheet is described here.

### symbols-black & symbols-white

Your extension should have a representative symbol that is automatically shown in the user interface. Black and white versions should be placed in these directories. If your interface needs other symbols, it is a good idea to place them here as well.

Symbols should always adhere to the [design guidelines](DesignGuidelines.md) to maintain a consistent, beautiful and minimalist look.

### node_modules

Created when your extension is installed, if it includes dependencies. At this time you need to run `npm install` manually for your extension. Note that this does not exist for system extensions, as they are installed in /usr/lib/node_modules. You may use any of the supplied modules in your code.
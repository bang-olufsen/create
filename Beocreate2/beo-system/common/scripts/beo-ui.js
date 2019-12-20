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

noExtensions = false;

var extensions = {};
var selectedExtension = null;
var stateRestored = false;
var historyConstructed = false;

beo = (function() {

uiSettings = {
	disclosure: {}
};
hifiberryOS = false;

$( document ).ready(function() {
	// FASTCLICK
	
	new FastClick(document.body);
	
	if (("standalone" in window.navigator) && window.navigator.standalone){
		$("body").addClass("standalone");
	}
	if ($("body").hasClass("hifiberry-os")) hifiberryOS = true;
	getWindowDimensions();
	sendToProductView({header: "isShownInBeoApp"});
	prepareMenus();
	prepareTabBar();
	prepareTextInput();
	updateInterfaceMode();
	setAppearance();
	beoCom.connectToCurrentProduct();
	
	$("body").css("opacity", "1");
	
	if (hifiberryOS) $('head link[rel="apple-touch-icon"]').attr("href", "common/apple-touch-icon-hifiberry.png");
	
	// File selected to upload.
	$("input[type=file]#file-input").on('change',function(){
	    uploadFile(null, null, this.files[0]);
	});
	
	// Preload animated wait icons:
	if (!hifiberryOS) {
		attentionIcon.src = "common/create-wait-animate.svg";
	} else {
		attentionIcon.src = "common/hifiberry-wait-animate.svg";
	}
});

darkAppearance = false;

// RECEIVE MESSAGES FROM BEOCREATE APP
window.addEventListener('message',function(event) {
	
	data = JSON.parse(event.data);
	if (data.header != undefined) {
	
		switch (data.header) {
			case "isShownInBeoApp":
				if (data.content == true) {
					$("body").addClass("in-beo-app");
				}
				break;
			case "hasDarkAppearance":
				if (data.content == true) {
					setAppearance(true);
				} else {
					setAppearance(false);
				}
				break;
		}
	
	}
});

function sendToProductView(data) {
	window.parent.postMessage(JSON.stringify(data), '*');
}

$(document).on("general", function(event, data) {
	
	
	if (data.header == "powerStatus" && !data.content.overrideUIActions) {
		if (product_information && product_information.systemID && product_information.systemName) {
			if (data.content.status == "shuttingDown") {
				sendToProductView({header: "powerStatus", content: {status: "shuttingDown", systemID: product_information.systemID(), systemName: product_information.systemName()}});
				notify({title: "Shutting down product…", message: "Leave power connected for at least 20 seconds to allow shutdown to finish.", icon: "common/symbols-black/power.svg", timeout: false});
				noConnectionNotifications = true;
				maxConnectionAttempts = 0;
			} else if (data.content.status == "rebooting") {
				sendToProductView({header: "powerStatus", content: {status: "rebooting", systemID: product_information.systemID(), systemName: product_information.systemName()}});
				notify({title: "Restarting product…", message: "This will take a moment, please wait.", icon: "attention", timeout: false});
				noConnectionNotifications = true;
				maxConnectionAttempts = 10;
			}
		}
	}
	
});


// USER INTERFACE SETUP

var language = "en";

var resizeTimeout;
var windowHeight = 0;
var windowWidth = 0;

var sidebarContentColour = "white"; 

function getWindowDimensions() {
	windowHeight = window.innerHeight;
	windowWidth = window.innerWidth;
}

window.addEventListener('resize', function(){
	clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(function() {
		getWindowDimensions();
		updateInterfaceMode();
		updateSliderWidths();
		updatePopupHeight();
		$(document).trigger("ui", {header: "windowResized"});
	}, 200);
}, true);

document.onkeydown = function(evt) {
    evt = evt || window.event;
    var isEscape = false;
    if ("key" in evt) {
        isEscape = (evt.key === "Escape" || evt.key === "Esc");
    } else {
        isEscape = (evt.keyCode === 27);
    }
    if (isEscape) {
		if (textInputOpen) {
			cancelText();
		} else if (askOpen) {
			ask();
		} else if (currentPopup) {
			popupBackplateClick('#open-popup', '#open-popup-back-plate', true);
		}
    }
};


var interfaceMode = 1; // 1 = normal, 2 = compact

function prepareMenus() {
	// Find every top level menu
	console.log("Preparing menus...");
	menuGroup = "";
	$("nav.bar .nav-content").append('<div class="nav-spacer"></div>');
		
	$("#extensions > *").each(function() {
		extensionCounter = 0;
		thisSection = this;
		submenuGroup = "";
		menuID = "";
		
		if ($(this).hasClass("nav-separator")) {
			$(this).remove();
			//$("nav.full .nav-content").append(titleElement);
			$("nav.full .nav-content").append('<hr>');
			$("nav.bar .nav-content").append('<div class="nav-separator"></div>');
		} else {
		// Loop through every menu screen of that menu
			$(".menu-screen", this).each(function() {
					
				if ($(this).attr("data-parent-extension")) { // Some extensions support deeper navigation hierarchies ("deep menu").
					deepMenu = true;
				} else {
					deepMenu = false;
				}
					
				// Translate this screen or title.
				thisScreen = this;
				translatedString("", "menuTitle", $(this).attr("id"), function(finalString) {
					$(this).attr("data-menu-title", finalString);
				});
				
				$("*[data-translation]", thisScreen).each(function() {
					translatedString($(this).attr("data-menu-title"), $(this).attr("data-translation"), $(thisScreen).attr("id"), function(finalString) {
						$(this).text("data-menu-title");
					});
				});
				
				if (extensionCounter == 0) {
					// TOP LEVEL MENU
					
					iconName = $(this).attr("data-icon");
					if (hifiberryOS && $(this).attr("data-icon-hifiberry")) {
						iconName = $(this).attr("data-icon-hifiberry");
					}
					menuOptions = {
						onclick: 'beo.showExtension(\''+$(this).attr("id")+'\');',
						icon: $(this).attr("data-asset-path")+"/symbols-"+sidebarContentColour+"/"+iconName,
						id: $(this).attr("id")+'-menu-item',
						data: {"data-extension-id": $(this).attr("id")},
						classes: ["nav-item"]
					};
					
					menuOptions.labelClasses = [""];
					if ($(this).attr("data-menu-title-class")) {
						menuOptions.labelClasses = [$(this).attr("data-menu-title-class")];
					}
					menuOptions.label = $(this).attr("data-menu-title");
						
					if (!$(this).attr("data-hidden")) {
						$("nav.full .nav-content").append(createMenuItem(menuOptions));
						$("nav.bar .nav-content").append('<div class="nav-item '+menuOptions.labelClasses.join(" ")+'" data-extension-id="'+menuOptions.data['data-extension-id']+'" onclick="beo.showExtension(\''+$(this).attr("id")+'\');">'+menuOptions.label+'</div>');
					}
					
					$(thisSection).attr("data-top-level-menu-id", $(this).attr("id"));
					if ($(this).attr("data-stylesheet")) {
						$('head').append('<link rel="stylesheet" type="text/css" href="'+$(this).attr("data-asset-path")+'/'+$(this).attr("data-stylesheet")+'">');
					}
					$(this).addClass("block");
					submenuGroup = "";
					menuID = $(this).attr("id");
					extensions[menuID] = {
						id: menuID, parentMenu: undefined, 
						icon: $(this).attr("data-icon"), 
						assetPath: $(this).attr("data-asset-path"), 
						title: $(this).attr("data-menu-title"),
						deepMenu: []
					};
					$(".scroll-area", this).first().prepend('<h1 class="large-title">'+$("header h1", this).first().text()+'</h1>'); // Duplicate title for views that use a large title.					
				} else {
					// SUBMENUS
					if (!deepMenu) {
						iconName = $(this).attr("data-icon");
						if (hifiberryOS && $(this).attr("data-icon-hifiberry")) {
							iconName = $(this).attr("data-icon-hifiberry");
						}
						menuOptions = {
							label: $(this).attr("data-menu-title"),
							onclick: 'beo.showExtension(\''+$(this).attr("id")+'\');',
							icon: $(this).attr("data-asset-path")+"/symbols-black/"+iconName, // Still not quite sure if it looks better with or without icons.
							id: $(this).attr("id")+'-menu-item',
							chevron: true,
							data: {"data-extension-id": $(this).attr("id")},
							classes: []
						};
						if ($(this).hasClass("source")) {
							// Use icons for sources.
							menuOptions.icon = $(this).attr("data-asset-path")+"/symbols-black/"+$(this).attr("data-icon");
							menuOptions.iconRight = "common/symbols-black/volume.svg";
							menuOptions.classes.push("hide-icon-right", "source-menu-item");
						}
						if ($(this).attr("data-menu-value-class")) {
							menuOptions.valueClasses = [$(this).attr("data-menu-value-class")];
							menuOptions.value = "";
						}
						if ($(this).attr("data-menu-title-class")) {
							menuOptions.labelClasses = [$(this).attr("data-menu-title-class")];
						}
						if ($(this).attr("data-menu-class")) {
							menuOptions.classes.push($(this).attr("data-menu-class"));
						}
						if (!$(this).attr("data-hidden")) {
							menuItemPlaced = false;
							if ($(this).attr("data-context")) {
								context = $(this).attr("data-context").split("/");
								if (context[1]) {
									if ($(".menu-screen:first-of-type .beo-dynamic-menu."+context[1], thisSection)) {
										$(".menu-screen:first-of-type .beo-dynamic-menu."+context[1], thisSection).append(createMenuItem(menuOptions));
										menuItemPlaced = true;
									}
								}
							} 
							if (!menuItemPlaced) {
								$(".menu-screen:first-of-type .beo-dynamic-menu", thisSection).append(createMenuItem(menuOptions));
							}
						}
						if ($(this).attr("data-stylesheet")) {
							$('head').append('<link rel="stylesheet" type="text/css" href="'+$(this).attr("data-asset-path")+'/'+$(this).attr("data-stylesheet")+'">');
						}
					}
					
					$(this).addClass("hidden-right");
					
					if (!deepMenu) {
						extensions[$(this).attr("id")] = {
							id: $(this).attr("id"), 
							parentMenu: menuID, 
							icon: $(this).attr("data-icon"), 
							assetPath: $(this).attr("data-asset-path"), 
							title: $(this).attr("data-menu-title"),
							deepMenu: []
						};
					} else { // Add deep menu to the list
						extensions[$(this).attr("data-parent-extension")].deepMenu.push($(this).attr("id"));
					}
					
					$(".scroll-area", this).first().prepend('<h1 class="large-title">'+$("header h1", this).first().text()+'</h1>'); // Duplicate title for views that use a large title.
				}
				if ($(this).attr("data-extension-name")) {
					extensions[$(this).attr("id")].genericTitle = $(this).attr("data-extension-name");
				}
				if (!deepMenu) extensions[$(this).attr("id")].builtIn = ($(this).attr("data-built-in")) ? true : false;
				extensionCounter++;
				
				//$(".menu-content h2, .menu-content .beo-dynamic-menu .menu-item, .menu-content .menu-item, .menu-content p", thisScreen).first().addClass("first");
			});
		}
	});
	
	$("nav.bar .nav-content").append('<div class="nav-spacer"></div>');
	
	// Promote now-playing into a special screen.
	if ($("#now-playing.menu-screen")) {
		nowPlaying = $("beo-now-playing").replaceWith($("#now-playing.menu-screen").detach());
	}
	
	$(document).trigger("ui", {header: "menusReady"});
	console.log("Menus ready.");
}

var configuredTabs = [];

function prepareTabBar() {
	// Load custom tabs if set, or load default tabs.
	if (localStorage.beoConfiguredTabs) {
		configuredTabs = JSON.parse(localStorage.beoConfiguredTabs);
	} else {
		tabIndex = 0;
		$("nav.full .menu-item").each(function() {
			if (tabIndex < 4) {
				configuredTabs.push($(this).attr("data-extension-id"));
				tabIndex++;
			}
		});
	}
	reloadTabIcons();
}

function reloadTabIcons() {
	/*for (var i = 0; i < 4; i++) {
		tabItem = extensions[configuredTabs[i]];
		$("#favourite-"+i+" img").attr("src", tabItem.assetPath+"/symbols-white/"+tabItem.icon);
		$("#favourite-"+i+" span").text($("#"+tabItem.id).attr("data-menu-title"));
	}*/
}

function updateInterfaceMode() {
	breakpoint = 620;
	
	if (windowWidth < breakpoint && interfaceMode == 1) {
		// Change to compact mode
		
		interfaceMode = 2;
	} else if (windowWidth >= breakpoint && interfaceMode == 2) {
		// Change to normal mode
		if (mainMenuVisible) toggleMainMenu();
		interfaceMode = 1;
	}
	updateNavIcons();
	updateHeaderIcons();
}

function updateNavIcons() {
	if (interfaceMode == 1) symbolFolder = "symbols-"+sidebarContentColour;
	if (interfaceMode == 2) symbolFolder = "symbols-white";
	$("nav.full .menu-item").each(function() {
		menuID = $(this).attr("data-extension-id");
		if ($(this).hasClass("selected")) {
			$(".menu-icon", this).attr("src", extensions[menuID].assetPath+"/symbols-white/"+extensions[menuID].icon);
		} else {
			$(".menu-icon", this).attr("src", extensions[menuID].assetPath+"/"+symbolFolder+"/"+extensions[menuID].icon);
		}
	});
}

function updateHeaderIcons() {
	
	$("header .symbol").each(function() {
		symbolURL = $(this).css("background-image");
		//if (interfaceMode == 1) symbolURL = symbolURL.replace("/symbols-black/", "/symbols-white/");
		if (interfaceMode == 2) symbolURL = symbolURL.replace("/symbols-white/", "/symbols-black/");
		$(this).css("background-image", symbolURL);
	});
}


window.matchMedia("(prefers-color-scheme: dark)").addListener(e => e.matches && setAppearance(true));
window.matchMedia("(prefers-color-scheme: light)").addListener(e => e.matches && setAppearance(false));

function setAppearance(isDark, savePreference) {
	if (savePreference) {
		if (isDark == undefined) localStorage.beocreateAppearance = "auto";
		if (isDark == true) localStorage.beocreateAppearance = "dark";
		if (isDark == false) localStorage.beocreateAppearance = "light";
	}
	$(".ui-appearance-mode .menu-item").removeClass("checked");
	if (localStorage.beocreateAppearance) {
		if (localStorage.beocreateAppearance == "dark") {
			isDark = true;
			$(".ui-appearance-mode .menu-item#ui-appearance-dark").addClass("checked");
		}
		if (localStorage.beocreateAppearance == "light") {
			isDark = false;
			$(".ui-appearance-mode .menu-item#ui-appearance-light").addClass("checked");
		}
		if (localStorage.beocreateAppearance == "auto") {
			$(".ui-appearance-mode .menu-item#ui-appearance-auto").addClass("checked");
		}
	} else {
		$(".ui-appearance-mode .menu-item#ui-appearance-auto").addClass("checked");
	}
	if (isDark == undefined) {
		dark = false;
		dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	} else {
		dark = isDark;
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

function setSymbol(element, symbolPath) {
	$(element).css("-webkit-mask-image", "url("+symbolPath+")").css("mask-image", "url("+symbolPath+")");
}

var mainMenuVisible = false;
function toggleMainMenu() {
	// Expands full navigation when the interface is in "compact" layout
	if (mainMenuVisible == false) {
		clearTimeout(mainMenuVisible);
		$("nav.full, #nav-back-plate").addClass("block");
		setTimeout(function() {
			$("nav.full, #nav-back-plate").addClass("visible");
			$("#extensions").addClass("shifted");
		}, 20);
		mainMenuVisible = true;
	} else {
		$("nav.full, #nav-back-plate").removeClass("visible");
		$("#extensions").removeClass("shifted");
		mainMenuVisible = setTimeout(function() {
			$("nav.full, #nav-back-plate").removeClass("block");
			mainMenuVisible = false;
		}, 500);
	}
	
}


var selectedParentMenu = null;
var menuState = {};
var navigating = false;


function showExtension(extension, direction, fromBackButton, invisibly) {
	/* Arguments:
		- extension (required): the id of the extension to show.
		- direction (optional): specifies from which direction ("left"/"right") the new extension is brought on screen. Used during setup to show extensions, that wouldn't normally be related, in a coherent flow. This also enables the back button to traverse this flow, also on top-level menus, instead of following the parent-submenu structure.
		- fromBackButton: indicates that the back button initiated this navigation, which means that the back button for the next screen shouldn't be altered.
		- invisibly: when extension history is constructed, this flag should be set. It will move extensions to their right places without animations and won't show the current one (also the "activated" function won't get triggered).
	
	*/
	if (!navigating && extensions[extension]) { // Prevent navigation if another transition is in progress
	
		navigating = true;
		if (isNaN(extension)) { // Selecting tab with name (from a menu item).
			newExtension = extension;
		} else { // Selecting tab with index number (from favourites bar).
			newExtension = configuredTabs[extension];
		}
		
		newTabIndex = configuredTabs.indexOf(newExtension);
		if (newTabIndex == -1 && extensions[newExtension].parentMenu) {
			newTabIndex = configuredTabs.indexOf(extensions[newExtension].parentMenu);
		}
		$("nav.favourites div").removeClass("selected");
		if (newTabIndex != -1) {
			$("nav.favourites div#favourite-"+newTabIndex).addClass("selected");
		}
		
		if (selectedParentMenu) {
			if (interfaceMode == 1) $('nav .nav-item[data-extension-id="'+selectedParentMenu+'"] .menu-icon').attr("src", extensions[selectedParentMenu].assetPath+"/symbols-"+sidebarContentColour+"/"+extensions[selectedParentMenu].icon);
			$('nav .nav-item[data-extension-id="'+selectedParentMenu+'"]').removeClass("selected");
		}
		
		backTarget = null;
		backTitle = null;
		
		
		if (direction) {
			
			sectionToFadeOut = 'section[data-top-level-menu-id="'+selectedParentMenu+'"]';
			
			if (extensions[newExtension].parentMenu) {
				sectionToFadeIn = 'section[data-top-level-menu-id="'+extensions[newExtension].parentMenu+'"]';
			} else {
				sectionToFadeIn = 'section[data-top-level-menu-id="'+newExtension+'"]';
			}
			
			direction == "left" ? outDirection = "right" : outDirection = "left";
			if (!invisibly) {
				$(sectionToFadeOut).addClass("faded-out animating "+outDirection);
				$(sectionToFadeIn).addClass("animating");
				
				setTimeout(function() {
					$(sectionToFadeOut).removeClass("block faded-out left right");
				}, 500);
				setTimeout(function() {
					$(sectionToFadeIn).addClass("block faded-out "+direction);
				}, 550);
				setTimeout(function() {
					$(sectionToFadeIn).removeClass("faded-out left right");
				}, 600);
				setTimeout(function() {
					$(sectionToFadeIn+", "+sectionToFadeOut).removeClass("animating");
				}, 1100);
			} else {
				$(sectionToFadeOut).addClass("faded-out "+outDirection).removeClass("block");
				$(sectionToFadeIn).removeClass("left right faded-out "+direction);
			}
			
		}
		
		if (extensions[newExtension].parentMenu) {
		// The extension is a submenu, show the parent menu and navigate to the submenu.
			
			if (selectedParentMenu != extensions[newExtension].parentMenu) {
				// This submenu has a different parent from the currently open menu.
				if (!direction) {
					$('section[data-top-level-menu-id="'+selectedParentMenu+'"]').removeClass("block");
					$('section[data-top-level-menu-id="'+extensions[newExtension].parentMenu+'"]').addClass("block");
				}
				selectedParentMenu = extensions[newExtension].parentMenu;
			} 
			if (!menuState[selectedParentMenu]) menuState[selectedParentMenu] = {};
			if (menuState[selectedParentMenu].submenu) {
				// There's already another submenu open for this menu, close it here first – but only if it's not the menu we actually want to open.
				if (menuState[selectedParentMenu].submenu != newExtension) {
					menuToClose = menuState[selectedParentMenu].submenu;
					if (!invisibly) {
						$("#" + menuToClose).addClass("hidden-right");
						setTimeout(function() {
							$("#" + menuToClose).removeClass("block");
						}, 600);
					} else {
						$("#" + menuToClose).removeClass("block").addClass("hidden-right");
					}
				}
			}
			
			menuState[selectedParentMenu].submenu = newExtension;
			if (!invisibly) activatedExtension(newExtension);
			
			if (selectedExtension && direction) {
				backTitle = $("#"+selectedExtension).attr("data-menu-title");
				backTarget = selectedExtension;
			} else if (selectedParentMenu) {
				backTarget = selectedParentMenu;
				backTitle = extensions[selectedParentMenu].title;
			}
			
			if (!direction) {
				if (!invisibly) {
					$("#" + newExtension).addClass("block new");
					setTimeout(function() {
						$("#" + newExtension).removeClass("hidden-right");
						$("#" + selectedParentMenu).addClass("hidden-left");
						$("#" + newExtension).attr("data-edge-swipe-previous", selectedParentMenu);
					}, 50);
				} else {
					$("#" + newExtension).addClass("block");
					$("#" + newExtension).removeClass("hidden-right");
					$("#" + selectedParentMenu).addClass("hidden-left");
					$("#" + newExtension).attr("data-edge-swipe-previous", selectedParentMenu);
				}
			} else if (direction) {
				if (!invisibly) {
					setTimeout(function() {
						$("#" + newExtension).addClass("block new");
						$("#" + newExtension).removeClass("hidden-right");
						$("#" + selectedParentMenu).addClass("hidden-left");
						$("#" + newExtension).attr("data-edge-swipe-previous", selectedParentMenu);
					}, 550);
				} else {
					$("#" + newExtension).addClass("block");
					$("#" + newExtension).removeClass("hidden-right");
					$("#" + selectedParentMenu).addClass("hidden-left");
					$("#" + newExtension).attr("data-edge-swipe-previous", selectedParentMenu);
				}
			}
			if (!invisibly) {
				setTimeout(function() {
					$("#" + selectedParentMenu).removeClass("block");
					$("#" + newExtension).removeClass("new");
					navigating = false;
				}, 600);
			} else {
				$("#" + selectedParentMenu).removeClass("block");
				navigating = false;
			}
		
		} else {
		/* The extension is a parent menu. Considerations:
		 	- If this parent menu is not selected in the navigation, select it.
		 	- In the previous case, if a submenu of this menu is open, keep it open, unless explicit direction is specified.
		 	- If the parent menu is already selected and a submenu is open, close it.
		*/
			if (selectedExtension && direction) {
				backTitle = $("#"+selectedExtension).attr("data-menu-title");
				backTarget = selectedExtension;
			}
			if (selectedParentMenu != newExtension) {
				// This is a different top level menu from previous one.
				if (!direction) {
					$('section[data-top-level-menu-id="'+selectedParentMenu+'"]').removeClass("block");
					$('section[data-top-level-menu-id="'+newExtension+'"]').addClass("block");
				}
				selectedParentMenu = newExtension;
				navigating = false;
				if (direction) {
					if (menuState[selectedParentMenu] && menuState[selectedParentMenu].submenu) {
						$("#" + selectedParentMenu).addClass("block");
						$("#" + selectedParentMenu).removeClass("hidden-left");
						$("#" + menuState[selectedParentMenu].submenu).addClass("hidden-right").removeClass("block");
						
					}
					if (!invisibly) activatedExtension(newExtension);
				} else if (menuState[selectedParentMenu] && menuState[selectedParentMenu].submenu) {
					if (!invisibly) activatedExtension(menuState[selectedParentMenu].submenu);
				} else {
					if (!invisibly) activatedExtension(newExtension);
				}
			} else {
				// This is the same top level menu as previously.
				if (menuState[selectedParentMenu] && menuState[selectedParentMenu].submenu) {
					// There's already another submenu open for this menu, close it.
					
					// Close deep menus too.
					if (deepMenuState[menuState[selectedParentMenu].submenu] && deepMenuState[menuState[selectedParentMenu].submenu].length > 0) {
						showDeepMenu(menuState[selectedParentMenu].submenu, menuState[selectedParentMenu].submenu, true);
					}
					if (!invisibly) activatedExtension(selectedParentMenu);
					if (!direction) {
						if (!invisibly) {
							$("#" + selectedParentMenu).addClass("block new");
							setTimeout(function() {
								$("#" + selectedParentMenu).removeClass("hidden-left");
								$("#" + menuState[selectedParentMenu].submenu).addClass("hidden-right");
							}, 50);
						} else {
							$("#" + selectedParentMenu).addClass("block");
							$("#" + selectedParentMenu).removeClass("hidden-left");
							$("#" + menuState[selectedParentMenu].submenu).addClass("hidden-right");
						}
					}
					if (direction) {
						if (!invisibly) {
							setTimeout(function() {
								$("#" + selectedParentMenu).addClass("block new");
								$("#" + selectedParentMenu).removeClass("hidden-left");
								$("#" + menuState[selectedParentMenu].submenu).addClass("hidden-right");
							}, 550);
						} else {
							$("#" + selectedParentMenu).addClass("block");
							$("#" + selectedParentMenu).removeClass("hidden-left");
							$("#" + menuState[selectedParentMenu].submenu).addClass("hidden-right");
						}
					}
					if (!invisibly) {
						setTimeout(function() {
							$("#" + menuState[selectedParentMenu].submenu).removeClass("block");
							$("#" + selectedParentMenu).removeClass("new");
							menuState[selectedParentMenu].submenu = undefined;
							navigating = false;
						}, 600);
					} else {
						$("#" + menuState[selectedParentMenu].submenu).removeClass("block");
						menuState[selectedParentMenu].submenu = undefined;
						navigating = false;
					}
				} else {
					if (deepMenuState[selectedParentMenu] && deepMenuState[selectedParentMenu].length > 0) {
						showDeepMenu(selectedParentMenu, selectedParentMenu);
					}
					navigating = false;
				}
			}
		}
		
		
		if (backTarget) {
			if (!fromBackButton) {
				$("#"+newExtension+" .back-button.master").addClass("visible");
				$("#"+newExtension+" .back-button.master").attr("data-back-text", backTitle).attr("data-back-target", backTarget);
			}
		} else {
			$("#"+newExtension+" .back-button.master").removeClass("visible");
		}
		
		// Set the back button to traverse the custom flow instead of menu hierarchy, if direction specified.
		if (direction) {
			if (!fromBackButton) {
				direction == "left" ? backDirection = "right" : backDirection = "left";
				$("#"+newExtension+" .back-button.master").attr("data-back-direction", backDirection);
			}
		} else if (!fromBackButton) {
			$("#"+newExtension+" .back-button.master").removeAttr("data-back-direction");
		}
		
		$('nav .nav-item[data-extension-id="'+selectedParentMenu+'"]').addClass("selected");
		$('nav .nav-item[data-extension-id="'+selectedParentMenu+'"] .menu-icon').attr("src", extensions[selectedParentMenu].assetPath+"/symbols-white/"+extensions[selectedParentMenu].icon);
		
		if (interfaceMode == 2 && mainMenuVisible && !invisibly) toggleMainMenu();
		//selectedExtension = newExtension;
	}
	
}


function showExtensionWithHistory(extensionHistory, extension) {
	// The function will construct the back-button history up until the "extension to select minus one" – for the last step, the function will call "showExtension".
	// extensionHistory: the path from left to right as an array.
	// extension: the extension to select. The history will be constructed only up until this extension.
	if (extensionHistory[0] != extension) {
		console.log("First extension to show is not '"+extension+"', constructing history…");
		for (var i = 0; i < extensionHistory.length; i++) {
			if (extensionHistory[i] == extension) {
				console.log("History constructed, now showing '"+extensionHistory[i]+"' normally…");
				showExtension(extensionHistory[i], "right", false);
				break;
			} else {
				console.log("Showing '"+extensionHistory[i]+"' invisibly to construct history…");
				showExtension(extensionHistory[i], "right", false, true);
			}
		}
	} else {
		// Just select the extension, no need to reconstruct history.
		console.log("History construction not necessary, showing '"+extension+"' normally…");
		showExtension(extension);
	}
	historyConstructed = true;
}

var deepMenuState = {};
var deepNavigating = false;
function showDeepMenu(menuID, overrideWithExtension, hideNew) {
	if (!deepNavigating) {
		deepNavigating = true;
		extension = (overrideWithExtension) ? overrideWithExtension : selectedExtension;
		if (extensions[extension].deepMenu.indexOf(menuID) == -1) {
			// First make sure the extension containing this deep menu is selected.
			for (ext in extensions) {
				if (extensions[ext].deepMenu.indexOf(menuID) != -1) {
					showExtension(ext);
					break;
				}
			}
		}
		newMenu = menuID;
		back = false;
		if (!deepMenuState[extension]) deepMenuState[extension] = [];
		if (deepMenuState[extension].length == 0) {
			// This extension currently has no deep menus open.
			oldMenu = extension;
			deepMenuState[extension] = [newMenu];
		} else {
			newMenuIndex = deepMenuState[extension].indexOf(newMenu); // Check if the new menu is in the deep menu hierarachy.
			oldMenu = deepMenuState[extension][deepMenuState[extension].length-1];
			if (newMenu == extension) {
				deepMenuState[extension] = [];
				back = true;
			} else if (deepMenuState[extension].length == 1 && newMenu == extension) { // Returning to the main menu of the extension.
				deepMenuState[extension] = [];
				back = true;
			} else {
				if (newMenuIndex == -1) { // Going forwards.
					deepMenuState[extension].push(newMenu);
				} else { // Going backwards.
					deepMenuState[extension].length = newMenuIndex+1;
					back = true;
				}
			}
		}
		if (oldMenu != newMenu) {
			if (back) {
				if (!hideNew) {
					$("#" + newMenu).addClass("hidden-left").removeClass("hidden-right");
				} else {
					$("#" + newMenu).addClass("hidden-right").removeClass("hidden-left");
				}
			} else {
				if (!hideNew) $("#" + newMenu).addClass("hidden-right").removeClass("hidden-left");
			}
			if (!hideNew) $("#" + newMenu).addClass("block new");
			setTimeout(function() {
				if (!hideNew) $("#" + newMenu).removeClass("hidden-right hidden-left");
				if (back) {
					$("#" + oldMenu).addClass("hidden-right");
				} else {
					$("#" + oldMenu).addClass("hidden-left");
					if (!hideNew) $("#" + newMenu).attr("data-edge-swipe-previous-deep", oldMenu);
				}
			}, 50);
			setTimeout(function() {
				$("#" + oldMenu).removeClass("block");
				if (!overrideWithExtension) $("#" + newMenu).removeClass("new");
				deepNavigating = false;
			}, 600);
			backTitle = $("#"+oldMenu).attr("data-menu-title");
			if (!back && !hideNew) {
				$("#"+newMenu+" .back-button.master").addClass("visible");
				$("#"+newMenu+" .back-button.master").attr("data-back-text", backTitle).attr("data-back-target-deep", oldMenu);
			}
		} else {
			deepNavigating = false;
		}
	}
}

function setMenuTitle(forMenu, title) {
	$("#"+forMenu).attr("data-menu-title", title);
	$("#"+forMenu+" > header h1, #"+forMenu+" h1.large-title").text(title);
}


$(document).on("click", ".back-button.master", function() {
	if ($(this).attr("data-back-target-deep")) {
		showDeepMenu($(this).attr("data-back-target-deep"));
	} else if ($(this).attr("data-back-target")) {
		backDirection = false;
		if ($(this).attr("data-back-direction")) backDirection = $(this).attr("data-back-direction");
		showExtension($(this).attr("data-back-target"), backDirection, true);
	}
});



function activatedExtension(extensionID) {
	// Trigger the same event in both the UI and on the product.
	setTimeout(function() {
		updateSliderWidths();
	}, 20);
	selectedExtension = extensionID;
	$(document).trigger("general", {header: "activatedExtension", content: {extension: extensionID}});
	beoCom.send({target: "general", header: "activatedExtension", content: {extension: extensionID}});
	sendToProductView(extensionID);
	
	// Save state, so that the UI returns to the same menu when reloaded.
	localStorage.beoCreateSelectedExtension = extensionID;
}





function restoreState(theMenu) {
	// Triggered by the setup extension when the websocket connection is established.
	if (!stateRestored) {
		if (!theMenu) theMenu = null;
		if (theMenu == null && localStorage.beoCreateSelectedExtension != undefined) {
			theMenu = localStorage.beoCreateSelectedExtension;
		}
		if (!extensions[theMenu]) theMenu = $(".menu-screen").first().attr("id");
		if (window.location.hash && extensions[window.location.hash.substring(1)]) {
			// The URL hash can be used to open a specific extension.
			if (window.location.hash == "#now-playing") {
				// Now Playing is a special case, because it opens on top of other extensions.
				showExtension(theMenu);
				if (now_playing && now_playing.showNowPlaying) now_playing.showNowPlaying();
			} else {
				showExtension(window.location.hash.substring(1));
			}
		} else {
			showExtension(theMenu);
		}
		beoCom.send({target: "ui", header: "getUISettings"});
		stateRestored = true;
	} else {
		// If state has already been restored (i.e. this is a reconnection), only indicate the currently selected extension to the product.
		activatedExtension(selectedExtension);
	}
}

$(document).on("ui", function(event, data) {
	if (data.header == "settings") {
		if (data.content.settings) {
			uiSettings = data.content.settings;
			if (uiSettings.disclosure) {
				for (element in uiSettings.disclosure) {
					if ($('.disclosure[data-disclosure="'+element+'"]').length > 0) {
						disclosure(element, uiSettings.disclosure[element]);
					}
				}
			}
		}
	}
});

// GENERATE MENU ITEMS


function createMenuItem(options) {
	// Assembles menu item markup from input, ensuring consistency.
	menuItem = '<div class="menu-item ';
	
	if (!options.classes) options.classes = [];
	if (options.icon) options.classes.push("icon");
	if (options.large) options.classes.push("large");
	if (options.chevron) options.classes.push("chevron");
	if (options.disabled) options.classes.push("disabled");
	if (options.checked) options.classes.push("checked");
	if (options.static) options.classes.push("static");
	if (options.toggle != undefined) options.classes.push("toggle");
	if (options.toggle) options.classes.push("on");
	if (options.twoRows || options.description || options.customMarkup) options.classes.push("two-rows");
	
	if (options.checkmark) {
		options.classes.push("checkmark", options.checkmark);
		if (options.checkmark == "left") {
			if (options.classes.indexOf("icon") == -1) options.classes.push("icon");
			options.icon = "common/symbols-black/checkmark.svg";
		}
	}
	
	// Custom classes
	if (options.classes) {
		menuItem += options.classes.join(" ");
	}
	menuItem += '"'; // Close classes
	
	// ID
	if (options.id) {
		menuItem += ' id="'+options.id+'"';
	}
	
	// Data items
	if (options.data) {
		for (property in options.data) {
			menuItem += ' '+property+'="'+options.data[property]+'"';
		}
	}
	
	// Action
	if (options.onclick) {
		menuItem += ' onclick="'+options.onclick+'"';
	}
	
	//menuItem += '><div class="one-row">';
	menuItem += '>\n';
	if (options.twoRows || options.description || options.customMarkup) menuItem += '<div class="first-row">\n';
	
	// Icon
	if (options.icon) {
		//menuItem += '<img class="menu-icon" src="'+options.icon+'">\n';
		menuItem += '<div class="menu-icon" style="-webkit-mask-image: url('+options.icon+'); mask-image: url('+options.icon+');"></div>\n';
	}
	
	menuItem += '<div class="menu-text-wrap">\n';
	
	// Label
	menuItem += '<div class="menu-label';
	if (options.labelClasses != undefined) {
		for (var i = 0; i < options.labelClasses.length; i++) {
			menuItem += ' '+options.labelClasses[i];
		}
	}
	menuItem += '"';
	if (options.translation && options.translation.label) {
		menuItem += ' data-translation="'+options.translation.label+'"'
	}
	menuItem += '>'+options.label+'</div>\n';
	
	
	//menuItem += '</div>'; // close one-row
	
	// Value
	if (options.value != undefined) {
		menuItem += '<div class="menu-value';
		if (options.valueClasses) {
			for (var i = 0; i < options.valueClasses.length; i++) {
				menuItem += ' '+options.valueClasses[i];
			}
		}
		if (options.valueAsButton) menuItem += ' button';
		if (options.valueAsBadge) menuItem += ' badge';
		menuItem += '"';
		if (options.translation && options.translation.value) {
			menuItem += ' data-translation="'+options.translation.value+'"'
		}
		menuItem += '>'+options.value+'</div>\n';
	}
	
	menuItem += '</div>\n'; // close text-wrap
	
	// Icon, right
	if (options.iconRight) {
		//menuItem += '<img class="menu-icon right" src="'+options.iconRight+'">\n';
		menuItem += '<div class="menu-icon right" style="-webkit-mask-image: url('+options.iconRight+'); mask-image: url('+options.iconRight+');"></div>\n';
	}
	
	// Toggle
	if (options.toggle != undefined) {
		menuItem += '<div class="menu-toggle"></div>\n';
	}
	
	if (options.twoRows || options.description || options.customMarkup) menuItem += '</div>\n'; // close first-row
	
	
	// Description or custom markup (choose one)
	if (options.description) {
		menuItem += '<div class="menu-custom-markup"><p>'+options.description+'</p></div>';
	} else if (options.customMarkup) {
		menuItem += '<div class="menu-custom-markup">'+options.customMarkup+'</div">';
	}
	
	
	menuItem += '</div>\n';
	

	return menuItem;
}

function createCollectionItem(options) {
	// Assembles collection item markup from input, ensuring consistency.
	collectionItem = '<div class="collection-item ';
	
	if (!options.classes) options.classes = [];
	if (options.disabled) options.classes.push("disabled");
	if (options.checked) options.classes.push("checked");
	if (options.static) options.classes.push("static");
	if (options.checkmark) options.classes.push("checkmark");
	if (options.overlay) options.classes.push("overlay");
	
	// Custom classes
	if (options.classes) {
		collectionItem += options.classes.join(" ");
	}
	collectionItem += '"'; // Close classes
	
	// ID
	if (options.id) {
		collectionItem += ' id="'+options.id+'"';
	}
	
	// Data items
	if (options.data) {
		for (property in options.data) {
			collectionItem += ' '+property+'="'+options.data[property]+'"';
		}
	}
	
	// Action
	if (options.onclick) {
		collectionItem += ' onclick="'+options.onclick+'"';
	}
	
	collectionItem += '>\n';
	
	// Square helper allows the collection item to maintain aspect ratio
	collectionItem += '<img class="square-helper" src="common/square-helper.png">\n<div class="collection-item-content">\n';
	
	if (options.icon) collectionItem += '<img class="collection-icon" src="'+options.icon+'">\n';
	
	if (options.labelUpper || options.label) {
		collectionItem += '<div class="collection-item-text">\n';
		
		if (options.labelUpper) collectionItem += '<div class="collection-label upper">'+options.labelUpper+'</div>\n';
		if (options.label) collectionItem += '<div class="collection-label lower">'+options.label+'</div>\n';
		
		collectionItem += '</div>\n';
	}
	
	collectionItem += '</div>\n'; // close collection content
	
	collectionItem += '</div>\n';
		
	
	return collectionItem;
}



// MANAGE LARGE/SMALL HEADER

document.addEventListener("scroll", function(event) {
	if (event.target != document) {
		targetScreen = event.target.offsetParent.id;
		if ($("#"+targetScreen).hasClass("large-title") || $("#"+targetScreen).hasClass("setup-large-title")) {
			if ($("#"+targetScreen+" .scroll-area").scrollTop() > 45) {
				$("#"+targetScreen+" header").addClass("compact");
			} else {
				$("#"+targetScreen+" header").removeClass("compact");
			}
		}
	}
	//console.log(event.offsetParent);
}, true);


// NOTIFICATION

var notificationTimeout;
var notificationAnimationTimeout;
var currentNotificationID = false;
var notificationIcon = "";
var attentionIcon = new Image();

function notify(options, dismissWithID) { // Display a standard HUD notification
	
	/* Possible options:
	no options = dismiss notification.
	
	id (notification ID)
	title
	message
	buttonAction
	buttonTitle
	icon ("attention" for animated B&O logo)
	timeout (seconds, false for persistent, nothing for default (3s))
	
	dismissWithID: if a notification with ID is being displayed, it can be only dismissed if the matching ID is supplied.
	*/
	if (!options) {
		if (!currentNotificationID || (dismissWithID && dismissWithID == currentNotificationID)) {
			$(".hud-notification").removeClass("visible");
			$("body").removeClass("notification");
			clearTimeout(notificationTimeout);
			notificationAnimationTimeout = setTimeout(function() {
				$(".hud-notification").removeClass("show");
			}, 500);
			currentNotificationID = false;
		}
	} else {
		clearTimeout(notificationAnimationTimeout);
		clearTimeout(notificationTimeout);
		
		if (options.id) {
			currentNotificationID = options.id;
		} else {
			currentNotificationID = false;
		}
		
		if (options.title) $(".hud-notification h1").text(options.title);
		
		if (options.message) {
			$(".hud-notification p").text(options.message);
		} else {
			$(".hud-notification p").text("");
		}
		
		if (options.buttonAction) {
			if (options.buttonTitle) $(".hud-notification .button").text(options.buttonTitle);
			if (options.buttonAction == "close") {
				$(".hud-notification .button").attr("onclick", "beo.notify(undefined, currentNotificationID);");
			} else {
				$(".hud-notification .button").attr("onclick", options.buttonAction);
			}
			$(".hud-notification .button").removeClass("hidden");
		} else {
			$(".hud-notification .button").addClass("hidden");
		}
		
		if (!options.icon) {
			icon = "common/symbols-black/notification.svg";
			$("#hud-notification-icon").removeClass("beo-load").addClass("hidden");
			notificationIcon = "";
		} else if (options.icon == "attention") {
			if (notificationIcon != "attention") {
				//icon = "common/symbols-black/wait-star.svg"
				/*if (!hifiberryOS) {
					icon = "common/create-wait-animate.svg";
				} else {
					icon = "common/hifiberry-wait-animate.svg";
				}*/
				icon = attentionIcon.src;
				$("#hud-notification-icon").addClass("beo-load");
		
				$("#hud-notification-icon").removeClass("hidden");
				$("#hud-notification-icon").css("-webkit-mask-image", "url("+icon+")");
				notificationIcon = "attention";
			}
		} else {
			icon = options.icon;
			$("#hud-notification-icon").removeClass("beo-load hidden");
			$("#hud-notification-icon").css("-webkit-mask-image", "url("+icon+")");
			notificationIcon = icon;
		}
		
		if (options.progress == undefined) {
			$("#hud-progress").addClass("hidden");
		} else {
			$("#hud-progress").removeClass("hidden");
			$("#hud-progress-fill").css("width", options.progress+"%");
		}
		
		if (options.timeout == undefined) {
			timeout = 3000;
		} else {
			if (options.timeout == false) {
				timeout = false;
			} else {
				timeout = options.timeout*1000;
			}
		}
		
		$(".hud-notification").addClass("show");
		$("body").addClass("notification");
		notificationAnimationTimeout = setTimeout(function() {
			$(".hud-notification").addClass("visible");
		}, 50);
		
		if (timeout) {
			notificationTimeout = setTimeout(function() {
				notify(undefined, currentNotificationID);
			}, timeout);
		} else {
			// Notification stays on screen.
		}
	}
}




// TABS WITHIN ELEMENTS (not the "favourites" at the bottom in compact layouts)

$(document).on("click", ".tabs div", function() {
	if ($(this).attr("data-select-tab")) {
		showMenuTab($(this).attr("data-select-tab"));
	}
});

function showMenuTab(tabID) {
	$(".tabs div[data-select-tab="+tabID+"]").siblings().removeClass("selected");
	$(".tabs div[data-select-tab="+tabID+"]").addClass("selected");
	$(".tab[data-tab-id="+tabID+"]").siblings(".tab").removeClass("visible");
	$(".tab[data-tab-id="+tabID+"]").addClass("visible");
	if ($(".tab[data-tab-id="+tabID+"]").attr("data-tab-callback")) {
		if (functionExists($(".tab[data-tab-id="+tabID+"]").attr("data-tab-callback"))) {
			executeFunction($(".tab[data-tab-id="+tabID+"]").attr("data-tab-callback"));
		} else {
			console.error("Function '"+$(".tab[data-tab-id="+tabID+"]").attr("data-tab-callback")+"', triggered by tab change, doesn't exist.");
		}
	}
}



// DISCLOSURE

$(document).on("click", ".disclosure", function() {
	if ($(this).attr("data-disclosure")) {
		element = $(this).attr("data-disclosure");
		if ($(this).hasClass("on")) {
			//$(this).removeClass("on");
			disclosure(element, false);
			//$(element).addClass("hidden");
			isOn = false;
		} else {
			//$(this).addClass("on");
			disclosure(element, true);
			//$(element).removeClass("hidden");
			isOn = true;
		}
		if (!$(this).attr("data-disclosure-volatile")) {
			beoCom.send({target: "ui", header: "disclosure", content: {element: element, isOn: isOn}});
		}
	}
});

function disclosure(element, isOn) {
	if (isOn != undefined) {
		if (isOn) {
			$('.disclosure[data-disclosure="'+element+'"]').addClass("on");
			$(element).removeClass("hidden");
		} else {
			$('.disclosure[data-disclosure="'+element+'"]').removeClass("on");
			$(element).addClass("hidden");
		}
	}
}



// LANGUAGE FEATURES

// Return a translation for a given translation ID, if exists. Otherwise return the default string that was supplied.
function translatedString(defaultString, translationID, extensionID) {
	if (typeof translations !== 'undefined' && translations[extensionID]) {
		if (translations[extensionID][translationID]) {
			finalString = translations[extensionID][translationID];
		} else {
			finalString = defaultString;
		}
		
	} else {
		finalString = defaultString;
	}
	return finalString;
}


function translatedStringWithFormat(format, dynamics, translationID, extensionID) {
	if (translationID && extensionID) {
		format = translatedString(format, translationID, extensionID);
	}
	
	finalString = format;
	textItems = format.split("%@");
	finalTextItems = [];
	if (textItems.length > 1) {
		if (dynamics == undefined) dynamics = [];
		textItems.forEach(function(item, index) {
			finalTextItems.push(item);
			if (typeof dynamics == "array") {
				if (dynamics[0]) finalTextItems.push(dynamics.shift());
			} else {
				if (index < textItems.length-1) finalTextItems.push(dynamics);
			}
		});
		finalString = finalTextItems.join("");
	}
	return finalString;
}


function capitaliseFirst(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

function commaAndList(list, andWord, translationID, extensionID) {

	if (translationID && extensionID) {
		andWord = translatedString(andWord, translationID, extensionID);
	}
	if (list.length > 1) {
		for (var i = 0; i < list.length; i++) {
			if (i == 0) {
				finalString = list[0];
			} else if (i > 0 && i < list.length-1) {
				finalString += ", "+list[i];
			} else {
				finalString += " " + andWord + " " + list[i];
			}
		}
		return finalString;
	} else {
		return list[0];
	}
}



// ASK

var askOpen = false;
var askCallbacks = null;
var askCancelCallback = null;
function ask(menuID, dynamicContent, callbacks, cancelCallback) {
	if (menuID) {
		askOpen = true;
		if (callbacks) askCallbacks = callbacks;
		if (cancelCallback) askCancelCallback = cancelCallback;
		/*if (cancelAction) {
			$("#ask-back-plate").attr("onclick", cancelAction);
		} else {
			$("#ask-back-plate").attr("onclick", "ask();");
		}*/
		$("#ask-menu-content").html($("#"+menuID).html());
		if (dynamicContent) {
			for (var i = 0; i < dynamicContent.length; i++) {
				$(".ask-dynamic-"+i).text(dynamicContent[i]);
			}
		}
		$("#ask, #ask-back-plate").addClass("block");
		setTimeout(function() {
			$("#ask, #ask-back-plate").addClass("visible");
		}, 150);
	} else {
		if (askCancelCallback) askCancelCallback();
		$("#ask, #ask-back-plate").removeClass("visible");
		setTimeout(function() {
			$("#ask, #ask-back-plate").removeClass("block");
		}, 500);
		askCallbacks = null;
		askCancelCallback = null;
		askOpen = false;
	}
}

function askOption(callbackIndex) {
	$("#ask, #ask-back-plate").removeClass("visible");
	setTimeout(function() {
		$("#ask, #ask-back-plate").removeClass("block");
	}, 500);
	if (askCallbacks) {
		askCallbacks[callbackIndex]();
	}
	askCallbacks = null;
	askOpen = false;
}


// SLIDER WIDTH
// Sliders that start their range from the centre need their widths to be updated when resized.

function updateSliderWidths() {
	$(".ui-slider.range-from-centre").each(function() {
		$(".ui-slider-range div", this).css("max-width", $(this).width() / 2 + "px");
	});
}



// POPUP VIEWS

// Common popup view with dynamic content.
var currentPopup = null;
var currentPopupParent = null;
var popupCancelAction = null;
function showPopupView(popupContentID, overridePopup, cancelAction) {
	popupCancelAction = null;
	if (popupContentID) {
		if (!currentPopup || overridePopup == currentPopup) {
			if (currentPopup) {
				$("#open-popup .popup-content").addClass("hidden");
				currentPopupParent.append($("#open-popup .popup-content").detach());
			}
			currentPopup = popupContentID;
			currentPopupParent = $("#"+popupContentID).parent();
			$("#open-popup").append($("#"+popupContentID).detach());
			$("#open-popup .popup-content").removeClass("hidden");
			
			// Apply the ID of the popup content view to the target view as a class so it can be targeted with CSS or JavaScript.
			showPopupViewInternal("#open-popup", "#open-popup-back-plate");
			if (cancelAction != undefined) popupCancelAction = cancelAction;
		}
	}
}

function hidePopupView(popupContentID) {
	hidePopupViewInternal("#open-popup", "#open-popup-back-plate", true);
}

function showPopupViewInternal(view, backplate) {
	$(view+", "+backplate).addClass("block");
	setTimeout(function() {
		$(view+", "+backplate).addClass("visible");
		updatePopupHeight();
	}, 100);
}

function hidePopupViewInternal(view, backplate, universalOverride) {
	if (view == "#open-popup" && universalOverride) {
		currentPopup = null;
	}
	$(view+", "+backplate).removeClass("visible");
	setTimeout(function() {
		$("#open-popup .popup-content").addClass("hidden");
		currentPopupParent.append($("#open-popup .popup-content").detach());
		$(view+", "+backplate).removeClass("block");
	}, 500);
}

function popupBackplateClick(view, backplate, universalOverride) {
	if (popupCancelAction != null && view == "#open-popup") {
		popupCancelAction();
	} else {
		hidePopupViewInternal(view, backplate, universalOverride);
	}
}

function updatePopupHeight() {
	if (interfaceMode == 1) {
		if ((windowHeight - 100) == $("#open-popup .popup-content").innerHeight()) {
			$("#open-popup .popup-content").css("height", "100%");
		} else {
			$("#open-popup .popup-content").css("height", "");
		}
	} else {
		$("#open-popup .popup-content").css("height", "");
	}
}


// TEXT INPUT

var textInputCallback;
var textInputMode = 0;
var textInputOptions;
var textInputCloseTimeout;
var textInputOpen = false;

function startTextInput(type, title, prompt, options, callback, cancelCallback) {
	clearTimeout(textInputCloseTimeout);
	$("#text-input, #text-input-back-plate").addClass("block");
	setTimeout(function() {
		$("#text-input, #text-input-back-plate").addClass("visible");
	}, 50);
	$("#text-input").removeClass("text password");
	$("#text-input-submit").addClass("disabled");
	
	textInputMode = type;
	if (type == 1) $("#text-input").addClass("text");
	if (type == 2) $("#text-input").addClass("password");
	if (type == 3) $("#text-input").addClass("text password");
	
	textInputOptions = options;
	
	if (options.autocapitalise) {
		if (options.autocapitalise == true) { 
			$("#text-input input[type=text]").attr("autocapitalize", "sentences");
		} else {
			$("#text-input input[type=text]").attr("autocapitalize", options.autocapitalise);
		}
	} else {
		$("#text-input input[type=text]").attr("autocapitalize", "off");
	}
	
	if (options.autocorrect) {
		$("#text-input input[type=text]").attr("autocorrect", "on");
	} else {
		$("#text-input input[type=text]").attr("autocorrect", "off");
	}
	$("#text-input input[type=password]").attr("placeholder", "");
	$("#text-input input[type=text]").attr("placeholder", "");
	if (options.placeholders.text) $("#text-input input[type=text]").attr("placeholder", options.placeholders.text);
	if (options.placeholders.password) $("#text-input input[type=password]").attr("placeholder", options.placeholders.password);
	
	$("#text-input input[type=text], #text-input input[type=password]").val("");
	if (options.text) $("#text-input input[type=text]").val(options.text);
	
	$("#text-prompt").text(prompt);
	$("#text-input h1").text(title);
	textInputCallback = callback;
	
	//setTimeout(function() {
	if (type == 2) {
		$("#text-input input[type=password]").focus();
	} else {
		$("#text-input input[type=text]").focus();
	}
	//}, 600);
	validateTextInput();
	textInputOpen = true;
}

var textInputValid = false;
function validateTextInput() {
	textInputValid = true;
	txt = $("#text-input input[type=text]").val();
	passwd = $("#text-input input[type=password]").val();
	if (textInputMode == 1 || textInputMode == 3) {
		if (!txt) textInputValid = false;
		if (textInputOptions.minLength && textInputOptions.minLength.text) {
			if (txt.length < textInputOptions.minLength.text) textInputValid = false;
		}
	}
	if (textInputMode == 2 || textInputMode == 3) {
		if (textInputOptions.optional && textInputOptions.optional.password) {
			if (textInputOptions.minLength.password && passwd != "") {
				if (passwd.length < textInputOptions.minLength.password) textInputValid = false;
			}
		} else {
			if (!passwd) textInputValid = false;
			if (textInputOptions.minLength && textInputOptions.minLength.password) {
				if (passwd.length < textInputOptions.minLength.password) textInputValid = false;
			}
		}
	}
	if (textInputValid) {
		$("#text-input-submit").removeClass("disabled");
	} else {
		$("#text-input-submit").addClass("disabled");
	}
}

function submitText() {
	if (textInputValid) {
		txt = $("#text-input input[type=text]").val();
		passwd = $("#text-input input[type=password]").val();
		cancelText(true);
		textInputCallback({text: txt, password: passwd});
		return true;
	} else {
		return false;
	}
}


function cancelText(hideOnly) {
	$("#text-input input[type=text], #text-input input[type=password]").blur();
	$("#text-input, #text-input-back-plate").removeClass("visible");
	textInputCloseTimeout = setTimeout(function() {
		$("#text-input, #text-input-back-plate").removeClass("block");
		$("#text-input input[type=text]").val("");
		$("#text-input input[type=password]").val("");
	}, 500);
	if (!hideOnly) {
		textInputCallback();
	}
	textInputOpen = false;
}

function prepareTextInput() {
	$('input').bind('input propertychange', function() {
	    if ($(this).attr("id") == "text-input-plain") validateTextInput();
		if ($(this).attr("id") == "text-input-password") validateTextInput();
	});
}


// UPLOAD FILES

var uploadToExtension = null;
var uploadOptions = null;
var uploadNotifyTimeout;
function uploadFile(options, extension, file) {
	if (file && file.name && uploadToExtension) {
		console.log(file);
		uploadNotifyTimeout = setTimeout(function() {
			// In most cases uploads are so fast there's no point showing a status.
			notify({title: "Uploading file...", icon: "attention", timeout: false}, "uploadFile");
		}, 500);
		fetch(window.location.protocol+"//"+productAddress+"/"+uploadToExtension+"/upload", {
			body: file,
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Disposition": "attachment",
				"fileName": file.name
			}
		}).then(
			function(response) {
				uploadFile();
				if (response.status !== 202) {
					console.log("Extension can't receive files.");
					notify({title: "File upload unsuccesful", message: "This extension is not set up to receive files.", buttonTitle: "Dismiss", buttonAction: "close", timeout: false}, "uploadFile");
				} else {
					console.log("File upload succeeded.");
				}
		    }
		).catch(function(err) {
			console.log('Fetch error when uploading file:', err);
		});
		document.getElementById("file-input").value = "";
	} else if (options && options.title && extension) {
		uploadToExtension = extension;
		uploadOptions = options;
		$("#upload h2").text(options.title);
		if (options.message) {
			$("#upload p").text(options.message).removeClass("hidden");
		} else {
			$("#upload p").addClass("hidden");
		}
		if (options.types) { // Specify file type.
			$("#file-input").attr("accept", options.types.join(","));
		} else {
			$("#file-input").attr("accept", "");
		}
		$("#upload, #upload-back-plate").addClass("block");
		setTimeout(function() {
			$("#upload, #upload-back-plate").addClass("visible");
		}, 150);
	} else {
		$("#upload, #upload-back-plate").removeClass("visible");
		setTimeout(function() {
			$("#upload, #upload-back-plate").removeClass("block");
		}, 500);
		clearTimeout(uploadNotifyTimeout);
		notify(false, "uploadFile");
	}
}


// SUPPORT

// https://stackoverflow.com/questions/359788/how-to-execute-a-javascript-function-when-i-have-its-name-as-a-string
function executeFunction(functionName, args) {
	//var args = Array.prototype.slice.call(arguments, 2);
	namespaces = functionName.split(".");
	func = namespaces.pop();
	context = window;
	for(var i = 0; i < namespaces.length; i++) {
	    context = context[namespaces[i]];
	}
	return context[func].apply(context, args);
}

function functionExists(funcName) {
	namespaces = funcName.split(".");
	if (namespaces.length == 1) {
		if (window[funcName]) {
			return true;
		} else {
			return false;
		}
	} else {
		if (window[namespaces[0]][namespaces[1]]) {
			return true;
		} else {
			return false;
		}
	}
}

// Converts from degrees to radians.
Math.radians = function(degrees) {
	return degrees * Math.PI / 180;
};

Math.distance = function(x1, y1, x2, y2) {
	return Math.sqrt((x2 -= x1) * x2 + (y2 -= y1) * y2);
};


return {
	ask: ask,
	askOption: askOption,
	showPopupView: showPopupView,
	hidePopupView: hidePopupView,
	popupBackplateClick: popupBackplateClick,
	startTextInput: startTextInput,
	submitText: submitText,
	cancelText: cancelText,
	uploadFile: uploadFile,
	executeFunction: executeFunction,
	functionExists: functionExists,
	translatedString: translatedString,
	translatedStringWithFormat: translatedStringWithFormat,
	capitaliseFirst: capitaliseFirst,
	commaAndList: commaAndList,
	showMenuTab: showMenuTab,
	notify: notify,
	restoreState: restoreState,
	setMenuTitle: setMenuTitle,
	showExtension: showExtension,
	showExtensionWithHistory: showExtensionWithHistory,
	showDeepMenu: showDeepMenu,
	toggleMainMenu: toggleMainMenu,
	createMenuItem: createMenuItem,
	createCollectionItem: createCollectionItem,
	setSymbol: setSymbol,
	sendToProductView: sendToProductView,
	setAppearance: setAppearance
}

})();
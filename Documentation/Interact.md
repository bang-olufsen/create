# Interact

*Interact* is a simple way to add custom functionality to a Beocreate 2 system. In essence, the user can connect triggers to actions to automate tasks in a *when this happens, do that* fashion. Interactions are set up through the Interact menu.

This document explains how to add triggers and actions to a Beocreate 2 extension such that they are available through Interact. Creating Beocreate 2 extensions is covered [here](ExtensionsIntroduction.md).

## Basics

Interact triggers and actions can range from simple to complex, but regardless of complexity, below are a few basic things to keep in mind. Examples will be provided later as we get into more detail.

### Synchronous or asynchronous functions

Server-side trigger and action functions can be either synchronous or asynchronous functions. When the Interact engine runs your function, it is run inside an *async* function with an *await* keyword.

If you would like to pass data to the next action in the chain, the function should *return* the value. Callbacks are not supported. Use Promises to write asynchronous functions if you need to wait for any data that needs to be passed on to the next action.

### Triggers *must* return a value

A trigger function must return a value in order to run the actions that are connected to it. A trigger can have user-configurable options that determine whether or not the conditions for running the actions are met.

The value that is returned is not important to the Interact engine, as long as it is not *undefined*. The value that is returned is accessible to all of the actions that are part of the interaction.

### Actions *can* return a value

When your action runs, you can return a value, but this is optional. This value is available to the next action in the chain, which might be useful in some cases. 

If an action in the chain does not return a value, the value that was last returned by a prior action is carried forward.

### Setup is possible but optional

When the user selects your trigger or action, you can either have it added right away, or you can present a dialogue with configurable options. The presentation and logic is up to you to decide.

Once the choices have been confirmed, provide the data to the Interact engine. It will be stored and automatically supplied back to you when the trigger or action runs.

## Defining triggers and actions

### Server side

On the server side, extensions that support Interact must export an *interact* object, containing the trigger and action functions.

The following example shows a condensed version of the Sound extension's *interact* object, exposing one trigger and two actions:

```
interact = {
	triggers: {
			volumeChanged: function(data, interactData) {
				if (!interactData || interactData.option == "any") {
					return data.volume;
				}
				//...
		},
	actions: {
			setVolume: function(interactData, triggerResult, actionResult) {
				switch (interactData.option) {
					case "up":
						setVolume("+2");
						break;
					//...
				}
			},
			mute: function(operation = undefined) {
				mute(operation);
			}
		}
	}
```

The full code can be found under **beo-extensions/sound/index.js**.

Trigger functions can take two arguments:

- **data**: this is the data that was passed to the *runTrigger* function (show later).
- **interactData**: this is the data that was supplied to the Interact engine when the trigger was set up and added.

Action functions can take three arguments:

- **interactData**: similar to the triggers, this is the data that was supplied when the action was set up and added.
- **triggerResult**: contains the value returned by the trigger function.
- **actionResult**: contains the value returned by the previous action (or the last action that did return a value).

*Note:* the variable names are not important, the order matters.

### Client side

On the client side, extensions should return an *interactDictionary* object, containing the client-side listing of the corresponding triggers and actions. This includes their names, custom icons, setup and preview functions. 

In addition, to allow Interact to automatically discover your interactDictionary, make sure to define the *data-namespace* attribute in the *.menu-screen* element of your extension. Client-side code for your extension should be contained within a self-invoked function (so that variables don't "leak" out of it) whose name matches this attribute value. You can see this in action in any of the Beocreate 2 system extensions.

The following example shows the Sound extension's *interactDictionary* object, exposing the triggers and actions to the user interface:

```
interactDictionary = {
	triggers: {
		volumeChanged: {
			name: "Volume Changed", 
			icon: "common/symbols-black/volume.svg", 
			setup: function(data) { interactSetup("volumeChanged", "setup", data) }, 
			preview: function(data) { return interactSetup("volumeChanged", "preview", data) },
			illegalWith: ["actions/sound/setVolume", "actions/sound/mute"]
		}
	},
	actions: {
		setVolume: {
			name: "Set Volume", 
			icon: "common/symbols-black/volume.svg", 
			setup: function(data) { interactSetup("setVolume", "setup", data) }, 
			preview: function(data) { return interactSetup("setVolume", "preview", data) },
			illegalWith: ["triggers/sound/volumeChanged"]
		},
		mute: {
			name: "Mute or Unmute", 
			icon: "common/symbols-black/volume-mute.svg", 
			illegalWith: ["triggers/sound/volumeChanged"]
		}
	}
}
```

This code can be found in **beo-extensions/sound/sound-client.js**.

The triggers and actions are defined as objects, with the following supported properties:

- **name:** the human-readable name of this trigger or action. The only *required* property.
- **icon:** path to a standard-format Beocreate 2 vector mask symbol. If not provided, the icon for your extension will be used. The icon specified for the trigger will become the icon for the interaction in the Interact main menu.
- **setup**: define this function to present the user a setup dialogue when adding the trigger or action. The *data* argument will contain the previously set up options, if the user decides to edit the trigger or action afterwards. If left undefined, the trigger or action is added immediately upon choosing it.
- **preview**: to show a preview text for the trigger or action, return a human-readable string. This is shown under the name of your trigger or action in the interaction editor. The *data* argument contains the previously set up options, which you can use to tailor the preview text so that it is more informative to the user.
- **illegalWith**: specify an array of *other* triggers or actions that this particular trigger or action is not allowed to be used with. The "illegal" triggers or actions will be greyed out in the picker menus. To specify a blocked action, the syntax is `actions/[extensionID]/[actionName]`. To specify a blocked action, the syntax is similarly `triggers/[extensionID]/[triggerName]`. In this example, the volume-related actions aren't allowed to be added with a volume-related trigger, because it might create an infinite loop where the interaction is getting triggered by itself.

## Setup

In this section, we will cover an example of how the "setup experience" for a trigger or action might look and work. 

As mentioned before, the presentation and logic for the user-configurable options are mostly free-form, but you must use the predefined save function to provide the options to Interact once the user is done setting them up.

This process takes place in the **client** side.

### Save functions

When saving a trigger with setup options, use the following function. In this example, we save the *volumeChanged* trigger for the Sound extension.

```
window.interact.saveTrigger(
	"sound", 
	"volumeChanged", 
	{option: volumeOption}
);
```

Saving an action with setup options works in the same way. In this example, we save the *setVolume* action for the Sound extension.

```
window.interact.saveAction(
	"sound", 
	"setVolume", 
	{option: volumeOption, volume: volumeToSet}
);
```

These functions take three arguments:

- an **extension identifier**
- **trigger or action name** (as defined in your extension's *interactDictionary* object)
- **data** can be any form of JavaScript data that your trigger or action understands. This data will be available to you when the trigger or action runs.

### Setup dialogue

The best way to present user with your choices is to use a *beo.ask* dialogue (the *popup view* mechanism is occupied by the interaction editor).

Let's look at a simplified version of the setup for *setVolume* action. Some of this is pseudo-code – you can find the actual code in **beo-extensions/sound/index.html**.

```
<div class="ask-menu" id="set-volume-setup">
	<h2>Set volume</h2>
	<p>When running the action...</p>
	<div id="interact-set-volume-options">
		<div class="menu-item checkmark left" data-option="up" onclick="sound.interactSetup('setVolume', 'option', 'up');">
			<div class="menu-label">Step Volume Up</div>
		</div>
		<div class="menu-item checkmark left" data-option="down" onclick="sound.interactSetup('setVolume', 'option', 'down');">
			<div class="menu-label">Step Volume Down</div>
		</div>
		<div class="menu-item checkmark left" data-option="slider" onclick="sound.interactSetup('setVolume', 'option', 'slider');">
			<div class="menu-label">Set to...</div>
		</div>
	</div>
	<div class="slider-wrap disabled" id="interact-volume-slider-wrap">
		<div class="interact-volume-slider black"></div>
	</div>
	
	<div class="ask-buttons">
		<div class="button pill black default disabled" onclick="sound.interactSetup('setVolume', 'save');">Save Action</div>
		<div class="button pill grey cancel" onclick="beo.ask();">Cancel</div>
	</div>
</div>
```

The buttons in the dialogue call a function in the client-side code to perform the necessary actions. In your code, this can be any function you write. In system extensions such as Sound, any code related to setting up interactions has been centralised into the one *interactSetup* function. A simplified version of this can be seen below:

```
var volumeOption = null;
var volumeToSet = null;
function interactSetup(stage, data = null) {
	switch (stage) {
		case "setup":
			if (data) {
				volumeOption = (data.option) ? data.option : null;
				volumeToSet = (data.volume) ? data.volume : systemVolume;
			} else {
				volumeOption = null;
				volumeToSet = systemVolume;
			}
			$(".interact-volume-slider").slider("value", volumeToSet);
			interactSetup("option", volumeOption); // Function calls the next stage of itself to populate the dialogue with previous or default data.
			$("#sound-set-volume-save").addClass("disabled");
			beo.ask("set-volume-setup");
			break;
		case "option":
			$("#interact-set-volume-options .menu-item").removeClass("checked");
			volumeOption = data;
			if (data) {
				$('#interact-set-volume-options .menu-item[data-option="'+data+'"]').addClass("checked");
				if (data == "slider") {
					$("#interact-volume-slider-wrap").removeClass("disabled");
				} else {
					$("#interact-volume-slider-wrap").addClass("disabled");
				}
				$("#sound-set-volume-save").removeClass("disabled");
			} else {
				$("#interact-volume-slider-wrap").addClass("disabled");
				$("#sound-set-volume-save").addClass("disabled");
			}
			break;
		case "set":
			volumeToSet = data;
			$("#sound-set-volume-save").removeClass("disabled");
			break;
		case "save":
			beo.ask();
			window.interact.saveAction("sound", "setVolume", {option: volumeOption, volume: volumeToSet}); // Saving the action.
			break;
		case "preview":
			if (data.option == "up") return "Step volume up";
			if (data.option == "down") return "Step volume down";
			if (data.option == "slider") return "Set to "+data.volume+" %";
			break;
	}
}
```

The function uses a switch statement to separate its different features. Note how the *save* stage calls the built-in *saveAction* function from the Interact engine to save the settings and add the action to the interaction. Data is temporarily held in two variables before it's saved.

Not shown is the code that interfaces with the slider and calls the "option" stage of the setup function to set a volume value.

At the end you can see the *preview* function that generates a helpful preview string that's shown in the interaction editor.

As stated, it's up to you to decide what kind of code works best for your setup steps as long as you tie into the standard save functions and list the calls to your own functions in the Interact dictionary.

## Triggering an interaction

Triggering an interaction is easy. An interaction kicks off when an extension calls the *runTrigger* function in the Interact engine:

```
if (beo.extensions.interact) beo.extensions.interact.runTrigger(
	"sound", 
	"volumeChanged", 
	{volume: newVolume, up: (newVolume > systemVolume)}
);
```

The function takes three arguments: 

- an **extension identifier**
- **trigger name** (as defined in your extension's *interact* object)
- **data** that you want to pass to the trigger (for example, to check whether or not the actions should run).

In the above example, the Sound extension runs its trigger for changing volume (*volumeChanged*), providing data for the trigger to check how the volume has changed (which will determine whether or not the actions should run).

Always check for the existence of the Interact extension when running the trigger.

*Note:* You do not need to (and can't) check if there's an interaction that uses your trigger. Always call the *runTrigger* function at a moment that's appropriate for you, and Interact engine will do the rest for you.
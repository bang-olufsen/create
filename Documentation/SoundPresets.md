# Sound Presets

Beocreate 2 integrates with *Beocreate 4-Channel Amplifier*, which contains a flexible and powerful *DSP* (digital signal processor) for customising the sound signature of the system.

Sound presets are collections of sound adjustment settings that can be applied at once, instantly. Presets can be imported right in the user interface (Sound > Sound Preset > Import Preset). In this document we cover how the presets work and how they can be created.

### New in Beocreate 2

In Beocreate 2, sound presets (previously called *sound profiles*) are now separated from DSP programs for greater flexibility:

1. A DSP program determines the sound processing flow and which sound adjustment features are available.
2. A sound preset contains the actual settings that are dynamically applied to the DSP program (equaliser and crossover parameters, levels, delays, ...).


## Data Format: JSON

In essence, sound presets are JSON files. The following is an example of a valid, although nonsensical, sound preset file:

	{
		"sound-preset": {
			"presetName": "Beovox CX 50",
			"productIdentity": "beovox-cx50",
			"fallbackDSP": "beocreate-universal",
			"samplingRate": 48000
		},
		"equaliser": {
			"a": [{"type": "highPass", "frequency": 1000}],
			"b": [{"type": "peak", "frequency": 1000, "Q": 0.7, "gain": 2}],
			"c": [{"type": "highShelf", "frequency": 1000, "Q": 0.5}],
			"d": [{"b0": 0.933897197830, "b1": -1.247919091952, "b2": 0.678131896299, "a1": -1.366776677313, "a2": 0.731535942794}]
		},
		"channels": {
			"a": {
				"level": 100,
				"enabled": true,
				"role": "mono"
			},
			"b": {
				"level": 100,
				"enabled": true,
				"role": "left",
				"delay": 3
			},
			"c": {
				"level": 80,
				"enabled": true,
				"role": "side"
			},
			"d": {
				"enabled": false
			}
		}
	}

The file has been divided into three top-level items: **sound-preset**, **equaliser** and **channels**. Each of these correspond to different *extensions* in Beocreate 2, which will handle the settings when previewing and applying the preset.

*Note:* These settings are currently supported by the default Beocreate 2 extensions and Beocreate Universal DSP program. Other extensions and DSP programs can add support for more settings.


## File Name + Preset Name

Presets have two different names: 

- *file name*: used in the file system, always unique
- *preset name*: the visible, "nice" name shown in the user interface

Both names are required. File names always need to be unique, because two files can't have the same name in the same folder. Whilst preset names do not have such a requirement, unique names are recommended to tell presets apart in the user interface.

Preset name should be embedded in the *sound-preset* section of the file as *presetName* property, such as in the example.


## Supported Sections and Settings

Next, we will cover the different sections and possible settings of a preset in detail. Required settings in each section are indicated as such, others are optional.


## sound-preset

This is the only ***required section***. It stores basic information about the sound preset, listed below.

#### Preset Name

	"presetName": "Beovox CX 50"

**Required.** The name of the preset shown in the user interface.

#### Product Identity

	"productIdentity": "beovox-cx50"

The identifier of a "product identity", that may contain information such as model name, manufacturer, designer, manufacturing years and a product image. Several product identities are included in Beocreate 2. Define this property to use a standalone product identity or an identity from another sound preset.

For more information on product identities, refer to [this document](ProductIdentities.md).

#### Fallback DSP Program

	"fallbackDSP": "beocreate-universal"

If the current DSP program doesn't support all of the settings in the preset, install the DSP program with this file name, if it is available on the system. For all default sound presets, this is "beocreate-universal". Other presets can use it as well if suitable.

#### Sampling Rate

	"samplingRate": 48000

*Required in some cases*. The value is in Hz.

If the sound preset contains filters defined as coefficients directly (explained later), the sampling rate has to be defined so that it can be matched with the DSP program. If not defined, those filters will be ignored. The sampling rate can also be defined with each filter, but this is an easier way.

#### Read-only

	"readOnly": false

Read-only sound presets can't be deleted or replaced from the user interface.

#### Preset Version

	"presetVersion": 1

Integer version number of the preset. For future use.


## equaliser

Settings for the parametric equaliser in the DSP program, intended for correcting the loudspeaker's magnitude response. This section is further subdivided into up to four channels as follows:

	"equaliser": {
		"a": [],
		"b": [],
		"c": [],
		"d": []
	}
	
*Note:* each channel is an *array*, not an object.

Channels A-D correspond to the speaker terminals on Beocreate 4-Channel Amplifier from **left to right**, when the terminals are facing you.

Within each channel the individual filters and their parameters can be defined. The amount of filters is limited by the DSP program. For example, Beocreate Universal supports up to 16 filters per channel. If the number of filters supported is less than is defined, the overflowing filters are ignored.

Leaving channels blank like above will bypass all of the filters on the channels. If a channel is not included, its settings will not be altered when the preset is applied. This is not recommended, as it might cause an undesired mix of settings – it is always better to bypass the filters on a channel.

The following filter types are supported:

- peak/dip
- high/low pass
- high/low shelf
- coefficients

You can find in-depth explanations for the different filter types [here](https://www.tonmeister.ca/wordpress/2018/02/06/bo-tech-a-very-brief-introduction-to-parametric-equalisation/). They can be mixed and matched in any combination to shape the sound as desired.

#### Peak or Dip

	{"type": "peak", "frequency": 1000, "Q": 0.7, "gain": 2}
	
A peak or dip filter either amplifies or attenuates sound at and around the centre frequency. *Note:* in both cases, the filter type is specified as *peak*.

- *frequency:* centre frequency of the filter in Hz. **Required.**
- *Q:* the "sharpness" of the filter – the higher the value, the narrower the bandwidth of the filter. **Required.**
- *gain:* the amplification (positive value) or attenuation (negative value) of the filter in dB. **Required.**

If all of these parameters aren't defined, the filter will be bypassed. The filter is a single-precision, 2nd-order filter.

#### High/Low Pass

	{"type": "highPass", "frequency": 1000}
	
Cuts sound above (*lowPass*) or below (*highPass*) the cutoff frequency, letting others pass. Ideal for creating simple crossovers.

- *frequency:* cutoff frequency of the filter in Hz. **Required.**
- *Q:* by default the filter is a 2nd-order Butterwork filter (12 dB/octave). Define Q to customise the filter.

*Tip:* you can create steeper filters by adding (*cascading*) more high-pass or low-pass filters to the same channel. For example, to achieve a 4th-order Linkwitz-Riley (24 dB/octave) filter, add two filters with the default Q at the same frequency.

#### High/Low Shelf

	{"type": "lowShelf", "frequency": 1000, "Q": 0.7, "gain": 2}

Boosts or attenuates sound above (*highShelf*) or below (*lowShelf*) the centre frequency. For example, the *ToneTouch* feature uses high and low shelf filters to adjust bass and treble.
	
- *frequency:* centre frequency of the filter in Hz. **Required.**
- *Q:* the "sharpness" of the filter – the higher the value, the steeper the "edge" of the shelf. **Required.**
- *gain:* the amplification (positive value) or attenuation (negative value) of the filter in dB. **Required.**

If all of these parameters aren't defined, the filter will be bypassed.

#### Coefficients

	{"b0": 0.933897197830, 
	 "b1": -1.247919091952, 
	 "b2": 0.678131896299, 
	 "a1": -1.366776677313, 
	 "a2": 0.731535942794,
	 "samplingRate": 48000}

For advanced, entirely custom filters, the filter coefficients can be defined directly.

The **required** parameters are the coefficients: *b0, b1, b2, a1, a2*. The system assumes a0 to be 1 and thus it can't be defined.

The coefficients have to be calculated against the *sampling rate* of the DSP program (48 kHz for Beocreate Universal). The sampling rate these filters are intended for should be indicated in the *sound-preset* section (see earlier) **or** with each filter, next to the coefficients (such as here). 

A missing sampling rate is not fatal, but the filter may sound different than expected. A warning will display in Speaker Equaliser interface.


## channels

Contains other sound settings related to each loudspeaker channel. This section is further subdivided into up to four channels as follows:

	"channels": {
		"a": {},
		"b": {},
		"c": {},
		"d": {}
	}
	
*Note:* each channel is an *object*, unlike in the *equaliser* section.

Channels A-D correspond to the speaker terminals on Beocreate 4-Channel Amplifier from **left to right**, when the terminals are facing you.

Within each channel, certain settings can be defined. Any settings that are not defined will not be altered when the preset is applied. It is recommended to always define settings that need to be consistent and known.

The following settings are supported for each channel:

- Mute/unmute (enabled)
- Role
- Level
- Delay
- Invert polarity

#### Mute/Unmute

A simple "is this channel playing" setting. If set to *false*, the *level* setting will have no effect.

	"enabled": true
	
Possible values are: *true* or *false*.

#### Role

Defines the signal played by the channel.

	"role": "left"
	
The possible roles are determined by the DSP program. Beocreate Universal supports:

- *left*
- *right*
- *mono* (left added to right)
- *side* (right substracted from left)

#### Level

Volume of this channel relative to the input signal.

	"level": -1.3
	
The level can be defined as:

- integer volume level in the range of 1–100
- attenuation in dB, like in the example. 0 is full volume.

*Tip:* for best sound quality, level should be set to 0 or 100 (full volume) unless some channels need to be quieter than others. In this case, only attenuate the channels that need it.

*Note:* this setting does *not* override the *master volume* and *volume limit* settings available in the user interface, but is applied in addition to them.

#### Delay

For time-aligning loudspeaker drivers, delays can be specified for each channel.

	"delay": 3
	
Delays are defined in *milliseconds*. You can use non-integer values for more precision.

Internally, the system converts the specified milliseconds to number of *samples* based on the current sampling rate, rounding the amount of samples to the nearest integer.

The maximum delay times are defined by the DSP program. For Beocreate Universal, this is about **41.6 milliseconds** (2000 samples at the 48 kHz sampling rate). If you define a value that exceeds the maximum delay time, the system will apply the maximum delay.

It is recommended to only delay the channels that require it.

#### Invert Polarity

For some crossover configurations (such as 2nd-order), it may be necessary to invert the *polarity* of a channel to avoid cancellation of sound at the crossover frequency.

	"invert": false
	
Possible values are: *true* or *false*.

*Tip:* although it is recommended to always ensure proper polarity when wiring up the loudspeakers, this setting can be used to "fix" or test for incorrect polarity of a loudspeaker driver.


## Product Identities

The purpose and structure of product identities are covered [here](ProductIdentities.md). Product identities can be embedded in sound presets by adding a *product-information* section and defining the same properties there:

	"product-information": {
		"modelID": "beovox-cx50",
		"modelName": "Beovox CX 50",
		...
	}
	
The product identities in sound presets will be discovered and made available in the system, for the user to choose or even for other sound presets to use.
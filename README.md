![CreateLogo](https://image.ibb.co/nfT01G/create_logo_two.png)

***Create*** *is an explorative movement within Bang & Olufsen. Our mission is to inspire and be inspired by the global creative community.*

# Beocreate 2

***Beocreate 2*** is the software suite for *Beocreate 4-Channel Amplifier*. It replaces the old setup tool and system software shipped with the *ReCreate* project in 2018. It has been redesigned from the ground up to be more flexible, more reliable and future-proof. 

***Beocreate Connect*** is a new companion application (for Mac + Windows) that automatically and instantly discovers all Beocreate 2 sound systems on the network, without typing a single IP address.

Beocreate 2 is bundled with [HiFiBerryOS](https://github.com/hifiberry/hifiberry-os) as its official user interface. On systems that use other HiFiBerry sound cards, the user interface carries HiFiBerry branding.

## Main Features

- A flexible front-end for Beocreate 4-Channel Amplifier and other HiFiBerry sound cards.
- Upcycle vintage Bang & Olufsen speakers or build your own, custom sound system.
- Beautifully crafted, responsive, browser-based user interface that works within the local network. Dark mode is supported.
- Customise the sound with ToneTouch. More sound adjustment features coming later.
- Volume and playback controls for active sources (feat. [HiFiBerry AudioControl](https://github.com/hifiberry/audiocontrol2)).
- Better overview and control of sources.
- Smarter management of network connections.
- Extension architecture for easy expandability and future-proofing.
- Based on Node.js.

## Getting Started

### Beocreate 2

As Beocreate 2 is part of HiFiBerryOS, the recommended way is to download the latest image of HiFiBerryOS for your Raspberry Pi generation and write it to a microSD card. [Get HiFiBerryOS](https://www.hifiberry.com/hifiberryos/)

Alternatively, you can use the Buildroot system to build HiFiBerryOS yourself. [Building HiFiBerryOS](https://github.com/hifiberry/hifiberry-os/blob/master/doc/building.md)

Once installed, you can follow instructions in Beocreate Connect set up the sound system.

### Beocreate Connect

Beocreate Connect is based on Electron, and you can run it using the following instructions:

1. [Install Node.js](https://nodejs.org/en/) on your Mac or Windows computer.
2. Clone or download the *bang-olufsen/create* repository.
3. In your terminal application, navigate to the *BeocreateConnect* folder and run `npm install` to download and install Electron and other dependencies.
4. Once installed, type `npm start` to start Beocreate Connect.

## Help

- [Find Your Product](Help/FindYourProduct.md)

## Documentation

We're working to add documentation for Beocreate 2 to make it easier to tap into its expandability.

### Extensions

Design and develop extensions to expand the functionality of the system.

- [Introduction to Extensions](Documentation/ExtensionsIntroduction.md)
- [Implementing Server-side Code](Documentation/ExtensionsServer.md)
- Implementing User Interface

### Sound & Customisation

Create sound presets, DSP programs and product identities to customise the sound system.

- [Sound Presets](Documentation/SoundPresets.md)
- DSP Programs.
- [Product Identities](Documentation/ProductIdentities.md)

### Design

Guidelines and best practices for design within Beocreate 2 ecosystem.

- [Beocreate 2 Design Guidelines](Documentation/DesignGuidelines.md)


## Known Issues

Some issues in the current release that aren't acknowledged in the user interface:

(No current issues)


## Legacy Code

The original code for the project (SigmaTCPDaemon, SigmaClientTool Beocreate Server and the bang-olufsen.com-based setup tool) has been archived under the [beocreate1](https://github.com/bang-olufsen/create/tree/beocreate1) branch.

The old DSP programs are in the *Speakers* directory, but please note that these aren't fully compatible with Beocreate 2. Beocreate 2 comes built in with the sound presets for these models.
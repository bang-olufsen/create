![CreateLogo](https://image.ibb.co/nfT01G/create_logo_two.png)

***Create*** *is an explorative movement within Bang & Olufsen. Our mission is to inspire and be inspired by the global creative community.*

# Beocreate 2

***Beocreate 2*** is the software suite for *Beocreate 4-Channel Amplifier*. It replaces the old setup tool and system software shipped with the *ReCreate* project in 2018. It has been redesigned from the ground up to be more flexible, more reliable and future-proof. 

***Beocreate Connect*** is a new companion application (for Mac + Windows) that automatically and instantly discovers all Beocreate 2 sound systems on the network, without typing a single IP address.

Beocreate 2 is a part of [HiFiBerryOS](https://github.com/hifiberry/hifiberry-os). On systems that do not use *Beocreate 4-Channel Amplifier*, the user interface carries HiFiBerry branding.

## Main Features

- A flexible front-end for Beocreate 4-Channel Amplifier and other HiFiBerry sound cards.
- Upcycle vintage Bang & Olufsen speakers or build your own, custom sound system
- Beautifully crafted, responsive (also supports dark mode), browser-based user interface that works within the local network
- New suite of sound adjustments (work in progress)
- Volume and playback controls for active sources (feat. [HiFiBerry AudioControl](https://github.com/hifiberry/audiocontrol2))
- Better overview and control of sources
- Smarter management of network connections
- Extension architecture for easy expandability and future-proofing
- Based on Node.js

## Getting Started

### Beocreate 2

As Beocreate 2 is part of HiFiBerryOS, the recommended way is to download the latest image of HiFiBerryOS for your Raspberry Pi generation and write it to a microSD card. [Link to download page here]

Alternatively, you can use the Buildroot system to build HiFiBerryOS yourself. [Link to instructions here]

Once installed, you can follow instructions in Beocreate Connect set up the sound system.

### Beocreate Connect

Beocreate Connect is based on Electron, and you can run it using the following instructions:

1. [Install Node.js](https://nodejs.org/en/) on your Mac or Windows computer.
2. Clone or download the *bang-olufsen/create* repository.
3. In your terminal application, navigate to the *BeocreateConnect* folder and run `npm install` to download and install Electron and other dependencies.
4. Once installed, type `npm start` to start Beocreate Connect.


## Documentation

### Extensions

Design and develop extensions.

- Getting Started with Extensions

### Sound

Create sound presets and DSP programs.

- [Sound Presets](Documentation/Sound Presets.md)

### Design

Guidelines and best practices for user interfaces and graphic design within Beocreate 2 ecosystem.

- [Beocreate 2 Design Guidelines](Documentation/Design Guidelines.md)


## Legacy Code

The original code for the project (SigmaTCPDaemon, SigmaClientTool Beocreate Server and the bang-olufsen.com-based setup tool) have been archived under the *beocreate1* branch.

The old DSP programs are in the *Speakers* directory, but please note that these aren't fully compatible with Beocreate 2. Beocreate 2 comes built in with the sound presets for these models.
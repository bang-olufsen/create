![CreateLogo](https://image.ibb.co/nfT01G/create_logo_two.png)

# What it is
The repository contains the software that is intended to run on a Raspberry Pi connected to the HifiBerry/BeoCreate 4-channel amplifier for upcycling vintage speakers. It currently consists of two different modules allowing communication and programming of the ADAU1451 DSP from the Raspberry Pi. 

## SigmaTcpDaemon
This is a program written in C++11 that runs a TCP server which enables connecting from Sigma Studio running on any PC on the same network and program or adjust DSP parameters. The server implements the communication protocol specified by Analog Devices which can be found [here](https://wiki.analog.com/resources/tools-software/sigmastudio/usingsigmastudio/tcpipchannels) and communicates with the DSP chip using the SPI interface of the Raspberry Pi.

## SigmaClientTool
This is a simple command-line tool intended primarily for debugging and writing the DSP EEPROM. It is depending on a running SigmaTcpDaemon instance which it will connect to and allow to read/write registers and also write to the EEPROM.

# Building
Clone this repository and build with CMake. For SigmaTcpDaemon:
```
git clone https://github.com/bang-olufsen/create.git
cd create/SigmaTcpDaemon
mkdir build && cd build
cmake ..
make
```

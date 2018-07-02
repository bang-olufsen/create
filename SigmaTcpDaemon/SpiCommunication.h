/*Copyright 2017 Bang & Olufsen A/S

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

#pragma once

#include "HwCommunicationIF.h"
#include <string>
#include <linux/spi/spidev.h>

#include <linux/types.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <fcntl.h>
#include <stdlib.h>
#include <cstring>
#include <vector>

//! @class SpiCommunication
//! @brief This class implements a simple interface for reading/writing the SPI bus used to communicate with the ADAU 1451 DSP
class SpiCommunication : public HwCommunicationIF {
public:
	SpiCommunication();
	~SpiCommunication();

	//!@brief Initializes the SPI device on the provided path. This method must be called before doing any I/O operations 
	//!@param devPath The system path to the SPI device
	void Initialize(std::string devPath);

	//!@brief Read a number of bytes from the SPI bus at a given address.
	//!@param addr The address to read from
	//!@param len The number of bytes to read
	//!@param data Buffer to store the read data. It is assumed that this is large enough to contain the data.
	int Read(unsigned int addr, unsigned int len, uint8_t *data);

	//!@brief Write a number of bytes to the SPI bus at a given address.
	//!@param addr The address to write to
	//!@param len The number of bytes to write
	//!@param data Buffer containing the data to write
	int Write(unsigned int addr, unsigned int len, const uint8_t *data);

private:
	int m_spiFd;
	struct spi_ioc_transfer m_xferSettings[2];
	std::vector<uint8_t> m_readCmdBuffer;
	std::vector<uint8_t> m_readOutputBuffer;
};
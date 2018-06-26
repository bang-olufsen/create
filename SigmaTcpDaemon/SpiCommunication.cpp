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

#include "SpiCommunication.h"
#include <stdexcept>
#include <vector>

#define XFER_WR_INDEX 0
#define XFER_RD_INDEX 1

const int CommandHeaderSize = 3;

SpiCommunication::SpiCommunication() :
m_spiFd(-1)
{
	memset(&m_xferSettings[XFER_WR_INDEX], 0, sizeof(spi_ioc_transfer));
	memset(&m_xferSettings[XFER_RD_INDEX], 0, sizeof(spi_ioc_transfer));
}

SpiCommunication::~SpiCommunication()
{
}

void SpiCommunication::Initialize(std::string devPath)
{
	unsigned char mode, lsb, bits;
	unsigned int speedWr = 100000, speedRd = 100000;

	m_spiFd = open(devPath.c_str(), O_RDWR);
	if (m_spiFd < 0)
	{
		throw std::domain_error("Failed to open SPI device");
	}

	if (ioctl(m_spiFd, SPI_IOC_RD_MODE, &mode) < 0)
	{
		throw std::domain_error("Failed SPI readmode");
	}

	if (ioctl(m_spiFd, SPI_IOC_RD_LSB_FIRST, &lsb) < 0)
	{
		throw std::domain_error("Failed SPI LSB_FIRST");
	}

	if (ioctl(m_spiFd, SPI_IOC_RD_BITS_PER_WORD, &bits) < 0)
	{
		throw std::domain_error("Failed SPI BITS_PER_WORD");
	}

	if (ioctl(m_spiFd, SPI_IOC_RD_MAX_SPEED_HZ, &speedRd) < 0)
	{
		throw std::domain_error("Failed SPI RD_MAX_SPEED_HZ");
	}

	if (ioctl(m_spiFd, SPI_IOC_WR_MAX_SPEED_HZ, &speedWr) < 0)
	{
		throw std::domain_error("Failed SPI WR_MAX_SPEED_HZ");
	}

	m_xferSettings[XFER_WR_INDEX].len = 3;  //Length of  command to write
	m_xferSettings[XFER_WR_INDEX].cs_change = 0;
	m_xferSettings[XFER_WR_INDEX].delay_usecs = 0;
	m_xferSettings[XFER_WR_INDEX].speed_hz = speedWr;
	m_xferSettings[XFER_WR_INDEX].bits_per_word = 8; 

	m_xferSettings[XFER_RD_INDEX].len = 2;  //Length of Data to read
	m_xferSettings[XFER_RD_INDEX].cs_change = 0;
	m_xferSettings[XFER_RD_INDEX].delay_usecs = 0;
	m_xferSettings[XFER_RD_INDEX].speed_hz = speedRd;
	m_xferSettings[XFER_RD_INDEX].bits_per_word = 8;
}


int SpiCommunication::Read(unsigned int addr, unsigned int len, uint8_t *data)
{
	const int SpiReadCmdHeaderValue = 0x01;
	int status;
	std::vector<uint8_t> readCmdBuffer(CommandHeaderSize + len, 0);
	std::vector<uint8_t> readOutputBuffer(CommandHeaderSize + len, 0);

	readCmdBuffer[0] = SpiReadCmdHeaderValue;
	readCmdBuffer[1] = (char) (addr >> 8);
	readCmdBuffer[2] = addr & 0xFF;
	m_xferSettings[XFER_WR_INDEX].tx_buf = (unsigned long)readCmdBuffer.data();
	m_xferSettings[XFER_WR_INDEX].len = CommandHeaderSize + len; // Length of  command to write
	m_xferSettings[XFER_WR_INDEX].rx_buf = (unsigned long)readOutputBuffer.data();
	m_xferSettings[XFER_WR_INDEX].len = CommandHeaderSize + len; //Length of Data to read 
	status = ioctl(m_spiFd, SPI_IOC_MESSAGE(1), m_xferSettings);

	if (status < 0) 
	{
		throw std::domain_error("Failed SPI_IOC_MESSAGE read error" + errno);
	}

	memcpy(data, readOutputBuffer.data() + CommandHeaderSize, len);
	
	return status;
}

int SpiCommunication::Write(unsigned int addr, unsigned int len, const uint8_t *data)
{
	const int SpiWriteCmdHeaderValue = 0x00;
	const int MaxBlockSizeWrite = 1024*3;
	char write_buf[MaxBlockSizeWrite + CommandHeaderSize] = { 0 };

	int  currentBlockSize = 0;
	int loopCount = len / MaxBlockSizeWrite;

	for (int i = 0; i <= loopCount; i++)
	{
		addr += (i*MaxBlockSizeWrite);
		write_buf[0] = SpiWriteCmdHeaderValue;
		write_buf[1] = (char) (addr >> 8);
		write_buf[2] = addr & 0xFF;

		if (i == loopCount) 
		{
			currentBlockSize = len % MaxBlockSizeWrite;
		}
		else 
		{
			currentBlockSize = MaxBlockSizeWrite;
		}

		if (currentBlockSize == 0)
		{
			//We are done
			break;
		}

		memcpy(&write_buf[CommandHeaderSize], data + (i*MaxBlockSizeWrite), currentBlockSize);

		m_xferSettings[XFER_WR_INDEX].tx_buf = (unsigned long)write_buf;
		m_xferSettings[XFER_WR_INDEX].len = currentBlockSize + CommandHeaderSize; // Length of  command to write
		int status = ioctl(m_spiFd, SPI_IOC_MESSAGE(1), m_xferSettings);

		if (status < 0) 
		{
			throw std::domain_error("Failed SPI_IOC_MESSAGE write error " + errno);
		}
	}

	return len;
}

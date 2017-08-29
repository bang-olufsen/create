#include "SpiCommunication.h"
#include <stdexcept>

#define XFER_WR_INDEX 0
#define XFER_RD_INDEX 1


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
	unsigned int speed = 100000;

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

	if (ioctl(m_spiFd, SPI_IOC_RD_MAX_SPEED_HZ, &speed) < 0)
	{
		throw std::domain_error("Failed SPI RD_MAX_SPEED_HZ");
	}

	if (ioctl(m_spiFd, SPI_IOC_WR_MAX_SPEED_HZ, &speed) < 0)
	{
		throw std::domain_error("Failed SPI WR_MAX_SPEED_HZ");
	}

	m_xferSettings[XFER_WR_INDEX].len = 3;  //Length of  command to write
	m_xferSettings[XFER_WR_INDEX].cs_change = 0;
	m_xferSettings[XFER_WR_INDEX].delay_usecs = 0;
	m_xferSettings[XFER_WR_INDEX].speed_hz = speed; 
	m_xferSettings[XFER_WR_INDEX].bits_per_word = 8; 

	m_xferSettings[XFER_RD_INDEX].len = 2;  //Length of Data to read
	m_xferSettings[XFER_RD_INDEX].cs_change = 0;
	m_xferSettings[XFER_RD_INDEX].delay_usecs = 0;
	m_xferSettings[XFER_RD_INDEX].speed_hz = speed;
	m_xferSettings[XFER_RD_INDEX].bits_per_word = 8;
}


int SpiCommunication::Read(unsigned int addr, unsigned int len, uint8_t *data)
{
	const int SpiReadCmdHeaderValue = 0x01;
	int status;
	char readCmdBuffer[3] = { 0 };

	readCmdBuffer[0] = SpiReadCmdHeaderValue;
	readCmdBuffer[1] = (char) (addr >> 8);
	readCmdBuffer[2] = addr & 0xFF;
	m_xferSettings[XFER_WR_INDEX].tx_buf = (unsigned long)readCmdBuffer;
	m_xferSettings[XFER_WR_INDEX].len = 3; // Length of  command to write
	m_xferSettings[XFER_RD_INDEX].rx_buf = (unsigned long)data;
	m_xferSettings[XFER_RD_INDEX].len = len; //Length of Data to read 
	status = ioctl(m_spiFd, SPI_IOC_MESSAGE(2), m_xferSettings);
	if (status < 0) {
		throw std::domain_error("Failed SPI_IOC_MESSAGE read error" + errno);
	}

	return status;
}

int SpiCommunication::Write(unsigned int addr, unsigned int len, const uint8_t *data)
{
	const int SpiWriteCmdHeaderValue = 0x00;
	const int MaxBlockSizeWrite = 1024;
	char write_buf[MaxBlockSizeWrite] = { 0 };

	int  currentBlockSize = 0;
	int loopCount = len / MaxBlockSizeWrite;

	for (int i = 0; i <= loopCount; i++)
	{
		addr += (i*MaxBlockSizeWrite);
		write_buf[0] = SpiWriteCmdHeaderValue;
		write_buf[1] = (char) (addr >> 8);
		write_buf[2] = addr & 0xFF;

		if (i == loopCount) {
			currentBlockSize = len % MaxBlockSizeWrite;
		}
		else {
			currentBlockSize = MaxBlockSizeWrite;
		}

		if (currentBlockSize == 0)
		{
			//We are done
			break;
		}

		memcpy(&write_buf[3], data + (i*MaxBlockSizeWrite), currentBlockSize);

		m_xferSettings[XFER_WR_INDEX].tx_buf = (unsigned long)write_buf;
		m_xferSettings[XFER_WR_INDEX].len = currentBlockSize + 3; // Length of  command to write
		int status = ioctl(m_spiFd, SPI_IOC_MESSAGE(1), m_xferSettings);

		if (status < 0) {
			throw std::domain_error("Failed SPI_IOC_MESSAGE write error " + errno);
		}
	}

	return len;
}

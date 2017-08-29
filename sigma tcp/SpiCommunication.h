#pragma once

#include "HwCommunicationIF.h"
#include <string>
#include <linux/spi/spidev.h>
#include <linux/types.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <fcntl.h>
#include <stdio.h>
#include <error.h>
#include <string.h>
#include <stdint.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <getopt.h>

class SpiCommunication : public HwCommunicationIF {
public:
	SpiCommunication();
	~SpiCommunication();

	void Initialize(std::string devPath);
	int Read(unsigned int addr, unsigned int len, uint8_t *data);
	int Write(unsigned int addr, unsigned int len, const uint8_t *data);

private:
	int m_spiFd;
	struct spi_ioc_transfer m_xferSettings[2];
};
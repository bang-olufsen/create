#pragma once
#include <stdint.h>

class HwCommunicationIF {
public:
	virtual int Read(unsigned int addr, unsigned int len, uint8_t *data) = 0;
	virtual int Write(unsigned int addr, unsigned int len, const uint8_t *data) = 0;
};
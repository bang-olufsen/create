#pragma once
#include <cstdint>

const int MaxReadSize = 1024;

typedef struct SigmaReadResponse
{
	uint16_t addr;
	uint16_t length;
	uint8_t data[MaxReadSize];
} SigmaReadResponse;

const char SigmaCommandReadCode = 0x0a;
const char SigmaCommandWriteCode = 0x0b;

const unsigned int SigmaCommandHeaderSize = 14;

const uint16_t SigmaServerPortNumber = 8086;
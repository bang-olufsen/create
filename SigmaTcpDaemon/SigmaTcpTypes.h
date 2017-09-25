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
#include <stdint.h>

const char CommandReadSuccess = 0x00;
const char CommandReadFailure = 0x01;

const char CommandRead = 0x0A;
const char CommandReadResponse = 0x0B;
const char CommandWrite = 0x09;

#pragma pack(push, 1)
typedef struct SigmaTcpReadRequest
{
	uint8_t controlValue = CommandRead;
	uint8_t totalLength3 = 0;
	uint8_t totalLength2 = 0;
	uint8_t totalLength1 = 0;
	uint8_t totalLength0 = 0;
	uint8_t chipAddress = 0;
	uint8_t dataLength3 = 0;
	uint8_t dataLength2 = 0;
	uint8_t dataLength1 = 0;
	uint8_t dataLength0 = 0;
	uint8_t addressHigh = 0;
	uint8_t addressLow = 0;
	uint8_t reserved[2] = {0};
} SigmaTcpReadRequest;
#pragma pack(pop)

#pragma pack(push, 1)
typedef struct SigmaTcpReadResponse
{
	uint8_t controlValue = CommandReadResponse;
	uint8_t totalLength3 = 0;
	uint8_t totalLength2 = 0;
	uint8_t totalLength1 = 0;
	uint8_t totalLength0 = 0;
	uint8_t chipAddress = 0;
	uint8_t dataLength3 = 0;
	uint8_t dataLength2 = 0;
	uint8_t dataLength1 = 0;
	uint8_t dataLength0 = 0;
	uint8_t addressHigh = 0;
	uint8_t addressLow = 0;
	uint8_t successFailure = 1;
	uint8_t reserved = 0x00;
} SigmaTcpReadResponse;
#pragma pack(pop)

#pragma pack(push, 1)
typedef struct SigmaTcpWriteRequest
{
	uint8_t controlValue = CommandWrite;
	uint8_t blockSafeload = 0;
	uint8_t channelNumber = 0;
	uint8_t totalLength3 = 0;
	uint8_t totalLength2 = 0;
	uint8_t totalLength1 = 0;
	uint8_t totalLength0 = 0;
	uint8_t chipAddress = 0;
	uint8_t dataLength3 = 0;
	uint8_t dataLength2 = 0;
	uint8_t dataLength1 = 0;
	uint8_t dataLength0 = 0;
	uint8_t addressHigh = 0;
	uint8_t addressLow = 0;
} SigmaTcpWriteRequest;
#pragma pack(pop)
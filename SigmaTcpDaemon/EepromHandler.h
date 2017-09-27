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

class EepromHandler {
public:
	EepromHandler();
	~EepromHandler();

	//!@brief Initializes the class with the required initialization data. Must be done before writing to EEPROM
	//!@param hwCommunicationIF The hardware interface to use for reading/writing data to/from DSP
	void Initialize(HwCommunicationIF* hwCommunicationIF);

	//!@brief Parses an XML sequence data document exported from SigmaStudio and writes the sequence data to DSP
	//!@param path The full path to the XML file
	//!@return true if the operation was successful
	bool WriteFromXml(std::string path);
private:
	HwCommunicationIF* m_hwIf;
};
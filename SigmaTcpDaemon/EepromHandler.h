#pragma once
#include "HwCommunicationIF.h"

class EepromHandler {
public:
	EepromHandler();
	~EepromHandler();

	void Initialize(HwCommunicationIF* hwCommunicationIF);

	void WriteDefualtEeprom();
private:
	HwCommunicationIF* m_hwIf;
};
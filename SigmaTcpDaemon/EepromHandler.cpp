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

#include "EepromHandler.h"
#include "TinyXML/tinyxml2.h"
#include <unistd.h>
#include <string>
#include <vector>
#include <iostream>
#include <sstream>

EepromHandler::EepromHandler() :
m_hwIf(nullptr)
{
}

EepromHandler::~EepromHandler()
{
}

void EepromHandler::Initialize(HwCommunicationIF* hwCommunicationIF)
{
	m_hwIf = hwCommunicationIF;
}

bool EepromHandler::WriteFromXml(std::string path)
{
	if (m_hwIf == nullptr)
	{
		std::cout << "Unable to write to EEPROM when uninitialized" << std::endl;
		return false;
	}

	tinyxml2::XMLDocument doc;
	
	if (doc.LoadFile(path.c_str()) != tinyxml2::XML_SUCCESS)
	{
		std::cout << "Error reading XML file, aborting EEPROM write" << std::endl;
		return false;
	}


	tinyxml2::XMLElement* rootElement = doc.FirstChildElement();

	if (rootElement == nullptr)
	{
		std::cout << "XML file missing root element, aborting EEPROM write" << std::endl;
		return false;
	}

	tinyxml2::XMLElement* pageElement = rootElement->FirstChildElement("page");

	if (pageElement == nullptr)
	{
		std::cout << "XML file missing page element, aborting EEPROM write" << std::endl;
		return false;
	}

	tinyxml2::XMLElement* action = pageElement->FirstChildElement("action");

	if (action == nullptr)
	{
		std::cout << "Missing actions, aborting EEPROM write" << std::endl;
		return false;
	}

	while (action != nullptr)
	{
		if (strcmp(action->Attribute("instr"), "writeXbytes") != 0)
		{
			//If not a write action then we assume its a delay action. That is all that is supported for now.
			//Since this is not a time critical operation we just sleep 1 second on all delays. That should be far more
			//than any required delay, so we should be safe.
			sleep(1);
			action = action->NextSiblingElement();
			continue;
		}

		//Get the address and length attributes
		unsigned int addr = action->IntAttribute("addr");
		unsigned int length = action->IntAttribute("len");
		std::string dataText(action->GetText());

		//Create a vector to hold the data
		std::vector<uint8_t> bytes(length - 2);
		std::fill(bytes.begin(), bytes.end(), 0);

		//Parse the string and fill the vector with the correct data
		for (int i = 0; i < length - 2; i++)
		{
			bytes.at(i) = std::stoi(dataText.substr(i * 3, 2), 0, 16);
		}

		//Write the data
		m_hwIf->Write(addr, length - 2, bytes.data());

		std::string actionName(action->Attribute("ParamName"));

		//For EEPROM erase action, wait 10 seconds before proceeding to be safe
		if (actionName.find("g_Erase") != std::string::npos)
		{
			sleep(10);
		}

		//Get next action
		action = action->NextSiblingElement();
	}

	return true;
}

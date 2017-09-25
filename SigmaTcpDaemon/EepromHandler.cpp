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
#include "Mode 0_Modes.h"
#include <unistd.h>

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

void EepromHandler::WriteDefualtEeprom()
{
	if (m_hwIf == nullptr)
	{
		return;
	}
	
	m_hwIf->Write(0xF400, 4, MODE_0_0);			/* IC 1.HIBERNATE */
	usleep(21);			/* IC 1.Hibernate Delay */
	m_hwIf->Write(0xF403, 4, MODE_0_2);			/* IC 1.KILL_CORE */
	m_hwIf->Write(0xF403, 4, MODE_0_3);			/* IC 1.KILL_CORE */
	m_hwIf->Write(0xF003, 4, MODE_0_4);			/* IC 1.PLL_ENABLE */
	m_hwIf->Write(0xF001, 4, MODE_0_5);			/* IC 1.PLL_CTRL1 Register */
	m_hwIf->Write(0xF002, 4, MODE_0_6);			/* IC 1.PLL_CLK_SRC Register */
	m_hwIf->Write(0xF005, 4, MODE_0_7);			/* IC 1.MCLK_OUT Register */
	m_hwIf->Write(0xF003, 4, MODE_0_8);			/* IC 1.PLL_ENABLE Register */
	usleep(10666);			/* Sigma300.SelfbootProgrammer.PLL Lock Delay */
	m_hwIf->Write(0xF050, 4, MODE_0_10);			/* IC 1.POWER_ENABLE0 Register */
	m_hwIf->Write(0xF051, 4, MODE_0_11);			/* IC 1.POWER_ENABLE1 Register */
	m_hwIf->Write(0xF403, 4, MODE_0_12);			/* IC 1.KILL_CORE */
	m_hwIf->Write(0xF403, 4, MODE_0_13);			/* IC 1.KILL_CORE */
	m_hwIf->Write(0xF581, 4, MODE_0_14);			/* IC 1.ASRC_MUTE */
	m_hwIf->Write(0xF422, 4, MODE_0_15);			/* IC 1.PANIC_PARITY_MASK */
	m_hwIf->Write(0xF516, 4, MODE_0_16);			/* IC 1.MP6_MODE */
	m_hwIf->Write(0xF517, 4, MODE_0_17);			/* IC 1.MP7_MODE */
	m_hwIf->Write(0xF519, 4, MODE_0_18);			/* IC 1.MP9_MODE */
	m_hwIf->Write(0xF526, 4, MODE_0_19);			/* IC 1.MP6_WRITE */
	m_hwIf->Write(0xF527, 4, MODE_0_20);			/* IC 1.MP7_WRITE */
	m_hwIf->Write(0xF79D, 4, MODE_0_21);			/* IC 1.SCLK_SCL_M_PIN */
	m_hwIf->Write(0xF79E, 4, MODE_0_22);			/* IC 1.MISO_SDA_M_PIN */
	m_hwIf->Write(0xF79F, 4, MODE_0_23);			/* IC 1.SS_M_PIN */
	m_hwIf->Write(0xF7A0, 4, MODE_0_24);			/* IC 1.MOSI_M_PIN */
	m_hwIf->Write(0xF100, 4, MODE_0_25);			/* IC 1.ASRC_INPUT0 */
	m_hwIf->Write(0xF101, 4, MODE_0_26);			/* IC 1.ASRC_INPUT1 */
	m_hwIf->Write(0xF140, 4, MODE_0_27);			/* IC 1.ASRC_OUT_RATE0 */
	m_hwIf->Write(0xF141, 4, MODE_0_28);			/* IC 1.ASRC_OUT_RATE1 */
	m_hwIf->Write(0xF180, 6, MODE_0_29);			/* IC 1.SOUT_SOURCE0 */
	m_hwIf->Write(0xF181, 6, MODE_0_30);			/* IC 1.SOUT_SOURCE1 */
	m_hwIf->Write(0xF182, 6, MODE_0_31);			/* IC 1.SOUT_SOURCE2 */
	m_hwIf->Write(0xF183, 6, MODE_0_32);			/* IC 1.SOUT_SOURCE3 */
	m_hwIf->Write(0xF184, 6, MODE_0_33);			/* IC 1.SOUT_SOURCE4 */
	m_hwIf->Write(0xF185, 6, MODE_0_34);			/* IC 1.SOUT_SOURCE5 */
	m_hwIf->Write(0xF186, 6, MODE_0_35);			/* IC 1.SOUT_SOURCE6 */
	m_hwIf->Write(0xF187, 6, MODE_0_36);			/* IC 1.SOUT_SOURCE7 */
	m_hwIf->Write(0xF188, 6, MODE_0_37);			/* IC 1.SOUT_SOURCE8 */
	m_hwIf->Write(0xF189, 6, MODE_0_38);			/* IC 1.SOUT_SOURCE9 */
	m_hwIf->Write(0xF18A, 6, MODE_0_39);			/* IC 1.SOUT_SOURCE10 */
	m_hwIf->Write(0xF18B, 6, MODE_0_40);			/* IC 1.SOUT_SOURCE11 */
	m_hwIf->Write(0xF18C, 6, MODE_0_41);			/* IC 1.SOUT_SOURCE12 */
	m_hwIf->Write(0xF18D, 6, MODE_0_42);			/* IC 1.SOUT_SOURCE13 */
	m_hwIf->Write(0xF18E, 6, MODE_0_43);			/* IC 1.SOUT_SOURCE14 */
	m_hwIf->Write(0xF18F, 6, MODE_0_44);			/* IC 1.SOUT_SOURCE15 */
	m_hwIf->Write(0xF190, 6, MODE_0_45);			/* IC 1.SOUT_SOURCE16 */
	m_hwIf->Write(0xF191, 6, MODE_0_46);			/* IC 1.SOUT_SOURCE17 */
	m_hwIf->Write(0xF192, 6, MODE_0_47);			/* IC 1.SOUT_SOURCE18 */
	m_hwIf->Write(0xF193, 6, MODE_0_48);			/* IC 1.SOUT_SOURCE19 */
	m_hwIf->Write(0xF194, 6, MODE_0_49);			/* IC 1.SOUT_SOURCE20 */
	m_hwIf->Write(0xF195, 6, MODE_0_50);			/* IC 1.SOUT_SOURCE21 */
	m_hwIf->Write(0xF196, 6, MODE_0_51);			/* IC 1.SOUT_SOURCE22 */
	m_hwIf->Write(0xF197, 6, MODE_0_52);			/* IC 1.SOUT_SOURCE23 */
	m_hwIf->Write(0xF1C0, 4, MODE_0_53);			/* IC 1.SPDIFTX_INPUT */
	m_hwIf->Write(0xF200, 4, MODE_0_54);			/* IC 1.SERIAL_BYTE_0_0 */
	m_hwIf->Write(0xF204, 4, MODE_0_55);			/* IC 1.SERIAL_BYTE_1_0 */
	m_hwIf->Write(0xF208, 4, MODE_0_56);			/* IC 1.SERIAL_BYTE_2_0 */
	m_hwIf->Write(0xF20C, 4, MODE_0_57);			/* IC 1.SERIAL_BYTE_3_0 */
	m_hwIf->Write(0xF210, 4, MODE_0_58);			/* IC 1.SERIAL_BYTE_4_0 */
	m_hwIf->Write(0xF214, 4, MODE_0_59);			/* IC 1.SERIAL_BYTE_5_0 */
	m_hwIf->Write(0xF218, 4, MODE_0_60);			/* IC 1.SERIAL_BYTE_6_0 */
	m_hwIf->Write(0xF21C, 4, MODE_0_61);			/* IC 1.SERIAL_BYTE_7_0 */
	m_hwIf->Write(0xF604, 4, MODE_0_62);			/* IC 1.SPDIF_RESTART */
	m_hwIf->Write(0xF690, 4, MODE_0_63);			/* IC 1.SPDIF_TX_EN */
	m_hwIf->Write(0xC000, 1114, MODE_0_64);			/* Program */
	sleep(2);
	m_hwIf->Write(0x0000, 12566, MODE_0_65);			/* DM0 Data */
	sleep(2);
	m_hwIf->Write(0x6000, 18, MODE_0_66);			/* DM1 Data */
	sleep(2);
	m_hwIf->Write(0xF403, 4, MODE_0_67);			/* IC 1.KILL_CORE */
	m_hwIf->Write(0xF404, 4, MODE_0_68);			/* IC 1.START_ADDRESS */
	m_hwIf->Write(0xF401, 4, MODE_0_69);			/* IC 1.START_PULSE */
	m_hwIf->Write(0xF402, 4, MODE_0_70);			/* IC 1.START_CORE */
	m_hwIf->Write(0xF402, 4, MODE_0_71);			/* IC 1.START_CORE */
	usleep(50);			/* IC 1.Start Delay */
	m_hwIf->Write(0xF400, 4, MODE_0_73);			/* IC 1.HIBERNATE */
	m_hwIf->Write(0x0032, 6, MODE_0_74);			/* g_MasterMode */
	m_hwIf->Write(0x0027, 6, MODE_0_75);			/* g_spi_mode */
	m_hwIf->Write(0x0028, 6, MODE_0_76);			/* g_spi_speed */
	m_hwIf->Write(0x0029, 6, MODE_0_77);			/* g_spi_address_bytes */
	m_hwIf->Write(0x002A, 6, MODE_0_78);			/* g_spi_chip_erase_command */
	m_hwIf->Write(0x002B, 6, MODE_0_79);			/* g_spi_wren_command */
	m_hwIf->Write(0x002C, 6, MODE_0_80);			/* g_spi_read_command */
	m_hwIf->Write(0x002D, 6, MODE_0_81);			/* g_spi_write_command */
	m_hwIf->Write(0x002E, 6, MODE_0_82);			/* g_spi_slave_clatch */
	m_hwIf->Write(0x0039, 6, MODE_0_83);			/* g_initialized */
	m_hwIf->Write(0x0034, 6, MODE_0_84);			/* g_Erase */
	sleep(7);
	m_hwIf->Write(0x0036, 6, MODE_0_85);			/* g_PageAddress */
	m_hwIf->Write(0x003C, 258, MODE_0_86);			/* Page_A0_S256_N5_idx0 */
	usleep(500000);
	m_hwIf->Write(0x0035, 6, MODE_0_87);			/* g_PageSize */
	m_hwIf->Write(0x0036, 6, MODE_0_88);			/* g_PageAddress */
	m_hwIf->Write(0x003C, 258, MODE_0_89);			/* Page_A256_S256_N5_idx1 */
	usleep(500000);
	m_hwIf->Write(0x0035, 6, MODE_0_90);			/* g_PageSize */
	m_hwIf->Write(0x0036, 6, MODE_0_91);			/* g_PageAddress */
	m_hwIf->Write(0x003C, 258, MODE_0_92);			/* Page_A512_S256_N5_idx2 */
	usleep(500000);
	m_hwIf->Write(0x0035, 6, MODE_0_93);			/* g_PageSize */
	m_hwIf->Write(0x0036, 6, MODE_0_94);			/* g_PageAddress */
	m_hwIf->Write(0x003C, 258, MODE_0_95);			/* Page_A768_S256_N5_idx3 */
	usleep(500000);
	m_hwIf->Write(0x0035, 6, MODE_0_96);			/* g_PageSize */
	m_hwIf->Write(0x0036, 6, MODE_0_97);			/* g_PageAddress */
	m_hwIf->Write(0x003C, 258, MODE_0_98);			/* Page_A1024_S256_N5_idx4 */
	usleep(500000);
	m_hwIf->Write(0x0035, 6, MODE_0_99);			/* g_PageSize */
	m_hwIf->Write(0xF400, 4, MODE_0_100);			/* IC 1.HIBERNATE */
	usleep(21);			/* IC 1.Hibernate Delay */
	m_hwIf->Write(0xF403, 4, MODE_0_102);			/* IC 1.KILL_CORE */
	m_hwIf->Write(0xF403, 4, MODE_0_103);			/* IC 1.KILL_CORE */
	m_hwIf->Write(0xF003, 4, MODE_0_104);			/* IC 1.PLL_ENABLE */
	m_hwIf->Write(0xF001, 4, MODE_0_105);			/* IC 1.PLL_CTRL1 Register */
	m_hwIf->Write(0xF002, 4, MODE_0_106);			/* IC 1.PLL_CLK_SRC Register */
	m_hwIf->Write(0xF005, 4, MODE_0_107);			/* IC 1.MCLK_OUT Register */
	m_hwIf->Write(0xF003, 4, MODE_0_108);			/* IC 1.PLL_ENABLE Register */
	usleep(10666);			/* IC 1.PLL Lock Delay */
	m_hwIf->Write(0xF050, 4, MODE_0_110);			/* IC 1.POWER_ENABLE0 Register */
	m_hwIf->Write(0xF051, 4, MODE_0_111);			/* IC 1.POWER_ENABLE1 Register */
	m_hwIf->Write(0xF403, 4, MODE_0_112);			/* IC 1.KILL_CORE */
	m_hwIf->Write(0xF403, 4, MODE_0_113);			/* IC 1.KILL_CORE */
	m_hwIf->Write(0xF581, 4, MODE_0_114);			/* IC 1.ASRC_MUTE */
	m_hwIf->Write(0xF422, 4, MODE_0_115);			/* IC 1.PANIC_PARITY_MASK */
	m_hwIf->Write(0xF516, 4, MODE_0_116);			/* IC 1.MP6_MODE */
	m_hwIf->Write(0xF517, 4, MODE_0_117);			/* IC 1.MP7_MODE */
	m_hwIf->Write(0xF519, 4, MODE_0_118);			/* IC 1.MP9_MODE */
	m_hwIf->Write(0xF526, 4, MODE_0_119);			/* IC 1.MP6_WRITE */
	m_hwIf->Write(0xF527, 4, MODE_0_120);			/* IC 1.MP7_WRITE */
	m_hwIf->Write(0xF79D, 4, MODE_0_121);			/* IC 1.SCLK_SCL_M_PIN */
	m_hwIf->Write(0xF79E, 4, MODE_0_122);			/* IC 1.MISO_SDA_M_PIN */
	m_hwIf->Write(0xF79F, 4, MODE_0_123);			/* IC 1.SS_M_PIN */
	m_hwIf->Write(0xF7A0, 4, MODE_0_124);			/* IC 1.MOSI_M_PIN */
	m_hwIf->Write(0xF100, 4, MODE_0_125);			/* IC 1.ASRC_INPUT0 */
	m_hwIf->Write(0xF101, 4, MODE_0_126);			/* IC 1.ASRC_INPUT1 */
	m_hwIf->Write(0xF140, 4, MODE_0_127);			/* IC 1.ASRC_OUT_RATE0 */
	m_hwIf->Write(0xF141, 4, MODE_0_128);			/* IC 1.ASRC_OUT_RATE1 */
	m_hwIf->Write(0xF180, 4, MODE_0_129);			/* IC 1.SOUT_SOURCE0 */
	m_hwIf->Write(0xF181, 4, MODE_0_130);			/* IC 1.SOUT_SOURCE1 */
	m_hwIf->Write(0xF182, 4, MODE_0_131);			/* IC 1.SOUT_SOURCE2 */
	m_hwIf->Write(0xF183, 4, MODE_0_132);			/* IC 1.SOUT_SOURCE3 */
	m_hwIf->Write(0xF184, 4, MODE_0_133);			/* IC 1.SOUT_SOURCE4 */
	m_hwIf->Write(0xF185, 4, MODE_0_134);			/* IC 1.SOUT_SOURCE5 */
	m_hwIf->Write(0xF186, 4, MODE_0_135);			/* IC 1.SOUT_SOURCE6 */
	m_hwIf->Write(0xF187, 4, MODE_0_136);			/* IC 1.SOUT_SOURCE7 */
	m_hwIf->Write(0xF188, 4, MODE_0_137);			/* IC 1.SOUT_SOURCE8 */
	m_hwIf->Write(0xF189, 4, MODE_0_138);			/* IC 1.SOUT_SOURCE9 */
	m_hwIf->Write(0xF18A, 4, MODE_0_139);			/* IC 1.SOUT_SOURCE10 */
	m_hwIf->Write(0xF18B, 4, MODE_0_140);			/* IC 1.SOUT_SOURCE11 */
	m_hwIf->Write(0xF18C, 4, MODE_0_141);			/* IC 1.SOUT_SOURCE12 */
	m_hwIf->Write(0xF18D, 4, MODE_0_142);			/* IC 1.SOUT_SOURCE13 */
	m_hwIf->Write(0xF18E, 4, MODE_0_143);			/* IC 1.SOUT_SOURCE14 */
	m_hwIf->Write(0xF18F, 4, MODE_0_144);			/* IC 1.SOUT_SOURCE15 */
	m_hwIf->Write(0xF190, 4, MODE_0_145);			/* IC 1.SOUT_SOURCE16 */
	m_hwIf->Write(0xF191, 4, MODE_0_146);			/* IC 1.SOUT_SOURCE17 */
	m_hwIf->Write(0xF192, 4, MODE_0_147);			/* IC 1.SOUT_SOURCE18 */
	m_hwIf->Write(0xF193, 4, MODE_0_148);			/* IC 1.SOUT_SOURCE19 */
	m_hwIf->Write(0xF194, 4, MODE_0_149);			/* IC 1.SOUT_SOURCE20 */
	m_hwIf->Write(0xF195, 4, MODE_0_150);			/* IC 1.SOUT_SOURCE21 */
	m_hwIf->Write(0xF196, 4, MODE_0_151);			/* IC 1.SOUT_SOURCE22 */
	m_hwIf->Write(0xF197, 4, MODE_0_152);			/* IC 1.SOUT_SOURCE23 */
	m_hwIf->Write(0xF1C0, 4, MODE_0_153);			/* IC 1.SPDIFTX_INPUT */
	m_hwIf->Write(0xF200, 4, MODE_0_154);			/* IC 1.SERIAL_BYTE_0_0 */
	m_hwIf->Write(0xF204, 4, MODE_0_155);			/* IC 1.SERIAL_BYTE_1_0 */
	m_hwIf->Write(0xF208, 4, MODE_0_156);			/* IC 1.SERIAL_BYTE_2_0 */
	m_hwIf->Write(0xF20C, 4, MODE_0_157);			/* IC 1.SERIAL_BYTE_3_0 */
	m_hwIf->Write(0xF210, 4, MODE_0_158);			/* IC 1.SERIAL_BYTE_4_0 */
	m_hwIf->Write(0xF214, 4, MODE_0_159);			/* IC 1.SERIAL_BYTE_5_0 */
	m_hwIf->Write(0xF218, 4, MODE_0_160);			/* IC 1.SERIAL_BYTE_6_0 */
	m_hwIf->Write(0xF21C, 4, MODE_0_161);			/* IC 1.SERIAL_BYTE_7_0 */
	m_hwIf->Write(0xF604, 4, MODE_0_162);			/* IC 1.SPDIF_RESTART */
	m_hwIf->Write(0xF690, 4, MODE_0_163);			/* IC 1.SPDIF_TX_EN */
	m_hwIf->Write(0xC000, 438, MODE_0_164);			/* Program Data */
	sleep(2);
	m_hwIf->Write(0x0000, 142, MODE_0_165);			/* DM0 Data */
	sleep(1);
	m_hwIf->Write(0x6000, 82, MODE_0_166);			/* DM1 Data */
	usleep(500000);
	m_hwIf->Write(0xF403, 4, MODE_0_167);			/* IC 1.KILL_CORE */
	m_hwIf->Write(0xF404, 4, MODE_0_168);			/* IC 1.START_ADDRESS */
	m_hwIf->Write(0xF401, 4, MODE_0_169);			/* IC 1.START_PULSE */
	m_hwIf->Write(0xF402, 4, MODE_0_170);			/* IC 1.START_CORE */
	m_hwIf->Write(0xF402, 4, MODE_0_171);			/* IC 1.START_CORE */
	usleep(50);			/* IC 1.Start Delay */
 	m_hwIf->Write(0xF400, 4, MODE_0_173);			/* IC 1.HIBERNATE */
}
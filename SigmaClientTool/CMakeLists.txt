cmake_minimum_required(VERSION 3.1)

project(SigmaClientTool)

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++11")

set(SOURCES Main.cpp SigmaProtocolDataFormatter.cpp SigmaTcpClient.cpp)

add_executable(SigmaClientTool ${SOURCES})
cmake_minimum_required(VERSION 3.1)

project(SigmaTcpDaemon)

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++11")

set(SOURCES Main.cpp SigmaTcpServer.cpp SpiCommunication.cpp)

#add_definitions ("-Wno-unused-function")
#add_definitions ("-Wno-unused-value")

add_executable(sigmaTcpDaemon ${SOURCES})

target_link_libraries(sigmaTcpDaemon pthread)

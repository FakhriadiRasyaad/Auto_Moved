#ifndef SERIAL_COMMAND_H
#define SERIAL_COMMAND_H
#include "DebugManager.h"
#include <Arduino.h>
#include "PresetManager.h"
#include "MotionPlanner.h"
#include "RobotArm.h"
#include "RobotConfig.h"

class SerialCommand
{
public:

   SerialCommand(
        MotionPlanner*,
        RobotArm*,
        PresetManager*,
        DebugManager*
        );
    void begin(uint32_t baud = 115200);

    void update();

private:
    MotionPlanner* planner;
    RobotArm* robot;
    PresetManager* preset;
    DebugManager* debug;
    String rxBuffer;

    //------------------------------------
    // Parser
    //------------------------------------
    void processCommand(String cmd);

    //------------------------------------
    // Command
    //------------------------------------
    void processJoint(String cmd);
    void processSave(String cmd);
    void processDelete(String cmd);
    void processShow(String cmd);
    void processPreset(String cmd);
    void processMove(String cmd);
    void processHome();
    void processStop();
    void processStatus();
    void processPosition();
    void processDebug(String cmd);
    //------------------------------------
    // Helper
    //------------------------------------
    void printHelp();

    String getToken(String str, uint8_t index);

    uint8_t countToken(String str);
};

#endif
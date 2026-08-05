#ifndef DEBUG_MANAGER_H
#define DEBUG_MANAGER_H

#include <Arduino.h>
#include "RobotArm.h"

class DebugManager
{
public:
    DebugManager(RobotArm* robot);

    void begin();

    void printAll();
    void printJoint(uint8_t joint);

    void printInfo();
    void printHealth();

private:
    RobotArm* robot;

    void printHeader();
    void printFooter();
};

#endif
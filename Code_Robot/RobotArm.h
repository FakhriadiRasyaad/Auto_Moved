#ifndef ROBOT_ARM_H
#define ROBOT_ARM_H

#include <Arduino.h>
#include "StepperAxis.h"
#include "RobotConfig.h"

class RobotArm
{
public:

    RobotArm();

    // Hubungkan axis ke robot
    void attachJoint(uint8_t id, StepperAxis* axis);

    void begin();

    void update();
    StepperAxis* getAxis(uint8_t joint);
    void moveJoint(uint8_t id, float degree);
    StepperAxis* getJoint(uint8_t id);
    void setJointSpeed(uint8_t id, float speed);
    
    void setJointAcceleration(uint8_t id, float accel);

    void stop();

    bool isBusy();

    float getJointPosition(uint8_t id);

private:
    bool isValidJoint(uint8_t id) const;
    StepperAxis* joint[JOINT_COUNT] = {nullptr};

};

#endif
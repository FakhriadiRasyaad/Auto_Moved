#ifndef MOTION_PLANNER_H
#define MOTION_PLANNER_H

#include <Arduino.h>
#include "RobotArm.h"

enum PlannerState
{
    PLANNER_IDLE,
    PLANNER_RUNNING
};

class MotionPlanner
{
public:

    MotionPlanner(RobotArm *robot);

    void begin();

    // Gerak 1 Joint
    void moveJoint(
        uint8_t joint,
        float degree);

    // Gerak semua Joint
    void moveAll(
        float j1,
        float j2,
        float j3,
        float j4,
        float j5,
        float j6);

    void moveAll(const float target[]);

    // Gerak sinkron
    void moveSync(
        float j1,
        float j2,
        float j3,
        float j4,
        float j5,
        float j6);

    // Home
    void home();

    // Stop
    void stop();

    // Update planner
    void update();

    // Robot masih bergerak?
    bool isBusy();

private:

    RobotArm* robot;

    PlannerState state = PLANNER_IDLE;

    float targetJoint[JOINT_COUNT];

    bool syncMove = false;

    void executeMove();
};

#endif
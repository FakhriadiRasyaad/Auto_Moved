#include "MotionPlanner.h"

MotionPlanner::MotionPlanner(RobotArm* robot)
{
    this->robot = robot;
}

void MotionPlanner::begin()
{

}

void MotionPlanner::moveJoint(
    uint8_t joint,
    float degree)
{
    robot->moveJoint(joint, degree);
}
void MotionPlanner::moveAll(
    float j1,
    float j2,
    float j3,
    float j4,
    float j5,
    float j6)
{
    float target[JOINT_COUNT] =
    {
        j1,
        j2,
        j3,
        j4,
        j5,
        j6
    };

    for(uint8_t i = 0; i < JOINT_COUNT; i++)
    {
        robot->moveJoint(i, target[i]);
    }
}

//=====================================================
// Move All Joint (Array)
//=====================================================

void MotionPlanner::moveAll(const float target[])
{
    for(uint8_t i = 0; i < JOINT_COUNT; i++)
    {
        robot->moveJoint(i, target[i]);
    }
}

void MotionPlanner::home()
{
    moveAll(
        0,
        0,
        0,
        0,
        0,
        0);
}
void MotionPlanner::moveSync(
    float j1,
    float j2,
    float j3,
    float j4,
    float j5,
    float j6)
{
    moveAll(j1, j2, j3, j4, j5, j6);
}

void MotionPlanner::stop()
{
    robot->stop();
}


void MotionPlanner::update()
{
    robot->update();
}

bool MotionPlanner::isBusy()
{
    return robot->isBusy();
}
#include "RobotArm.h"

RobotArm::RobotArm()
{
}
//==============================
// Attach Joint
//==============================
void RobotArm::attachJoint(uint8_t id,
                           StepperAxis* axis)
{
    if(id>=JOINT_COUNT)
        return;
    joint[id]=axis;
}
//==============================
// Begin
//==============================
void RobotArm::begin()
{
    for(int i=0;i<JOINT_COUNT;i++)
    {
        if(joint[i]!=nullptr)
            joint[i]->begin();
    }
}
//==============================
// Update
//==============================
void RobotArm::update()
{
    for(uint8_t i = 0; i < JOINT_COUNT; i++)
    {
        StepperAxis* axis = joint[i];

        if(axis)
            axis->update();
    }
}
//==============================
// Move Joint
//==============================
void RobotArm::moveJoint(uint8_t id,
                         float degree)
{
    if(id >= JOINT_COUNT)
        return;

    if(joint[id] == nullptr)
        return;

    joint[id]->moveTo(degree);
}

StepperAxis* RobotArm::getAxis(uint8_t joint)
{
    if(joint >= JOINT_COUNT)
        return nullptr;

    return this->joint[joint];
}

void RobotArm::setJointSpeed(uint8_t id, float speed)
{
    if(id >= JOINT_COUNT) return;

    if(joint[id] != nullptr)
        joint[id]->setSpeed(speed);
}

void RobotArm::setJointAcceleration(uint8_t id, float accel)
{
    if(id >= JOINT_COUNT) return;

    if(joint[id] != nullptr)
        joint[id]->setAcceleration(accel);
}
//==============================
// Stop
//==============================
void RobotArm::stop()
{
    for(int i=0;i<JOINT_COUNT;i++)
    {
        if(joint[i]!=nullptr)
            joint[i]->stop();
    }
}
//==============================
// Busy
//==============================
bool RobotArm::isBusy()
{
    for(uint8_t i = 0; i < JOINT_COUNT; i++)
    {
        StepperAxis* axis = joint[i];

        if(axis && axis->isBusy())
            return true;
    }

    return false;
}
//==============================
// Position
//==============================
float RobotArm::getJointPosition(uint8_t joint)
{
    if(joint >= JOINT_COUNT)
        return 0.0f;

    if(this->joint[joint] == nullptr)
        return 0.0f;

    return this->joint[joint]->getCurrentDegree();
}


#include "DebugManager.h"

DebugManager::DebugManager(RobotArm* robot)
{
    this->robot = robot;
}

void DebugManager::begin()
{
}

void DebugManager::printHeader()
{
    Serial.println();
    Serial.println("========================================");
    Serial.println("          ROBOT DEBUG INFO");
    Serial.println("========================================");
}

void DebugManager::printFooter()
{
    Serial.println("========================================");
}

void DebugManager::printAll()
{
    printHeader();

    for(uint8_t i = 0; i < JOINT_COUNT; i++)
    {
        printJoint(i);
    }

    printFooter();
}

void DebugManager::printJoint(uint8_t joint)
{
    if(joint >= JOINT_COUNT)
        return;

    StepperAxis* axis = robot->getAxis(joint);

    if(axis == nullptr)
        return;

    Serial.print("Joint J");
    Serial.println(joint + 1);

    Serial.println("----------------------------");

    Serial.print("Current Degree : ");
    Serial.println(axis->getCurrentDegree(),2);

    Serial.print("Target Degree  : ");
    Serial.println(axis->getTargetDegree(),2);

    Serial.print("Error          : ");
    Serial.println(axis->getError(),2);

    Serial.print("Current Step   : ");
    Serial.println(axis->getCurrentStep());

    Serial.print("Target Step    : ");
    Serial.println(axis->getTargetStep());

    Serial.print("Busy           : ");

    if(axis->isBusy())
        Serial.println("YES");
    else
        Serial.println("NO");

    Serial.println();
}

void DebugManager::printInfo()
{
    Serial.println();
    Serial.println("=========== ROBOT INFO ===========");

    Serial.print("Joint Count : ");
    Serial.println(JOINT_COUNT);

    Serial.println();

    for(uint8_t i=0;i<JOINT_COUNT;i++)
    {
        StepperAxis* axis = robot->getAxis(i);

        if(axis == nullptr)
            continue;

        Serial.print("J");
        Serial.print(i+1);
        Serial.print(" Speed : ");
        Serial.println(axis->getSpeed());

        Serial.print("J");
        Serial.print(i+1);
        Serial.print(" Accel : ");
        Serial.println(axis->getAcceleration());

        Serial.println();
    }
}

void DebugManager::printHealth()
{
    Serial.println();
    Serial.println("========== HEALTH ==========");

    for(uint8_t i=0;i<JOINT_COUNT;i++)
    {
        StepperAxis* axis = robot->getAxis(i);

        Serial.print("J");
        Serial.print(i+1);
        Serial.print(" : ");

        if(axis == nullptr)
        {
            Serial.println("NOT FOUND");
            continue;
        }

        Serial.println("OK");
    }

    Serial.println("============================");
}
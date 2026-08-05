#include <Wire.h>

#include "RobotConfig.h"
#include "EncoderAS5600.h"
#include "StepperAxis.h"
#include "RobotArm.h"
#include "MotionPlanner.h"
#include "Calibration.h"
#include "PresetManager.h"
#include "DebugManager.h"
#include "SerialCommand.h"

//=====================================================
// Hardware
//=====================================================

FastAccelStepperEngine engine;

// Encoder
EncoderAS5600 encoder1(0, GEAR_RATIO[0]);
EncoderAS5600 encoder2(1, GEAR_RATIO[1]);
EncoderAS5600 encoder3(2, GEAR_RATIO[2]);
EncoderAS5600 encoder4(3, GEAR_RATIO[3]);
EncoderAS5600 encoder5(4, GEAR_RATIO[4]);
EncoderAS5600 encoder6(5, GEAR_RATIO[5]);
// Tambahkan encoder2 ... encoder6 nanti

// Stepper
StepperAxis joint1(&engine, 0, &encoder1);
StepperAxis joint2(&engine, 1, &encoder2);
StepperAxis joint3(&engine, 2, &encoder3);
StepperAxis joint4(&engine, 3, &encoder4);
StepperAxis joint5(&engine, 4, &encoder5);
StepperAxis joint6(&engine, 5, &encoder6);
// Tambahkan joint2 ... joint6 nanti

//=====================================================
// Framework
//=====================================================
RobotArm robot;
MotionPlanner planner(&robot);
Calibration calibration;
PresetManager preset;
DebugManager debug(&robot);

SerialCommand serial(
    &planner,
    &robot,
    &preset,
    &debug
);
void setup()
{
    Wire.begin();
    engine.init();
    // Hardware
    encoder1.begin();
    encoder2.begin();
    encoder3.begin();
    encoder4.begin();
    encoder5.begin();
    encoder6.begin();
    joint1.begin();

    robot.attachJoint(0, &joint1);
    robot.attachJoint(1, &joint2);
    robot.attachJoint(2, &joint3);
    robot.attachJoint(3, &joint4);
    robot.attachJoint(4, &joint5);
    robot.attachJoint(5, &joint6);

    
    // Jika RobotArm memiliki fungsi attachJoint()/setJoint()
    // robot.attachJoint(0, &joint1);
    // Framework
    robot.begin();
    planner.begin();
    calibration.begin();
    preset.begin();
    debug.begin();
    serial.begin();

    Serial.println();
    Serial.println("===================================");
    Serial.println(" Robot Framework Ready");
    Serial.println("===================================");
    Serial.println("Ketik HELP untuk melihat command.");
}

void loop()
{
    robot.update();
    planner.update();
    serial.update();
}
#ifndef STEPPER_AXIS_H
#define STEPPER_AXIS_H

#include "RobotConfig.h"
#include <Arduino.h>
#include <FastAccelStepper.h>
#include "EncoderAS5600.h"

class StepperAxis
{
public:
    StepperAxis(
        FastAccelStepperEngine *engine,
        uint8_t id,
        EncoderAS5600 *encoder);
    void begin();
    void setLimit(float minDeg, float maxDeg);
    bool isInsideLimit(float target);
    void setStepLimit(long minPulse, long maxPulse);
    long getCurrentStep() const;
    long getTargetStep() const;

    void moveTo(float targetJoint);
    void update();
    bool isTargetReached() const;
    void setSpeed(float speed);
    void setAcceleration(float accel);

    float getSpeed();
    float getAcceleration();

    long jointDegreeToStep(float degree);
    float getCurrentDegree() const;
    float getTargetDegree() const;
    float getError() const;
    bool isBusy();
    void stop();

private:
    FastAccelStepper *stepper = nullptr;
    FastAccelStepperEngine *engine_ = nullptr;
    EncoderAS5600 *enc = nullptr;

    uint8_t jointID;
    uint8_t stepPin_;
    uint8_t dirPin_;

    float pulsePerJointDeg = 0.0f;
    bool targetChanged = false;
    float targetDegree = 0.0f;
    float currentDegree = 0.0f;
    float homeOffset = 0.0f;
    float lastError = 0.0f;

    uint32_t minSpeed = 200;
    uint32_t maxSpeed = 3000;

    uint32_t currentSpeed = DEFAULT_SPEED;
    uint32_t currentAccel = DEFAULT_ACCEL;

    float tolerance = DEFAULT_TOLERANCE;
    long currentMotorStep = 0;
    long targetMotorStep = 0;
    float minLimit = -360.0f;
    float maxLimit = 360.0f;
    

    long minStepMove = DEFAULT_MIN_STEP;
    long maxStepMove = DEFAULT_MAX_STEP;

    long lastTargetStep = 0;

    uint32_t calculateSpeed(float error);
};
#endif
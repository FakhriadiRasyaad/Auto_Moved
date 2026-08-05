#include "StepperAxis.h"
#include <math.h>

//======================================================
// Constructor
//======================================================
StepperAxis::StepperAxis(
    FastAccelStepperEngine *engine,
    uint8_t id,
    EncoderAS5600 *encoder)
{
    engine_ = engine;
    jointID = id;
    enc = encoder;

    stepPin_ = STEP_PIN[id];
    dirPin_  = DIR_PIN[id];

    pulsePerJointDeg =
        (MOTOR_PULSE_REV * GEAR_RATIO[id]) / 360.0f;
    targetDegree = 0.0f;
    currentDegree = 0.0f;
    lastError = 0.0f;

    homeOffset = 0.0f;
    lastTargetStep = LONG_MIN;
}

//======================================================
// Begin
//======================================================
//======================================================
// Begin
//======================================================
void StepperAxis::begin()
{
    stepper = engine_->stepperConnectToPin(stepPin_);

    if(stepper == nullptr)
        return;
    stepper->setDirectionPin(dirPin_, true);
    stepper->setEnablePin(255);

    stepper->setSpeedInHz(currentSpeed);
    stepper->setAcceleration(currentAccel);

    // Sinkronkan posisi awal dengan encoder
    enc->update();

    homeOffset = enc->getJointDegreeRelative();

    stepper->setCurrentPosition(0);

    lastTargetStep = LONG_MIN;
}

//======================================================
// Speed
//======================================================
void StepperAxis::setSpeed(float speed)
{
    currentSpeed = speed;

    if(stepper)
        stepper->setSpeedInHz(speed);
}

void StepperAxis::setAcceleration(float accel)
{
    currentAccel = accel;

    if(stepper)
        stepper->setAcceleration(accel);
}

float StepperAxis::getSpeed()
{
    return currentSpeed;
}

float StepperAxis::getAcceleration()
{
    return currentAccel;
}

//======================================================
// Degree to Pulse
//======================================================
long StepperAxis::jointDegreeToStep(float degree)
{
    return lround(degree * pulsePerJointDeg);
}

//======================================================
// Move
//======================================================
//======================================================
// Move To Joint
//======================================================
void StepperAxis::moveTo(float degree)
{
    if(stepper == nullptr)
        return;

    targetDegree = constrain(degree, minLimit, maxLimit);

    long targetStep = jointDegreeToStep(targetDegree - homeOffset);

    if(targetStep != lastTargetStep)
    {
        // Terapkan ulang parameter motion
        stepper->setSpeedInHz(currentSpeed);
        stepper->setAcceleration(currentAccel);
        stepper->applySpeedAcceleration();

        // Baru kirim target
        stepper->moveTo(targetStep);

        lastTargetStep = targetStep;
    }
}

//======================================================
// Closed Loop Update
//======================================================
//======================================================
// Closed Loop Update
//======================================================
void StepperAxis::update()
{
    if(stepper == nullptr || enc == nullptr)
        return;

    enc->update();

    currentDegree = enc->getJointDegreeRelative();

    lastError = targetDegree - currentDegree;

    currentMotorStep = stepper->getCurrentPosition();
    targetMotorStep  = stepper->targetPos();

   // uint32_t newSpeed = calculateSpeed(lastError);

    //if(newSpeed != currentSpeed)
    //{
        //currentSpeed = newSpeed;
        //stepper->setSpeedInHz(currentSpeed);
      //  stepper->applySpeedAcceleration();
    //}
}

//======================================================
// Stop
//======================================================
//======================================================
// Stop
//======================================================
void StepperAxis::stop()
{
    if(stepper)
        stepper->stopMove();
}

//======================================================
// Busy
//======================================================
bool StepperAxis::isBusy()
{
    if(stepper == nullptr)
        return false;

    return stepper->isRunning();
}

//======================================================
// Position
//======================================================
//======================================================
// Soft Limit
//======================================================
void StepperAxis::setLimit(float minDeg,float maxDeg)
{
    minLimit = minDeg;
    maxLimit = maxDeg;
}

bool StepperAxis::isInsideLimit(float target)
{
    return (target >= minLimit &&
            target <= maxLimit);
}

//======================================================
// Step Limit
//======================================================
void StepperAxis::setStepLimit(long minPulse,long maxPulse)
{
    minStepMove = minPulse;
    maxStepMove = maxPulse;
}

//======================================================
// P Controller
//======================================================
//======================================================
// Dynamic Speed
//======================================================
uint32_t StepperAxis::calculateSpeed(float error)
{
    error = fabs(error);

    float ratio = error / 30.0f;

    if(ratio > 1.0f)
        ratio = 1.0f;

    uint32_t speed =
        minSpeed +
        (maxSpeed - minSpeed) * ratio;

    return speed;
}
float StepperAxis::getCurrentDegree() const
{
    return currentDegree;
}

float StepperAxis::getTargetDegree() const
{
    return targetDegree;
}

float StepperAxis::getError() const
{
    return lastError;
}
bool StepperAxis::isTargetReached() const
{
    return fabs(lastError) <= tolerance;
}

long StepperAxis::getCurrentStep() const
{
    return currentMotorStep;
}

long StepperAxis::getTargetStep() const
{
    return targetMotorStep;
}

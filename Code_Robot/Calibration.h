#ifndef CALIBRATION_H
#define CALIBRATION_H

#include <Arduino.h>
#include <Preferences.h>

class Calibration
{
public:
    float getZero(uint8_t joint);
    Calibration();

    bool begin();

    void saveZero(uint8_t joint, float encoderDegree);

    float loadZero(uint8_t joint);  
    bool hasCalibration();
    bool isCalibrated(uint8_t joint);

    void clearZero(uint8_t joint);

    void clearAll();

private:

    Preferences prefs;
    const char* namespaceName = "RobotArm";
    String makeKey(uint8_t joint);
};

#endif
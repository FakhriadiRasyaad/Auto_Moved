#include "Calibration.h"

Calibration::Calibration()
{
}

bool Calibration::begin()
{
    return prefs.begin("robot", false);
}

//------------------------------------
// Membuat nama key
//------------------------------------
String Calibration::makeKey(uint8_t joint)
{
    return "J" + String(joint) + "_ZERO";
}

//------------------------------------
// Simpan Zero
//------------------------------------
void Calibration::saveZero(uint8_t joint, float motorDegree)
{
    if(!prefs.isKey(makeKey(joint).c_str()))
    {
        Serial.println("Create new calibration key");
    }

    prefs.putFloat(makeKey(joint).c_str(), motorDegree);

    Serial.print("ZERO SAVED : ");
    Serial.print(makeKey(joint));
    Serial.print(" = ");
    Serial.println(motorDegree);
}

bool Calibration::isCalibrated(uint8_t joint)
{
    return prefs.isKey(makeKey(joint).c_str());
}

void Calibration::clearZero(uint8_t joint)
{
    prefs.remove(makeKey(joint).c_str());
}

void Calibration::clearAll()
{
    prefs.clear();
}

//------------------------------------
// Load Zero
//------------------------------------
float Calibration::loadZero(uint8_t joint)
{
    String key = makeKey(joint);
    return prefs.getFloat(key.c_str(), 0.0f);
}
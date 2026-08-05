#ifndef ENCODER_AS5600_H
#define ENCODER_AS5600_H

#include <Arduino.h>
#include <Wire.h>

class EncoderAS5600
{
public:

    EncoderAS5600(uint8_t tcaChannel, float gearRatio);

    void begin();
    void update();
    bool isConnected() const;
    // Zero Calibration
    void setZero();
    void setZero(float zero);
    // Encoder Data
    uint16_t getRaw();
    long getTurn();
    float getMotorDegree();
    float getMotorRevolution();
    float getJointDegree();
    // Relative Position
    float getMotorDegreeRelative();
    float getJointDegreeRelative();
    bool isConnected();
    float getVelocity();
private:

    uint8_t _channel;
    float _gearRatio;
    uint16_t raw;
    uint16_t lastRaw;
    bool checkConnection();
    long turn;
    float zeroMotorDegree = 0.0f;
    unsigned long lastUpdate = 0;
    float lastJointDegree = 0.0f;
    float velocity = 0.0f;
    bool connected = false;
    void selectChannel();
    uint16_t readRaw();
};

#endif
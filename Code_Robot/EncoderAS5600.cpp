#include "EncoderAS5600.h"

#define TCAADDR      0x70
#define AS5600_ADDR  0x36

//------------------------------------------------
// Constructor
//------------------------------------------------
EncoderAS5600::EncoderAS5600(uint8_t tcaChannel, float gearRatio)
{
    _channel = tcaChannel;
    _gearRatio = gearRatio;
    raw = 0;
    lastRaw = 0;
    turn = 0;
    zeroMotorDegree = 0.0f;
}

//------------------------------------------------
// Begin
//------------------------------------------------
void EncoderAS5600::begin()
{
    lastRaw = readRaw();
    raw = lastRaw;

    turn = 0;

    lastJointDegree = getJointDegreeRelative();

    lastUpdate = millis();
}

//------------------------------------------------
// Select TCA9548A Channel
//------------------------------------------------
void EncoderAS5600::selectChannel()
{
    Wire.beginTransmission(TCAADDR);
    Wire.write(1 << _channel);
    Wire.endTransmission();
}

//------------------------------------------------
// Read Raw Encoder
//------------------------------------------------
uint16_t EncoderAS5600::readRaw()
{
    selectChannel();

    Wire.beginTransmission(AS5600_ADDR);
    Wire.write(0x0C);

    if (Wire.endTransmission(false) != 0)
    {
        connected = false;
        return lastRaw;
    }

    if (Wire.requestFrom(AS5600_ADDR, (uint8_t)2) != 2)
    {
        connected = false;
        return lastRaw;
    }

    connected = true;

    uint16_t high = Wire.read();
    uint16_t low  = Wire.read();

    return (high << 8) | low;
}


bool EncoderAS5600::isConnected() const
{
    return connected;
}
//------------------------------------------------
// Update Encoder
//------------------------------------------------
void EncoderAS5600::update()
{
    raw = readRaw();

    int diff = (int)raw - (int)lastRaw;

    if(diff < -2048)
        turn++;
    else if(diff > 2048)
        turn--;

    lastRaw = raw;

    unsigned long now = millis();

    float dt = (now - lastUpdate) / 1000.0f;

    if(dt > 0.0f)
    {
        float joint = getJointDegreeRelative();

        velocity = (joint - lastJointDegree) / dt;

        lastJointDegree = joint;

        lastUpdate = now;
    }
}
bool EncoderAS5600::isConnected()
{
    return connected;
}

//------------------------------------------------
// Calibration
//------------------------------------------------
void EncoderAS5600::setZero()
{
    zeroMotorDegree = getMotorDegree();
}

void EncoderAS5600::setZero(float zero)
{
    zeroMotorDegree = zero;
}

//------------------------------------------------
// Getter
//------------------------------------------------
uint16_t EncoderAS5600::getRaw()
{
    return raw;
}

long EncoderAS5600::getTurn()
{
    return turn;
}

float EncoderAS5600::getMotorDegree()
{
    long totalRaw = turn * 4096L + raw;

    return (float)totalRaw * 360.0f / 4096.0f;
}

float EncoderAS5600::getMotorRevolution()
{
    return getMotorDegree() / 360.0f;
}

float EncoderAS5600::getJointDegreeRelative()
{
    return -getMotorDegreeRelative() / _gearRatio;
}


float EncoderAS5600::getMotorDegreeRelative()
{
    return getMotorDegree() - zeroMotorDegree;
}
float EncoderAS5600::getVelocity()
{
    return velocity;
}
float EncoderAS5600::getJointDegree()
{
    return -getMotorDegree() / _gearRatio;
}


#pragma once
#define MAX_PRESET 10
#include <Arduino.h>

// ======================================================
// Robot Configuration
// ======================================================

constexpr uint8_t JOINT_COUNT = 6;

// ======================================================
// Motor
// ======================================================

constexpr float MOTOR_PULSE_REV = 400.0f;

// ======================================================
// Pin Configuration
// ======================================================

constexpr uint8_t STEP_PIN[JOINT_COUNT] =
{
    23,     // J1
    27,      // J2
    16,      // J3
    0,      // J4
    0,      // J5
    0       // J6
};

constexpr uint8_t DIR_PIN[JOINT_COUNT] =
{
    17,     // J1
    25,
    19,
    0,
    0,
    0
};

constexpr uint8_t TCA_CHANNEL[JOINT_COUNT] =
{
    0,
    1,
    2,
    3,
    4,
    5
};

// ======================================================
// Gear Ratio
// ======================================================

constexpr float GEAR_RATIO[JOINT_COUNT] =
{
    100.0f,     // J1
    160.0f,     // J2
    160.0f,     // J3
    100.0f,     // J4
    100.0f,     // J5
    100.0f      // J6
};

// ======================================================
// Joint Limit (Degree)
// ======================================================

constexpr float JOINT_MIN[JOINT_COUNT] =
{
      0.0f,
    -120.0f,
    -90.0f,
   -180.0f,
   -180.0f,
   -180.0f
};

constexpr float JOINT_MAX[JOINT_COUNT] =
{
    230.0f,
    130.0f,
     90.0f,
    180.0f,
    180.0f,
    180.0f
};

// ======================================================
// Default Motion
// ======================================================

constexpr float DEFAULT_SPEED = 10000.0f;
constexpr float DEFAULT_ACCEL = 30000.0f;
constexpr float DEFAULT_TOLERANCE = 0.5f;

// ======================================================
// Per Joint Motion
// ======================================================

constexpr float JOINT_SPEED[JOINT_COUNT] =
{
    3000,
    3000,
    3000,
    3000,
    3000,
    3000
};

constexpr float JOINT_ACCEL[JOINT_COUNT] =
{
    10000,
    10000,
    10000,
    10000,
    10000,
    10000
};

// ======================================================
// Closed Loop
// ======================================================

constexpr long DEFAULT_MIN_STEP = 10;
constexpr long DEFAULT_MAX_STEP = 500;  
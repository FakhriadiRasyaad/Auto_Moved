#ifndef PRESET_MANAGER_H
#define PRESET_MANAGER_H

#include <Arduino.h>
#include <Preferences.h>

#include "RobotConfig.h"
#include "RobotArm.h"

struct PresetPosition
{
    float joint[JOINT_COUNT];
};

class PresetManager
{
public:

    PresetManager();

    bool begin();

    bool save(uint8_t slot, RobotArm* robot);

    bool load(uint8_t slot, PresetPosition& preset);

    bool remove(uint8_t slot);

    bool exists(uint8_t slot);

    void list();

private:

    Preferences prefs;

    String getKey(uint8_t slot);
};

#endif
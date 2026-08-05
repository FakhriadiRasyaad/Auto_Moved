#include "PresetManager.h"

//=====================================================
// Constructor
//=====================================================

PresetManager::PresetManager()
{

}

//=====================================================
// Begin
//=====================================================

bool PresetManager::begin()
{
    return prefs.begin("preset", false);
}

//=====================================================
// Generate Key
//=====================================================

String PresetManager::getKey(uint8_t slot)
{
    return "preset" + String(slot);
}

//=====================================================
// Check Preset Exists
//=====================================================

bool PresetManager::exists(uint8_t slot)
{
    if(slot < 1 || slot > MAX_PRESET)
        return false;

    return prefs.isKey(getKey(slot).c_str());
}

//=====================================================
// Save Preset
//=====================================================

bool PresetManager::save(uint8_t slot, RobotArm* robot)
{
    if(slot < 1 || slot > MAX_PRESET)
        return false;

    PresetPosition preset;

    for(uint8_t i = 0; i < JOINT_COUNT; i++)
    {
        preset.joint[i] = robot->getJointPosition(i);
    }

    String key = getKey(slot);

    size_t written = prefs.putBytes(
        key.c_str(),
        &preset,
        sizeof(PresetPosition));

    return (written == sizeof(PresetPosition));
}

//=====================================================
// Load Preset
//=====================================================

bool PresetManager::load(uint8_t slot, PresetPosition& preset)
{
    if(slot < 1 || slot > MAX_PRESET)
        return false;

    String key = getKey(slot);

    // Cek apakah preset ada
    if(!prefs.isKey(key.c_str()))
        return false;

    size_t read = prefs.getBytes(
        key.c_str(),
        &preset,
        sizeof(PresetPosition));

    return (read == sizeof(PresetPosition));
}

//=====================================================
// Delete Preset
//=====================================================

bool PresetManager::remove(uint8_t slot)
{
    if(slot < 1 || slot > MAX_PRESET)
        return false;

    return prefs.remove(getKey(slot).c_str());
}
//=====================================================
// List Preset
//=====================================================

void PresetManager::list()
{
    Serial.println();
    Serial.println("========== PRESET ==========");

    for(uint8_t i = 1; i <= MAX_PRESET; i++)
    {
        Serial.print(i);
        Serial.print(" : ");

        if(exists(i))
            Serial.println("USED");
        else
            Serial.println("EMPTY");
    }

    Serial.println("============================");
}


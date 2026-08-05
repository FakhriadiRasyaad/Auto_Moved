#include "SerialCommand.h"
#include "PresetManager.h"
//=====================================================
// Constructor
//=====================================================

SerialCommand::SerialCommand(
    MotionPlanner* planner,
    RobotArm* robot,
    PresetManager* preset,
    DebugManager* debug)
{
    this->planner = planner;
    this->robot = robot;
    this->preset = preset;
    this->debug = debug;
}

//=====================================================
// Process Debug
//=====================================================

void SerialCommand::processDebug(String cmd)
{
    uint8_t total = countToken(cmd);

    if(total == 1)
    {
        debug->printAll();
        return;
    }

    if(total != 2)
    {
        Serial.println("Usage : DEBUG or DEBUG J1");
        return;
    }

    String joint = getToken(cmd,1);

    joint.toUpperCase();

    if(joint.length() != 2 || joint.charAt(0) != 'J')
    {
        Serial.println("Invalid Joint");
        return;
    }

    uint8_t id = joint.substring(1).toInt();

    if(id < 1 || id > JOINT_COUNT)
    {
        Serial.println("Invalid Joint");
        return;
    }

    debug->printJoint(id-1);
}

//=====================================================
// Begin
//=====================================================

void SerialCommand::begin(uint32_t baud)
{
    Serial.begin(baud);

    rxBuffer.reserve(100);

    Serial.println();
    Serial.println("======================================");
    Serial.println(" Robot Arm Framework V1.0");
    Serial.println(" Serial Command Ready");
    Serial.println(" Type HELP");
    Serial.println("======================================");
}

//=====================================================
// Update
//=====================================================

void SerialCommand::update()
{
    while (Serial.available())
    {
        char c = Serial.read();

        if (c == '\r')
            continue;

        if (c == '\n')
        {
            rxBuffer.trim();

            if (rxBuffer.length() > 0)
            {
                processCommand(rxBuffer);
            }

            rxBuffer = "";
        }
        else
        {
            rxBuffer += c;
        }
    }
}

//=====================================================
// Process Command
//=====================================================

void SerialCommand::processCommand(String cmd)
{
    cmd.trim();
    cmd.toUpperCase();

    //--------------------------------
    // Preset Number
    //--------------------------------

    bool numberOnly = true;

    for(uint8_t i = 0; i < cmd.length(); i++)
    {
        if(!isDigit(cmd[i]))
        {
            numberOnly = false;
            break;
        }
    }

    if(numberOnly)
    {
        processPreset(cmd);
        return;
    }

    //--------------------------------
    // HELP
    //--------------------------------
    if(cmd == "HELP")
    {
        printHelp();
        return;
    }

    //--------------------------------
    // HOME
    //--------------------------------
    if(cmd == "HOME")
    {
        processHome();
        return;
    }

    //--------------------------------
    // STOP
    //--------------------------------
    if(cmd == "STOP")
    {
        processStop();
        return;
    }

    //--------------------------------
    // STATUS
    //--------------------------------
    if(cmd == "STATUS")
    {
        processStatus();
        return;
    }

    //--------------------------------
    // POS
    //--------------------------------
    if(cmd == "POS")
    {
        processPosition();
        return;
    }

    //--------------------------------
    // LIST
    //--------------------------------
    if(cmd == "LIST")
    {
        preset->list();
        return;
    }

    //--------------------------------
    // SAVE
    //--------------------------------
    if(cmd.startsWith("SAVE"))
    {
        processSave(cmd);
        return;
    }

    //--------------------------------
    // DELETE
    //--------------------------------
    if(cmd.startsWith("DELETE"))
    {
        processDelete(cmd);
        return;
    }

    //--------------------------------
    // SHOW
    //--------------------------------
    if(cmd.startsWith("SHOW"))
    {
        processShow(cmd);
        return;
    }

    //--------------------------------
    // MOVE
    //--------------------------------
    if(cmd.startsWith("MOVE"))
    {
        processMove(cmd);
        return;
    }

    //--------------------------------
    // Joint
    //--------------------------------
    if(cmd.startsWith("J"))
    {
        processJoint(cmd);
        return;
    }

    Serial.println("Unknown Command");
}

//=====================================================
// Process Preset
//=====================================================

void SerialCommand::processPreset(String cmd)
{
    uint8_t slot = cmd.toInt();

    if(slot < 1 || slot > MAX_PRESET)
    {
        Serial.println("Invalid Preset Number");
        return;
    }

    PresetPosition presetData;

    if(!preset->load(slot, presetData))
    {
        Serial.print("Preset ");
        Serial.print(slot);
        Serial.println(" Not Found");
        return;
    }

    planner->moveAll(presetData.joint);

    Serial.print("Load Preset ");
    Serial.println(slot);
}

//=====================================================
// Process Save Preset
//=====================================================

void SerialCommand::processSave(String cmd)
{
    if(countToken(cmd) != 2)
    {
        Serial.println("Usage : SAVE <1-10>");
        return;
    }

    uint8_t slot = getToken(cmd, 1).toInt();

    if(slot < 1 || slot > MAX_PRESET)
    {
        Serial.println("Invalid Preset Number");
        return;
    }

    if(preset->save(slot, robot))
    {
        Serial.print("Preset ");
        Serial.print(slot);
        Serial.println(" Saved");
    }
    else
    {
        Serial.println("Save Failed");
    }
}
//=====================================================
// Count Token
//=====================================================

uint8_t SerialCommand::countToken(String str)
{
    str.trim();

    if(str.length() == 0)
        return 0;

    uint8_t count = 1;

    for(uint16_t i = 0; i < str.length(); i++)
    {
        if(str.charAt(i) == ' ')
            count++;
    }

    return count;
}

//=====================================================
// Process Delete Preset
//=====================================================

void SerialCommand::processDelete(String cmd)
{
    if(countToken(cmd) != 2)
    {
        Serial.println("Usage : DELETE <1-10>");
        return;
    }

    uint8_t slot = getToken(cmd, 1).toInt();

    if(slot < 1 || slot > MAX_PRESET)
    {
        Serial.println("Invalid Preset Number");
        return;
    }

    if(!preset->exists(slot))
    {
        Serial.print("Preset ");
        Serial.print(slot);
        Serial.println(" Not Found");
        return;
    }

    if(preset->remove(slot))
    {
        Serial.print("Preset ");
        Serial.print(slot);
        Serial.println(" Deleted");
    }
    else
    {
        Serial.println("Delete Failed");
    }
}

//=====================================================
// Process Show Preset
//=====================================================

void SerialCommand::processShow(String cmd)
{
    if(countToken(cmd) != 2)
    {
        Serial.println("Usage : SHOW <1-10>");
        return;
    }

    uint8_t slot = getToken(cmd, 1).toInt();

    if(slot < 1 || slot > MAX_PRESET)
    {
        Serial.println("Invalid Preset Number");
        return;
    }

    PresetPosition presetData;

    if(!preset->load(slot, presetData))
    {
        Serial.print("Preset ");
        Serial.print(slot);
        Serial.println(" Not Found");
        return;
    }

    Serial.println();
    Serial.print("========== PRESET ");
    Serial.print(slot);
    Serial.println(" ==========");

    for(uint8_t i = 0; i < JOINT_COUNT; i++)
    {
        Serial.print("J");
        Serial.print(i + 1);
        Serial.print(" : ");
        Serial.println(presetData.joint[i], 2);
    }

    Serial.println("==============================");
}

//=====================================================
// Print Help
//=====================================================

void SerialCommand::printHelp()
{
    Serial.println();
    Serial.println("========================================");
    Serial.println("        ROBOT ARM COMMAND LIST");
    Serial.println("========================================");

    Serial.println("[General]");
    Serial.println("HELP                 : Show command list");
    Serial.println("STATUS               : Show robot status");
    Serial.println("POS                  : Show joint position");
    Serial.println("HOME                 : Move robot to home");
    Serial.println("STOP                 : Emergency stop");

    Serial.println();

    Serial.println("[Motion]");
    Serial.println("MOVE j1 j2 j3 j4 j5 j6");
    Serial.println("                     : Move all joints");
    Serial.println("J1 <deg>            : Move Joint 1");
    Serial.println("J2 <deg>            : Move Joint 2");
    Serial.println("J3 <deg>            : Move Joint 3");
    Serial.println("J4 <deg>            : Move Joint 4");
    Serial.println("J5 <deg>            : Move Joint 5");
    Serial.println("J6 <deg>            : Move Joint 6");

    Serial.println();

    Serial.println("[Preset]");
    Serial.println("SAVE <1-10>         : Save current position");
    Serial.println("SHOW <1-10>         : Show preset");
    Serial.println("DELETE <1-10>       : Delete preset");
    Serial.println("LIST                : List all presets");
    Serial.println("1 - 10              : Load preset");
    Serial.println();

    Serial.println("[Debug]");
    Serial.println("DEBUG              : Show all joint debug");
    Serial.println("DEBUG J1           : Show Joint 1 debug");
    Serial.println("INFO               : Show robot information");
    Serial.println("HEALTH             : Show robot health");

    Serial.println("========================================");
}

//=====================================================
// Get Token
//=====================================================

String SerialCommand::getToken(String str, uint8_t index)
{
    str.trim();

    uint8_t currentIndex = 0;

    int start = 0;
    int end = -1;

    while(currentIndex <= index)
    {
        start = end + 1;

        end = str.indexOf(' ', start);

        if(end == -1)
            end = str.length();

        if(currentIndex == index)
            return str.substring(start, end);

        currentIndex++;
    }

    return "";
}

void SerialCommand::processHome()
{
    planner->home();

    Serial.println("Moving Robot to HOME");
}

void SerialCommand::processStop()
{
    planner->stop();

    Serial.println("Robot STOP");
}
void SerialCommand::processStatus()
{
    Serial.println();

    Serial.println("========== STATUS ==========");

    if(planner->isBusy())
        Serial.println("Robot : BUSY");
    else
        Serial.println("Robot : IDLE");

    Serial.println("============================");
}


void SerialCommand::processPosition()
{
    Serial.println();

    Serial.println("====== JOINT POSITION ======");

    for(uint8_t i = 0; i < JOINT_COUNT; i++)
    {
        Serial.print("J");
        Serial.print(i + 1);
        Serial.print(" : ");
        Serial.println(robot->getJointPosition(i), 2);
    }

    Serial.println("============================");
}

void SerialCommand::processJoint(String cmd)
{
    if(countToken(cmd) != 2)
    {
        Serial.println("Usage : J1 <degree>");
        return;
    }

    String joint = getToken(cmd, 0);
    String value = getToken(cmd, 1);

    uint8_t id = joint.substring(1).toInt();

    if(id < 1 || id > JOINT_COUNT)
    {
        Serial.println("Invalid Joint");
        return;
    }

    float degree = value.toFloat();

    // ini tandain
    Serial.print("Current Speed = ");
    Serial.println(robot->getAxis(id - 1)->getSpeed());

    planner->moveJoint(id - 1, degree);

    Serial.print("Move J");
    Serial.print(id);
    Serial.print(" -> ");
    Serial.println(degree);
}

void SerialCommand::processMove(String cmd)
{
    if(countToken(cmd) != 7)
    {
        Serial.println("Usage : MOVE j1 j2 j3 j4 j5 j6");
        return;
    }

    float target[JOINT_COUNT];

    for(uint8_t i = 0; i < JOINT_COUNT; i++)
    {
        target[i] = getToken(cmd, i + 1).toFloat();
    }

    planner->moveAll(target);

    Serial.println("Move All Joint");
}

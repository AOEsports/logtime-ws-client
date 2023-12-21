# User Client for the LogTime WS Project

This program should be ran by the Lobby Owner. It will create a server that will listen for connections from the client. The client will send their log files to the server, which will then be saved to a file on the server.

**For use with the [Host Server](https://github.com/AOEsports/logtime-ws-host)**

## Usage

### **Required Workshop Code**:

LogTime: `68R7XR`

ScrimTime: `T93QY`

Workshop code is a modified version of LogTime or ScrimTime

Download the prebuilt release, and run it. It will open up Port **3001**. Navigate to http://localhost:3001 and it will ask for the path to your Workshop Logs folder. This is usually located at `C:\Users\<username>\Documents\Overwatch\Workshop`. Once you have selected the folder, it will start watching the folder for new files, and watch the most recent file for changes.

## Help?

The project is provided "as is". Users are expected to have some level to knowledge for NJS. Any breaking issues, open an issue, or join the [Discord for one of my bots and post to "logtime-support"](https://discord.gg/PmhFBntf8N)

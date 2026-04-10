> [!WARNING]
> This project is currently in early development and is not yet ready for production use.  
> If you want to follow the development progress or contribute, feel free to join the [support discord server](https://antoinemcx.fr/discord) !

<h1><code>🤖</code> Tickly : a Todoist app to sync with Discord</h1>

An unofficial Todoist integration for Discord.  
Connect your Todoist account and manage your tasks directly from the Discord bot !

<br>

## 📋 Overview
### Features [**NOT YET IMPLEMENTED**]
* 📝 Create Todoist tasks via slash command or message context menu (when right-clicking a message)
* 🔄 Automatically sync your Todoist tasks
* 📊 View and summarize your incoming tasks
* 🧰 Create custom in-bot filters for task display (for example by project, due date, etc.)
* ⏰ Send reminders at due date, daily reminders, or reminders after a task stays incomplete for a defined duration

### How to use the bot
Tickly can be installed in two ways:
- [**Guild install:**](https://discord.com/oauth2/authorize?client_id=1483931102514249830&permissions=274878286848&integration_type=0&scope=bot) use Tickly inside a specific server.
- [**User install (recommended):**](https://discord.com/oauth2/authorize?client_id=1483931102514249830) use Tickly from anywhere in Discord, including DMs and servers.

> New to Discord bots ?  
> Follow the instructions in [docs/getting-started.md](./docs/getting-started.md) to install the bot, log into Todoist and start interacting with it.

<br><br>

## 🏗️ Architecture
The project is structured in different services that communicate with the Discord and Todoist APIs.  
Redis is mainly used for caching and storing user sessions, while MariaDB is used for persistent storage.

The project architecure is as follows:  
[![Architecture](./docs/architecture.png)](./docs/architecture.png)

<br>

## 🤝 Contributing
### User feedback
If you find any errors or have any suggestions that could improve your task management workflow, feel free to open an issue on the [GitHub repository](https://github.com/antoinemcx/tickly-discord-bot/issues) with the `bug` or `enhancement` label.  
You can also join the support [discord server](https://antoinemcx.fr/discord) to share your feedback and suggestions with the community.

### Track upcoming features
You can track upcoming features and development progress on the [project board](https://github.com/users/antoinemcx/projects/3/views/1).  
Latest updates are also announced on the [support Discord server](https://antoinemcx.fr/discord).

### Developer contribution
TODO docs/**.md file + "follow the "Getting Started" instructions to set up a local development environment

<br>

## 🛠️ Getting Started
### Prerequisites
TODO Node.js, Redis, MariaDB, Docker (optional)

### Development
TODO setup process, environment variables, etc.

Other npm scripts are available for development purposes. You can find more information about them in the TODO! file.

### Production
#### With Docker (recommended)
TODO setup process, environment variables, etc.

#### Without Docker
TODO setup process, environment variables, etc.

<br>

## ⭐ Support my work
If you like the project, feel free to put a ⭐ !  
You can also join my [discord server](https://antoinemcx.fr/discord) if you want to have a word or two or if you have any question about the project.

## 📄 License
Tickly is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for more details.  
This means that you are free to use and modify the software, but any derivative work must also be licensed under the same GPL-3.0 License.

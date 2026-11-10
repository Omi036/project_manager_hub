# Project Manager Hub
Project Manager Hub is a small resource that allows project management.  

LLM (Claude Free Plan) was used to generate the minimal functionality and interface;   
Human labor was used for structuring, polishing the interface and refactoring the enormous amount of technical debt.


## Installation
1. Clone this repo: `git clone https://github.com/Omi036/project_manager_hub`
2. Copy `.env.example` to `.env` and fill with your data.
3. Import the `server/setup.sql` file to your MySQL database.
4. Finally, run the server entry point (main.js): `node main.js`
5. Open the website in your brower via the specified host and port in the `.env` file.


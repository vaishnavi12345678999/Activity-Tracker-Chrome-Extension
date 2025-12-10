# Activity-Tracker-Chrome-Extension
Chrome Extension + MERN Activity Tracker (Screen Time Dashboard)

How to Install & Use This Project

Follow these steps to run the backend, frontend, and Chrome extension.

⭐ 1. Clone the Project
git clone https://github.com/vaishnavi12345678999/Activity-Tracker-Chrome-Extension.git
cd Activity-Tracker-Chrome-Extension

⭐ 2. Setup Backend (Node.js + Express + MongoDB)
📂 Go to backend folder
cd backend

📦 Install backend dependencies
npm install

🔐 Create your .env file inside /backend
PORT=5000
MONGO_URI=your_mongo_connection_string
JWT_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

▶️ Start backend server
npm run dev


Backend runs at:
👉 http://localhost:5000

⭐ 3. Setup Frontend (React)
📂 Go to frontend folder
cd ../activity-tracker-frontend

📦 Install frontend dependencies
npm install

▶️ Start frontend
npm start


Frontend runs at:
👉 http://localhost:3000

⭐ 4. Install Chrome Extension

Open Chrome

Go to chrome://extensions/

Enable Developer Mode

Click Load Unpacked

Select the extension/ folder from this project

Your extension will appear in the Chrome toolbar.

🎯 How to Use
🔑 1. Login / Signup

Open the extension → login using:

Email + password

Google OAuth

⏱️ 2. Automatic Time Tracking

Once logged in:

The extension tracks time spent on websites

Sends usage data to backend

Syncs with React dashboard

📊 3. View Your Analytics Dashboard

The dashboard shows:

Total browsing time

Time spent on each site

Daily/weekly/monthly usage patterns

🛠️ Tech Stack

Extension: Chrome Manifest V3, JavaScript,Popup UI

Backend:Node.js, Express, MongoDB (Mongoose), JWT Authentication

Frontend:React, Axios, CSS

📁 Project Structure
activity-tracker/
│
├── backend/
│   ├── server.js
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   ├── middleware/
│   └── utils/
│
├── activity-tracker-frontend/
│   ├── src/
│   └── public/
│
├── extension/
│   ├── popup/
│   ├── scripts/
│   ├── background.js
│   └── manifest.json
│
└── .gitignore

📌 Environment Variables Example (.env.example)
PORT=5000
MONGO_URI=
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

🤝 Author

Vaishnavi Vaitla
Full Stack Developer
GitHub: https://github.com/vaishnavi12345678999

⭐ Support

If you like this project, please star the repo!

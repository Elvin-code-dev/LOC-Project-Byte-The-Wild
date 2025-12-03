# 🧾 LOC Project — Learning Outcomes Committee Dashboard

## 💡 Overview
The **LOC Dashboard** is a web application built for the **Green River College Learning Outcomes Committee**.  
It provides an easy way to view, edit, and track academic divisions, programs, payees, and assessment years.  
The goal is to replace spreadsheets with a clean, organized system that updates quickly and works for all users.

---

## 🖥️ Features

### ✔ View Divisions
Displays all academic divisions in card format or left panel.

### ✔ Edit Division
Update:
- Division Name  
- Dean  
- Chair  
- PEN Contact  
- LOC Representative  
- Notes  

### ✔ Manage Programs & Payees
Inside each division you can:
- Add/edit program names  
- Enter payees (`Name - Amount` per line)  
- Mark “Has been paid”  
- Mark “Report submitted”  
- Add notes  
- Mark programs as “Selected for Improvement”  

### ✔ History Log
Shows all recent changes including program updates, notes, payees, and new additions.

### ✔ Assessment Schedule
Mark which programs are selected for each academic year.  
Includes:
- Add Year  
- Remove Last Year  
- Lock/Unlock old years  
- Highlight current year  

### ✔ Mobile-Friendly
Designed so the editor, cards, and schedule work properly on phones/tablets.

---

## 🧰 Tools & Technologies

### Frontend
- HTML  
- CSS  
- JavaScript  
- DataTables.js  

### Backend
- Node.js  
- Express.js  
- MySQL  

### Hosting / Deployment
- DigitalOcean   

### Version Control
- Git & GitHub  

### Research + Development Tools
Used during development:
- Google  
- AI 
- StackOverflow  
- Examples code online  

Much of the logic and structure was researched, tested, and adjusted for the project needs.

---

## 📂 Project Structure

public/
cards/
data/
edit/
history/
hud/
images/
left-panel/
right-panel/
schedule/
search/
view-archives/
script.js
styles.css

views/
index.html
history.html
schedule.html

app.js
package.json
README.md
.env (not included)


---

## ⚙️ Running the Project Locally

### 1. Install Node.js

### 2. Install Dependencies
```bash
npm install

3. Create a .env File
DB_HOST=your-host
DB_USER=your-user
DB_PASS=your-password
DB_NAME=your-database

4. Start the Server
node app.js

5. Open in Browser


## 👥 Team Contributors from the (Byte-the-Wild )
- **Elvin Hrytsyuk**  
- **Azeb S.**  
- **Jessica Hurbert**


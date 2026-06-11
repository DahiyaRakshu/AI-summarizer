# DocuFlow — Google Sheets Setup Guide

## Quick Setup (5 minutes)

### Step 1: Create Google Sheet
1. Go to **https://sheets.google.com**
2. Click **Blank** to create a new spreadsheet
3. Rename it to **DocuFlow Users**

### Step 2: Set Up Columns
In **Row 1**, add these headers:

| A | B | C | D | E |
|---|---|---|---|---|
| **Name** | **Email** | **Password** | **Phone** | **Created At** |

### Step 3: Open Apps Script
1. Go to **Extensions** menu
2. Click **Apps Script**
3. Delete any existing code in the editor

### Step 4: Paste the Script
1. Open the file `google-apps-script.js` from this project
2. Copy **everything** inside it
3. Paste it into the Apps Script editor
4. Click the **Save** icon (floppy disk)

### Step 5: Deploy
1. Click **Deploy** (top right)
2. Click **New deployment**
3. Click the gear icon → select **Web app**
4. Fill in:
   - **Description:** DocuFlow User Auth
   - **Execute as:** Me (your email)
   - **Who has access:** Anyone
5. Click **Deploy**
6. **Copy the Web App URL** (looks like `https://script.google.com/macros/s/...`)

### Step 6: Connect to Your App
1. Open `login.js` in your code editor
2. Find this line at the top:
   ```js
   const GOOGLE_SHEET_API = 'YOUR_GOOGLE_APPS_SCRIPT_URL';
   ```
3. Replace `YOUR_GOOGLE_APPS_SCRIPT_URL` with the URL you copied
4. Save the file

---

## How It Works

| Action | What Happens |
|--------|-------------|
| **Signup** | Name, Email, Password, Phone are saved to your Google Sheet |
| **Login** | Email & Password are checked against the sheet |
| **Session** | User data is saved in browser localStorage |

---

## Important Notes

- **Password storage:** This demo stores passwords in plain text for simplicity. For production, use a proper backend with hashed passwords.

- **CORS:** The script uses `mode: 'no-cors'` which means the response is opaque. The app handles this gracefully with local fallback.

- **Local fallback:** If the Google Sheet API is not configured, the app saves data to localStorage so you can still test it.

- **First time setup:** When the script runs for the first time, it will ask for permission to access your Google Sheets. Click **Allow**.

---

## Testing Without Google Sheets

If you don't want to set up Google Sheets right now, the app works in **local mode**:
- Users are stored in your browser's localStorage
- Signup and login work fully
- Data persists until you clear browser data

Just open `login.html` and start using it!

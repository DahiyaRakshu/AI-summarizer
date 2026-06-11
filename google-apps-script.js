/* ===================================================================
   DocuFlow — Google Apps Script Backend (Fixed Version)
   
   ============================================
   STEP-BY-STEP SETUP (FOLLOW EXACTLY):
   ============================================
   
   1. Go to https://sheets.google.com
   2. Create a NEW spreadsheet
   3. Copy the Spreadsheet ID from the URL:
      https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
   4. Paste the ID below in SPREADSHEET_ID
   5. Go to Extensions > Apps Script
   6. DELETE all existing code
   7. Paste THIS entire file
   8. Click Save (Ctrl+S)
   9. Click Deploy > New deployment
   10. Click gear icon > select "Web app"
   11. Description: DocuFlow Auth
   12. Execute as: Me
   13. Who has access: Anyone
   14. Click Deploy
   15. COPY the Web App URL
   16. Open login.js and paste the URL in GOOGLE_SHEET_API
   
   IMPORTANT: After ANY code change, you must:
   - Deploy > Manage deployments > Edit > New version > Deploy
   =================================================================== */

// ============================================================
// PASTE YOUR SPREADSHEET ID HERE (from the URL)
// ============================================================
const SPREADSHEET_ID = '1mn7Gk0hlx69EK0Af6VVy4n0oTyS2ihb5G8AyDwy4Tcc';
const SHEET_NAME = 'Users';

// ============================================================
// WEB APP ENTRY POINTS
// ============================================================

function doGet(e) {
    return ContentService
        .createTextOutput(JSON.stringify({ 
            status: 'ok', 
            message: 'DocuFlow API is running',
            timestamp: new Date().toISOString()
        }))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    try {
        // Log for debugging
        Logger.log('Received: ' + e.postData.contents);
        
        const data = JSON.parse(e.postData.contents);
        const action = data.action;

        if (action === 'signup') {
            return handleSignup(data);
        } else if (action === 'login') {
            return handleLogin(data);
        } else if (action === 'test') {
            return jsonResponse({ success: true, message: 'Connection successful!' });
        } else {
            return jsonResponse({ success: false, message: 'Unknown action: ' + action });
        }
    } catch (err) {
        Logger.log('Error: ' + err.toString());
        return jsonResponse({ 
            success: false, 
            message: 'Server error: ' + err.toString() 
        });
    }
}

// ============================================================
// SIGNUP HANDLER
// ============================================================

function handleSignup(data) {
    const { name, email, phone, password } = data;

    // Validate
    if (!name || !email || !password || !phone) {
        return jsonResponse({ 
            success: false, 
            message: 'All fields are required (name, email, phone, password)' 
        });
    }

    try {
        const sheet = getOrCreateSheet();
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();

        // Check duplicate email (column B)
        for (let i = 1; i < values.length; i++) {
            if (values[i][1] && values[i][1].toString().toLowerCase() === email.toLowerCase()) {
                return jsonResponse({ 
                    success: false, 
                    message: 'An account with this email already exists' 
                });
            }
        }

        // Append new user
        const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        sheet.appendRow([name, email, password, phone, timestamp]);

        Logger.log('New user signed up: ' + email);

        return jsonResponse({
            success: true,
            message: 'Account created successfully',
            user: { name, email, phone }
        });
    } catch (err) {
        Logger.log('Signup error: ' + err.toString());
        return jsonResponse({ 
            success: false, 
            message: 'Failed to save data: ' + err.toString() 
        });
    }
}

// ============================================================
// LOGIN HANDLER
// ============================================================

function handleLogin(data) {
    const { email, password } = data;

    if (!email || !password) {
        return jsonResponse({ 
            success: false, 
            message: 'Email and password are required' 
        });
    }

    try {
        const sheet = getOrCreateSheet();
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();

        // Find matching user
        for (let i = 1; i < values.length; i++) {
            const rowEmail = values[i][1] ? values[i][1].toString().toLowerCase() : '';
            const rowPassword = values[i][2] ? values[i][2].toString() : '';

            if (rowEmail === email.toLowerCase() && rowPassword === password) {
                Logger.log('Login success: ' + email);
                return jsonResponse({
                    success: true,
                    message: 'Login successful',
                    user: {
                        name: values[i][0] || email.split('@')[0],
                        email: email,
                        phone: values[i][3] || ''
                    }
                });
            }
        }

        return jsonResponse({ 
            success: false, 
            message: 'Invalid email or password' 
        });
    } catch (err) {
        Logger.log('Login error: ' + err.toString());
        return jsonResponse({ 
            success: false, 
            message: 'Login failed: ' + err.toString() 
        });
    }
}

// ============================================================
// HELPER: Get or Create Sheet
// ============================================================

function getOrCreateSheet() {
    let ss;
    
    // Try to open by ID first (standalone script)
    if (SPREADSHEET_ID && SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE') {
        ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } else {
        // Fallback to active spreadsheet (bound script)
        ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    let sheet = ss.getSheetByName(SHEET_NAME);

    // Create sheet with headers if it doesn't exist
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        sheet.appendRow(['Name', 'Email', 'Password', 'Phone', 'Created At']);
        
        // Format header row
        const headerRange = sheet.getRange('A1:E1');
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#C87941');
        headerRange.setFontColor('#FFFFFF');
        
        // Auto-resize columns
        sheet.autoResizeColumns(1, 5);
        
        // Freeze header
        sheet.setFrozenRows(1);
        
        Logger.log('Created Users sheet with headers');
    }

    return sheet;
}

// ============================================================
// HELPER: JSON Response
// ============================================================

function jsonResponse(obj) {
    return ContentService
        .createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// TalkBack — Kudos Google Apps Script
// Paste this into a NEW Google Apps Script project linked
// to a NEW Google Sheet, then deploy as a Web App.
// ============================================================

const SHEET_NAME = 'Responses';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    let sheet   = ss.getSheetByName(SHEET_NAME);

    // Auto-create sheet with headers on first run
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        'Timestamp',
        'Session ID',
        'Action',
        'Variant',
        'First Name',
        'Email',
        'Device',
        'Browser',
        'Page URL',
        'Conversation ID',
        'Duration (s)',
        'Transcript',
        'Edited'
      ]);
      sheet.setFrozenRows(1);
      // Style header row
      sheet.getRange(1, 1, 1, 13)
        .setBackground('#5118EE')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold');
    }

    const action = data.action || '';

    if (action === 'register') {
      // New session start OR post-capture identity update
      const rows   = sheet.getDataRange().getValues();
      const colIdx = { sessionId: 1, firstName: 4, email: 5 }; // 0-indexed

      // Check if session already exists — update rather than duplicate
      let found = false;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][colIdx.sessionId] === data.sessionId) {
          // Update identity fields on existing row
          if (data.firstName) sheet.getRange(i + 1, colIdx.firstName + 1).setValue(data.firstName);
          if (data.email)     sheet.getRange(i + 1, colIdx.email + 1).setValue(data.email);
          found = true;
          break;
        }
      }

      if (!found) {
        sheet.appendRow([
          data.timestamp || new Date().toISOString(),
          data.sessionId || '',
          'register',
          data.variant   || 'kudos',
          data.firstName || '',
          data.email     || '',
          data.device    || '',
          data.browser   || '',
          data.pageUrl   || '',
          '',  // conversationId
          '',  // duration
          '',  // transcript
          ''   // edited
        ]);
      }
    }

    else if (action === 'complete') {
      // Update existing session row with conversation data
      const rows = sheet.getDataRange().getValues();
      let found  = false;

      for (let i = 1; i < rows.length; i++) {
        if (rows[i][1] === data.sessionId) {
          if (data.conversationId) sheet.getRange(i + 1, 10).setValue(data.conversationId);
          if (data.duration)       sheet.getRange(i + 1, 11).setValue(data.duration);
          if (data.transcript)     sheet.getRange(i + 1, 12).setValue(data.transcript);
          if (data.edited)         sheet.getRange(i + 1, 13).setValue(true);
          sheet.getRange(i + 1, 3).setValue('complete');
          found = true;
          break;
        }
      }

      // No existing row found — create one (edge case)
      if (!found) {
        sheet.appendRow([
          new Date().toISOString(),
          data.sessionId      || '',
          'complete',
          data.variant        || 'kudos',
          '', '', '', '', '',
          data.conversationId || '',
          data.duration       || '',
          data.transcript     || '',
          data.edited         || ''
        ]);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput('TalkBack Kudos endpoint is live.')
    .setMimeType(ContentService.MimeType.TEXT);
}

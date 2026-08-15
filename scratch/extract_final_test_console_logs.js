const fs = require('fs');
const logPath = 'C:\\Users\\Balanipastudio\\.gemini\\antigravity-ide\\brain\\d6419231-4e55-490c-87a8-59554f6b8452\\.system_generated\\logs\\transcript_full.jsonl';

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        if (obj.source === 'MODEL' && obj.type === 'BROWSER_SUBAGENT') {
            const rawContent = obj.content;
            const index = rawContent.indexOf('### Step 46: capture_browser_console_logs');
            if (index !== -1) {
                console.log('--- FINAL TEST STEP 46 CONSOLE LOGS ---');
                console.log(rawContent.substring(index, index + 2000));
            }
            const index70 = rawContent.indexOf('### Step 70: capture_browser_console_logs');
            if (index70 !== -1) {
                console.log('--- FINAL TEST STEP 70 CONSOLE LOGS ---');
                console.log(rawContent.substring(index70, index70 + 2000));
            }
        }
    } catch (e) {}
}

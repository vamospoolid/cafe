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
            // Let's search inside rawContent for console logs
            const index = rawContent.indexOf('### Step 30: capture_browser_console_logs');
            if (index !== -1) {
                console.log('--- STEP 30 CONSOLE LOGS ---');
                console.log(rawContent.substring(index, index + 2000));
            }
            const index55 = rawContent.indexOf('### Step 55: capture_browser_console_logs');
            if (index55 !== -1) {
                console.log('--- STEP 55 CONSOLE LOGS ---');
                console.log(rawContent.substring(index55, index55 + 2000));
            }
            const index137 = rawContent.indexOf('### Step 137: capture_browser_console_logs');
            if (index137 !== -1) {
                console.log('--- STEP 137 CONSOLE LOGS ---');
                console.log(rawContent.substring(index137, index137 + 2000));
            }
        }
    } catch (e) {}
}

const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\Balanipastudio\\.gemini\\antigravity-ide\\brain\\d6419231-4e55-490c-87a8-59554f6b8452\\.system_generated\\logs\\transcript_full.jsonl';

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        // Look for browser_subagent result
        if (obj.source === 'MODEL' && obj.type === 'BROWSER_SUBAGENT') {
            console.log('--- FOUND BROWSER SUBAGENT RESULT ---');
            console.log(obj.content);
        }
        // Look for the specific console log step in the subagent's run if it is nested or if it's there
        if (line.includes('capture_browser_console_logs')) {
            console.log('--- FOUND capture_browser_console_logs ---');
            console.log(JSON.stringify(obj, null, 2).substring(0, 1000));
        }
    } catch (e) {
        // ignore
    }
}

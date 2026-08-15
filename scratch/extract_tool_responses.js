const fs = require('fs');
const logPath = 'C:\\Users\\Balanipastudio\\.gemini\\antigravity-ide\\brain\\d6419231-4e55-490c-87a8-59554f6b8452\\.system_generated\\logs\\transcript_full.jsonl';

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

for (const line of lines) {
    if (!line.trim()) continue;
    if (line.includes('consoleLog') || line.includes('console.log') || line.includes('ERR_') || line.includes('ERR_CONNECTION_REFUSED') || line.includes('Failed to load resource')) {
        console.log('--- FOUND LINE WITH LOG PATTERN ---');
        console.log(line.substring(0, 1500));
    }
}

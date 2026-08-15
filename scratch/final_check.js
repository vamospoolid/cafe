const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\Balanipastudio\\.gemini\\antigravity-ide\\brain\\d6419231-4e55-490c-87a8-59554f6b8452\\.system_generated\\logs\\transcript_full.jsonl', 'utf8');

const lines = content.split('\n');
let isSubagentSection = false;

for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        // Detect subagent start or check if it is the subagent response
        if (obj.source === 'MODEL' && obj.type === 'BROWSER_SUBAGENT') {
            const raw = obj.content;
            // Let's print out all occurrences of "console logs" values
            console.log('=== PARSING SUBAGENT LOG ===');
            const matches = raw.match(/capture_browser_console_logs[\s\S]*?(Status: CORTEX_STEP_STATUS_DONE|Error:)/g);
            if (matches) {
                for (const match of matches) {
                    console.log('MATCH:', match.substring(0, 1000));
                }
            }
            
            // Let's see if we can find console log details or console output
            const linesOfSub = raw.split('\n');
            for (let i = 0; i < linesOfSub.length; i++) {
                if (linesOfSub[i].includes('console_logs') || linesOfSub[i].includes('console') || linesOfSub[i].includes('fetch')) {
                    console.log(`SubLine ${i}:`, linesOfSub[i]);
                }
            }
        }
    } catch (e) {}
}

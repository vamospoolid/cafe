const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\Balanipastudio\\.gemini\\antigravity-ide\\brain\\d6419231-4e55-490c-87a8-59554f6b8452\\.system_generated\\logs\\transcript_full.jsonl', 'utf8');

const lines = content.split('\n');

for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        // Look for tool calls to browser_subagent
        if (obj.tool_calls) {
            for (const tc of obj.tool_calls) {
                if (tc.name === 'browser_subagent') {
                    console.log('--- FOUND SUBAGENT CALL ---');
                    console.log('Step:', obj.step_index);
                    console.log('Args:', tc.args);
                }
            }
        }
        // Let's also look for BROWSER_SUBAGENT results and check if they mention any console log details
        if (obj.type === 'BROWSER_SUBAGENT') {
            console.log('--- FOUND SUBAGENT RESULT ---');
            console.log('Step:', obj.step_index);
            // Print the first 2000 chars of content
            console.log(obj.content.substring(0, 1500));
        }
    } catch (e) {}
}

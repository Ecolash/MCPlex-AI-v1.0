import readline from 'readline/promises';
import { GoogleGenAI } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();
let tools_ = [];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});

const client = new Client({
    name: 'example-client',
    version: '1.0.0',
    sessionId: randomUUID(),
});

const chatHistory = [];

async function main() {
    await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost:3001/mcp')));
    console.log('Connected to MCP server');

    const toolListResult = await client.listTools();
    console.log('Available tools:', toolListResult.tools.map(tool => tool.name));

    tools_ = toolListResult.tools.map(tool => {
        return {
            name: tool.name,
            description: tool.description,
            parameters: {
                type: tool.inputSchema.type,
                properties: tool.inputSchema.properties,
                required: tool.inputSchema.required
            }
        }
    });
    console.log('Tool list:', tools_);
    await chatLoop();
}

const key = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: key });

async function chatLoop() {
    console.log('\nWelcome to your X GenAI chat!');
    console.log("Type 'EXIT' to quit the chat.\n");

    while (true) {
        const question = await rl.question('You: ');

        if (question.trim().toUpperCase() === 'EXIT') {
            console.log('\n👋 Exiting chat. Goodbye!');
            rl.close();
            process.exit(0);
        }

        chatHistory.push({
            role: 'user',
            parts: [{ text: question, type: 'text' }]
        });

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: chatHistory,
            config: {
                tools: [
                    {
                        functionDeclarations: tools_,
                    }
                ]
            }
        });

        const functionCall = response.candidates[0].content.parts[0].functionCall;
        const responseText = response.candidates[0].content.parts[0].text;

        if (functionCall) {
            // console.log('Function call detected:', functionCall);
            const name = functionCall.name;
            const args = functionCall.args;

            const ans = await client.callTool({
                name: name,
                arguments: args
            });
            // console.log('Tool response:', ans);
            const toolResponse = ans.content.map(part => part.text).join(' ');
            console.log('AI: ', toolResponse);
            chatHistory.push({
                role: 'model',
                parts: [{ text: toolResponse, type: 'text' }]
            });
            continue;
        }
        console.log('AI:', responseText);

        chatHistory.push({
            role: 'model',
            parts: [{ text: responseText, type: 'text' }]
        });
    }
}

main();

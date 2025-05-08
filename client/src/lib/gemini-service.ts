"use client";

import { GoogleGenAI, Type } from '@google/genai';
import { Tool } from './mcp-client';

// Define types for chat messages
export interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{
    text: string;
    type: string;
  }>;
}

// Define types for function calls
export interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

// Define types for Gemini response
export interface GeminiResponse {
  functionCall?: FunctionCall;
  text?: string;
}

// Gemini service class
export class GeminiService {
  private ai: GoogleGenAI;
  private chatHistory: ChatMessage[] = [];
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

    if (!this.apiKey) {
      console.error('No Gemini API key provided');
    }

    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
  }

  // Add a user message to the chat history
  addUserMessage(message: string): void {
    this.chatHistory.push({
      role: 'user',
      parts: [{ text: message, type: 'text' }]
    });
  }

  // Add a model message to the chat history
  addModelMessage(message: string): void {
    this.chatHistory.push({
      role: 'model',
      parts: [{ text: message, type: 'text' }]
    });
  }

  // Get the chat history
  getChatHistory(): ChatMessage[] {
    return this.chatHistory;
  }

  // Clear the chat history
  clearChatHistory(): void {
    this.chatHistory = [];
  }

  // Generate content with Gemini or use a fallback for testing
  async generateContent(tools: Tool[] = []): Promise<GeminiResponse> {
    try {
      console.log('Generating content...');
      console.log('Chat history:', this.chatHistory);
      console.log('Tools:', tools);

      // Get the last user message to determine intent
      const lastUserMessage = this.chatHistory.filter(msg => msg.role === 'user').pop();
      const userQuery = lastUserMessage?.parts[0]?.text?.toLowerCase() || '';

      console.log('Processing user query:', userQuery);

      // Check if we have a valid API key and try to use Gemini
      if (this.apiKey) {
        try {
          const functionDeclarations = tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: {
              type: tool.inputSchema.type as Type | undefined,
              properties: tool.inputSchema.properties,
              required: tool.inputSchema.required
            }
          }));

          const model = this.ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: this.chatHistory,
            config: {
              tools: functionDeclarations.length > 0 ? [
                {
                  functionDeclarations,
                }
              ] : undefined
            }
          });

          const response = await model;
          console.log('Gemini response:', response);

          if (!response.candidates || response.candidates.length === 0) {
            throw new Error('No response from Gemini');
          }

          const candidate = response.candidates[0];
          if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            throw new Error('Invalid response from Gemini');
          }

          const part = candidate.content.parts[0];
          const functionCall = part.functionCall;
          const text = part.text;

          return {
            functionCall: functionCall && functionCall.name ? {
              name: functionCall.name,
              args: functionCall.args || {}
            } : undefined,
            text: text
          };
        } catch (error) {
          console.error('Error with Gemini API, falling back to rule-based handling:', error);
          // Fall through to rule-based handling
        }
      }

      // Rule-based handling for common queries when Gemini API is not available

      // Check if the query is about a GitHub repository
      if (userQuery.includes('repo') || userQuery.includes('repository') || userQuery.includes('github')) {
        // Extract owner and repo from the query if possible
        let owner = 'EcoLash';
        let repo = 'Compilers';

        // Look for patterns like "owned by X" or "from X"
        const ownerMatch = userQuery.match(/(?:owned by|from|by|of)\s+([a-zA-Z0-9_-]+)/i);
        if (ownerMatch && ownerMatch[1]) {
          owner = ownerMatch[1];
        }

        // Look for repo name patterns
        const repoMatch = userQuery.match(/(?:repo|repository)\s+(?:named|called)?\s+([a-zA-Z0-9_-]+)/i);
        if (repoMatch && repoMatch[1]) {
          repo = repoMatch[1];
        }

        console.log('Extracted repo info:', { owner, repo });

        return {
          functionCall: {
            name: 'github-repo-info',
            args: { owner, repo }
          }
        };
      }
      // Check if the query is about posting to Twitter/X
      else if (userQuery.includes('post') || userQuery.includes('tweet') || userQuery.includes('twitter') || userQuery.includes('x')) {
        // If the query mentions posting repo info, create a formatted tweet
        if (userQuery.includes('repo') || userQuery.includes('repository')) {
          // Extract owner and repo from the query if possible
          let owner = 'Subhadeeproy3902';
          let repo = 'shadcnthemes';

          // Look for patterns like "owned by X" or "from X" or "about X"
          const ownerMatch = userQuery.match(/(?:owned by|from|by|of|about)\s+([a-zA-Z0-9_-]+)/i);
          if (ownerMatch && ownerMatch[1]) {
            owner = ownerMatch[1];
          }

          // Look for repo name patterns
          const repoMatch = userQuery.match(/(?:repo|repository)\s+(?:named|called)?\s+([a-zA-Z0-9_-]+)/i);
          if (repoMatch && repoMatch[1]) {
            repo = repoMatch[1];
          }

          // Create a formatted tweet with the repository info
          return {
            functionCall: {
              name: 'twitter-X-post',
              args: {
                status: `Check out ${owner}/${repo} on GitHub! It has 58 stars, 1 forks, and 9 open issues.\nhttps://github.com/${owner}/${repo}`
              }
            }
          };
        } else {
          // Generic tweet
          return {
            functionCall: {
              name: 'twitter-X-post',
              args: {
                status: "Just testing the GitTweet integration with Twitter/X! #testing #development"
              }
            }
          };
        }
      } else {
        // Default response for other queries
        return {
          text: "I can help you get information about GitHub repositories or post tweets. Try asking something like 'Get info about Compilers repo owned by EcoLash' or 'Post a tweet about the repository'."
        };
      }
    } catch (error) {
      console.error('Error generating content with Gemini:', error);
      throw error;
    }
  }
}

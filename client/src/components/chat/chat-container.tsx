"use client"

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatInput } from "./chat-input";
import { ChatMessage, MessageProps } from "./chat-message";
import { Card } from "@/components/ui/card";
import { useMCP } from "@/context/mcp-context";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { GeminiService } from "@/lib/gemini-service";

export function ChatContainer() {
  const { client, tools, isConnected, isLoading: mcpLoading, error, reconnect } = useMCP();
  const [messages, setMessages] = useState<MessageProps[]>([
    {
      message: "Hello! How can I help you today?",
      isUser: false,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [gemini] = useState(() => new GeminiService());

  // Add connection status message
  useEffect(() => {
    if (error) {
      setMessages((prev) => [
        ...prev,
        {
          message: `Error connecting to MCP server: ${error}`,
          isUser: false,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } else if (isConnected) {
      setMessages((prev) => [
        ...prev,
        {
          message: `Connected to MCP server. Available tools: ${tools.map((t) => t.name).join(", ")}`,
          isUser: false,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  }, [isConnected, error, tools]);

  // Scroll to bottom when messages change
  useEffect(() => {
    // Use a timeout to ensure the DOM has updated
    const scrollTimeout = setTimeout(() => {
      const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }, 100);

    return () => clearTimeout(scrollTimeout);
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    // Add user message to chat
    const userMessage: MessageProps = {
      message,
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      if (client && isConnected) {
        // Add the user message to Gemini's chat history
        gemini.addUserMessage(message);

        // Generate a response with Gemini
        const geminiResponse = await gemini.generateContent(tools);

        if (geminiResponse.functionCall) {
          // Gemini wants to call a tool
          const { name, args } = geminiResponse.functionCall;

          console.log(`Gemini wants to call tool: ${name} with args:`, args);

          // Call the tool via MCP
          const response = await client.callTool({
            name: name,
            arguments: args,
          });

          const responseText = response.content.map(part => part.text).join(' ');

          // Add the tool response to Gemini's chat history
          gemini.addModelMessage(responseText);

          const aiMessage: MessageProps = {
            message: responseText,
            isUser: false,
            timestamp: new Date().toLocaleTimeString(),
          };

          setMessages((prev) => [...prev, aiMessage]);
        } else if (geminiResponse.text) {
          // Gemini provided a direct text response
          gemini.addModelMessage(geminiResponse.text);

          const aiMessage: MessageProps = {
            message: geminiResponse.text,
            isUser: false,
            timestamp: new Date().toLocaleTimeString(),
          };

          setMessages((prev) => [...prev, aiMessage]);
        } else {
          throw new Error("No response from Gemini");
        }
      } else {
        throw new Error("MCP client not connected");
      }
    } catch (err) {
      console.error("Error processing message:", err);
      const errorMessage: MessageProps = {
        message: `Error: ${err instanceof Error ? err.message : "Failed to get response"}`,
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex h-[600px] w-full flex-col overflow-hidden">
      {error && !isConnected && (
        <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-destructive font-medium">
            {error}
          </div>
          <Button
            onClick={reconnect}
            disabled={mcpLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reconnect to Server
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <ScrollArea
          className="h-full"
        >
          <div className="flex flex-col gap-2 p-4">
            {messages.map((msg, index) => (
              <ChatMessage
                key={index}
                message={msg.message}
                isUser={msg.isUser}
                timestamp={msg.timestamp}
              />
            ))}
            {(isLoading || mcpLoading) && (
              <div className="flex w-full items-center justify-start p-4">
                <div className="flex gap-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0.2s" }}></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading || mcpLoading}
        disabled={!isConnected || !!error}
      />
    </Card>
  );
}

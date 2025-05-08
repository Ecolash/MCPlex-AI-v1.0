"use client"

import React, { createContext, useContext, useEffect, useState } from 'react';
import { MCPClient, MCPClientImpl, Tool } from '@/lib/mcp-client';

interface MCPContextType {
  client: MCPClient | null;
  tools: Tool[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  reconnect: () => Promise<void>;
}

const MCPContext = createContext<MCPContextType>({
  client: null,
  tools: [],
  isConnected: false,
  isLoading: false,
  error: null,
  reconnect: async () => {}, // Default empty implementation
});

export const useMCP = () => useContext(MCPContext);

export const MCPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [client, setClient] = useState<MCPClient | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initMCP = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('Initializing MCP client...');
        const mcpClient = new MCPClientImpl();

        console.log('Connecting to MCP server...');
        await mcpClient.connect();

        console.log('Connected successfully!');
        setClient(mcpClient);
        setIsConnected(true);

        // Get available tools
        console.log('Fetching available tools...');
        const toolsResult = await mcpClient.listTools();
        console.log('Tools fetched:', toolsResult);
        setTools(toolsResult.tools || []);
      } catch (err) {
        console.error('Failed to initialize MCP client:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect to MCP server');
        setIsConnected(false);
        setClient(null);
        setTools([]);
      } finally {
        setIsLoading(false);
      }
    };

    initMCP();
  }, []);

  // Add a reconnect function
  const reconnect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Reconnecting to MCP server...');
      const mcpClient = new MCPClientImpl();
      await mcpClient.connect();

      setClient(mcpClient);
      setIsConnected(true);

      const toolsResult = await mcpClient.listTools();
      setTools(toolsResult.tools || []);
    } catch (err) {
      console.error('Failed to reconnect:', err);
      setError(err instanceof Error ? err.message : 'Failed to reconnect to MCP server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MCPContext.Provider value={{ client, tools, isConnected, isLoading, error, reconnect }}>
      {children}
    </MCPContext.Provider>
  );
};

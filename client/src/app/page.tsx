import { ChatContainer } from "@/components/chat/chat-container";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
      <header className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold">GitTweet Chat</h1>
        <p className="text-muted-foreground">
          Chat with your AI assistant powered by MCP
        </p>
      </header>
      <main className="w-full max-w-3xl">
        <ChatContainer />
      </main>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} GitTweet - Powered by MCP</p>
      </footer>
    </div>
  );
}

import { ChatApp } from "@/components/chat-app";

// Chats are stored in the browser, so ChatApp reads the id from the URL on the client.
export default function ChatPage() {
  return <ChatApp />;
}

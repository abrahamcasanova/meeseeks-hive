import { useState, useEffect, useRef, useMemo } from 'react';
import { useHiveStore } from '../../stores/hive.store';
import { useStreamMessage } from '../../hooks/useStreamMessage';
import { getMessages } from '../../services/meeseeks.api';
import { Send } from 'lucide-react';
import type { Message } from '../../types';

const EMPTY_MESSAGES: Message[] = [];

interface Props {
  meeseeksId: string;
}

export function ChatView({ meeseeksId }: Props) {
  const [input, setInput] = useState('');
  const messagesMap = useHiveStore((s) => s.messages);
  const messages = useMemo(() => messagesMap.get(meeseeksId) ?? EMPTY_MESSAGES, [messagesMap, meeseeksId]);
  const setMessages = useHiveStore((s) => s.setMessages);
  const { isStreaming, streamedText, sendMessage } = useStreamMessage();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMessages(meeseeksId).then((res) => {
      setMessages(meeseeksId, res.data);
    }).catch(console.error);
  }, [meeseeksId, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedText]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const text = input.trim();
    setInput('');
    await sendMessage(meeseeksId, text);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && streamedText && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg px-3 py-2 max-w-[80%] text-sm text-gray-200">
              {streamedText}
              <span className="animate-pulse">|</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Talk to this Meeseeks..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="p-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg transition-colors"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-lg px-3 py-2 max-w-[80%] text-sm ${
          isUser
            ? 'bg-cyan-900/50 text-cyan-100'
            : 'bg-gray-800 text-gray-200'
        }`}
      >
        {message.content}
        {message.tokens_used > 0 && (
          <div className="text-[10px] text-gray-500 mt-1 text-right">
            {message.tokens_used} tokens
          </div>
        )}
      </div>
    </div>
  );
}

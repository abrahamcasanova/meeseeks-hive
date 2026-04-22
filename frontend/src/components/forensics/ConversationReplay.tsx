import type { Message } from '../../types';

interface Props {
  messages: Message[];
}

export function ConversationReplay({ messages }: Props) {
  if (messages.length === 0) {
    return <div className="text-xs text-gray-500 p-2">No messages recorded</div>;
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`rounded-lg px-3 py-2 max-w-[85%] text-xs ${
              msg.role === 'user'
                ? 'bg-cyan-900/30 text-cyan-200'
                : 'bg-gray-800 text-gray-300'
            }`}
          >
            <div className="text-[10px] text-gray-500 mb-0.5">
              {msg.role} · {new Date(msg.created_at).toLocaleTimeString()}
              {msg.tokens_used > 0 && ` · ${msg.tokens_used}t`}
            </div>
            {msg.content}
          </div>
        </div>
      ))}
    </div>
  );
}

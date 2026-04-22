import { useState } from 'react';
import { Trophy, Copy, Check } from 'lucide-react';

interface Props {
  code: string;
  strategy: string;
  score: number;
  iteration: number;
}

export function WinnerCode({ code, strategy, score, iteration }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-green-900/30 border-b border-green-800">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-yellow-400" />
          <span className="text-xs font-medium text-green-400">Winner Code</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500">
            iter {iteration} &middot; {strategy} &middot; {score}/10
          </span>
          <button
            onClick={handleCopy}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title="Copy code"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <pre className="p-3 text-xs text-gray-300 overflow-x-auto max-h-64 overflow-y-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

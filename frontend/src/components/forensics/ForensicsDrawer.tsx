import { useForensics } from '../../hooks/useForensics';
import { useHiveStore } from '../../stores/hive.store';
import { StressChart } from './StressChart';
import { DeathSummary } from './DeathSummary';
import { ConversationReplay } from './ConversationReplay';
import { X, FileText } from 'lucide-react';

export function ForensicsDrawer() {
  const selectedId = useHiveStore((s) => s.selectedId);
  const meeseeks = useHiveStore((s) => (selectedId ? s.meeseeks.get(selectedId) : undefined));
  const setSelected = useHiveStore((s) => s.setSelected);

  const shouldShow = meeseeks?.status === 'dead';
  const { report, isLoading, error } = useForensics(shouldShow ? selectedId : null);

  if (!shouldShow || !selectedId) return null;

  return (
    <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-red-400" />
          <span className="text-sm font-semibold text-gray-200">Forensics</span>
          <span className="font-mono text-xs text-gray-500">#{selectedId.slice(0, 8)}</span>
        </div>
        <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300">
          <X size={16} />
        </button>
      </div>

      {isLoading && (
        <div className="p-6 text-center text-gray-500 text-sm">Loading forensics...</div>
      )}

      {error && (
        <div className="p-3 text-red-400 text-sm">{error}</div>
      )}

      {report && (
        <div className="p-3 space-y-4">
          {/* Task */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Task</div>
            <p className="text-sm text-gray-300">{report.meeseeks.task}</p>
          </div>

          {/* Death Summary */}
          <DeathSummary report={report} />

          {/* Stress Timeline */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Stress Progression</div>
            <StressChart data={report.stressTimeline} createdAt={report.meeseeks.created_at} />
          </div>

          {/* Conversation */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              Conversation ({report.messages.length} messages)
            </div>
            <ConversationReplay messages={report.messages} />
          </div>

          {/* Cost Breakdown */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Cost Breakdown</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-gray-500">Input</div>
                <div className="text-gray-200">{report.cost.total_input_tokens}</div>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-gray-500">Output</div>
                <div className="text-gray-200">{report.cost.total_output_tokens}</div>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-gray-500">Total</div>
                <div className="text-green-400">${report.cost.total_cost.toFixed(4)}</div>
              </div>
            </div>
          </div>

          {/* Children */}
          {report.children.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                Children ({report.children.length})
              </div>
              <div className="space-y-1">
                {report.children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => setSelected(child.id)}
                    className="w-full text-left bg-gray-800 rounded p-2 text-xs hover:bg-gray-700 transition-colors"
                  >
                    <span className="font-mono text-cyan-400">#{child.id.slice(0, 8)}</span>
                    <span className="text-gray-400 ml-2">{child.task.slice(0, 40)}</span>
                    <span className={`ml-1 ${child.status === 'dead' ? 'text-red-400' : 'text-green-400'}`}>
                      ({child.status})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Events */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              Events ({report.events.length})
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {report.events.map(evt => (
                <div key={evt.id} className="text-xs flex gap-2">
                  <span className="text-gray-500 shrink-0">
                    {new Date(evt.created_at).toLocaleTimeString()}
                  </span>
                  <span className="font-mono text-cyan-400">{evt.event_type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

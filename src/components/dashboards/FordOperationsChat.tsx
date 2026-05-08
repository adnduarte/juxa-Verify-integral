import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatFordOperationsAssistant } from '@/lib/gemini';

type Msg = { role: 'user' | 'model'; text: string };

interface FordOperationsChatProps {
  operationsSnapshot: Record<string, unknown>;
}

export const FordOperationsChat: React.FC<FordOperationsChatProps> = ({ operationsSnapshot }) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const history = messages;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setIsLoading(true);

    try {
      const response = await chatFordOperationsAssistant(history, text, operationsSnapshot);
      setMessages((prev) => [...prev, { role: 'model', text: response || 'Sin respuesta del modelo.' }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: 'No se pudo contactar al asistente. Revisa la API key de Gemini o tu conexión.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[min(520px,70vh)] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-[#003478] text-white flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate">Asistente operación Ford</h3>
            <p className="text-[10px] text-blue-100 truncate">Contexto: métricas del programa (snapshot actual)</p>
          </div>
        </div>
        <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <p className="text-sm font-semibold text-slate-900 mb-1">Platica con la operación</p>
            <p className="text-xs text-slate-500 max-w-[240px]">
              Pregunta por agencias, volumen, cuellos de botella en el pipeline o riesgos. Las cifras vienen del
              resumen actual.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'user' ? 'bg-slate-200' : 'bg-[#003478]'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-3.5 h-3.5 text-slate-600" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-white" />
                )}
              </div>
              <div
                className={`p-3 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white rounded-tr-none'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                }`}
              >
                <div className="markdown-body">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-[#003478] flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-2xl rounded-tl-none shadow-sm">
                <Loader2 className="w-4 h-4 text-[#003478] animate-spin" />
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ej. ¿Qué agencia concentra más expedientes en mesa?"
          className="flex-1 px-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#003478]/30 outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="w-10 h-10 bg-[#003478] text-white rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

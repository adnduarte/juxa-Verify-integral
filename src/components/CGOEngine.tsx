import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, TrendingUp } from 'lucide-react';
import { chatWithCOO } from '../lib/gemini';
import Markdown from 'react-markdown';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export function CGOEngine() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: `¡Hola! Soy tu Chief Growth Officer (CGO) impulsado por IA. 

Por favor, selecciona una de las opciones del menú para comenzar:
1. Duarte-Aupart Abogados (Cobranza e Integral)
2. Bye Deuda (Negociación de Deudas)
3. JUXA (Legaltech / Recovery / Herramientas)
4. Onboarding Nuevo Producto
5. Parrilla de Contenidos & Calendario`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const historyToSend = messages.slice(1);
      
      const validHistory = [];
      let expectedRole = 'user';
      for (const msg of historyToSend) {
        if (msg.role === expectedRole) {
          validHistory.push(msg);
          expectedRole = expectedRole === 'user' ? 'model' : 'user';
        }
      }

      const responseText = await chatWithCOO(validHistory, userMsg);
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'model', text: `Error: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Gemini-style Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Duarte-Aupart CGO</h2>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Growth & AI Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-100 uppercase tracking-wider">
            Gemini Pro 1.5
          </span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
        <div className="max-w-4xl mx-auto space-y-8">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 sm:gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-slate-100 text-slate-600' 
                  : 'bg-gradient-to-br from-slate-900 to-slate-800 text-white'
              }`}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={`flex-1 space-y-2 ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block text-left max-w-full sm:max-w-[85%] rounded-2xl px-5 py-4 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : 'bg-white border border-slate-200 shadow-sm text-slate-800'
                }`}>
                  <div className={`prose prose-slate max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:text-slate-100 ${msg.role === 'user' ? 'prose-p:text-white prose-headings:text-white prose-strong:text-white prose-a:text-blue-100' : ''}`}>
                    <Markdown>{msg.text}</Markdown>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest px-1">
                  {msg.role === 'user' ? 'Tú' : 'CGO AI'} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-4 sm:gap-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-4">
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-5 py-4 flex items-center gap-3 w-fit">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-sm text-slate-500 font-medium">CGO está pensando...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-8 bg-white border-t border-slate-100 shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="relative group">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregúntale al CGO sobre estrategias de crecimiento..."
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl px-5 py-4 pr-14 resize-none min-h-[60px] max-h-[200px] text-slate-700 transition-all shadow-sm"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="absolute right-3 bottom-3 w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30 active:scale-95"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-3 font-medium uppercase tracking-widest">
            Impulsado por Duarte-Aupart Growth Engine • 2026
          </p>
        </div>
      </div>
    </div>
  );
}

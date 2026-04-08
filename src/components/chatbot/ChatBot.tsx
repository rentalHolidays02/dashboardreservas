import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { MessageCircle, X, Send, Sparkles, Loader2 } from 'lucide-react';
import { MOCK_WORKERS, MOCK_ACCOMMODATIONS, MOCK_INCIDENCIAS } from '../../services/mockData';

const GROQ_API_KEY = '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';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `Eres Cristóbal, el asistente inteligente de un sistema de gestión de Recursos Humanos y Pagos para una empresa de limpieza de alojamientos turísticos. Eres amable, conciso y profesional. Responde siempre en español.

Datos actuales del sistema:

TRABAJADORES (${MOCK_WORKERS.length} en total):
${MOCK_WORKERS.map(w => `- ${w.fullName}: ${w.cleansCountMonth} limpiezas este mes, ${w.kmsMonth} km, neto mensual ${w.netMoneyMonth}€, pago por ${w.tipoPago ?? 'sin definir'}, alojamientos: ${w.accommodations.join(', ')}`).join('\n')}

ALOJAMIENTOS (${MOCK_ACCOMMODATIONS.length} en total, ${MOCK_ACCOMMODATIONS.filter(a => a.active).length} activos):
${MOCK_ACCOMMODATIONS.map(a => `- ${a.name} (${a.city}, ${a.zipCode}) — ${a.active ? 'activo' : 'inactivo'}${a.notes ? '. Nota: ' + a.notes : ''}`).join('\n')}

INCIDENCIAS RECIENTES (${MOCK_INCIDENCIAS.length}):
${MOCK_INCIDENCIAS.map(i => `- ${i.userName} en ${i.accommodationName}: "${i.description}" — coste ${i.coste}€, pagado por ${i.pagadoPor}`).join('\n')}

Responde de forma directa y breve. Si no tienes datos suficientes para responder algo concreto, indícalo con claridad.`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hola, soy Cristóbal, tu asistente de RH. ¿En qué puedo ayudarte?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...updatedMessages.map(m => ({ role: m.role, content: m.content })),
          ],
          max_tokens: 400,
          temperature: 0.6,
        }),
      });

      if (!response.ok) throw new Error('Error en la respuesta de la API');

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content ?? 'No he podido obtener una respuesta.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Ha ocurrido un error. Por favor, inténtalo de nuevo.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[195] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Chat popup */}
      <div
        className={`fixed bottom-[76px] right-6 z-[200] w-[360px] rounded-2xl overflow-hidden bg-white/90 dark:bg-stone-900/95 backdrop-blur-xl border border-white/60 dark:border-stone-800/50 soft-shadow transition-all duration-300 ease-out origin-bottom-right ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-stone-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 flex items-center justify-center">
              <Sparkles size={13} className="text-orange-500" />
            </div>
            <div>
              <p className="text-[13px] font-normal text-slate-800 dark:text-stone-200 font-display leading-none">
                Cristóbal
              </p>
              <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5 leading-none">
                RH · Pagos
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 hover:bg-stone-100/80 dark:hover:bg-stone-800/60 transition-all active:scale-95"
          >
            <X size={13} />
          </button>
        </div>

        {/* Messages area */}
        <div className="h-[340px] px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          {messages.map((msg, i) =>
            msg.role === 'assistant' ? (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={10} className="text-orange-500" />
                </div>
                <div className="bg-stone-50/80 dark:bg-stone-800/40 border border-stone-100/80 dark:border-stone-700/30 rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[260px]">
                  <p className="text-[12px] text-slate-600 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-end">
                <div className="bg-orange-500 rounded-xl rounded-tr-sm px-3.5 py-2.5 max-w-[260px]">
                  <p className="text-[12px] text-white leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            )
          )}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={10} className="text-orange-500" />
              </div>
              <div className="bg-stone-50/80 dark:bg-stone-800/40 border border-stone-100/80 dark:border-stone-700/30 rounded-xl rounded-tl-sm px-3.5 py-2.5">
                <Loader2 size={13} className="text-orange-400 animate-spin" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="px-4 py-3.5 border-t border-stone-100 dark:border-stone-800/50">
          <div className="flex items-center gap-2 bg-stone-50/80 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-700/30 rounded-xl px-3.5 py-2.5">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta..."
              className="flex-1 bg-transparent text-[12px] text-slate-700 dark:text-stone-300 placeholder:text-slate-400 dark:placeholder:text-stone-500 outline-none"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="w-6 h-6 flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
            >
              <Send size={11} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[200] w-12 h-12 rounded-2xl flex items-center justify-center bg-white/90 dark:bg-stone-900/95 backdrop-blur-xl border border-orange-200/40 dark:border-orange-900/30 soft-shadow transition-all duration-300 active:scale-95 hover:scale-105"
      >
        <div className={`transition-all duration-300 ${isOpen ? 'scale-0 opacity-0 absolute' : 'scale-100 opacity-100'}`}>
          <MessageCircle size={18} className="text-orange-500" />
        </div>
        <div className={`transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 absolute'}`}>
          <X size={16} className="text-slate-500 dark:text-stone-400" />
        </div>
      </button>
    </>
  );
};

export default ChatBot;

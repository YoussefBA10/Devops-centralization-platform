import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Maximize2, 
  Minimize2,
  Brain,
  AlertTriangle
} from 'lucide-react';
import api from '../../services/api';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [query, setQuery] = useState('');
  const [convId, setConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  const getFormattedTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const cleanFallbackMessage = (content: string) => {
    let cleaned = content;
    // Remove the top warning note case insensitively
    cleaned = cleaned.replace(/\*?Note: The AI summarization service is currently busy or rate-limited\..*?retrieved for your request:\*?/is, '');
    // Remove the bottom retry note case insensitively
    cleaned = cleaned.replace(/\*?Please try again in a few seconds for an AI-generated summary\.\*?/is, '');
    return cleaned.trim();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, loading]);

  // Try to recover the last active conversation ID from session storage
  useEffect(() => {
    const savedId = sessionStorage.getItem('activeChatId');
    if (savedId) {
      setConvId(parseInt(savedId));
      loadHistory(parseInt(savedId));
    }
  }, []);

  const loadHistory = async (id: number) => {
    try {
      const res = await api.get(`/chat/${id}`);
      const history: Message[] = JSON.parse(res.data.messagesJson);
      const mappedHistory = history.map(msg => ({
        ...msg,
        timestamp: msg.timestamp || getFormattedTime()
      }));
      setMessages(mappedHistory);
    } catch (err) {
      sessionStorage.removeItem('activeChatId');
      setConvId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading || isSendingRef.current) return;

    isSendingRef.current = true;
    const userMessage: Message = {
      role: 'user',
      content: query,
      timestamp: getFormattedTime()
    };

    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    try {
      const res = await api.post('/chat', { 
        query: userMessage.content,
        conversationId: convId
      });
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: res.data.response,
        timestamp: getFormattedTime()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      if (!convId) {
        setConvId(res.data.conversationId);
        sessionStorage.setItem('activeChatId', res.data.conversationId.toString());
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm sorry, I'm having trouble connecting to my brain right now.",
        timestamp: getFormattedTime()
      }]);
    } finally {
      setLoading(false);
      isSendingRef.current = false;
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-primary rounded-2xl shadow-2xl text-primary-foreground group"
      >
        {isOpen ? <X className="w-6 h-6" /> : (
          <div className="relative">
            <MessageSquare className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-primary"></span>
          </div>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              width: isMaximized ? 'calc(100vw - 48px)' : '400px',
              height: isMaximized ? 'calc(100vh - 48px)' : '600px',
              bottom: isMaximized ? '24px' : '90px',
              right: isMaximized ? '24px' : '24px'
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed z-50 bg-card border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-white/5 bg-gradient-to-r from-primary/10 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Monetique Eye AI</h3>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Active Assistant</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsMaximized(!isMaximized)} className="p-2 hover:bg-white/5 rounded-full text-muted-foreground">
                  {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none my-auto">
                  <div className="p-4 bg-[#1a1a1a] rounded-2xl border border-white/5 mb-3 text-slate-400">
                    <Bot className="w-8 h-8" />
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">Ask me about your infrastructure</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isUser = msg.role === 'user';
                  const isFallback = msg.role === 'assistant' && (
                    msg.content.includes("busy or rate-limited") || 
                    msg.content.includes("summarization service is currently busy")
                  );

                  return (
                    <div key={i} className={`flex gap-3 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                        isUser 
                          ? 'bg-blue-600/20 border-blue-500/10 text-blue-400' 
                          : 'bg-[#1a1a1a] border-white/5 text-slate-400'
                      }`}>
                        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      
                      <div className={`p-4 pb-2 rounded-[12px] flex flex-col text-sm leading-relaxed ${
                        isUser 
                          ? 'bg-blue-600 text-white max-w-[70%]' 
                          : `bg-[#1a1a1a] text-white max-w-[70%] border border-white/5 ${isFallback ? 'border-l-4 border-l-amber-500' : ''}`
                      }`}>
                        {isFallback && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-500 font-semibold mb-2 select-none">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Limited response</span>
                          </div>
                        )}
                        
                        <div className={`mb-1 pr-6 ${isUser ? '' : 'text-slate-100'}`}>
                          {isUser ? (
                            msg.content
                          ) : (
                            <ReactMarkdown
                              components={{
                                strong: (props) => <strong className="font-bold text-white" {...props} />,
                                em: (props) => <em className="italic text-slate-200" {...props} />,
                                p: (props) => <p className="mb-2 last:mb-0" {...props} />,
                                ul: (props) => <ul className="list-disc pl-5 mb-2 space-y-1 text-slate-200" {...props} />,
                                ol: (props) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-slate-200" {...props} />,
                                li: (props) => <li className="text-sm" {...props} />,
                                code: ({ className, children, ...props }) => {
                                  const match = /language-(\w+)/.exec(className || '');
                                  return match ? (
                                    <pre className="bg-[#0f0f10] p-3 rounded-lg overflow-x-auto text-xs my-2 border border-white/5 font-mono">
                                      <code className="text-slate-200" {...props}>{children}</code>
                                    </pre>
                                  ) : (
                                    <code className="bg-[#0f0f10] px-1.5 py-0.5 rounded text-xs font-mono text-amber-400" {...props}>{children}</code>
                                  );
                                }
                              }}
                            >
                              {isFallback ? cleanFallbackMessage(msg.content) : msg.content}
                            </ReactMarkdown>
                          )}
                        </div>
                        
                        <span className={`text-[10px] self-end mt-1 ${isUser ? 'text-blue-200/70' : 'text-muted-foreground'}`}>
                          {msg.timestamp || getFormattedTime()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              
              {loading && (
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center shrink-0 border border-white/5 text-slate-400">
                    <Bot className="w-4 h-4" />
                  </div>
                  
                  <div className="p-4 rounded-[12px] bg-[#1a1a1a] text-white max-w-[70%] border border-white/5 flex items-center justify-center min-h-[44px]">
                    <div className="flex gap-1.5 items-center">
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-white/5 bg-secondary/20">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={loading ? "Waiting for response..." : "Ask anything..."}
                  disabled={loading}
                  className="flex-1 bg-background border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!query.trim() || loading}
                  className="bg-primary text-primary-foreground p-2 rounded-xl disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatWidget;

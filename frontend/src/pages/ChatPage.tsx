import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User as UserIcon, 
  Loader2, 
  MessageSquare,
  Plus,
  History,
  Trash2,
  Brain,
  AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Input';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp?: string;
}

interface Conversation {
  id: number;
  startedAt: string;
  messagesJson: string;
}

const ChatPage: React.FC = () => {
  useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/chat/history');
      setConversations(res.data);
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadConversation = async (id: number) => {
    try {
      const res = await api.get(`/chat/${id}`);
      const conv = res.data;
      setCurrentConvId(conv.id);
      const history: Message[] = JSON.parse(conv.messagesJson);
      const mappedHistory = history.map(msg => ({
        ...msg,
        timestamp: msg.timestamp || getFormattedTime()
      }));
      setMessages(mappedHistory);
    } catch (err) {
      console.error('Failed to load conversation', err);
    }
  };

  const startNewChat = () => {
    setCurrentConvId(null);
    setMessages([]);
    setInput('');
  };

  const deleteConversation = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await api.delete(`/chat/${id}`);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConvId === id) startNewChat();
    } catch (err) {
      console.error('Failed to delete', err);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || isSendingRef.current) return;

    isSendingRef.current = true;
    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: getFormattedTime()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/chat', { 
        query: userMessage.content,
        conversationId: currentConvId 
      });
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: res.data.response,
        timestamp: getFormattedTime()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      if (!currentConvId) {
        setCurrentConvId(res.data.conversationId);
        fetchHistory();
      }
    } catch (error) {
       setMessages(prev => [...prev, {
         role: 'assistant',
         content: "I'm sorry, I'm having trouble connecting to the AI brain right now.",
         timestamp: getFormattedTime()
       }]);
    } finally {
      setLoading(false);
      isSendingRef.current = false;
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* History Sidebar */}
      <div className="w-80 border-r border-white/5 bg-black/20 flex flex-col">
        <div className="p-6">
          <Button onClick={startNewChat} className="w-full bg-primary/20 hover:bg-primary/30 text-primary border-primary/20">
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
          <div className="flex items-center gap-2 px-2 mb-4">
             <History className="w-4 h-4 text-muted-foreground" />
             <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">History</span>
          </div>
          
          {historyLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center p-8 text-xs text-muted-foreground italic">
              No previous chats found
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                  currentConvId === conv.id 
                    ? 'bg-primary/10 border-primary/20 text-primary' 
                    : 'bg-transparent border-transparent hover:bg-white/5 text-muted-foreground hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="text-sm truncate font-medium">
                    {new Date(conv.startedAt).toLocaleDateString()} Chat
                  </span>
                </div>
                <button 
                  onClick={(e) => deleteConversation(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col p-8 overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/20">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI DevOps Assistant</h1>
              <p className="text-sm text-muted-foreground">Enterprise Infrastructure Support</p>
            </div>
          </div>
        </div>

        <Card className="flex-1 overflow-hidden flex flex-col mb-6 bg-card/30 backdrop-blur-xl border-white/5">
          <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
            {messages.length === 0 && !loading ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none my-auto">
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
                      {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
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
          </div>
        </Card>

        <form onSubmit={handleSend} className="relative">
          <div className="flex items-center gap-4 bg-card border-2 border-border p-2 rounded-2xl h-16 pl-6">
             <input
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value)}
               placeholder={loading ? "Waiting for response..." : "Ask about your infrastructure..."}
               className="flex-1 bg-transparent border-none focus:outline-none text-base placeholder:text-muted-foreground disabled:opacity-50"
               disabled={loading}
             />
             <Button type="submit" size="lg" className="h-full rounded-xl px-6" loading={loading} disabled={!input.trim() || loading}>
               <Send className="w-4 h-4" />
             </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;

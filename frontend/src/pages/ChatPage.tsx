import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User as UserIcon, 
  Sparkles, 
  Loader2, 
  Terminal,
  Eraser,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  Plus,
  History,
  Trash2,
  Brain
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Input';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'assistant' | 'user';
  content: string;
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
      setMessages(JSON.parse(conv.messagesJson));
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
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/chat', { 
        query: input,
        conversationId: currentConvId 
      });
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: res.data.response,
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
       }]);
    } finally {
      setLoading(false);
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
            {messages.length === 0 && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                <Sparkles className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-bold">How can I help you today?</h3>
                <p className="text-sm max-w-sm mt-2">
                  Ask about deployments, environment health, logs, or metrics.
                </p>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-border ${
                    msg.role === 'user' ? 'bg-secondary' : 'bg-primary/10'
                  }`}>
                    {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4 text-primary" />}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-none' 
                      : 'bg-secondary/80 border border-border rounded-tl-none prose prose-invert prose-p:leading-relaxed max-w-none'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    ) : msg.content}
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                     <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                  <div className="p-4 bg-secondary/80 border border-border rounded-2xl rounded-tl-none">
                     <div className="flex gap-1">
                       <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce"></span>
                       <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce delay-75"></span>
                       <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce delay-150"></span>
                     </div>
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
               placeholder="Ask about your infrastructure..."
               className="flex-1 bg-transparent border-none focus:outline-none text-base placeholder:text-muted-foreground"
               disabled={loading}
             />
             <Button type="submit" size="lg" className="h-full rounded-xl px-6" loading={loading} disabled={!input.trim()}>
               <Send className="w-4 h-4" />
             </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;

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
  ChevronRight
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Input';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

const ChatPage: React.FC = () => {
  useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your Monetique-Eye AI Assistant. I can help you analyze logs, suggest infrastructure optimizations, or explain current system risks. How can I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/chat', { query: input });
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
       setMessages(prev => [...prev, {
         role: 'assistant',
         content: "I'm sorry, I'm having trouble connecting to the AI brain right now. Please check if the backend service is reachable.",
         timestamp: new Date()
       }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-8">
      {/* Chat Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/20 relative group">
            <Bot className="w-6 h-6 text-primary" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background animate-pulse"></div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              AI DevOps Assistant
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-[10px] text-primary font-bold uppercase tracking-wider">Llama 3.3</span>
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Secure environment context enabled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMessages([messages[0]])}>
            <Eraser className="w-4 h-4 mr-2" />
            Clear
          </Button>
          <Button variant="outline" size="sm">
            <Terminal className="w-4 h-4 mr-2" />
            Expert Mode
          </Button>
        </div>
      </div>

      {/* Messages Container */}
      <Card className="flex-1 overflow-hidden flex flex-col mb-6 bg-card/30 backdrop-blur-xl border-white/5 shadow-2xl">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth" ref={scrollRef}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-4 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-border shadow-md ${
                  msg.role === 'user' ? 'bg-secondary' : 'bg-primary/10'
                }`}>
                  {msg.role === 'user' ? <UserIcon className="w-5 h-5" /> : <Sparkles className="w-5 h-5 text-primary" />}
                </div>
                <div className={`space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-none' 
                      : 'bg-secondary/80 border border-border rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1 uppercase font-bold tracking-widest">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-4 max-w-[80%]">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-border bg-primary/10 shadow-md">
                   <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
                <div className="flex items-center gap-1 p-4 bg-secondary/80 border border-border rounded-2xl rounded-tl-none shadow-lg">
                   <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce"></div>
                   <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce delay-75"></div>
                   <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggested Queries */}
        <div className="px-6 py-4 border-t border-border bg-secondary/20 overflow-x-auto">
          <div className="flex gap-3">
             {["Check environment health", "Analyze recent errors", "Suggest log index optimization"].map((q) => (
               <button 
                 key={q} 
                 onClick={() => setInput(q)}
                 className="whitespace-nowrap px-4 py-2 rounded-lg bg-background border border-border text-xs font-semibold hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center gap-2 group"
               >
                 {q}
                 <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
               </button>
             ))}
          </div>
        </div>
      </Card>

      {/* Input Console */}
      <form onSubmit={handleSend} className="relative group">
        <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-focus-within:opacity-100 opacity-0 transition-opacity duration-500 -z-10"></div>
        <div className="flex items-center gap-4 bg-card border-2 border-border group-focus-within:border-primary/50 p-2 rounded-2xl shadow-2xl transition-all h-20 pl-6">
           <MessageSquare className="w-6 h-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
           <input
             type="text"
             value={input}
             onChange={(e) => setInput(e.target.value)}
             placeholder="Discuss system metrics or ask for automation advice..."
             className="flex-1 bg-transparent border-none focus:outline-none text-lg font-medium placeholder:text-muted-foreground"
             disabled={loading}
           />
           <Button type="submit" size="lg" className="h-full rounded-xl px-8" loading={loading}>
             Send Message
             <Send className="w-4 h-4" />
           </Button>
        </div>
      </form>
      <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest mt-6 font-bold flex items-center justify-center gap-2">
         <ShieldCheck className="w-3 h-3" />
         End-to-end encrypted session • Content non-persistent
      </p>
    </div>
  );
};

export default ChatPage;

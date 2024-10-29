import React, { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { AuthForm } from './components/AuthForm';
import { supabase, type Message } from './lib/supabase';
import { MessageSquare, LogOut } from 'lucide-react';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(
    localStorage.getItem('username')
  );

  useEffect(() => {
    if (username) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000); // Refresh every 3 seconds
      const subscription = subscribeToMessages();
      return () => {
        clearInterval(interval);
        subscription();
      };
    }
  }, [username]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel('messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, 
        payload => {
          if (payload.eventType === 'INSERT') {
            setMessages(current => [payload.new as Message, ...current]);
          } else if (payload.eventType === 'DELETE') {
            setMessages(current => current.filter(msg => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const handleSendMessage = async (content: string) => {
    if (!username) return;
    
    try {
      const { error } = await supabase.from('messages').insert([
        {
          content,
          user_name: username,
          avatar_url: `https://api.dicebear.com/7.x/avatars/svg?seed=${username}`
        }
      ]);

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleAuth = (newUsername: string) => {
    setUsername(newUsername);
    localStorage.setItem('username', newUsername);
  };

  const handleLogout = () => {
    setUsername(null);
    localStorage.removeItem('username');
    toast.success('Logged out successfully');
  };

  if (!username) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <AuthForm onAuth={handleAuth} />
        <Toaster position="top-right" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <MessageSquare className="w-6 h-6 text-blue-500" />
                <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Signed in as <span className="font-medium">{username}</span>
                </span>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <MessageList messages={messages} isLoading={isLoading} />
          </div>
          
          <div className="p-6 border-t border-gray-100">
            <MessageInput onSend={handleSendMessage} isLoading={isLoading} />
          </div>
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
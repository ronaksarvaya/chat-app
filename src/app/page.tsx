'use client'

import { useChat } from 'ai/react'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Initialize Supabase client outside component
const supabaseClient = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export default function Chat() {
  const { messages: aiMessages, input, handleInputChange, handleSubmit } = useChat()
  const [savedMessages, setSavedMessages] = useState([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabaseClient) {
      setError('Missing Supabase configuration')
      return
    }

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('messages')
          .select('*')
          .order('created_at', { ascending: true })
        
        if (error) throw error
        setSavedMessages(data || [])
      } catch (err) {
        console.error('Error fetching messages:', err)
        setError('Failed to load messages. Please try again later.')
      }
    }

    fetchMessages()

    const subscription = supabaseClient
  .channel('messages')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
    setSavedMessages((current) => [...current, payload.new])
  })
  .subscribe()

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabaseClient) {
      setError('Supabase client not initialized')
      return
    }

    if (input.trim()) {
      try {
        const { error: supabaseError } = await supabaseClient
          .from('messages')
          .insert({
            content: input,
            user_id: 'user',
            created_at: new Date().toISOString() // Manually setting the current timestamp
          })
        
        if (supabaseError) throw supabaseError
        handleSubmit(e)
      } catch (err) {
        console.error('Error sending message:', err)
        setError('Failed to send message. Please try again.')
      }
    }
  }

  return (
    <div className="flex flex-col w-full max-w-md mx-auto h-screen py-8">
      <h1 className="text-2xl font-bold mb-4 text-center">Real-time Chat</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="flex-grow overflow-y-auto space-y-4 mb-4 p-4 border border-gray-300 rounded">
        {savedMessages.map((m) => (
          <div
            key={m.id}
            className={`p-2 rounded ${m.user_id === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'}`}
          >
            <p className="text-sm font-semibold mb-1">{m.user_id === 'user' ? 'You' : 'AI'}</p>
            <p>{m.content}</p>
          </div>
        ))}

        {aiMessages.map((m) => (
          <div key={m.id} className="p-2 rounded bg-green-100">
            <p className="text-sm font-semibold mb-1">AI (Live)</p>
            <p>{m.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleFormSubmit} className="flex">
        <input
          className="flex-grow p-2 border border-gray-300 rounded-l"
          value={input}
          placeholder="Type your message..."
          onChange={handleInputChange}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-r hover:bg-blue-600 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}

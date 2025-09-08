'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'

export function SignInLanding() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [mounted, setMounted] = useState(false)
  
  const { sendMagicLink } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Basic email validation
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    
    try {
      setIsLoading(true)
      await sendMagicLink(email)
      setSentEmail(email)
      setEmailSent(true)
    } catch (error) {
      console.error('Failed to send magic link:', error)
      toast.error('Failed to send magic link. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div 
      style={{
        minHeight: '100vh',
        backgroundColor: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.4s ease-in-out'
      }}
    >
      <div style={{ width: '100%', maxWidth: '1200px' }}>
        <div style={{ maxWidth: '800px' }}>
          {!emailSent ? (
            <>
              <h1 
                style={{
                  fontSize: '96px',
                  fontWeight: '700',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#000000',
                  margin: '0 0 24px 0',
                  letterSpacing: '-0.04em',
                  lineHeight: '1'
                }}
              >
                Scry<span style={{ opacity: 0.7 }}>.</span>
              </h1>
              
              <p 
                style={{
                  fontSize: '20px',
                  fontWeight: '300',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#737373',
                  margin: '0 0 80px 0',
                  lineHeight: '1.4'
                }}
              >
                Remember everything.
              </p>
              
              <form onSubmit={handleSubmit}>
                <div style={{ maxWidth: '500px' }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    disabled={isLoading}
                    autoFocus
                    style={{
                      width: '100%',
                      border: '1px solid #e5e5e5',
                      borderRadius: '6px',
                      padding: '16px 20px',
                      fontSize: '18px',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      opacity: isLoading ? 0.5 : 1,
                      cursor: isLoading ? 'not-allowed' : 'text',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                      boxShadow: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#737373'
                      e.target.style.boxShadow = '0 0 0 3px rgba(115, 115, 115, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e5e5'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                  <p
                    style={{
                      fontSize: '14px',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      color: '#737373',
                      margin: '8px 0 0 0'
                    }}
                  >
                    Enter your email and we&apos;ll send you a magic link
                  </p>
                </div>
              </form>
            </>
          ) : (
            <div style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}>
              <h1 
                style={{
                  fontSize: '96px',
                  fontWeight: '700',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#000000',
                  margin: '0 0 48px 0',
                  letterSpacing: '-0.04em',
                  lineHeight: '1'
                }}
              >
                Scry<span style={{ opacity: 0.7 }}>.</span>
              </h1>
              
              <p 
                style={{
                  fontSize: '20px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#000000',
                  margin: '0 0 8px 0',
                  fontWeight: '500'
                }}
              >
                Check your inbox
              </p>
              <p 
                style={{
                  fontSize: '16px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#525252',
                  margin: '0 0 24px 0'
                }}
              >
                We sent a magic link to {sentEmail}
              </p>
              <button
                onClick={() => {
                  setEmailSent(false)
                  setSentEmail('')
                  setEmail('')
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#737373',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
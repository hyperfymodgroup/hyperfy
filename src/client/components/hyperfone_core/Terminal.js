import { css } from '@firebolt-dev/css'
import React, { useState, useEffect, useRef } from 'react'

export function Terminal({ theme }) {
  const [history, setHistory] = useState([])
  const [currentCommand, setCurrentCommand] = useState('')
  const [currentPath, setCurrentPath] = useState('/') // Default to root path
  const [isProcessing, setIsProcessing] = useState(false)
  const terminalRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  // Focus input when terminal is clicked
  const handleTerminalClick = () => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  // Handle command execution
  const handleKeyPress = async (e) => {
    if (e.key === 'Enter' && currentCommand.trim()) {
      e.preventDefault()
      setIsProcessing(true)

      // Add command to history
      const commandEntry = {
        type: 'command',
        content: currentCommand,
        timestamp: new Date().toISOString()
      }
      setHistory(prev => [...prev, commandEntry])

      try {
        // Send command to API
        const response = await fetch('/api/terminal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ command: currentCommand, cwd: currentPath })
        })

        const result = await response.json()

        // Add response to history
        const responseEntry = {
          type: 'response',
          content: result.output || result.error,
          error: !!result.error,
          timestamp: new Date().toISOString()
        }
        setHistory(prev => [...prev, responseEntry])

        // Update current path if it was a cd command
        if (result.newPath) {
          setCurrentPath(result.newPath)
        }
      } catch (error) {
        // Add error to history
        const errorEntry = {
          type: 'response',
          content: 'Failed to execute command: ' + error.message,
          error: true,
          timestamp: new Date().toISOString()
        }
        setHistory(prev => [...prev, errorEntry])
      }

      setCurrentCommand('')
      setIsProcessing(false)
    }
  }

  return (
    <div 
      onClick={handleTerminalClick}
      css={css`
        display: flex;
        flex-direction: column;
        height: 100%;
        background: ${theme.background}ee;
        font-family: 'Courier New', monospace;
        padding: 20px;
        color: ${theme.text};
      `}
    >
      {/* Terminal Output */}
      <div 
        ref={terminalRef}
        css={css`
          flex: 1;
          overflow-y: auto;
          margin-bottom: 20px;

          &::-webkit-scrollbar {
            width: 8px;
          }
          
          &::-webkit-scrollbar-track {
            background: ${theme.background}44;
          }
          
          &::-webkit-scrollbar-thumb {
            background: ${theme.primary}44;
            border-radius: 4px;
          }
        `}
      >
        {history.map((entry, index) => (
          <div 
            key={index}
            css={css`
              margin-bottom: 8px;
              white-space: pre-wrap;
              word-break: break-word;
            `}
          >
            {entry.type === 'command' ? (
              <div css={css`
                color: ${theme.primary};
              `}>
                {currentPath}$ {entry.content}
              </div>
            ) : (
              <div css={css`
                color: ${entry.error ? theme.error : theme.text};
                opacity: 0.8;
              `}>
                {entry.content}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Command Input */}
      <div css={css`
        display: flex;
        align-items: center;
        gap: 8px;
        background: ${theme.background}88;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid ${theme.border};
      `}>
        <span css={css`
          color: ${theme.primary};
        `}>
          {currentPath}$
        </span>
        <input
          ref={inputRef}
          type="text"
          value={currentCommand}
          onChange={(e) => setCurrentCommand(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isProcessing}
          css={css`
            flex: 1;
            background: none;
            border: none;
            color: ${theme.text};
            font-family: inherit;
            font-size: inherit;
            padding: 0;
            
            &:focus {
              outline: none;
            }
            
            &:disabled {
              opacity: 0.5;
            }
          `}
        />
      </div>

      {/* Status Line */}
      <div css={css`
        margin-top: 8px;
        font-size: 12px;
        color: ${theme.textSecondary};
      `}>
        {isProcessing ? 'Processing...' : 'Ready'}
      </div>
    </div>
  )
} 
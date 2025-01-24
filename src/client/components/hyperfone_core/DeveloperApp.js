<<<<<<< HEAD
import { css } from '@firebolt-dev/css'
import React, { useState } from 'react'
import { WorldInspector } from './WorldInspector'
import { Terminal } from './Terminal'
import { useSocket } from '../../hooks/useSocket'

export function DeveloperApp({ theme, world }) {
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [expandedNodes, setExpandedNodes] = useState(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTab, setSelectedTab] = useState('hierarchy')
  const socket = useSocket()

  // Early return if world is not available
  if (!world) {
    return (
      <div css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        background: ${theme.background}ee;
        color: ${theme.text};
      `}>
        <div css={css`
          padding: 20px;
          background: ${theme.background}dd;
          border: 1px solid ${theme.primary}33;
          border-radius: 8px;
          text-align: center;
        `}>
          <h3 css={css`
            color: ${theme.primary};
            margin: 0 0 10px 0;
            font-family: 'Courier New', monospace;
          `}>INITIALIZING WORLD</h3>
          <p css={css`
            margin: 0;
            color: ${theme.text}aa;
            font-family: 'Courier New', monospace;
          `}>Please wait...</p>
        </div>
      </div>
    )
  }

  const renderEntityDetails = () => {
    if (!selectedEntity) return null

    return (
      <div css={css`
        background: ${theme.background}dd;
        border: 1px solid ${theme.primary}33;
        border-radius: 8px;
        overflow: hidden;
      `}>
        <div css={css`
          padding: 12px;
          background: ${theme.primary}11;
          border-bottom: 1px solid ${theme.primary}33;
          font-family: 'Courier New', monospace;
          color: ${theme.primary};
          display: flex;
          justify-content: space-between;
          align-items: center;
        `}>
          Entity Details
          <button
            onClick={() => setSelectedEntity(null)}
            css={css`
              background: none;
              border: none;
              color: ${theme.text};
              cursor: pointer;
              font-size: 1.2em;
              padding: 0;
              &:hover {
                color: ${theme.primary};
              }
            `}
          >
            ×
          </button>
        </div>
        <div css={css`padding: 12px;`}>
          <pre css={css`
            margin: 0;
            white-space: pre-wrap;
            word-break: break-all;
            font-size: 12px;
          `}>
            {JSON.stringify(selectedEntity.data, null, 2)}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      background: ${theme.background}ee;
      color: ${theme.text};
    `}>
      {/* Tab Bar */}
      <div css={css`
        display: flex;
        gap: 2px;
        padding: 8px 8px 0;
        background: ${theme.background}dd;
      `}>
        <button
          onClick={() => setSelectedTab('hierarchy')}
          css={css`
            background: ${selectedTab === 'hierarchy' ? theme.background : theme.background + '88'};
            border: 1px solid ${theme.primary}33;
            border-bottom: ${selectedTab === 'hierarchy' ? 'none' : `1px solid ${theme.primary}33`};
            border-radius: 8px 8px 0 0;
            color: ${theme.text};
            padding: 8px 16px;
            cursor: pointer;
            font-family: 'Courier New', monospace;
            
            &:hover {
              background: ${theme.background};
            }
          `}
        >
          World Hierarchy 🌐
        </button>
        <button
          onClick={() => setSelectedTab('terminal')}
          css={css`
            background: ${selectedTab === 'terminal' ? theme.background : theme.background + '88'};
            border: 1px solid ${theme.primary}33;
            border-bottom: ${selectedTab === 'terminal' ? 'none' : `1px solid ${theme.primary}33`};
            border-radius: 8px 8px 0 0;
            color: ${theme.text};
            padding: 8px 16px;
            cursor: pointer;
            font-family: 'Courier New', monospace;
            
            &:hover {
              background: ${theme.background};
            }
          `}
        >
          Terminal 💻
        </button>
        <div css={css`
          flex: 1;
          border-bottom: 1px solid ${theme.primary}33;
        `} />
      </div>

      {/* Content */}
      <div css={css`
        flex: 1;
        display: flex;
        gap: 16px;
        padding: 16px;
        overflow: hidden;
      `}>
        {selectedTab === 'hierarchy' ? (
          <>
            <div css={css`
              flex: 1;
              display: flex;
              flex-direction: column;
              gap: 16px;
              overflow: hidden;
            `}>
              {/* Search */}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search entities..."
                css={css`
                  background: ${theme.background}dd;
                  border: 1px solid ${theme.primary}33;
                  border-radius: 4px;
                  color: ${theme.text};
                  padding: 8px;
                  font-family: 'Courier New', monospace;
                  
                  &:focus {
                    outline: none;
                    border-color: ${theme.primary}66;
                  }
                `}
              />

              {/* World Inspector */}
              <div css={css`
                flex: 1;
                background: ${theme.background}dd;
                border: 1px solid ${theme.primary}33;
                border-radius: 8px;
                overflow: hidden;
              `}>
                <WorldInspector
                  theme={theme}
                  world={world}
                  selectedEntity={selectedEntity}
                  setSelectedEntity={setSelectedEntity}
                  expandedNodes={expandedNodes}
                  setExpandedNodes={setExpandedNodes}
                  searchTerm={searchTerm}
                />
              </div>
            </div>

            {/* Entity Details */}
            {selectedEntity && (
              <div css={css`
                width: 300px;
                overflow-y: auto;
              `}>
                {renderEntityDetails()}
              </div>
            )}
          </>
        ) : (
          <Terminal theme={theme} socket={socket} />
        )}
      </div>
    </div>
  )
=======
import { css } from '@firebolt-dev/css'
import React, { useState } from 'react'
import { WorldInspector } from './WorldInspector'

export function DeveloperApp({ theme }) {
  const [activeTab, setActiveTab] = useState('inspector')

  const tabs = [
    { id: 'inspector', name: 'World Inspector', icon: '🔍' },
    { id: 'performance', name: 'Performance', icon: '📊' },
    { id: 'console', name: 'Console', icon: '💻' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'inspector':
        return <WorldInspector theme={theme} />

      case 'performance':
        return (
          <div css={css`
            padding: 20px;
            color: ${theme.textSecondary};
          `}>
            Performance monitoring coming soon...
          </div>
        )

      case 'console':
        return (
          <div css={css`
            padding: 20px;
            color: ${theme.textSecondary};
          `}>
            Console coming soon...
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      background: ${theme.background};
      color: ${theme.text};
    `}>
      {/* Header */}
      <div css={css`
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 20px;
        border-bottom: 1px solid ${theme.border};
      `}>
        <span css={css`font-size: 24px;`}>🛠️</span>
        <h1 css={css`
          margin: 0;
          font-size: 18px;
          font-weight: 500;
        `}>
          Developer Tools
        </h1>
      </div>

      {/* Tabs */}
      <div css={css`
        display: flex;
        gap: 10px;
        padding: 10px 20px;
        border-bottom: 1px solid ${theme.border};
      `}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            css={css`
              background: ${activeTab === tab.id ? theme.primary + '22' : 'transparent'};
              border: 1px solid ${activeTab === tab.id ? theme.primary : theme.border};
              color: ${theme.text};
              padding: 8px 16px;
              border-radius: 8px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 6px;
              transition: all 0.2s ease;
              
              &:hover {
                background: ${theme.primary}22;
                border-color: ${theme.primary};
              }
            `}
          >
            <span>{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </div>

      {/* Content */}
      <div css={css`
        flex: 1;
        overflow: auto;
      `}>
        {renderTabContent()}
      </div>
    </div>
  )
>>>>>>> dev
} 
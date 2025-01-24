import { css } from '@firebolt-dev/css'
import React, { useState, useEffect } from 'react'
import { WorldInspector } from './WorldInspector'
import { Terminal } from './Terminal'
import { hyperFoneOS } from '../hyperfoneOS'
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

  const toggleNode = (id) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedNodes(newExpanded)
  }

  const renderEntityNode = (entity) => {
    if (!entity) return null

    const isExpanded = expandedNodes.has(entity.data.id)
    const hasChildren = entity.nodes?.size > 0

    return (
      <div key={entity.data.id} css={css`
        margin: 4px 0;
        padding-left: ${hasChildren ? '0' : '20px'};
      `}>
        <div css={css`
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          background: ${selectedEntity?.data.id === entity.data.id ? theme.primary + '33' : 'transparent'};
          
          &:hover {
            background: ${theme.primary}22;
          }
        `}>
          {hasChildren && (
            <button
              onClick={() => {
                const newExpanded = new Set(expandedNodes)
                if (isExpanded) {
                  newExpanded.delete(entity.data.id)
                } else {
                  newExpanded.add(entity.data.id)
                }
                setExpandedNodes(newExpanded)
              }}
              css={css`
                background: none;
                border: none;
                color: ${theme.text};
                cursor: pointer;
                padding: 0 4px;
                font-size: 12px;
                transform: rotate(${isExpanded ? '90deg' : '0deg'});
                transition: transform 0.2s ease;
              `}
            >
              ▶
            </button>
          )}
          <div
            onClick={() => setSelectedEntity(entity)}
            css={css`flex: 1;`}
          >
            {entity.data.type} - {entity.data.id}
          </div>
        </div>
        
        {isExpanded && hasChildren && (
          <div css={css`
            margin-left: 20px;
            border-left: 1px solid ${theme.border}44;
          `}>
            {Array.from(entity.nodes.values()).map(node => renderEntityNode(node))}
          </div>
        )}
      </div>
    )
  }

  const renderWorldInfo = () => {
    const stats = {
      'Entity Count': world.entities?.items?.size || 0,
      'Network ID': world.network?.id || 'N/A',
      'Network Type': world.network?.isServer ? 'Server' : 'Client',
      'Physics Active': world.physics?.active ? 'Yes' : 'No',
      'Frame': world.frame || 0,
      'Time': world.time?.toFixed(2) || 0,
    }

    return (
      <div css={css`
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 10px;
        padding: 10px;
      `}>
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} css={css`
            background: ${theme.background}44;
            padding: 10px;
            border-radius: 8px;
            border: 1px solid ${theme.border}44;
          `}>
            <div css={css`
              font-size: 12px;
              color: ${theme.text}88;
              margin-bottom: 4px;
            `}>
              {key}
            </div>
            <div css={css`
              font-size: 14px;
              color: ${theme.text};
            `}>
              {value}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderEntityDetails = () => {
    if (!selectedEntity) return null

    const details = {
      'Basic Info': {
        'ID': selectedEntity.data.id || 'N/A',
        'Type': selectedEntity.data.type || 'N/A',
        'Name': selectedEntity.data.name || 'N/A',
      },
      'Transform': {
        'Position': selectedEntity.data.position?.join(', ') || 'N/A',
        'Rotation': selectedEntity.data.rotation?.join(', ') || 'N/A',
        'Scale': selectedEntity.data.scale?.join(', ') || 'N/A',
      },
      'Components': {
        'Has Physics': !!selectedEntity.data.physics,
        'Has Mesh': !!selectedEntity.data.mesh,
        'Has Script': !!selectedEntity.data.script,
        'Has Collider': !!selectedEntity.data.collider,
      },
      'Hierarchy': {
        'Parent': selectedEntity.data.parent?.id || 'None',
        'Children Count': selectedEntity.nodes?.size || 0,
      }
    }

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
      color: ${theme.text};
      font-family: 'Courier New', monospace;
      background: ${theme.background}ee;
    `}>
      {/* Tab Bar */}
      <div css={css`
        display: flex;
        gap: 2px;
        padding: 8px 8px 0 8px;
        background: ${theme.background}dd;
        border-bottom: 1px solid ${theme.primary}33;
      `}>
        {[
          { id: 'hierarchy', label: 'World Hierarchy', icon: '🌐' },
          { id: 'terminal', label: 'Terminal', icon: '💻' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
            css={css`
              background: ${selectedTab === tab.id ? theme.background : theme.background + '88'};
              border: 1px solid ${theme.primary}33;
              border-bottom: ${selectedTab === tab.id ? 'none' : `1px solid ${theme.primary}33`};
              border-radius: 4px 4px 0 0;
              color: ${selectedTab === tab.id ? theme.primary : theme.text};
              padding: 8px 16px;
              cursor: pointer;
              font-family: 'Courier New', monospace;
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: ${selectedTab === tab.id ? '-1px' : '0'};
              
              &:hover {
                background: ${theme.background};
                color: ${theme.primary};
              }
            `}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div css={css`
        flex: 1;
        overflow: hidden;
        background: ${theme.background}dd;
      `}>
        {selectedTab === 'hierarchy' ? (
          <div css={css`
            display: flex;
            height: 100%;
          `}>
            {/* Entity List */}
            <div css={css`
              width: 300px;
              border-right: 1px solid ${theme.border};
              display: flex;
              flex-direction: column;
              background: ${theme.background}22;
            `}>
              <div css={css`
                padding: 12px;
                background: ${theme.primary}11;
                border-bottom: 1px solid ${theme.primary}33;
              `}>
                <input
                  type="text"
                  placeholder="Search entities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  css={css`
                    width: 100%;
                    padding: 8px 12px;
                    background: ${theme.background}dd;
                    border: 1px solid ${theme.primary}33;
                    border-radius: 4px;
                    color: ${theme.text};
                    font-family: 'Courier New', monospace;
                    
                    &:focus {
                      outline: none;
                      border-color: ${theme.primary};
                    }
                    
                    &::placeholder {
                      color: ${theme.text}66;
                    }
                  `}
                />
              </div>
              <div css={css`
                flex: 1;
                overflow-y: auto;
                padding: 8px;
                
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
              `}>
                {Array.from(world.entities.items.values())
                  .filter(entity => 
                    !searchTerm || 
                    entity.data.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    entity.data.type.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map(entity => renderEntityNode(entity))
                }
              </div>
            </div>

            {/* Entity Details */}
            <div css={css`
              flex: 1;
              overflow-y: auto;
              padding: 20px;
              
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
            `}>
              {renderWorldInfo()}
              {selectedEntity && (
                <div css={css`margin-top: 20px;`}>
                  {renderEntityDetails()}
                </div>
              )}
            </div>
          </div>
        ) : (
          <Terminal theme={theme} world={world} />
        )}
      </div>
    </div>
  )
} 
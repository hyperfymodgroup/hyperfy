import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookIcon,
  SearchIcon,
  LoaderIcon,
  ArrowRightIcon,
  XIcon,
} from 'lucide-react'

import documentationData from '../public/data/docs.json'
import { usePane } from './usePane'

export function Docspane({ close }) {
  const paneRef = useRef()
  const headRef = useRef()
  const [data, setData] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedSections, setExpandedSections] = useState({})

  useEffect(() => {
    if (paneRef.current && headRef.current) {
      usePane('docs', paneRef, headRef)
    }
  }, [paneRef, headRef])

  useEffect(() => {
    try {
      setData(documentationData)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const filteredData = useMemo(() => {
    if (!searchTerm) return data

    const lowerCaseSearchTerm = searchTerm.toLowerCase()

    return Object.keys(data).reduce((acc, key) => {
      const item = data[key]
      const matchesTitle = item.title.toLowerCase().includes(lowerCaseSearchTerm)
      const matchesDescription = item.description.toLowerCase().includes(lowerCaseSearchTerm)
      const matchesProperties = Object.values(item.properties || {}).some(prop =>
        prop.description.toLowerCase().includes(lowerCaseSearchTerm)
      )
      const matchesMethods = Object.values(item.methods || {}).some(method =>
        method.description.toLowerCase().includes(lowerCaseSearchTerm)
      )

      if (matchesTitle || matchesDescription || matchesProperties || matchesMethods) {
        acc[key] = item
      }

      return acc
    }, {})
  }, [data, searchTerm])

  const toggleSection = (key) => {
    setExpandedSections(prevState => ({
      ...prevState,
      [key]: !prevState[key]
    }))
  }

  if (loading) {
    return (
      <div className='docspane-loader' css={css`
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        font-size: 24px;
        color: rgba(255, 255, 255, 0.5);
      `}>
        <LoaderIcon size={32} />
        <span>Loading...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className='docspane-error' css={css`
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        font-size: 24px;
        color: rgba(255, 0, 0, 0.5);
      `}>
        <XIcon size={32} />
        <span>Error loading documentation: {error.message}</span>
      </div>
    )
  }

  return (
    <div
      ref={paneRef}
      className='docspane'
      css={css`
        position: absolute;
        top: 20px;
        left: 20px;
        width: 540px;
        height: calc(100vh - 40px);
        background: rgba(22, 22, 28, 1);
        border: 1px solid rgba(255, 255, 255, 0.03);
        border-radius: 10px;
        box-shadow: rgba(0, 0, 0, 0.5) 0px 10px 30px;
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      `}
    >
      <div
        ref={headRef}
        className='docspane-head'
        css={css`
          display: flex;
          align-items: center;
          padding: 0 13px 0 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          cursor: move;
          .docspane-head-title {
            padding-left: 10px;
            flex: 1;
            font-weight: 500;
          }
          .docspane-head-search {
            width: 150px;
            display: flex;
            align-items: center;
            svg {
              margin-right: 5px;
            }
            input {
              flex: 1;
              font-size: 14px;
              padding: 5px;
              border: 1px solid rgba(255, 255, 255, 0.05);
              border-radius: 10px;
              background: rgba(45, 45, 55, 1);
              color: white;
              &::placeholder {
                color: rgba(255, 255, 255, 0.5);
              }
            }
          }
          .docspane-head-btn {
            width: 30px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.5);
            &:hover {
              cursor: pointer;
              color: white;
            }
          }
        `}
      >
        <BookIcon size={16} />
        <div className='docspane-head-title'>Documentation</div>
        <div className='docspane-head-search'>
          <SearchIcon size={16} />
          <input
            type='text'
            placeholder='Search'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className='docspane-head-btn' onClick={close}>
          <XIcon size={20} />
        </div>
      </div>
      <div className='docspane-content' css={css`
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        height: calc(100% - 70px);
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* Edge */
        &::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
      `}>
        {Object.keys(filteredData).length === 0 ? (
          <div className='docspane-empty' css={css`
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: rgba(255, 255, 255, 0.5);
          `}>
            <span>No results found</span>
          </div>
        ) : (
          Object.keys(filteredData).map((key) => {
            const item = filteredData[key]
            return (
              <div key={key} className='docspane-section' css={css`
                margin-bottom: 10px;
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 10px;
                background: rgba(35, 35, 45, 1);
                overflow: hidden;
                transition: max-height 0.2s ease-out;
              `}>
                <div className='docspane-section-header' onClick={() => toggleSection(key)} css={css`
                  display: flex;
                  align-items: center;
                  cursor: pointer;
                  padding: 10px;
                  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                `}>
                  <ArrowRightIcon size={16} css={css`
                    transform: ${expandedSections[key] ? 'rotate(90deg)' : 'rotate(0deg)'};
                    transition: transform 0.2s;
                    margin-right: 10px;
                  `} />
                  <div className='docspane-section-title' css={css`
                    font-size: 18px;
                    font-weight: 500;
                  `}>{item.title}</div>
                </div>
                <div className='docspane-section-description' css={css`
                  padding: 10px 20px;
                  color: rgba(255, 255, 255, 0.5);
                `}>
                  {item.description}
                </div>
                <div className={`docspane-section-content ${expandedSections[key] ? 'expanded' : ''}`} css={css`
                  padding: ${expandedSections[key] ? '10px 20px' : '0'};
                  background: rgba(45, 45, 55, 1);
                  border-top: none;
                  border-radius: 0 0 10px 10px;
                  max-height: ${expandedSections[key] ? '500px' : '0'};
                  overflow-y: auto;
                  scrollbar-width: none; /* Firefox */
                  -ms-overflow-style: none; /* Edge */
                  &::-webkit-scrollbar {
                    display: none; /* Chrome, Safari, Opera */
                  }
                  transition: max-height 0.2s ease-out;
                `}>
                  {expandedSections[key] && item.properties && Object.keys(item.properties).map((propKey) => {
                    const prop = item.properties[propKey]
                    return (
                      <div key={propKey} className='docspane-section-property' css={css`
                        margin-bottom: 5px;
                      `}>
                        <div className='docspane-section-property-name' css={css`
                          font-size: 14px;
                          font-weight: 500;
                        `}>{propKey}</div>
                        <div className='docspane-section-property-type' css={css`
                          font-size: 12px;
                          color: rgba(255, 255, 255, 0.5);
                        `}>{prop.type}</div>
                        <div className='docspane-section-property-description' css={css`
                          font-size: 14px;
                          color: rgba(255, 255, 255, 0.7);
                        `}>{prop.description}</div>
                      </div>
                    )
                  })}
                  {expandedSections[key] && item.methods && Object.keys(item.methods).map((methodKey) => {
                    const method = item.methods[methodKey]
                    return (
                      <div key={methodKey} className='docspane-section-method' css={css`
                        margin-bottom: 5px;
                      `}>
                        <div className='docspane-section-method-name' css={css`
                          font-size: 14px;
                          font-weight: 500;
                        `}>{methodKey}</div>
                        <div className='docspane-section-method-description' css={css`
                          font-size: 14px;
                          color: rgba(255, 255, 255, 0.7);
                        `}>{method.description}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BoxIcon,
  CircleCheckIcon,
  DownloadIcon,
  EarthIcon,
  EyeIcon,
  FileCode2Icon,
  FileIcon,
  LoaderIcon,
  PackageCheckIcon,
  ShuffleIcon,
  XIcon,
  LayersIcon,
  AtomIcon,
  FolderIcon,
  BlendIcon,
  CircleIcon,
  AnchorIcon,
  PersonStandingIcon,
  MagnetIcon,
  DumbbellIcon,
  ChevronDown,
  SplitIcon,
  LockKeyholeIcon,
  SparkleIcon,
  ZapIcon,
  Trash2Icon,
} from 'lucide-react'

import { hashFile } from '../../core/utils-client'
import { usePane } from './usePane'
import { useUpdate } from './useUpdate'
import { cls } from './cls'
import { exportApp } from '../../core/extras/appTools'
import { downloadFile } from '../../core/extras/downloadFile'
import { hasRole } from '../../core/utils'
import {
  fileKinds,
  InputDropdown,
  InputFile,
  InputNumber,
  InputRange,
  InputSwitch,
  InputText,
  InputTextarea,
} from './Inputs'

export function InspectPane({ world, entity }) {
  if (entity.isApp) {
    return <AppPane world={world} app={entity} />
  }
  if (entity.isPlayer) {
    return <PlayerPane world={world} player={entity} />
  }
}

const extToType = {
  glb: 'model',
  vrm: 'avatar',
}
const allowedModels = ['glb', 'vrm']

export function AppPane({ world, app }) {
  const paneRef = useRef()
  const headRef = useRef()
  const [blueprint, setBlueprint] = useState(app.blueprint)
  const canEdit = !blueprint.frozen && hasRole(world.entities.player.data.roles, 'admin', 'builder')
  const [tab, setTab] = useState('main')
  usePane('inspect', paneRef, headRef)
  useEffect(() => {
    window.app = app
  }, [])
  useEffect(() => {
    const onModify = bp => {
      if (bp.id !== blueprint.id) return
      setBlueprint(bp)
    }
    world.blueprints.on('modify', onModify)
    return () => {
      world.blueprints.off('modify', onModify)
    }
  }, [])
  const download = async () => {
    try {
      const file = await exportApp(app.blueprint, world.loader.loadFile)
      downloadFile(file)
    } catch (err) {
      console.error(err)
    }
  }

  // Close handler
  const handleClose = () => {
    world.emit('inspect-close')
    world.emit('inspect', null)
  }

  return (
    <div
      ref={paneRef}
      className='apane'
      css={css`
        position: absolute;
        top: 20px;
        left: 20px;
        width: 320px;
        max-height: calc(100vh - 40px);
        background: rgba(22, 22, 28, 1);
        border: 1px solid rgba(255, 255, 255, 0.03);
        border-radius: 10px;
        box-shadow: rgba(0, 0, 0, 0.5) 0px 10px 30px;
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        .apane-head {
          height: 50px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          padding: 0 10px;
          &-icon {
            width: 60px;
            height: 40px;
            display: flex;
            align-items: center;
            svg {
              margin-left: 10px;
            }
          }
          &-tabs {
            flex: 1;
            align-self: stretch;
            display: flex;
            justify-content: center;
          }
          &-tab {
            align-self: stretch;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 16px 0 0;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.5);
            &:hover:not(.active) {
              cursor: pointer;
              color: rgba(255, 255, 255, 0.7);
            }
            &.active {
              border-bottom: 1px solid white;
              margin-bottom: -1px;
              color: white;
            }
          }

          &-btns {
            width: 60px;
            display: flex;
            align-items: center;
            &.right {
              justify-content: flex-end;
            }
          }

          &-btn {
            color: #515151;
            width: 30px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            &:hover {
              cursor: pointer;
              color: white;
            }
          }
        }
        .apane-download {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          svg {
            margin-right: 8px;
          }
          span {
            font-size: 14px;
          }
          &:hover {
            cursor: pointer;
          }
        }
      `}
    >
      <div className='apane-head' ref={headRef}>
        <div className='apane-head-icon'>
          <ZapIcon size={16} />
        </div>
        <div className='apane-head-tabs'>
          <div className={cls('apane-head-tab', { active: tab === 'main' })} onClick={() => setTab('main')}>
            <span>App</span>
          </div>
          {canEdit && (
            <div className={cls('apane-head-tab', { active: tab === 'meta' })} onClick={() => setTab('meta')}>
              <span>Meta</span>
            </div>
          )}
          <div className={cls('apane-head-tab', { active: tab === 'nodes' })} onClick={() => setTab('nodes')}>
            <span>Nodes</span>
          </div>
        </div>
        <div className='apane-head-btns right'>
          {canEdit && (
            <div
              className='apane-head-btn'
              onClick={() => {
                handleClose()
                app.destroy(true)
              }}
            >
              <Trash2Icon size={16} />
            </div>
          )}
          <div className='apane-head-btn' onClick={handleClose}>
            <XIcon size={20} />
          </div>
        </div>
      </div>
      {tab === 'main' && (
        <>
          <AppPaneMain world={world} app={app} blueprint={blueprint} canEdit={canEdit} />
          <div className='apane-download' onClick={download}>
            <DownloadIcon size={16} />
            <span>Download</span>
          </div>
        </>
      )}
      {tab === 'meta' && <AppPaneMeta world={world} app={app} blueprint={blueprint} />}
      {tab === 'nodes' && <AppPaneNodes app={app} world={world} />}
    </div>
  )
}

function AppPaneMain({ world, app, blueprint, canEdit }) {
  const [fileInputKey, setFileInputKey] = useState(0)
  const downloadModel = e => {
    if (e.shiftKey) {
      e.preventDefault()
      const file = world.loader.getFile(blueprint.model)
      if (!file) return
      downloadFile(file)
    }
  }
  const changeModel = async e => {
    setFileInputKey(n => n + 1)
    const file = e.target.files[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    if (!allowedModels.includes(ext)) return
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as glb filename
    const filename = `${hash}.${ext}`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    const type = extToType[ext]
    world.loader.insert(type, url, file)
    // update blueprint locally (also rebuilds apps)
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, model: url })
    // upload model
    await world.network.upload(file)
    // broadcast blueprint change to server + other clients
    world.network.send('blueprintModified', { id: blueprint.id, version, model: url })
  }
  const editCode = () => {
    world.emit('code', true)
  }
  const toggle = async key => {
    const value = !blueprint[key]
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, [key]: value })
    world.network.send('blueprintModified', { id: blueprint.id, version, [key]: value })
  }
  return (
    <div
      className='amain noscrollbar'
      css={css`
        flex: 1;
        padding: 0 20px 10px;
        max-height: 500px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        .amain-image {
          align-self: center;
          width: 120px;
          height: 120px;
          background-position: center;
          background-size: cover;
          border-radius: 10px;
          margin: 20px 0 0;
        }
        .amain-name {
          text-align: center;
          font-size: 18px;
          font-weight: 500;
          margin: 16px 0 0;
        }
        .amain-author {
          text-align: center;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 7px 0 0;
          a {
            color: #00a7ff;
          }
        }
        .amain-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 16px 0 0;
        }
        .amain-line {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          margin: 0 -20px;
          &.mt {
            margin-top: 20px;
          }
          &.mb {
            margin-bottom: 20px;
          }
        }
        .amain-btns {
          display: flex;
          gap: 5px;
          margin: 0 0 5px;
          &-btn {
            flex: 1;
            background: #252630;
            border-radius: 10px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            cursor: pointer;
            input {
              position: absolute;
              top: -9999px;
            }
            svg {
              margin: 0 8px 0 0;
            }
            span {
              font-size: 14px;
            }
          }
        }
        .amain-btns2 {
          display: flex;
          gap: 5px;
          &-btn {
            flex: 1;
            background: #252630;
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 10px 0;
            color: #606275;
            cursor: pointer;
            svg {
              margin: 0 0 5px;
            }
            span {
              font-size: 12px;
            }
            &.active {
              color: white;
              &.blue svg {
                color: #5097ff;
              }
              &.yellow svg {
                color: #fbff50;
              }
              &.red svg {
                color: #ff5050;
              }
              &.green svg {
                color: #50ff51;
              }
            }
          }
        }
        .amain-fields {
          margin-top: 20px;
        }
      `}
    >
      {blueprint.image && (
        <div
          className='amain-image'
          css={css`
            background-image: ${blueprint.image ? `url(${world.resolveURL(blueprint.image.url)})` : 'none'};
          `}
        />
      )}
      {blueprint.name && <div className='amain-name'>{blueprint.name}</div>}
      {blueprint.author && (
        <div className='amain-author'>
          <span>by </span>
          {blueprint.url && (
            <a href={world.resolveURL(blueprint.url)} target='_blank'>
              {blueprint.author || 'Unknown'}
            </a>
          )}
          {!blueprint.url && <span>{blueprint.author || 'Unknown'}</span>}
        </div>
      )}
      {blueprint.desc && <div className='amain-desc'>{blueprint.desc}</div>}
      {canEdit && (
        <>
          <div className='amain-line mt mb' />
          <div className='amain-btns'>
            <label className='amain-btns-btn' onClick={downloadModel}>
              <input key={fileInputKey} type='file' accept='.glb,.vrm' onChange={changeModel} />
              <BoxIcon size={16} />
              <span>Model</span>
            </label>
            <div className='amain-btns-btn' onClick={editCode}>
              <FileCode2Icon size={16} />
              <span>Code</span>
            </div>
          </div>
          <div className='amain-btns2'>
            <div
              className={cls('amain-btns2-btn green', { active: blueprint.preload })}
              onClick={() => toggle('preload')}
            >
              <CircleCheckIcon size={12} />
              <span>Preload</span>
            </div>
            <div className={cls('amain-btns2-btn blue', { active: blueprint.public })} onClick={() => toggle('public')}>
              <EarthIcon size={12} />
              <span>Public</span>
            </div>
            <div className={cls('amain-btns2-btn red', { active: blueprint.locked })} onClick={() => toggle('locked')}>
              <LockKeyholeIcon size={12} />
              <span>Lock</span>
            </div>
            <div
              className={cls('amain-btns2-btn yellow', { active: blueprint.unique })}
              onClick={() => toggle('unique')}
            >
              <SparkleIcon size={12} />
              <span>Unique</span>
            </div>
          </div>
          {app.fields.length > 0 && <div className='amain-line mt' />}
          <div className='amain-fields'>
            <Fields app={app} blueprint={blueprint} />
          </div>
        </>
      )}
    </div>
  )
}

function AppPaneMeta({ world, app, blueprint }) {
  const set = async (key, value) => {
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, [key]: value })
    world.network.send('blueprintModified', { id: blueprint.id, version, [key]: value })
  }
  return (
    <div
      className='ameta noscrollbar'
      css={css`
        flex: 1;
        padding: 20px 20px 10px;
        max-height: 500px;
        overflow-y: auto;
        .ameta-field {
          display: flex;
          align-items: center;
          margin: 0 0 10px;
          &-label {
            width: 90px;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.5);
          }
          &-input {
            flex: 1;
          }
        }
      `}
    >
      <div className='ameta-field'>
        <div className='ameta-field-label'>Name</div>
        <div className='ameta-field-input'>
          <InputText value={blueprint.name} onChange={name => set('name', name)} />
        </div>
      </div>
      <div className='ameta-field'>
        <div className='ameta-field-label'>Image</div>
        <div className='ameta-field-input'>
          <InputFile world={world} kind='texture' value={blueprint.image} onChange={image => set('image', image)} />
        </div>
      </div>
      <div className='ameta-field'>
        <div className='ameta-field-label'>Author</div>
        <div className='ameta-field-input'>
          <InputText value={blueprint.author} onChange={author => set('author', author)} />
        </div>
      </div>
      <div className='ameta-field'>
        <div className='ameta-field-label'>URL</div>
        <div className='ameta-field-input'>
          <InputText value={blueprint.url} onChange={url => set('url', url)} />
        </div>
      </div>
      <div className='ameta-field'>
        <div className='ameta-field-label'>Description</div>
        <div className='ameta-field-input'>
          <InputTextarea value={blueprint.desc} onChange={desc => set('desc', desc)} />
        </div>
      </div>
    </div>
  )
}

function AppPaneNodes({ app, world }) {
  const [selectedNode, setSelectedNode] = useState(null)
  const rootNode = useMemo(() => app.getNodes(), [])
  const [updateCounter, setUpdateCounter] = useState(0)

  // Set up auto-refresh for the node data
  useEffect(() => {
    const intervalId = setInterval(() => {
      setUpdateCounter(prev => prev + 1);
    }, 1000); // Refresh every second
    
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (rootNode && !selectedNode) {
      setSelectedNode(rootNode)
    }
  }, [rootNode])

  // Helper function to safely get vector string
  const getVectorString = vec => {
    if (!vec || typeof vec.x !== 'number') return null
    return `${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)}`
  }

  // Helper function to get vector components for editable fields
  const getVectorComponents = vec => {
    if (!vec || typeof vec.x !== 'number') return { x: 0, y: 0, z: 0 }
    return { 
      x: parseFloat(vec.x.toFixed(3)), 
      y: parseFloat(vec.y.toFixed(3)), 
      z: parseFloat(vec.z.toFixed(3))
    }
  }

  // Helper function to safely check if a property exists
  const hasProperty = (obj, prop) => {
    try {
      return obj && typeof obj[prop] !== 'undefined'
    } catch (err) {
      return false
    }
  }

  // Function to update node properties
  const updateNodeProperty = (property, component, value) => {
    if (!selectedNode || !hasProperty(selectedNode, property)) return
    
    // Safely update the property
    try {
      // Convert string input to number
      const numValue = parseFloat(value)
      if (isNaN(numValue)) return

      // Update the component (x, y, or z)
      selectedNode[property][component] = numValue
      
      // For nodes with matrix updates
      if (typeof selectedNode.clean === 'function') {
        selectedNode.clean()
      }
      
      // Trigger a re-render
      setUpdateCounter(prev => prev + 1)
      
      // If this is an app's root node, update app entity position in network
      if (app.root === selectedNode) {
        const updateData = {
          id: app.data.id
        };
        
        if (property === 'position') {
          updateData.position = selectedNode.position.toArray();
        } else if (property === 'rotation') {
          updateData.quaternion = selectedNode.quaternion.toArray();
        } else if (property === 'scale') {
          updateData.scale = selectedNode.scale.toArray();
        }
        
        // Send update to network
        world.network.send('entityModified', updateData);
        
        // Update gizmo position if available
        if (world.builder && world.builder.updateHighlight) {
          world.builder.updateHighlight();
        }
      }
    } catch (err) {
      console.error('Failed to update property:', err)
    }
  }

  return (
    <div
      className='anodes noscrollbar'
      css={css`
        flex: 1;
        padding: 20px;
        min-height: 200px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        .anodes-tree {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 20px;
          padding-right: 10px;
        }
        .anodes-item {
          display: flex;
          align-items: center;
          padding: 4px 6px;
          border-radius: 10px;
          font-size: 14px;
          cursor: pointer;
          &:hover {
            color: #00a7ff;
          }
          &.selected {
            color: #00a7ff;
            background: rgba(0, 167, 255, 0.1);
          }
          svg {
            margin-right: 8px;
            opacity: 0.5;
            flex-shrink: 0;
          }
          span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          &-indent {
            margin-left: 20px;
          }
        }
        .anodes-empty {
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
          padding: 20px;
        }
        .anodes-details {
          flex-shrink: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
          max-height: 40vh;
          overflow-y: auto;
          padding-right: 10px;
        }
        .anodes-detail {
          display: flex;
          margin-bottom: 12px;
          font-size: 14px;
          &-label {
            width: 100px;
            color: rgba(255, 255, 255, 0.5);
            flex-shrink: 0;
          }
          &-value {
            flex: 1;
            word-break: break-word;
            &.copy {
              cursor: pointer;
            }
          }
          &-inputs {
            display: flex;
            flex: 1;
            gap: 5px;
          }
          &-input-group {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
          }
          &-input {
            flex: 1;
            width: 100%;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
            border-radius: 4px;
            padding: 3px 18px;
            font-size: 13px;
            text-align: center;
            font-family: monospace;
            &:focus {
              outline: none;
              border-color: #00a7ff;
              background: rgba(0, 167, 255, 0.1);
            }
            &.x {
              border-top: 2px solid #ff4d4d;
            }
            &.y {
              border-top: 2px solid #4dff4d;
            }
            &.z {
              border-top: 2px solid #4d4dff;
            }
          }
          &-btn {
            position: absolute;
            width: 18px;
            height: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            cursor: pointer;
            &:hover {
              color: white;
              background: rgba(255, 255, 255, 0.1);
            }
            &.up {
              top: 0;
              right: 0;
              border-top-right-radius: 4px;
            }
            &.down {
              bottom: 0;
              right: 0;
              border-bottom-right-radius: 4px;
            }
          }
          &-component-label {
            margin-top: 2px;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            text-transform: uppercase;
          }
        }
      `}
    >
      <div className='anodes-tree'>
        {rootNode ? (
          renderHierarchy([rootNode], 0, selectedNode, setSelectedNode)
        ) : (
          <div className='anodes-empty'>
            <LayersIcon size={24} />
            <div>No nodes found</div>
          </div>
        )}
      </div>

      {selectedNode && (
        <div className='anodes-details'>
          <HierarchyDetail label='ID' value={selectedNode.id} copy />
          <HierarchyDetail label='Name' value={selectedNode.name} />

          {/* Position - Editable */}
          {hasProperty(selectedNode, 'position') && (
            <HierarchyDetailVector 
              label='Position' 
              vector={getVectorComponents(selectedNode.position)} 
              onChange={(component, value) => updateNodeProperty('position', component, value)}
            />
          )}

          {/* Rotation - Editable */}
          {hasProperty(selectedNode, 'rotation') && (
            <HierarchyDetailVector 
              label='Rotation' 
              vector={getVectorComponents(selectedNode.rotation)} 
              onChange={(component, value) => updateNodeProperty('rotation', component, value)}
              isDegrees={true}
            />
          )}

          {/* Scale - Editable */}
          {hasProperty(selectedNode, 'scale') && (
            <HierarchyDetailVector 
              label='Scale' 
              vector={getVectorComponents(selectedNode.scale)} 
              onChange={(component, value) => updateNodeProperty('scale', component, value)}
            />
          )}

          {/* Material */}
          {hasProperty(selectedNode, 'material') && selectedNode.material && (
            <>
              <HierarchyDetail label='Material' value={selectedNode.material.type || 'Standard'} />
              {hasProperty(selectedNode.material, 'color') && selectedNode.material.color && (
                <HierarchyDetail
                  label='Color'
                  value={
                    selectedNode.material.color.getHexString
                      ? `#${selectedNode.material.color.getHexString()}`
                      : 'Unknown'
                  }
                />
              )}
            </>
          )}

          {/* Geometry */}
          {hasProperty(selectedNode, 'geometry') && selectedNode.geometry && (
            <HierarchyDetail label='Geometry' value={selectedNode.geometry.type || 'Custom'} />
          )}
        </div>
      )}
    </div>
  )
}

function HierarchyDetail({ label, value, copy }) {
  let handleCopy = copy ? () => navigator.clipboard.writeText(value) : null
  return (
    <div className='anodes-detail'>
      <div className='anodes-detail-label'>{label}</div>
      <div className={cls('anodes-detail-value', { copy })} onClick={handleCopy}>
        {value}
      </div>
    </div>
  )
}

function HierarchyDetailVector({ label, vector, onChange, isDegrees = false }) {
  // Store local state to avoid flickering during edits
  const [localValues, setLocalValues] = useState({
    x: isDegrees ? (vector.x * 180 / Math.PI).toFixed(1) : vector.x.toFixed(3),
    y: isDegrees ? (vector.y * 180 / Math.PI).toFixed(1) : vector.y.toFixed(3),
    z: isDegrees ? (vector.z * 180 / Math.PI).toFixed(1) : vector.z.toFixed(3)
  });
  
  // Update local values when the vector changes (from external sources)
  useEffect(() => {
    setLocalValues({
      x: isDegrees ? (vector.x * 180 / Math.PI).toFixed(1) : vector.x.toFixed(3),
      y: isDegrees ? (vector.y * 180 / Math.PI).toFixed(1) : vector.y.toFixed(3),
      z: isDegrees ? (vector.z * 180 / Math.PI).toFixed(1) : vector.z.toFixed(3)
    });
  }, [vector, isDegrees]);

  const handleInputChange = (component, value) => {
    // Update local input state immediately for responsive UI
    setLocalValues(prev => ({
      ...prev,
      [component]: value
    }));
  };

  const handleBlur = (component, value) => {
    // Parse as number
    let numValue = parseFloat(value);
    
    // Validate
    if (isNaN(numValue)) {
      // Reset to original value if invalid
      setLocalValues(prev => ({
        ...prev,
        [component]: isDegrees 
          ? (vector[component] * 180 / Math.PI).toFixed(1) 
          : vector[component].toFixed(3)
      }));
      return;
    }
    
    // Snap rotation values to nearest 5 degrees
    if (isDegrees) {
      numValue = Math.round(numValue / 5) * 5;
      setLocalValues(prev => ({
        ...prev,
        [component]: numValue.toFixed(1)
      }));
      
      // Convert to radians for the actual change
      numValue = numValue * Math.PI / 180;
    }
    
    // Commit the change
    onChange(component, numValue);
  };

  const handleKeyDown = (e, component, value) => {
    if (e.key === 'Enter') {
      e.target.blur(); // Trigger blur to apply the value
    }
  };
  
  const handleIncrement = (component, amount) => {
    const currentValue = parseFloat(localValues[component]);
    if (isNaN(currentValue)) return;
    
    // Calculate the increment amount based on the type of value
    const increment = isDegrees ? 5 : (label === 'Scale' ? 0.1 : 0.25);
    const newValue = (currentValue + (increment * amount)).toFixed(isDegrees ? 1 : 3);
    
    // Update the local UI immediately
    setLocalValues(prev => ({
      ...prev,
      [component]: newValue
    }));
    
    // Apply the value
    let finalValue = parseFloat(newValue);
    if (isDegrees) {
      finalValue = finalValue * Math.PI / 180;
    }
    
    onChange(component, finalValue);
  };

  return (
    <div className='anodes-detail'>
      <div className='anodes-detail-label'>{label}</div>
      <div className='anodes-detail-inputs'>
        <div className='anodes-detail-input-group'>
          <input 
            type="text" 
            className="anodes-detail-input x" 
            value={localValues.x} 
            onChange={(e) => handleInputChange('x', e.target.value)}
            onBlur={(e) => handleBlur('x', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'x', e.target.value)}
          />
          <div className="anodes-detail-btn up" onClick={() => handleIncrement('x', 1)}>+</div>
          <div className="anodes-detail-btn down" onClick={() => handleIncrement('x', -1)}>-</div>
          <div className="anodes-detail-component-label">X</div>
        </div>
        
        <div className='anodes-detail-input-group'>
          <input 
            type="text" 
            className="anodes-detail-input y" 
            value={localValues.y} 
            onChange={(e) => handleInputChange('y', e.target.value)}
            onBlur={(e) => handleBlur('y', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'y', e.target.value)}
          />
          <div className="anodes-detail-btn up" onClick={() => handleIncrement('y', 1)}>+</div>
          <div className="anodes-detail-btn down" onClick={() => handleIncrement('y', -1)}>-</div>
          <div className="anodes-detail-component-label">Y</div>
        </div>
        
        <div className='anodes-detail-input-group'>
          <input 
            type="text" 
            className="anodes-detail-input z" 
            value={localValues.z} 
            onChange={(e) => handleInputChange('z', e.target.value)}
            onBlur={(e) => handleBlur('z', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'z', e.target.value)}
          />
          <div className="anodes-detail-btn up" onClick={() => handleIncrement('z', 1)}>+</div>
          <div className="anodes-detail-btn down" onClick={() => handleIncrement('z', -1)}>-</div>
          <div className="anodes-detail-component-label">Z</div>
        </div>
      </div>
    </div>
  )
}

const nodeIcons = {
  default: CircleIcon,
  group: FolderIcon,
  mesh: BoxIcon,
  rigidbody: DumbbellIcon,
  collider: BlendIcon,
  lod: EyeIcon,
  avatar: PersonStandingIcon,
  snap: MagnetIcon,
}

function renderHierarchy(nodes, depth = 0, selectedNode, setSelectedNode) {
  if (!Array.isArray(nodes)) return null

  return nodes.map(node => {
    if (!node) return null

    // Skip the root node but show its children
    // if (depth === 0 && node.id === '$root') {
    //   return renderHierarchy(node.children || [], depth, selectedNode, setSelectedNode)
    // }

    // Safely get children
    const children = node.children || []
    const hasChildren = Array.isArray(children) && children.length > 0
    const isSelected = selectedNode?.id === node.id
    const Icon = nodeIcons[node.name] || nodeIcons.default

    return (
      <div key={node.id}>
        <div
          className={cls('anodes-item', {
            'anodes-item-indent': depth > 0,
            selected: isSelected,
          })}
          style={{ marginLeft: depth * 20 }}
          onClick={() => setSelectedNode(node)}
        >
          <Icon size={14} />
          <span>{node.id === '$root' ? 'app' : node.id}</span>
        </div>
        {hasChildren && renderHierarchy(children, depth + 1, selectedNode, setSelectedNode)}
      </div>
    )
  })
}

function PlayerPane({ world, player }) {
  return <div>PLAYER INSPECT</div>
}

function Fields({ app, blueprint }) {
  const world = app.world
  const [fields, setFields] = useState(app.fields)
  const props = blueprint.props
  useEffect(() => {
    app.onFields = setFields
    return () => {
      app.onFields = null
    }
  }, [])
  const modify = (key, value) => {
    if (props[key] === value) return
    props[key] = value
    // update blueprint locally (also rebuilds apps)
    const id = blueprint.id
    const version = blueprint.version + 1
    world.blueprints.modify({ id, version, props })
    // broadcast blueprint change to server + other clients
    world.network.send('blueprintModified', { id, version, props })
  }
  return fields.map(field => (
    <Field key={field.key} world={world} props={props} field={field} value={props[field.key]} modify={modify} />
  ))
}

const fieldTypes = {
  section: FieldSection,
  text: FieldText,
  textarea: FieldTextArea,
  number: FieldNumber,
  file: FieldFile,
  switch: FieldSwitch,
  dropdown: FieldDropdown,
  range: FieldRange,
}

function Field({ world, props, field, value, modify }) {
  if (field.hidden) {
    return null
  }
  if (field.when) {
    for (const rule of field.when) {
      if (rule.op === 'eq' && props[rule.key] !== rule.value) {
        return null
      }
    }
  }
  const FieldControl = fieldTypes[field.type]
  if (!FieldControl) return null
  return <FieldControl world={world} field={field} value={value} modify={modify} />
}

function FieldWithLabel({ label, children }) {
  return (
    <div
      className='fieldwlabel'
      css={css`
        display: flex;
        align-items: center;
        margin: 0 0 10px;
        .fieldwlabel-label {
          width: 90px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }
        .fieldwlabel-content {
          flex: 1;
        }
      `}
    >
      <div className='fieldwlabel-label'>{label}</div>
      <div className='fieldwlabel-content'>{children}</div>
    </div>
  )
}

function FieldSection({ world, field, value, modify }) {
  return (
    <div
      className='fieldsection'
      css={css`
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        margin: 20px 0 14px;
        padding: 16px 0 0 0;
        .fieldsection-label {
          font-size: 14px;
          font-weight: 400;
          line-height: 1;
        }
      `}
    >
      <div className='fieldsection-label'>{field.label}</div>
    </div>
  )
}

function FieldText({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputText value={value} onChange={value => modify(field.key, value)} placeholder={field.placeholder} />
    </FieldWithLabel>
  )
}

function FieldTextArea({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputTextarea value={value} onChange={value => modify(field.key, value)} placeholder={field.placeholder} />
    </FieldWithLabel>
  )
}

function FieldNumber({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputNumber
        value={value}
        onChange={value => modify(field.key, value)}
        dp={field.dp}
        min={field.min}
        max={field.max}
        step={field.step}
      />
    </FieldWithLabel>
  )
}

function FieldRange({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputRange
        value={value}
        onChange={value => modify(field.key, value)}
        min={field.min}
        max={field.max}
        step={field.step}
      />
    </FieldWithLabel>
  )
}

function FieldFile({ world, field, value, modify }) {
  const kind = fileKinds[field.kind]
  if (!kind) return null
  return (
    <FieldWithLabel label={field.label}>
      <InputFile world={world} kind={field.kind} value={value} onChange={value => modify(field.key, value)} />
    </FieldWithLabel>
  )
}

function FieldSwitch({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputSwitch options={field.options} value={value} onChange={value => modify(field.key, value)} />
    </FieldWithLabel>
  )
}

function FieldDropdown({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputDropdown options={field.options} value={value} onChange={value => modify(field.key, value)} />
    </FieldWithLabel>
  )
}

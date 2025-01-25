/*
 * Core Inventory App
 * Built-in inventory management for Hyperfy
 */

import { css } from '@firebolt-dev/css'
import { useState, useEffect, useRef } from 'react'
import { useAuthContext } from '../../components/AuthProvider'
import { uuid } from '../../../core/utils'
import * as THREE from '../../../core/extras/three'
import { PencilIcon, InfinityIcon } from 'lucide-react'

export function InventoryApp() {
  const { user } = useAuthContext()
  const [items, setItems] = useState([])
  const [worldItems, setWorldItems] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingName, setEditingName] = useState(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [activeTab, setActiveTab] = useState('inventory') // 'inventory' or 'world'
  const [infiniteItems, setInfiniteItems] = useState(new Set())
  
  // Refs for 3D rendering
  const modelContainersRef = useRef(new Map())
  const renderersRef = useRef(new Map())
  const scenesRef = useRef(new Map())
  const camerasRef = useRef(new Map())
  const modelsRef = useRef(new Map())

  // Load inventory items
  useEffect(() => {
    loadInventory()
  }, [user])

  // Load world items
  useEffect(() => {
    const updateWorldItems = () => {
      const items = []
      
      // Get all entities using get() and filter
      const allEntities = []
      for (let i = 0; i < 1000; i++) { // Reasonable limit to prevent infinite loops
        const entity = window.world.entities.get(i)
        if (!entity) continue
        
        // Only include app entities that have blueprints
        if (entity.type === 'app' && entity.blueprint) {
          const blueprint = window.world.blueprints.get(entity.blueprint)
          if (blueprint) {
            items.push({
              id: entity.id,
              blueprint: entity.blueprint,
              name: blueprint.name || 'Unnamed Item',
              description: blueprint.description || '',
              position: entity.base.position.toArray(),
              model: blueprint.model
            })
          }
        }
      }
      
      console.log('Found world items:', items)
      setWorldItems(items)
    }

    // Initial load
    updateWorldItems()

    // Subscribe to entity changes
    const onAdd = () => {
      console.log('Entity added')
      updateWorldItems()
    }
    const onRemove = () => {
      console.log('Entity removed')
      updateWorldItems()
    }
    window.world.entities.on('add', onAdd)
    window.world.entities.on('remove', onRemove)

    return () => {
      window.world.entities.off('add', onAdd)
      window.world.entities.off('remove', onRemove)
    }
  }, [])

  // Setup 3D rendering for each item
  useEffect(() => {
    // Cleanup old renderers
    renderersRef.current.forEach(renderer => renderer.dispose())
    renderersRef.current.clear()
    scenesRef.current.clear()
    camerasRef.current.clear()
    modelsRef.current.clear()

    const cleanupFunctions = []

    // Setup new renderers for each item
    const setupRenderer = (containerId, blueprint) => {
      const container = modelContainersRef.current.get(containerId)
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) return null

      // Create renderer
      const renderer = new THREE.WebGLRenderer({ 
        alpha: true,
        antialias: true
      })
      renderer.setSize(container.clientWidth, container.clientHeight)
      renderer.setPixelRatio(window.devicePixelRatio)
      container.innerHTML = '' // Clear previous content
      container.appendChild(renderer.domElement)

      // Create scene with cyberpunk atmosphere
      const scene = new THREE.Scene()
      
      // Add fog for depth
      scene.fog = new THREE.FogExp2(0x000000, 0.15)
      
      // Create camera
      const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000)
      camera.position.set(0, 0.5, 2)
      camera.lookAt(0, 0, 0)

      // Add cyberpunk lighting
      const ambientLight = new THREE.AmbientLight(0x551bf9, 0.4) // Purple ambient
      scene.add(ambientLight)
      
      const mainLight = new THREE.DirectionalLight(0x00ffff, 0.8) // Cyan main light
      mainLight.position.set(1, 2, 3)
      scene.add(mainLight)
      
      const backLight = new THREE.DirectionalLight(0xff00ff, 0.5) // Magenta backlight
      backLight.position.set(-1, 1, -2)
      scene.add(backLight)

      // Add grid floor for preview window only
      if (containerId === 'details') {
        const grid = new THREE.GridHelper(4, 10, 0x551bf9, 0x551bf944)
        grid.position.y = -0.5
        scene.add(grid)
      }

      // Store refs
      renderersRef.current.set(containerId, renderer)
      scenesRef.current.set(containerId, scene)
      camerasRef.current.set(containerId, camera)

      // Start animation
      let animationFrame
      const animate = () => {
        animationFrame = requestAnimationFrame(animate)
        const model = modelsRef.current.get(containerId)
        if (model) {
          model.rotation.y += 0.01
        }
        renderer.render(scene, camera)
      }
      animate()

      // Load model if blueprint exists
      if (blueprint && window.world?.blueprints) {
        const loadModel = async () => {
          try {
            const blueprintData = window.world.blueprints.get(blueprint)
            if (!blueprintData) {
              console.warn('Blueprint not found:', blueprint)
              return
            }

            let glb = window.world.loader.get('glb', blueprintData.model)
            if (!glb) {
              glb = await window.world.loader.load('glb', blueprintData.model)
            }

            if (glb) {
              const group = new THREE.Group()
              const modelNodes = glb.scene.clone()
              group.add(modelNodes)
              
              // Scale and center the model
              const box = new THREE.Box3().setFromObject(group)
              const size = box.getSize(new THREE.Vector3())
              const maxDim = Math.max(size.x, size.y, size.z)
              const scale = 1 / maxDim
              group.scale.setScalar(scale)
              
              const center = box.getCenter(new THREE.Vector3())
              group.position.sub(center.multiplyScalar(scale))
              
              // Adjust camera for preview
              if (containerId === 'details') {
                camera.position.z = 3
              } else {
                camera.position.z = 2
              }
              
              scene.add(group)
              modelsRef.current.set(containerId, group)
            }
          } catch (err) {
            console.warn('Failed to load model for item:', blueprint, err)
          }
        }
        loadModel()
      }

      return () => {
        cancelAnimationFrame(animationFrame)
        renderer.dispose()
        renderer.forceContextLoss()
        renderer.domElement.remove()
        container.innerHTML = ''
      }
    }

    // Setup renderers for inventory items
    items.forEach(item => {
      const cleanup = setupRenderer(item.id, item.blueprint)
      if (cleanup) cleanupFunctions.push(cleanup)
    })

    // Setup renderer for details preview if an item is selected
    if (selectedItem) {
      const cleanup = setupRenderer('details', selectedItem.blueprint)
      if (cleanup) cleanupFunctions.push(cleanup)
    }

    return () => {
      cleanupFunctions.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup()
        }
      })
    }
  }, [items, selectedItem])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      items.forEach(item => {
        const container = modelContainersRef.current.get(item.id)
        const renderer = renderersRef.current.get(item.id)
        const camera = camerasRef.current.get(item.id)
        
        if (container && renderer && camera) {
          const width = container.clientWidth
          const height = container.clientHeight
          
          if (width > 0 && height > 0) {
            renderer.setSize(width, height)
            camera.aspect = width / height
            camera.updateProjectionMatrix()
          }
        }
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [items])

  // Load inventory from storage
  const loadInventory = async () => {
    try {
      setIsLoading(true)
      const savedItems = localStorage.getItem('hyperfy_inventory')
      if (savedItems) {
        setItems(JSON.parse(savedItems))
      } else {
        setItems([])
      }
    } catch (err) {
      console.error('Failed to load inventory:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Save inventory to storage
  const saveInventory = (newItems) => {
    try {
      localStorage.setItem('hyperfy_inventory', JSON.stringify(newItems))
    } catch (err) {
      console.error('Failed to save inventory:', err)
    }
  }

  // Add item to inventory
  const addItem = (newItem) => {
    // Get the blueprint data if available
    let itemData = { ...newItem }
    if (newItem.blueprint && window.world?.blueprints) {
      try {
        const blueprint = window.world.blueprints.get(newItem.blueprint)
        if (blueprint) {
          itemData = {
            ...itemData,
            model: blueprint.model, // Store the model path
            name: blueprint.name || newItem.name || 'Unnamed Item',
            description: blueprint.description || ''
          }
        }
      } catch (err) {
        console.warn('Failed to get blueprint data:', err)
      }
    }

    const updatedItems = [...items]
    const existingItem = updatedItems.find(item => 
      // Match by blueprint instead of id to stack similar items
      item.blueprint === itemData.blueprint
    )
    
    if (existingItem) {
      existingItem.quantity += 1
    } else {
      updatedItems.push({
        ...itemData,
        id: uuid(), // Generate new ID for inventory item
        quantity: 1
      })
    }
    
    setItems(updatedItems)
    saveInventory(updatedItems)
  }

  // Remove item from inventory
  const removeItem = (itemId, quantity = 1) => {
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: Math.max(0, item.quantity - quantity)
        }
      }
      return item
    }).filter(item => item.quantity > 0)
    
    setItems(updatedItems)
    saveInventory(updatedItems)
    
    if (selectedItem?.id === itemId && !updatedItems.find(i => i.id === itemId)) {
      setSelectedItem(null)
    }
  }

  // Handle item selection
  const handleSelectItem = (item) => {
    setSelectedItem(item)
  }

  // Handle item use with infinite check
  const handleUseItem = async (item) => {
    try {
      const data = {
        id: uuid(),
        type: 'app',
        blueprint: item.blueprint,
        position: [0, 1, 0],
        quaternion: [0, 0, 0, 1],
        mover: window.world.network.id,
        uploader: null,
      }
      window.world.entities.add(data, true)
      
      // Only remove item if not infinite
      if (!infiniteItems.has(item.id)) {
        removeItem(item.id, 1)
      }
    } catch (err) {
      console.error('Failed to use item:', err)
    }
  }

  // Handle item drop with infinite check
  const handleDropItem = async (item) => {
    try {
      const player = window.world.entities.player
      const position = [...player.base.position.toArray()]
      position[1] += 0.5
      
      const data = {
        id: uuid(),
        type: 'app',
        blueprint: item.blueprint,
        position,
        quaternion: [0, 0, 0, 1],
        mover: null,
        uploader: null,
        scale: [0.3, 0.3, 0.3],
      }
      window.world.entities.add(data, true)
      
      // Only remove item if not infinite
      if (!infiniteItems.has(item.id)) {
        removeItem(item.id, 1)
      }
    } catch (err) {
      console.error('Failed to drop item:', err)
    }
  }

  // Handle name edit
  const startEditingName = (item) => {
    console.log('Start editing name for item:', item.id) // Debug log
    setEditingName(item.id)
    setEditingNameValue(item.name || '')
  }

  const saveEditingName = () => {
    console.log('Saving name:', editingName, editingNameValue) // Debug log
    if (!editingName) return

    const updatedItems = items.map(item => {
      if (item.id === editingName) {
        const updatedItem = {
          ...item,
          name: editingNameValue || 'Unnamed Item'
        }
        // If this is the selected item, update it too
        if (selectedItem?.id === item.id) {
          setSelectedItem(updatedItem)
        }
        return updatedItem
      }
      return item
    })

    setItems(updatedItems)
    saveInventory(updatedItems)
    setEditingName(null)
  }

  // Handle picking up world item
  const handlePickupWorldItem = (item) => {
    try {
      // Add to inventory
      window.hyperFoneInventory.addItem({
        blueprint: item.blueprint,
        name: item.name,
        description: item.description
      })

      // Remove from world
      const entity = window.world.entities.get(item.id)
      if (entity) {
        entity.destroy(true)
      }
    } catch (err) {
      console.error('Failed to pick up item:', err)
    }
  }

  // Toggle infinite status for an item
  const toggleInfinite = (itemId) => {
    setInfiniteItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  // Check if user is admin
  const isAdmin = user?.roles?.includes('admin')

  // Expose methods for external use
  window.hyperFoneInventory = {
    addItem,
    removeItem,
    getItems: () => items,
    useItem: handleUseItem,
    dropItem: handleDropItem
  }

  if (isLoading) {
    return (
      <div css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: rgba(255, 255, 255, 0.6);
      `}>
        Loading...
      </div>
    )
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      background: rgba(0, 0, 0, 0.1);
    `}>
      {/* Tabs */}
      <div css={css`
        display: flex;
        padding: 10px 20px 0;
        gap: 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      `}>
        <button
          onClick={() => setActiveTab('inventory')}
          css={css`
            background: none;
            border: none;
            color: ${activeTab === 'inventory' ? 'white' : 'rgba(255, 255, 255, 0.6)'};
            padding: 10px 20px;
            font-size: 14px;
            cursor: pointer;
            position: relative;
            
            &:after {
              content: '';
              position: absolute;
              bottom: -1px;
              left: 0;
              right: 0;
              height: 2px;
              background: ${activeTab === 'inventory' ? '#551bf9' : 'transparent'};
            }
          `}
        >
          Inventory ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('world')}
          css={css`
            background: none;
            border: none;
            color: ${activeTab === 'world' ? 'white' : 'rgba(255, 255, 255, 0.6)'};
            padding: 10px 20px;
            font-size: 14px;
            cursor: pointer;
            position: relative;
            
            &:after {
              content: '';
              position: absolute;
              bottom: -1px;
              left: 0;
              right: 0;
              height: 2px;
              background: ${activeTab === 'world' ? '#551bf9' : 'transparent'};
            }
          `}
        >
          World Items ({worldItems.length})
        </button>
      </div>

      <div css={css`
        display: flex;
        flex: 1;
        overflow: hidden;
      `}>
        {/* Main Content */}
        <div css={css`
          flex: 1;
          padding: 20px;
          overflow-y: auto;
        `}>
          {activeTab === 'inventory' ? (
            // Inventory Items Grid
            items.length === 0 ? (
              <div css={css`
                display: flex;
                align-items: center;
                justify-content: center;
                height: 200px;
                color: rgba(255, 255, 255, 0.6);
                text-align: center;
                font-size: 14px;
              `}>
                Your inventory is empty.
                <br />
                Right-click objects in the world to pick them up.
              </div>
            ) : (
              <div css={css`
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 20px;
              `}>
                {items.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    css={css`
                      background: rgba(0, 0, 0, 0.2);
                      border: 1px solid ${selectedItem?.id === item.id ? '#551bf9' : 'rgba(255, 255, 255, 0.1)'};
                      border-radius: 8px;
                      overflow: hidden;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      
                      &:hover {
                        border-color: #551bf9;
                        transform: translateY(-2px);
                      }
                    `}
                  >
                    <div 
                      ref={el => el && modelContainersRef.current.set(item.id, el)}
                      css={css`
                        aspect-ratio: 1;
                        background: rgba(0, 0, 0, 0.1);
                        position: relative;
                        width: 100%;
                        height: 150px;
                      `}
                    >
                      <div css={css`
                        position: absolute;
                        bottom: 5px;
                        right: 5px;
                        background: rgba(0, 0, 0, 0.5);
                        color: white;
                        font-size: 10px;
                        padding: 2px 6px;
                        border-radius: 10px;
                        z-index: 1;
                      `}>
                        {item.quantity}
                      </div>
                    </div>
                    <div css={css`
                      padding: 8px;
                    `}>
                      {editingName === item.id ? (
                        <input
                          type="text"
                          value={editingNameValue}
                          onChange={e => setEditingNameValue(e.target.value)}
                          onBlur={saveEditingName}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEditingName()
                            if (e.key === 'Escape') setEditingName(null)
                          }}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                          css={css`
                            width: 100%;
                            background: rgba(0, 0, 0, 0.2);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            border-radius: 4px;
                            color: white;
                            font-size: 12px;
                            padding: 4px 8px;
                            outline: none;
                            
                            &:focus {
                              border-color: #551bf9;
                            }
                          `}
                        />
                      ) : (
                        <div css={css`
                          display: flex;
                          align-items: center;
                          gap: 4px;
                        `}>
                          <div css={css`
                            color: white;
                            font-size: 12px;
                            font-weight: 500;
                            margin-bottom: 2px;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            flex: 1;
                          `}>
                            {item.name}
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              startEditingName(item)
                            }}
                            css={css`
                              background: none;
                              border: none;
                              padding: 2px;
                              color: rgba(255, 255, 255, 0.6);
                              cursor: pointer;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              opacity: 0.6;
                              transition: opacity 0.2s;

                              &:hover {
                                opacity: 1;
                              }
                            `}
                          >
                            <PencilIcon size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // World Items Grid
            worldItems.length === 0 ? (
              <div css={css`
                display: flex;
                align-items: center;
                justify-content: center;
                height: 200px;
                color: rgba(255, 255, 255, 0.6);
                text-align: center;
                font-size: 14px;
              `}>
                No items found in the world.
              </div>
            ) : (
              <div css={css`
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 20px;
              `}>
                {worldItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    css={css`
                      background: rgba(0, 0, 0, 0.2);
                      border: 1px solid ${selectedItem?.id === item.id ? '#551bf9' : 'rgba(255, 255, 255, 0.1)'};
                      border-radius: 8px;
                      overflow: hidden;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      
                      &:hover {
                        border-color: #551bf9;
                        transform: translateY(-2px);
                      }
                    `}
                  >
                    <div 
                      ref={el => el && modelContainersRef.current.set(item.id, el)}
                      css={css`
                        aspect-ratio: 1;
                        background: rgba(0, 0, 0, 0.1);
                        position: relative;
                        width: 100%;
                        height: 150px;
                      `}
                    />
                    <div css={css`
                      padding: 8px;
                    `}>
                      <div css={css`
                        display: flex;
                        align-items: center;
                        gap: 4px;
                      `}>
                        <div css={css`
                          color: white;
                          font-size: 12px;
                          font-weight: 500;
                          margin-bottom: 2px;
                          white-space: nowrap;
                          overflow: hidden;
                          text-overflow: ellipsis;
                          flex: 1;
                        `}>
                          {item.name}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Item Details */}
        {selectedItem && (
          <div css={css`
            width: 300px;
            background: rgba(0, 0, 0, 0.2);
            border-left: 1px solid rgba(255, 255, 255, 0.1);
            padding: 20px;
            display: flex;
            flex-direction: column;
          `}>
            <div 
              ref={el => el && modelContainersRef.current.set('details', el)}
              css={css`
                aspect-ratio: 1;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                margin-bottom: 20px;
                overflow: hidden;
              `}
            />
            <div css={css`
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 10px;
            `}>
              <h2 css={css`
                color: white;
                font-size: 18px;
                margin: 0;
                flex: 1;
              `}>
                {selectedItem.name}
              </h2>
              {activeTab === 'inventory' && (
                <>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      startEditingName(selectedItem)
                    }}
                    css={css`
                      background: none;
                      border: none;
                      padding: 4px;
                      color: rgba(255, 255, 255, 0.6);
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      opacity: 0.6;
                      transition: opacity 0.2s;

                      &:hover {
                        opacity: 1;
                      }
                    `}
                  >
                    <PencilIcon size={16} />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleInfinite(selectedItem.id)}
                      css={css`
                        background: none;
                        border: none;
                        padding: 4px;
                        color: ${infiniteItems.has(selectedItem.id) ? '#551bf9' : 'rgba(255, 255, 255, 0.6)'};
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        opacity: 0.6;
                        transition: all 0.2s;

                        &:hover {
                          opacity: 1;
                          transform: scale(1.1);
                        }
                      `}
                    >
                      <InfinityIcon size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
            <p css={css`
              color: rgba(255, 255, 255, 0.6);
              font-size: 14px;
              margin-bottom: 20px;
              flex: 1;
            `}>
              {selectedItem.description}
              {activeTab === 'world' && selectedItem.position && (
                <div css={css`margin-top: 10px;`}>
                  Position: {selectedItem.position.map(n => n.toFixed(2)).join(', ')}
                </div>
              )}
              {activeTab === 'inventory' && isAdmin && infiniteItems.has(selectedItem.id) && (
                <div css={css`
                  margin-top: 10px;
                  color: #551bf9;
                  font-style: italic;
                `}>
                  ∞ Infinite item
                </div>
              )}
            </p>
            <div css={css`
              display: flex;
              gap: 10px;
            `}>
              {activeTab === 'inventory' ? (
                <>
                  <button
                    onClick={() => handleUseItem(selectedItem)}
                    css={css`
                      flex: 1;
                      background: #551bf9;
                      border: none;
                      color: white;
                      padding: 12px;
                      border-radius: 8px;
                      font-size: 14px;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      
                      &:hover {
                        background: #6633ff;
                      }
                    `}
                  >
                    Place
                  </button>
                  <button
                    onClick={() => handleDropItem(selectedItem)}
                    css={css`
                      background: #ff4444;
                      border: none;
                      color: white;
                      padding: 12px;
                      border-radius: 8px;
                      font-size: 14px;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      
                      &:hover {
                        background: #ff6666;
                      }
                    `}
                  >
                    Drop
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handlePickupWorldItem(selectedItem)}
                  css={css`
                    flex: 1;
                    background: #551bf9;
                    border: none;
                    color: white;
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    
                    &:hover {
                      background: #6633ff;
                    }
                  `}
                >
                  Pick Up
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 
import * as THREE from '../extras/three'
import JSZip from 'jszip'

import { System } from './System'

import { hashFile } from '../utils-client'
import { hasRole, uuid } from '../utils'
import { ControlPriorities } from '../extras/ControlPriorities'
import { CopyIcon, EyeIcon, HandIcon, Trash2Icon, UnlinkIcon, LinkIcon, DownloadIcon } from 'lucide-react'
import { cloneDeep } from 'lodash-es'
import moment from 'moment'

contextBreakers = ['MouseLeft', 'Escape']

const MAX_UPLOAD_SIZE = parseInt(process.env.PUBLIC_MAX_UPLOAD_SIZE || '100')

/**
 * Editor System
 *
 * - runs on the client
 * - listens for files being drag and dropped onto the window and handles them
 * - handles editing apps
 *
 */
export class ClientEditor extends System {
  constructor(world) {
    super(world)
    this.target = null
    this.file = null
    this.contextTracker = {
      downAt: null,
      movement: new THREE.Vector3(),
    }
    // Track moving objects
    this.movingObject = null
    this.originalPosition = null
    this.lastCopiedObject = null // Store last copied object for quick duplication

    // Add action history for undo
    this.actionHistory = []
    this.maxHistoryLength = 50 // Keep last 50 actions

    // Add event listeners
    window.addEventListener('paste', this.onPaste)
    window.addEventListener('copy', this.onCopy)
    window.addEventListener('cut', this.onCut)
    window.addEventListener('keydown', this.onKeyDown)
  }

  async init({ viewport }) {
    viewport.addEventListener('dragover', this.onDragOver)
    viewport.addEventListener('dragenter', this.onDragEnter)
    viewport.addEventListener('dragleave', this.onDragLeave)
    viewport.addEventListener('drop', this.onDrop)
  }

  start() {
    this.control = this.world.controls.bind({
      priority: ControlPriorities.EDITOR,
      onPress: code => {
        if (code === 'MouseRight') {
          // Check if we're currently moving an object
          if (this.movingObject) {
            // Restore original position
            if (this.originalPosition) {
              this.movingObject.data.position = [...this.originalPosition]
              this.movingObject.data.mover = null
              this.world.network.send('entityModified', {
                id: this.movingObject.data.id,
                position: this.movingObject.data.position,
                mover: null
              })
            }
            this.movingObject = null
            this.originalPosition = null
            
            // Start context menu after a brief delay
            setTimeout(() => {
              this.contextTracker.downAt = performance.now()
              this.contextTracker.movement.set(0, 0, 0)
            }, 50)
            
            return true // Consume the event
          }
          
          this.contextTracker.downAt = performance.now()
          this.contextTracker.movement.set(0, 0, 0)
        }
      },
      onRelease: code => {
        if (code === 'MouseRight') {
          const elapsed = performance.now() - this.contextTracker.downAt
          const distance = this.contextTracker.movement.length()
          if (elapsed < 300 && distance < 30) {
            this.tryContext()
          }
        }
        if (this.context && contextBreakers.includes(code)) {
          this.setContext(null)
        }
      },
    })
  }

  update(delta) {
    if (this.control.buttons.MouseRight) {
      this.contextTracker.movement.add(this.control.pointer.delta)
    }
  }

  tryContext() {
    const hits = this.world.stage.raycastPointer(this.world.controls.pointer.position)
    let entity
    for (const hit of hits) {
      entity = hit.getEntity?.()
      if (entity) break
    }
    if (!entity) return
    const context = {
      id: uuid(),
      x: this.world.controls.pointer.position.x,
      y: this.world.controls.pointer.position.y,
      actions: [],
    }
    if (entity.isPlayer) {
      context.actions.push({
        label: 'Inspect',
        icon: EyeIcon,
        visible: true,
        disabled: false,
        onClick: () => {
          this.setContext(null)
        },
      })
    }
    if (entity.isApp) {
      const roles = this.world.entities.player.data.user.roles
      const isAdmin = hasRole(roles, 'admin')
      const isBuilder = hasRole(roles, 'builder')
      
      // Add Copy GLB URL action
      const blueprint = this.world.blueprints.get(entity.data.blueprint)
      if (blueprint?.model) {
        context.actions.push({
          label: 'Copy GLB URL',
          icon: LinkIcon,
          visible: true,
          disabled: false,
          onClick: () => {
            this.setContext(null)
            // Convert asset:// URL to full domain URL
            const url = blueprint.model.replace('asset://', `${window.location.protocol}//${window.location.host}/assets/`)
            navigator.clipboard.writeText(url)
              .then(() => console.log('GLB URL copied to clipboard'))
              .catch(err => console.error('Failed to copy GLB URL:', err))
          },
        })

        // Add Copy JSON action
        context.actions.push({
          label: 'Copy JSON',
          icon: CopyIcon,
          visible: true,
          disabled: false,
          onClick: () => {
            this.setContext(null)
            // Create JSON object with app data
            const appData = {
              type: 'app',
              blueprint: {
                id: blueprint.id,
                model: blueprint.model.replace('asset://', `${window.location.protocol}//${window.location.host}/assets/`),
                script: blueprint.script ? blueprint.script.replace('asset://', `${window.location.protocol}//${window.location.host}/assets/`) : null,
                config: blueprint.config,
                preload: blueprint.preload
              },
              quaternion: entity.data.quaternion,
              scale: entity.data.scale || [1, 1, 1],
              state: entity.data.state || {}
            }

            // Copy JSON to clipboard
            navigator.clipboard.writeText(JSON.stringify(appData, null, 2))
              .then(() => {
                this.world.chat.add({
                  id: uuid(),
                  from: null,
                  fromId: null,
                  body: 'Object JSON copied to clipboard',
                  createdAt: moment().toISOString(),
                })
              })
              .catch(err => console.error('Failed to copy JSON:', err))
          },
        })
      }

      context.actions.push({
        label: 'Inspect',
        icon: EyeIcon,
        visible: isAdmin || isBuilder,
        disabled: false,
        onClick: () => {
          this.setContext(null)
          this.world.emit('inspect', entity)
        },
      })
      context.actions.push({
        label: 'Move',
        icon: HandIcon,
        visible: isAdmin || isBuilder,
        disabled: false,
        onClick: () => {
          this.setContext(null)
          // Store original position before moving
          this.movingObject = entity
          this.originalPosition = [...entity.data.position]
          entity.move()
        },
      })
      context.actions.push({
        label: 'Duplicate',
        icon: CopyIcon,
        visible: isAdmin || isBuilder,
        disabled: !!entity.data.uploader, // must be uploaded
        onClick: () => {
          this.setContext(null)
          const data = {
            id: uuid(),
            type: 'app',
            blueprint: entity.data.blueprint,
            position: entity.data.position,
            quaternion: entity.data.quaternion,
            mover: this.world.network.id,
            uploader: null,
            state: {},
          }
          this.world.entities.add(data, true)
        },
      })
      context.actions.push({
        label: 'Unlink',
        icon: UnlinkIcon,
        visible: isAdmin || isBuilder,
        disabled: !!entity.data.uploader, // must be uploaded
        onClick: () => {
          this.setContext(null)
          // duplicate the blueprint
          const blueprint = {
            id: uuid(),
            version: 0,
            model: entity.blueprint.model,
            script: entity.blueprint.script,
            config: cloneDeep(entity.blueprint.config),
            preload: entity.blueprint.preload,
          }
          this.world.blueprints.add(blueprint, true)
          // assign new blueprint
          entity.modify({ blueprint: blueprint.id })
          this.world.network.send('entityModified', { id: entity.data.id, blueprint: blueprint.id })
        },
      })
      context.actions.push({
        label: 'Destroy',
        icon: Trash2Icon,
        visible: isAdmin || isBuilder,
        disabled: false,
        onClick: () => {
          this.setContext(null)
          entity.destroy(true)
        },
      })
    }
    if (context.actions.length) {
      this.setContext(context)
    }
  }

  setContext(value) {
    this.context = value
    this.world.emit('context', value)
  }

  onDragOver = e => {
    e.preventDefault()
  }

  onDragEnter = e => {
    this.target = e.target
    this.dropping = true
    this.file = null
  }

  onDragLeave = e => {
    if (e.target === this.target) {
      this.dropping = false
    }
  }

  onPaste = async (e) => {
    // ensure we have admin/builder role
    const roles = this.world.entities.player.data.user.roles
    const canPaste = hasRole(roles, 'admin', 'builder')
    if (!canPaste) return

    const text = e.clipboardData.getData('text')
    if (!text) return

    try {
      // Try to parse as JSON first
      const data = JSON.parse(text)
      if (data.type === 'app' && data.blueprint) {
        await this.addJsonObject({ text: () => Promise.resolve(text) })
        return
      }
    } catch (err) {
      // Not valid JSON, try as URL
      try {
        new URL(text)
        await this.handleUrl(text.trim())
      } catch (err) {
        // Not a valid URL either, ignore
        console.log('Pasted content is neither valid JSON nor URL:', text)
      }
    }
  }

  onCopy = async (e) => {
    // ensure we have admin/builder role
    const roles = this.world.entities.player.data.user.roles
    const canCopy = hasRole(roles, 'admin', 'builder')
    if (!canCopy) return

    // Get object under cursor
    const hits = this.world.stage.raycastPointer(this.world.controls.pointer.position)
    let entity
    for (const hit of hits) {
      entity = hit.getEntity?.()
      if (entity) break
    }
    
    if (!entity?.isApp) return

    // Get blueprint data
    const blueprint = this.world.blueprints.get(entity.data.blueprint)
    if (!blueprint?.model) return

    e.preventDefault() // Prevent default copy behavior

    // Create JSON object with app data
    const appData = {
      type: 'app',
      blueprint: {
        id: blueprint.id,
        model: blueprint.model.replace('asset://', `${window.location.protocol}//${window.location.host}/assets/`),
        script: blueprint.script ? blueprint.script.replace('asset://', `${window.location.protocol}//${window.location.host}/assets/`) : null,
        config: blueprint.config,
        preload: blueprint.preload
      },
      quaternion: entity.data.quaternion,
      scale: entity.data.scale || [1, 1, 1],
      state: entity.data.state || {}
    }

    // Copy to clipboard
    e.clipboardData.setData('text/plain', JSON.stringify(appData, null, 2))

    // Show confirmation message
    this.world.chat.add({
      id: uuid(),
      from: null,
      fromId: null,
      body: 'Object JSON copied to clipboard',
      createdAt: moment().toISOString(),
    })
  }

  onCut = async (e) => {
    // ensure we have admin/builder role
    const roles = this.world.entities.player.data.user.roles
    const canCut = hasRole(roles, 'admin', 'builder')
    if (!canCut) return

    // Get object under cursor
    const hits = this.world.stage.raycastPointer(this.world.controls.pointer.position)
    let entity
    for (const hit of hits) {
      entity = hit.getEntity?.()
      if (entity) break
    }
    
    if (!entity?.isApp) return

    // Store entity data before deletion for potential undo
    const entityData = {
      type: entity.data.type,
      blueprint: entity.data.blueprint,
      position: entity.data.position,
      quaternion: entity.data.quaternion,
      scale: entity.data.scale || [1, 1, 1],
      state: entity.data.state || {}
    }

    // Get blueprint data
    const blueprint = this.world.blueprints.get(entity.data.blueprint)
    if (!blueprint?.model) return

    e.preventDefault() // Prevent default cut behavior

    // Create JSON object with app data
    const appData = {
      type: 'app',
      blueprint: {
        id: blueprint.id,
        model: blueprint.model.replace('asset://', `${window.location.protocol}//${window.location.host}/assets/`),
        script: blueprint.script ? blueprint.script.replace('asset://', `${window.location.protocol}//${window.location.host}/assets/`) : null,
        config: blueprint.config,
        preload: blueprint.preload
      },
      quaternion: entity.data.quaternion,
      scale: entity.data.scale || [1, 1, 1],
      state: entity.data.state || {}
    }

    // Copy to clipboard
    e.clipboardData.setData('text/plain', JSON.stringify(appData, null, 2))

    // Delete the entity
    entity.destroy(true)

    // Add to history
    this.addToHistory({
      type: 'delete',
      entityData
    })

    // Show confirmation message
    this.world.chat.add({
      id: uuid(),
      from: null,
      fromId: null,
      body: 'Object cut to clipboard',
      createdAt: moment().toISOString(),
    })
  }

  async handleUrl(url) {
    try {
        // Fetch the file
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error('Failed to fetch file')
        }

        const blob = await response.blob()
        // Get filename from URL, fallback to a default if none exists
        const urlParts = url.split('/')
        const filename = urlParts[urlParts.length - 1].split('?')[0] || 'downloaded-file'
        
        // Create a File object from the blob
        const file = new File([blob], filename, { type: blob.type })

        // Get extension and process file
        const ext = filename.split('.').pop().toLowerCase()
        if (ext === 'glb') {
            await this.addModel(file)
        } else if (ext === 'vrm') {
            await this.addAvatar(file)
        } else if (ext === 'js') {
            await this.addScript(file)
        } else if (ext === 'hype') {
            await this.addHypeFile(file)
        } else {
            console.log('Unsupported file type:', ext)
        }

    } catch (err) {
        this.world.chat.add({
            id: uuid(),
            from: null,
            fromId: null,
            body: `Failed to load URL: ${err.message}`,
            createdAt: moment().toISOString(),
        })
        console.error('URL processing error:', err)
    }
  }

  onDrop = async e => {
    e.preventDefault()
    this.dropping = false
    // ensure we have admin/builder role
    const roles = this.world.entities.player.data.user.roles
    const canDrop = hasRole(roles, 'admin', 'builder')
    if (!canDrop) return

    // handle drop
    let file

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const item = e.dataTransfer.items[0]
        if (item.kind === 'file') {
            file = item.getAsFile()
        } else if (item.kind === 'string') {
            // Handle both text/uri-list and text/plain
            const text = await new Promise(resolve => {
                item.getAsString(resolve)
            })
            // Try to handle as URL
            try {
                await this.handleUrl(text.trim())
            } catch (err) {
                console.log('Not a valid URL:', text)
            }
            return
        }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        file = e.dataTransfer.files[0]
    }

    if (!file) return

    const maxSize = MAX_UPLOAD_SIZE * 1024 * 1024
    if (file.size > maxSize) {
        this.world.chat.add({
            id: uuid(),
            from: null,
            fromId: null,
            body: `File size too large (>${MAX_UPLOAD_SIZE}mb)`,
            createdAt: moment().toISOString(),
        })
        console.error(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`)
        return
    }

    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'glb') {
        await this.addModel(file)
    }
    if (ext === 'vrm') {
        await this.addAvatar(file)
    }
    if (ext === 'js') {
        await this.addScript(file)
    }
    if (ext === 'hype') {
        await this.addHypeFile(file)
    }
    if (ext === 'json') {
        await this.addJsonObject(file)
    }
  }

  async addModel(file) {
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as glb filename
    const filename = `${hash}.glb`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    this.world.loader.insert('model', url, file)
    // make blueprint
    const blueprint = {
      id: uuid(),
      version: 0,
      model: url,
      script: null,
      config: {},
      preload: false,
    }
    // register blueprint
    this.world.blueprints.add(blueprint, true)
    // get spawn point
    const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
    const position = hit ? hit.point.toArray() : [0, 0, 0]
    // spawn the app moving
    // - mover: follows this clients cursor until placed
    // - uploader: other clients see a loading indicator until its fully uploaded
    const data = {
      id: uuid(),
      type: 'app',
      blueprint: blueprint.id,
      position,
      quaternion: [0, 0, 0, 1],
      mover: this.world.network.id,
      uploader: this.world.network.id,
      state: {},
    }
    const app = this.world.entities.add(data, true)
    // upload the glb
    await this.world.network.upload(file)
    // mark as uploaded so other clients can load it in
    app.onUploaded()
  }

  async addAvatar(file) {
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as vrm filename
    const filename = `${hash}.vrm`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    this.world.loader.insert('avatar', url, file)
    this.world.emit('avatar', {
      file,
      url,
      hash,
      onPlace: async () => {
        // close pane
        this.world.emit('avatar', null)
        // make blueprint
        const blueprint = {
          id: uuid(),
          version: 0,
          model: url,
          script: null,
          config: {},
          preload: false,
        }
        // register blueprint
        this.world.blueprints.add(blueprint, true)
        // get spawn point
        const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
        const position = hit ? hit.point.toArray() : [0, 0, 0]
        // spawn the app moving
        // - mover: follows this clients cursor until placed
        // - uploader: other clients see a loading indicator until its fully uploaded
        const data = {
          id: uuid(),
          type: 'app',
          blueprint: blueprint.id,
          position,
          quaternion: [0, 0, 0, 1],
          mover: this.world.network.id,
          uploader: this.world.network.id,
          state: {},
        }
        const app = this.world.entities.add(data, true)
        // upload the glb
        await this.world.network.upload(file)
        // mark as uploaded so other clients can load it in
        app.onUploaded()
      },
      onEquip: async () => {
        // close pane
        this.world.emit('avatar', null)
        // prep new user data
        const player = this.world.entities.player
        const prevUser = player.data.user
        const newUser = cloneDeep(player.data.user)
        newUser.avatar = url
        // update locally
        player.modify({ user: newUser })
        // upload
        try {
          await this.world.network.upload(file)
        } catch (err) {
          console.error(err)
          // revert
          player.modify({ user: prevUser })
          return
        }
        // update for everyone
        this.world.network.send('entityModified', {
          id: player.data.id,
          user: newUser,
        })
      },
    })
  }

  async addScript(file) {
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as script filename
    const filename = `${hash}.js`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    this.world.loader.insert('script', url, file)
    // make blueprint with crash block model and the script
    const blueprint = {
      id: uuid(),
      version: 0,
      model: 'asset://crash-block.glb',  // Using crash block as visual representation
      script: url,
      config: {},
      preload: false,
    }
    // register blueprint
    this.world.blueprints.add(blueprint, true)
    // get spawn point
    const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
    const position = hit ? hit.point.toArray() : [0, 0, 0]
    // spawn the app moving
    const data = {
      id: uuid(),
      type: 'app',
      blueprint: blueprint.id,
      position,
      quaternion: [0, 0, 0, 1],
      mover: this.world.network.id,
      uploader: this.world.network.id,
      state: {},
    }
    const app = this.world.entities.add(data, true)
    // upload the script
    await this.world.network.upload(file)
    // mark as uploaded so other clients can load it in
    app.onUploaded()
  }

  async addHypeFile(file) {
    try {
        // Read the zip file
        const zip = new JSZip()
        const contents = await zip.loadAsync(file)
        
        // Find the .glb and .js files
        let glbFile = null
        let jsFile = null
        
        for (const [filename, zipEntry] of Object.entries(contents.files)) {
            if (filename.toLowerCase().endsWith('.glb')) {
                glbFile = zipEntry
            } else if (filename.toLowerCase().endsWith('.js')) {
                jsFile = zipEntry
            }
        }

        if (!glbFile || !jsFile) {
            throw new Error('Hype file must contain both a .glb and a .js file')
        }

        // Extract the files as blobs
        const glbBlob = await glbFile.async('blob')
        const jsBlob = await jsFile.async('blob')

        // Create File objects
        const glbFileObj = new File([glbBlob], glbFile.name, { type: 'model/gltf-binary' })
        const jsFileObj = new File([jsBlob], jsFile.name, { type: 'application/javascript' })

        // Hash both files
        const glbHash = await hashFile(glbFileObj)
        const jsHash = await hashFile(jsFileObj)

        // Create canonical URLs
        const glbUrl = `asset://${glbHash}.glb`
        const jsUrl = `asset://${jsHash}.js`

        // Cache files locally
        this.world.loader.insert('model', glbUrl, glbFileObj)
        this.world.loader.insert('script', jsUrl, jsFileObj)

        // Create blueprint combining both
        const blueprint = {
            id: uuid(),
            version: 0,
            model: glbUrl,
            script: jsUrl,
            config: {},
            preload: false,
        }

        // Register blueprint
        this.world.blueprints.add(blueprint, true)

        // Get spawn point
        const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
        const position = hit ? hit.point.toArray() : [0, 0, 0]

        // Spawn the app
        const data = {
            id: uuid(),
            type: 'app',
            blueprint: blueprint.id,
            position,
            quaternion: [0, 0, 0, 1],
            mover: this.world.network.id,
            uploader: this.world.network.id,
            state: {},
        }

        const app = this.world.entities.add(data, true)

        // Upload both files
        await Promise.all([
            this.world.network.upload(glbFileObj),
            this.world.network.upload(jsFileObj)
        ])

        // Mark as uploaded
        app.onUploaded()

    } catch (err) {
        this.world.chat.add({
            id: uuid(),
            from: null,
            fromId: null,
            body: `Failed to process hype file: ${err.message}`,
            createdAt: moment().toISOString(),
        })
        console.error('Hype file processing error:', err)
    }
  }

  async addJsonObject(file) {
    try {
      // Read the JSON file
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate the JSON structure
      if (!data.type || data.type !== 'app' || !data.blueprint || !data.blueprint.model) {
        throw new Error('Invalid JSON format')
      }

      // Convert domain URLs back to asset:// format
      const modelUrl = data.blueprint.model.replace(/^https?:\/\/[^\/]+\/assets\//, 'asset://')
      let scriptUrl = null

      // Handle script if present
      if (data.blueprint.script) {
        try {
          // Fetch the script file
          const scriptResponse = await fetch(data.blueprint.script)
          if (!scriptResponse.ok) {
            throw new Error(`Failed to fetch script: ${scriptResponse.statusText}`)
          }
          
          // Convert the response to a File object
          const scriptBlob = await scriptResponse.blob()
          const scriptFileName = data.blueprint.script.split('/').pop()
          const scriptFile = new File([scriptBlob], scriptFileName, { type: 'application/javascript' })
          
          // Hash and upload the script file
          const scriptHash = await hashFile(scriptFile)
          scriptUrl = `asset://${scriptHash}.js`
          
          // Cache script locally
          this.world.loader.insert('script', scriptUrl, scriptFile)
          
          // Upload script to server
          await this.world.network.upload(scriptFile)
        } catch (err) {
          console.error('Failed to process script:', err)
          // Continue without script if it fails
        }
      }

      // Create blueprint
      const blueprint = {
        id: uuid(),
        version: 0,
        model: modelUrl,
        script: scriptUrl,
        config: data.blueprint.config || {},
        preload: data.blueprint.preload || false,
      }

      // Register blueprint
      this.world.blueprints.add(blueprint, true)

      // Get spawn point
      const hit = this.world.stage.raycastPointer(this.world.controls.pointer.position)[0]
      const position = hit ? hit.point.toArray() : [0, 0, 0]

      // Create entity data
      const entityData = {
        id: uuid(),
        type: 'app',
        blueprint: blueprint.id,
        position,
        quaternion: data.quaternion || [0, 0, 0, 1],
        scale: data.scale || [1, 1, 1],
        mover: this.world.network.id,
        uploader: this.world.network.id,
        state: data.state || {},
      }

      // Add entity
      const app = this.world.entities.add(entityData, true)

      // Add to history
      this.addToHistory({
        type: 'create',
        entityId: app.data.id
      })

      // Mark as uploaded since we're using existing assets
      app.onUploaded()

    } catch (err) {
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: `Failed to process JSON file: ${err.message}`,
        createdAt: moment().toISOString(),
      })
      console.error('JSON file processing error:', err)
    }
  }

  // Add action to history with its inverse operation
  addToHistory(action) {
    this.actionHistory.push(action)
    if (this.actionHistory.length > this.maxHistoryLength) {
      this.actionHistory.shift()
    }
  }

  onKeyDown = (e) => {
    // ensure we have admin/builder role
    const roles = this.world.entities.player.data.user.roles
    const canEdit = hasRole(roles, 'admin', 'builder')
    if (!canEdit) return

    // Get object under cursor for operations that need it
    const hits = this.world.stage.raycastPointer(this.world.controls.pointer.position)
    let entity
    for (const hit of hits) {
      entity = hit.getEntity?.()
      if (entity?.isApp) break
    }

    // Modern building game controls
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Z - Undo
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        this.undo()
      }
      // Ctrl+Shift+Z or Ctrl+Y - Redo (placeholder for future implementation)
      else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        // TODO: Implement redo functionality
      }
      // Ctrl+C - Copy
      else if (e.key === 'c') {
        e.preventDefault()
        if (entity) {
          this.lastCopiedObject = entity
          // Get blueprint data
          const blueprint = this.world.blueprints.get(entity.data.blueprint)
          if (!blueprint?.model) return

          // Create JSON object with app data
          const appData = {
            type: 'app',
            blueprint: {
              id: blueprint.id,
              model: blueprint.model.replace('asset://', `${window.location.protocol}//${window.location.host}/assets/`),
              script: blueprint.script ? blueprint.script.replace('asset://', `${window.location.protocol}//${window.location.host}/assets/`) : null,
              config: blueprint.config,
              preload: blueprint.preload
            },
            quaternion: entity.data.quaternion,
            scale: entity.data.scale || [1, 1, 1],
            state: entity.data.state || {}
          }

          // Copy to clipboard
          navigator.clipboard.writeText(JSON.stringify(appData, null, 2))
            .then(() => {
              this.world.chat.add({
                id: uuid(),
                from: null,
                fromId: null,
                body: 'Object JSON copied to clipboard',
                createdAt: moment().toISOString(),
              })
            })
            .catch(err => console.error('Failed to copy JSON:', err))
        }
      }
      // Ctrl+X - Cut
      else if (e.key === 'x') {
        e.preventDefault()
        if (entity) {
          this.lastCopiedObject = entity
          // Get blueprint data
          const blueprint = this.world.blueprints.get(entity.data.blueprint)
          if (!blueprint?.model) return

          // Store entity data for undo
          const entityData = {
            type: entity.data.type,
            blueprint: entity.data.blueprint,
            position: entity.data.position,
            quaternion: entity.data.quaternion,
            scale: entity.data.scale || [1, 1, 1],
            state: entity.data.state || {}
          }

          // Create JSON object with app data
          const appData = {
            type: 'app',
            blueprint: {
              id: blueprint.id,
              model: blueprint.model.replace('asset://', `${window.location.protocol}//${window.location.host}/assets/`),
              script: blueprint.script ? blueprint.script.replace('asset://', `${window.location.protocol}//${window.location.host}/assets/`) : null,
              config: blueprint.config,
              preload: blueprint.preload
            },
            quaternion: entity.data.quaternion,
            scale: entity.data.scale || [1, 1, 1],
            state: entity.data.state || {}
          }

          // Copy to clipboard
          navigator.clipboard.writeText(JSON.stringify(appData, null, 2))
            .then(() => {
              // Delete the entity after successful copy
              entity.destroy(true)
              this.addToHistory({
                type: 'delete',
                entityData
              })
              this.world.chat.add({
                id: uuid(),
                from: null,
                fromId: null,
                body: 'Object cut to clipboard',
                createdAt: moment().toISOString(),
              })
            })
            .catch(err => console.error('Failed to cut object:', err))
        }
      }
      // Ctrl+V - Paste
      else if (e.key === 'v') {
        e.preventDefault()
        navigator.clipboard.readText()
          .then(async text => {
            if (!text) return
            try {
              // Try to parse as JSON first
              const data = JSON.parse(text)
              if (data.type === 'app' && data.blueprint) {
                await this.addJsonObject({ text: () => Promise.resolve(text) })
              }
            } catch (err) {
              // Not valid JSON, try as URL
              try {
                new URL(text)
                await this.handleUrl(text.trim())
              } catch (err) {
                // Not a valid URL either, ignore
                console.log('Pasted content is neither valid JSON nor URL:', text)
              }
            }
          })
          .catch(err => console.error('Failed to read clipboard:', err))
      }
      // Ctrl+D - Quick Duplicate (like Blender)
      else if (e.key === 'd') {
        e.preventDefault()
        if (entity) {
          this.duplicateObject(entity)
        }
      }
    } else {
      // R - Rotate object being moved (90 degrees)
      if (e.key === 'r' && this.movingObject) {
        e.preventDefault()
        const currentRotation = new THREE.Euler().setFromQuaternion(
          new THREE.Quaternion().fromArray(this.movingObject.data.quaternion)
        )
        currentRotation.y += Math.PI / 2 // 90 degrees
        const newQuaternion = new THREE.Quaternion().setFromEuler(currentRotation)
        this.movingObject.data.quaternion = newQuaternion.toArray()
        this.world.network.send('entityModified', {
          id: this.movingObject.data.id,
          quaternion: this.movingObject.data.quaternion
        })
      }
      // Delete/Backspace - Delete object
      else if ((e.key === 'Delete' || e.key === 'Backspace') && entity) {
        e.preventDefault()
        const entityData = {
          type: entity.data.type,
          blueprint: entity.data.blueprint,
          position: entity.data.position,
          quaternion: entity.data.quaternion,
          scale: entity.data.scale || [1, 1, 1],
          state: entity.data.state || {}
        }
        entity.destroy(true)
        this.addToHistory({
          type: 'delete',
          entityData
        })
      }
      // Escape - Cancel current operation
      else if (e.key === 'Escape') {
        e.preventDefault()
        if (this.movingObject) {
          // Cancel move and restore position
          if (this.originalPosition) {
            this.movingObject.data.position = [...this.originalPosition]
            this.movingObject.data.mover = null
            this.world.network.send('entityModified', {
              id: this.movingObject.data.id,
              position: this.movingObject.data.position,
              mover: null
            })
          }
          this.movingObject = null
          this.originalPosition = null
        }
        this.setContext(null)
      }
    }
  }

  duplicateObject(entity) {
    if (!entity?.isApp) return

    const data = {
      id: uuid(),
      type: 'app',
      blueprint: entity.data.blueprint,
      position: entity.data.position,
      quaternion: entity.data.quaternion,
      scale: entity.data.scale || [1, 1, 1],
      mover: this.world.network.id,
      uploader: null,
      state: cloneDeep(entity.data.state) || {},
    }

    // Offset the duplicate slightly so it's not exactly on top
    const offset = 0.5 // 0.5 units
    data.position = [
      data.position[0] + offset,
      data.position[1],
      data.position[2] + offset
    ]

    const app = this.world.entities.add(data, true)
    
    // Add to history
    this.addToHistory({
      type: 'create',
      entityId: app.data.id
    })

    // Start moving the duplicated object
    this.movingObject = app
    this.originalPosition = [...app.data.position]
    app.move()
  }

  undo = () => {
    // ensure we have admin/builder role
    const roles = this.world.entities.player.data.user.roles
    const canUndo = hasRole(roles, 'admin', 'builder')
    if (!canUndo) return

    const lastAction = this.actionHistory.pop()
    if (!lastAction) {
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: 'Nothing to undo',
        createdAt: moment().toISOString(),
      })
      return
    }

    try {
      // Execute the inverse operation
      if (lastAction.type === 'delete') {
        // Recreate the deleted entity
        const entityData = {
          ...lastAction.entityData,
          id: uuid(), // Generate new ID for the restored entity
          mover: this.world.network.id,
          uploader: null, // No need to upload since assets exist
        }
        this.world.entities.add(entityData, true)
      } else if (lastAction.type === 'create') {
        // Delete the created entity
        const entity = this.world.entities.get(lastAction.entityId)
        if (entity) {
          entity.destroy(true)
        }
      }

      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: 'Undo successful',
        createdAt: moment().toISOString(),
      })
    } catch (err) {
      console.error('Undo failed:', err)
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: 'Failed to undo last action',
        createdAt: moment().toISOString(),
      })
    }
  }

  destroy() {
    super.destroy()
    window.removeEventListener('paste', this.onPaste)
    window.removeEventListener('copy', this.onCopy)
    window.removeEventListener('cut', this.onCut)
    window.removeEventListener('keydown', this.onKeyDown)
  }
}

import * as THREE from '../extras/three'

import { System } from './System'

import { hashFile } from '../utils-client'
import { hasRole, uuid } from '../utils'
import { ControlPriorities } from '../extras/ControlPriorities'
import { CopyIcon, EyeIcon, HandIcon, Trash2Icon, UnlinkIcon, SmartphoneIcon } from 'lucide-react'
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
          entity.move()
        },
      })
      context.actions.push({
        label: 'Add to HyperFone',
        icon: SmartphoneIcon,
        visible: true,
        disabled: false,
        onClick: () => {
          this.setContext(null)
          const blueprint = this.world.blueprints.get(entity.data.blueprint)
          if (blueprint && window.hyperFoneInventory) {
            window.hyperFoneInventory.addItem({
              blueprint: entity.data.blueprint,
              name: blueprint.name || 'Unnamed Item',
              description: blueprint.description || '',
              model: blueprint.model
            })
            entity.destroy(true)
          }
        },
      })
      context.actions.push({
        label: 'Duplicate',
        icon: CopyIcon,
        visible: isAdmin || isBuilder,
        disabled: !!entity.data.uploader,
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
        disabled: !!entity.data.uploader,
        onClick: () => {
          this.setContext(null)
          const blueprint = {
            id: uuid(),
            version: 0,
            model: entity.blueprint.model,
            script: entity.blueprint.script,
            config: cloneDeep(entity.blueprint.config),
            preload: entity.blueprint.preload,
          }
          this.world.blueprints.add(blueprint, true)
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

  onDrop = e => {
    e.preventDefault()
    this.dropping = false
    const roles = this.world.entities.player.data.user.roles
    const canDrop = hasRole(roles, 'admin', 'builder')
    if (!canDrop) return
    let file
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const item = e.dataTransfer.items[0]
      if (item.kind === 'file') {
        file = item.getAsFile()
      }
      if (item.type === 'text/uri-list') {
        // ...
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
      this.addModel(file)
    }
    if (ext === 'vrm') {
      this.addAvatar(file)
    }
  }

  async addModel(file) {
    const hash = await hashFile(file)
    const filename = `${hash}.glb`
    const url = `asset://${filename}`
    this.world.loader.insert('model', url, file)
    const blueprint = {
      id: uuid(),
      version: 0,
      model: url,
      script: null,
      config: {},
      preload: false,
    }
    this.world.blueprints.add(blueprint, true)
    const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
    const position = hit ? hit.point.toArray() : [0, 0, 0]
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
    await this.world.network.upload(file)
    app.onUploaded()
  }

  async addAvatar(file) {
    const hash = await hashFile(file)
    const filename = `${hash}.vrm`
    const url = `asset://${filename}`
    this.world.loader.insert('avatar', url, file)
    this.world.emit('avatar', {
      file,
      url,
      hash,
      onPlace: async () => {
        this.world.emit('avatar', null)
        const blueprint = {
          id: uuid(),
          version: 0,
          model: url,
          script: null,
          config: {},
          preload: false,
        }
        this.world.blueprints.add(blueprint, true)
        const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
        const position = hit ? hit.point.toArray() : [0, 0, 0]
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
        await this.world.network.upload(file)
        app.onUploaded()
      },
      onEquip: async () => {
        this.world.emit('avatar', null)
        const player = this.world.entities.player
        const prevUser = player.data.user
        const newUser = cloneDeep(player.data.user)
        newUser.avatar = url
        player.modify({ user: newUser })
        try {
          await this.world.network.upload(file)
        } catch (err) {
          console.error(err)
          player.modify({ user: prevUser })
          return
        }
        this.world.network.send('entityModified', {
          id: player.data.id,
          user: newUser,
        })
      },
    })
  }
}

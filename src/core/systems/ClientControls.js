import { bindRotations } from '../extras/bindRotations'
import { buttons, codeToProp } from '../extras/buttons'
import * as THREE from '../extras/three'
import { System } from './System'

const LMB = 1 // bitmask
const RMB = 2 // bitmask
const MMB = 4 // bitmask - middle mouse button
const MouseLeft = 'mouseLeft'
const MouseRight = 'mouseRight'
const MouseMiddle = 'mouseMiddle'
const HandednessLeft = 'left'
const HandednessRight = 'right'

let actionIds = 0

/**
 * Control System
 *
 * - runs on the client
 * - provides a layered priority control system for both input and output
 *
 */

const controlTypes = {
  // key: createButton,
  mouseLeft: createButton,
  mouseRight: createButton,
  mouseMiddle: createButton,
  touchStick: createVector,
  scrollDelta: createValue,
  pointer: createPointer,
  screen: createScreen,
  camera: createCamera,
  xrLeftStick: createVector,
  xrLeftBtn1: createButton,
  xrLeftBtn2: createButton,
  xrRightStick: createVector,
  xrRightBtn1: createButton,
  xrRightBtn2: createButton,
}

export class ClientControls extends System {
  constructor(world) {
    super(world)
    this.controls = []
    this.actions = []
    this.buttonsDown = new Set()
    this.isUserGesture = false
    this.isMac = /Mac/.test(navigator.platform)
    this.pointer = {
      locked: false,
      shouldLock: false,
      coords: new THREE.Vector3(), // [0,0] to [1,1]
      position: new THREE.Vector3(), // [0,0] to [viewportWidth,viewportHeight]
      delta: new THREE.Vector3(), // position delta (pixels)
    }
    this.touches = new Map() // id -> { id, position, delta, prevPosition }
    this.screen = {
      width: 0,
      height: 0,
    }
    this.scroll = {
      delta: 0,
    }
    this.xrSession = null
    this.mmbDown = false
    this.middleMouseLocked = false
  }

  start() {
    this.world.on('xrSession', this.onXRSession)
  }

  preFixedUpdate() {
    // mouse wheel delta
    for (const control of this.controls) {
      if (control.entries.scrollDelta) {
        control.entries.scrollDelta.value = this.scroll.delta
        if (control.entries.scrollDelta.capture) break
      }
    }
    // xr
    if (this.xrSession) {
      this.xrSession.inputSources?.forEach(src => {
        // left
        if (src.gamepad && src.handedness === HandednessLeft) {
          for (const control of this.controls) {
            if (control.entries.xrLeftStick) {
              control.entries.xrLeftStick.value.x = src.gamepad.axes[2]
              control.entries.xrLeftStick.value.z = src.gamepad.axes[3]
              if (control.entries.xrLeftStick.capture) break
            }
            if (control.entries.xrLeftBtn1) {
              const button = control.entries.xrLeftBtn1
              const down = src.gamepad.buttons[4].pressed
              if (down && !button.down) {
                button.pressed = true
                button.onPress?.()
              }
              if (!down && button.down) {
                button.released = true
                button.onRelease?.()
              }
              button.down = down
            }
            if (control.entries.xrLeftBtn2) {
              const button = control.entries.xrLeftBtn2
              const down = src.gamepad.buttons[5].pressed
              if (down && !button.down) {
                button.pressed = true
                button.onPress?.()
              }
              if (!down && button.down) {
                button.released = true
                button.onRelease?.()
              }
              button.down = down
            }
          }
        }
        // right
        if (src.gamepad && src.handedness === HandednessRight) {
          for (const control of this.controls) {
            if (control.entries.xrRightStick) {
              control.entries.xrRightStick.value.x = src.gamepad.axes[2]
              control.entries.xrRightStick.value.z = src.gamepad.axes[3]
              if (control.entries.xrRightStick.capture) break
            }
            if (control.entries.xrRightBtn1) {
              const button = control.entries.xrRightBtn1
              const down = src.gamepad.buttons[4].pressed
              if (down && !button.down) {
                button.pressed = true
                button.onPress?.()
              }
              if (!down && button.down) {
                button.released = true
                button.onRelease?.()
              }
              button.down = down
            }
            if (control.entries.xrRightBtn2) {
              const button = control.entries.xrRightBtn2
              const down = src.gamepad.buttons[5].pressed
              if (down && !button.down) {
                button.pressed = true
                button.onPress?.()
              }
              if (!down && button.down) {
                button.released = true
                button.onRelease?.()
              }
              button.down = down
            }
          }
        }
      })
    }
  }

  postLateUpdate() {
    // clear pointer delta
    this.pointer.delta.set(0, 0, 0)
    // clear scroll delta
    this.scroll.delta = 0
    // clear buttons
    for (const control of this.controls) {
      for (const key in control.entries) {
        const value = control.entries[key]
        if (value.$button) {
          value.pressed = false
          value.released = false
        }
      }
    }
    // update camera
    let written
    for (const control of this.controls) {
      const camera = control.entries.camera
      if (camera?.write && !written) {
        this.world.rig.position.copy(camera.position)
        this.world.rig.quaternion.copy(camera.quaternion)
        this.world.camera.position.z = camera.zoom
        written = true
      } else if (camera) {
        camera.position.copy(this.world.rig.position)
        camera.quaternion.copy(this.world.rig.quaternion)
        camera.zoom = this.world.camera.position.z
      }
    }
    // clear touch deltas
    for (const [id, info] of this.touches) {
      info.delta.set(0, 0, 0)
    }
  }

  async init({ viewport }) {
    this.viewport = viewport
    this.screen.width = this.viewport.offsetWidth
    this.screen.height = this.viewport.offsetHeight
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    this.viewport.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onWindowPointerUp)
    this.viewport.addEventListener('touchstart', this.onTouchStart)
    this.viewport.addEventListener('touchmove', this.onTouchMove)
    this.viewport.addEventListener('touchend', this.onTouchEnd)
    this.viewport.addEventListener('touchcancel', this.onTouchEnd)
    this.viewport.addEventListener('pointerup', this.onPointerUp)
    this.viewport.addEventListener('wheel', this.onScroll, { passive: false }) // prettier-ignore
    document.body.addEventListener('contextmenu', this.onContextMenu)
    window.addEventListener('resize', this.onResize)
    window.addEventListener('blur', this.onBlur)
  }

  bind(options = {}) {
    const self = this
    const entries = {}
    const control = {
      options,
      entries,
      actions: null,
      api: {
        setActions(value) {
          if (value !== null && !Array.isArray(value)) {
            throw new Error('[control] actions must be null or array')
          }
          control.actions = value
          if (value) {
            for (const action of value) {
              action.id = ++actionIds
            }
          }
          self.buildActions()
        },
        release: () => {
          const idx = this.controls.indexOf(control)
          if (idx === -1) return
          this.controls.splice(idx, 1)
          options.onRelease?.()
        },
      },
    }
    // insert at correct priority level
    // - 0 is lowest priority generally for player controls
    // - apps use higher priority
    // - global systems use highest priority over everything
    const idx = this.controls.findIndex(c => c.options.priority < options.priority)
    if (idx === -1) {
      this.controls.push(control)
    } else {
      this.controls.splice(idx, 0, control)
    }
    // return proxy api
    return new Proxy(control, {
      get(target, prop) {
        // internal property
        if (prop in target.api) {
          return target.api[prop]
        }
        // existing item
        if (prop in entries) {
          return entries[prop]
        }
        // new button item
        if (buttons.has(prop)) {
          entries[prop] = createButton(self, control, prop)
          return entries[prop]
        }
        // new item based on type
        const createType = controlTypes[prop]
        if (createType) {
          entries[prop] = createType(self, control, prop)
          return entries[prop]
        }
        return undefined
      },
    })
  }

  releaseAllButtons() {
    // release all down buttons because they can get stuck
    for (const control of this.controls) {
      for (const key in control.entries) {
        const value = control.entries[key]
        if (value.$button && value.down) {
          value.released = true
          value.down = false
          value.onRelease?.()
        }
      }
    }
  }

  buildActions() {
    this.actions = []
    for (const control of this.controls) {
      const actions = control.actions
      if (actions) {
        for (const action of actions) {
          // ignore if existing
          const idx = this.actions.findIndex(a => a.type === action.type)
          if (idx !== -1) continue
          this.actions.push(action)
        }
      }
    }
    this.world.emit('actions', this.actions)
  }

  onKeyDown = e => {
    if (e.defaultPrevented) return
    if (e.repeat) return
    if (this.isInputFocused()) return
    const code = e.code
    if (code === 'Tab') {
      // prevent default focus switching behavior
      e.preventDefault()
    }
    const prop = codeToProp[code]
    const text = e.key
    this.buttonsDown.add(prop)
    for (const control of this.controls) {
      const button = control.entries[prop]
      if (button?.$button) {
        button.pressed = true
        button.down = true
        const capture = button.onPress?.()
        if (capture || button.capture) break
      }
      const capture = control.onButtonPress?.(prop, text)
      if (capture) break
    }
  }

  onKeyUp = e => {
    if (e.repeat) return
    if (this.isInputFocused()) return
    const code = e.code
    if (code === 'MetaLeft' || code === 'MetaRight') {
      // releasing a meta key while another key is down causes browsers not to ever
      // trigger onKeyUp, so we just have to force all keys up
      return this.releaseAllButtons()
    }
    const prop = codeToProp[code]
    this.buttonsDown.delete(prop)
    for (const control of this.controls) {
      const button = control.entries[prop]
      if (button?.$button && button.down) {
        button.down = false
        button.released = true
        button.onRelease?.()
      }
    }
  }

  onPointerDown = e => {
    if (e.isCoreUI) return
    this.checkPointerChanges(e)
  }

  onPointerMove = e => {
    if (e.isCoreUI) return
    // this.checkPointerChanges(e)
    const rect = this.viewport.getBoundingClientRect()
    const offsetX = e.pageX - rect.left
    const offsetY = e.pageY - rect.top
    this.pointer.coords.x = Math.max(0, Math.min(1, offsetX / rect.width)) // prettier-ignore
    this.pointer.coords.y = Math.max(0, Math.min(1, offsetY / rect.height)) // prettier-ignore
    this.pointer.position.x = offsetX
    this.pointer.position.y = offsetY
    
    // Only apply camera movement if middle mouse is down or pointer is locked
    if (this.mmbDown || this.pointer.locked) {
      this.pointer.delta.x += e.movementX
      this.pointer.delta.y += e.movementY
    }
  }

  onPointerUp = e => {
    if (e.isCoreUI) return
    this.checkPointerChanges(e)
  }

  checkPointerChanges(e) {
    const lmb = !!(e.buttons & LMB)
    // left mouse down
    if (!this.lmbDown && lmb) {
      this.lmbDown = true
      this.buttonsDown.add(MouseLeft)
      for (const control of this.controls) {
        const button = control.entries.mouseLeft
        if (button) {
          button.down = true
          button.pressed = true
          const capture = button.onPress?.()
          if (capture || button.capture) break
        }
      }
    }
    // left mouse up
    if (this.lmbDown && !lmb) {
      this.lmbDown = false
      this.buttonsDown.delete(MouseLeft)
      for (const control of this.controls) {
        const button = control.entries.mouseLeft
        if (button) {
          button.down = false
          button.released = true
          button.onRelease?.()
        }
      }
    }
    
    const rmb = !!(e.buttons & RMB)
    // right mouse down
    if (!this.rmbDown && rmb) {
      this.rmbDown = true
      this.buttonsDown.add(MouseRight)
      for (const control of this.controls) {
        const button = control.entries.mouseRight
        if (button) {
          button.down = true
          button.pressed = true
          const capture = button.onPress?.()
          if (capture || button.capture) break
        }
      }
    }
    // right mouse up
    if (this.rmbDown && !rmb) {
      this.rmbDown = false
      this.buttonsDown.delete(MouseRight)
      for (const control of this.controls) {
        const button = control.entries.mouseRight
        if (button) {
          button.down = false
          button.released = true
          button.onRelease?.()
        }
      }
    }
    
    // Add middle mouse button support
    const mmb = !!(e.buttons & MMB)
    // middle mouse down
    if (!this.mmbDown && mmb) {
      this.mmbDown = true
      this.buttonsDown.add(MouseMiddle)
      
      // If in build mode, lock the pointer when middle mouse is pressed
      if (this.world.builder?.enabled && !this.pointer.locked) {
        this.lockPointer()
        this.middleMouseLocked = true
      }
      
      for (const control of this.controls) {
        const button = control.entries.mouseMiddle
        if (button) {
          button.down = true
          button.pressed = true
          button.onPress?.()
          if (button.capture) break
        }
      }
    }
    // middle mouse up
    if (this.mmbDown && !mmb) {
      this.mmbDown = false
      this.buttonsDown.delete(MouseMiddle)
      
      // If in build mode and we locked with middle mouse button, unlock
      if (this.middleMouseLocked) {
        this.unlockPointer()
        this.middleMouseLocked = false
      }
      
      for (const control of this.controls) {
        const button = control.entries.mouseMiddle
        if (button) {
          button.down = false
          button.released = true
          button.onRelease?.()
        }
      }
    }
  }

  async lockPointer() {
    this.pointer.shouldLock = true
    try {
      await this.viewport.requestPointerLock()
      return true
    } catch (err) {
      console.log('pointerlock denied, too quick?')
      return false
    }
  }

  unlockPointer() {
    this.pointer.shouldLock = false
    if (!this.pointer.locked) return
    document.exitPointerLock()
    this.onPointerLockEnd()
  }

  onPointerLockChange = e => {
    const didPointerLock = !!document.pointerLockElement
    if (didPointerLock) {
      this.onPointerLockStart()
    } else {
      this.onPointerLockEnd()
    }
  }

  onPointerLockStart() {
    if (this.pointer.locked) return
    this.pointer.locked = true
    this.world.emit('pointer-lock', true)
    // pointerlock is async so if its no longer meant to be locked, exit
    if (!this.pointer.shouldLock) this.unlockPointer()
  }

  onPointerLockEnd() {
    if (!this.pointer.locked) return
    this.pointer.locked = false
    this.world.emit('pointer-lock', false)
  }

  onScroll = e => {
    if (e.isCoreUI) return
    e.preventDefault()
    let delta = e.shiftKey ? e.deltaX : e.deltaY
    if (!this.isMac) delta = -delta
    this.scroll.delta += delta
  }

  onContextMenu = e => {
    e.preventDefault()
  }

  onTouchStart = e => {
    e.preventDefault()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const info = {
        id: touch.identifier,
        position: new THREE.Vector3(touch.clientX, touch.clientY, 0),
        prevPosition: new THREE.Vector3(touch.clientX, touch.clientY, 0),
        delta: new THREE.Vector3(),
      }
      this.touches.set(info.id, info)
      for (const control of this.controls) {
        const consume = control.options.onTouch?.(info)
        if (consume) break
      }
    }
  }

  onTouchMove = e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const info = this.touches.get(touch.identifier)
      const currentX = touch.clientX
      const currentY = touch.clientY
      info.delta.x += currentX - info.prevPosition.x
      info.delta.y += currentY - info.prevPosition.y
      info.position.x = currentX
      info.position.y = currentY
      info.prevPosition.x = currentX
      info.prevPosition.y = currentY
    }
  }

  onTouchEnd = e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const info = this.touches.get(touch.identifier)
      for (const control of this.controls) {
        const consume = control.options.onTouchEnd?.(info)
        if (consume) break
      }
      this.touches.delete(touch.identifier)
    }
  }

  onResize = () => {
    this.screen.width = this.viewport.offsetWidth
    this.screen.height = this.viewport.offsetHeight
  }

  onBlur = () => {
    this.releaseAllButtons()
  }

  onXRSession = session => {
    this.xrSession = session
  }

  isInputFocused() {
    return document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
  }

  onWindowPointerUp = e => {
    // Check if middle mouse button was released
    if (this.mmbDown && !(e.buttons & MMB)) {
      this.mmbDown = false
      this.buttonsDown.delete(MouseMiddle)
      
      // If in build mode and we locked with middle mouse button, unlock
      if (this.middleMouseLocked) {
        this.unlockPointer()
        this.middleMouseLocked = false
      }
      
      for (const control of this.controls) {
        const button = control.entries.mouseMiddle
        if (button) {
          button.down = false
          button.released = true
          button.onRelease?.()
        }
      }
    }
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    this.viewport.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onWindowPointerUp)
    this.viewport.removeEventListener('touchstart', this.onTouchStart)
    this.viewport.removeEventListener('touchmove', this.onTouchMove)
    this.viewport.removeEventListener('touchend', this.onTouchEnd)
    this.viewport.removeEventListener('touchcancel', this.onTouchEnd)
    this.viewport.removeEventListener('pointerup', this.onPointerUp)
    this.viewport.removeEventListener('wheel', this.onScroll)
    document.body.removeEventListener('contextmenu', this.onContextMenu)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('blur', this.onBlur)
  }
}

function createButton(controls, control, prop) {
  const down = controls.buttonsDown.has(prop)
  const pressed = down
  const released = false
  return {
    $button: true,
    down,
    pressed,
    released,
    capture: false,
    onPress: null,
    onRelease: null,
  }
}

function createVector(controls, control, prop) {
  return {
    $vector: true,
    value: new THREE.Vector3(),
    capture: false,
  }
}

function createValue(controls, control, prop) {
  return {
    $value: true,
    value: null,
    capture: false,
  }
}

function createPointer(controls, control, prop) {
  const coords = new THREE.Vector3() // [0,0] to [1,1]
  const position = new THREE.Vector3() // [0,0] to [viewportWidth,viewportHeight]
  const delta = new THREE.Vector3() // position delta (pixels)
  return {
    get coords() {
      return coords.copy(controls.pointer.coords)
    },
    get position() {
      return position.copy(controls.pointer.position)
    },
    get delta() {
      return delta.copy(controls.pointer.delta)
    },
    get locked() {
      return controls.pointer.locked
    },
    lock() {
      controls.lockPointer()
    },
    unlock() {
      controls.unlockPointer()
    },
  }
}

function createScreen(controls, control) {
  return {
    $screen: true,
    get width() {
      return controls.screen.width
    },
    get height() {
      return controls.screen.height
    },
  }
}

function createCamera(controls, control) {
  const world = controls.world
  const position = new THREE.Vector3().copy(world.rig.position)
  const quaternion = new THREE.Quaternion().copy(world.rig.quaternion)
  const rotation = new THREE.Euler(0, 0, 0, 'YXZ').copy(world.rig.rotation)
  bindRotations(quaternion, rotation)
  const zoom = world.camera.position.z
  return {
    $camera: true,
    position,
    quaternion,
    rotation,
    zoom,
    write: false,
  }
}

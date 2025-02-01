import * as THREE from '../extras/three'

import { System } from './System'

const UP = new THREE.Vector3(0, 1, 0)
const v1 = new THREE.Vector3()

export class ClientAudio extends System {
  constructor(world) {
    super(world)
    this.handles = new Set()
    this.ctx = new AudioContext() // new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain()
    this.masterGain.connect(this.ctx.destination)
    this.groupGains = {
      music: this.ctx.createGain(),
      sfx: this.ctx.createGain(),
      voice: this.ctx.createGain(),
    }
    this.groupGains.music.connect(this.masterGain)
    this.groupGains.sfx.connect(this.masterGain)
    this.groupGains.voice.connect(this.masterGain)
    this.listener = this.ctx.listener
    this.listener.positionX.value = 0
    this.listener.positionY.value = 0
    this.listener.positionZ.value = 0
    this.listener.forwardX.value = 0
    this.listener.forwardY.value = 0
    this.listener.forwardZ.value = -1
    this.listener.upX.value = 0
    this.listener.upY.value = 1
    this.listener.upZ.value = 0

    this.gestured = false
    this.gestureQueue = []
    const onGesture = () => {
      while (this.gestureQueue.length) {
        this.gestureQueue.shift()()
      }
      document.body.removeEventListener('click', onGesture)
      this.gestured = true
    }
    document.body.addEventListener('click', onGesture)
  }

  async init() {
    // ...
  }

  start() {
    // ...
  }

  lateUpdate(delta) {
    const target = this.world.rig
    // position
    this.listener.positionX.value = target.position.x
    this.listener.positionY.value = target.position.y
    this.listener.positionZ.value = target.position.z
    // direction
    const dir = v1.set(0, 0, -1).applyQuaternion(target.quaternion)
    this.listener.forwardX.value = dir.x
    this.listener.forwardY.value = dir.y
    this.listener.forwardZ.value = dir.z
    this.listener.upX.value = UP.x
    this.listener.upY.value = UP.y
    this.listener.upZ.value = UP.z
  }

  requireGesture(fn) {
    if (this.gestured) return fn()
    this.gestureQueue.push(fn)
  }
}

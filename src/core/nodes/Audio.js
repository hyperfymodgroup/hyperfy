import * as THREE from '../extras/three'
import { every, isBoolean, isNumber } from 'lodash-es'

import { Node } from './Node'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const q1 = new THREE.Quaternion()

const groups = ['music', 'sfx']
const distanceModels = ['linear', 'inverse', 'exponential']

const defaults = {
  src: null,
  volume: 1,
  loop: false,
  group: 'music',
  // see: https://medium.com/@kfarr/understanding-web-audio-api-positional-audio-distance-models-for-webxr-e77998afcdff
  spatial: true,
  distanceModel: 'inverse',
  refDistance: 1,
  maxDistance: 40,
  rolloffFactor: 3,
  coneInnerAngle: 360,
  coneOuterAngle: 360,
  coneOuterGain: 0,
}

export class Audio extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'audio'

    this.src = data.src
    this.volume = data.volume
    this.loop = data.loop
    this.group = data.group
    this.spatial = data.spatial
    this.distanceModel = data.distanceModel
    this.refDistance = data.refDistance
    this.maxDistance = data.maxDistance
    this.rolloffFactor = data.rolloffFactor
    this.coneInnerAngle = data.coneInnerAngle
    this.coneOuterAngle = data.coneOuterAngle
    this.coneOuterGain = data.coneOuterGain

    this.n = 0
    this.source = null
    this.gainNode = null
    this.pannerNode = null

    this.offset = 0
    this.shouldPlay = false
    this.startTime = null
  }

  async mount() {
    // ...
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.needsRebuild = false
      if (this.source) {
        this.pause()
        this.play()
      }
      return
    }
    if (didMove) {
      this.move()
    }
  }

  unmount() {
    this.stop()
  }

  move() {
    if (!this.pannerNode) return
    this.matrixWorld.decompose(v1, q1, v2)
    this.pannerNode.positionX.value = v1.x
    this.pannerNode.positionY.value = v1.y
    this.pannerNode.positionZ.value = v1.z
    const forward = v1.set(0, 0, -1).applyQuaternion(q1)
    this.pannerNode.orientationX.value = forward.x
    this.pannerNode.orientationY.value = forward.y
    this.pannerNode.orientationZ.value = forward.z
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._src = source._src
    this._volume = source._volume
    this._loop = source._loop
    this._group = source._group
    this._spatial = source._spatial
    this._distanceModel = source._distanceModel
    this._refDistance = source._refDistance
    this._maxDistance = source._maxDistance
    this._rolloffFactor = source._rolloffFactor
    this._coneInnerAngle = source._coneInnerAngle
    this._coneOuterAngle = source._coneOuterAngle
    this._coneOuterGain = source._coneOuterGain
    return this
  }

  get src() {
    return this._src
  }

  set src(value) {
    this._src = value || null
    this.needsRebuild = true
    this.setDirty()
  }

  get volume() {
    return this._volume
  }

  set volume(value) {
    this._volume = isNumber(value) ? value : defaults.volume
    if (this.gainNode) this.gainNode.gain.value = this._volume
  }

  get loop() {
    return this._loop
  }

  set loop(value) {
    this._loop = isBoolean(value) ? value : defaults.loop
    this.needsRebuild = true
    this.setDirty()
  }

  get group() {
    return this._group
  }

  set group(value) {
    this._group = isCategory(value) ? value : defaults.group
    this.needsRebuild = true
    this.setDirty()
  }

  get spatial() {
    return this._spatial
  }

  set spatial(value) {
    this._spatial = isBoolean(value) ? value : defaults.spatial
    this.needsRebuild = true
    this.setDirty()
  }

  get distanceModel() {
    return this._distanceModel
  }

  set distanceModel(value) {
    this._distanceModel = isDistanceModel(value) ? value : defaults.distanceModel
    if (this.pannerNode) {
      this.pannerNode.distanceModel = this._distanceModel
    }
  }

  get refDistance() {
    return this._refDistance
  }

  set refDistance(value) {
    this._refDistance = isNumber(value) ? value : defaults.refDistance
    if (this.pannerNode) {
      this.pannerNode.refDistance = this._refDistance
    }
  }

  get maxDistance() {
    return this._maxDistance
  }

  set maxDistance(value) {
    this._maxDistance = isNumber(value) ? value : defaults.maxDistance
    if (this.pannerNode) {
      this.pannerNode.maxDistance = this._maxDistance
    }
  }

  get rolloffFactor() {
    return this._rolloffFactor
  }

  set rolloffFactor(value) {
    this._rolloffFactor = isNumber(value) ? value : defaults.rolloffFactor
    if (this.pannerNode) {
      this.pannerNode.rolloffFactor = this._rolloffFactor
    }
  }

  get coneInnerAngle() {
    return this._coneInnerAngle
  }

  set coneInnerAngle(value) {
    this._coneInnerAngle = isNumber(value) ? value : defaults.coneInnerAngle
    if (this.pannerNode) {
      this.pannerNode.coneInnerAngle = this._coneInnerAngle
    }
  }

  get coneOuterAngle() {
    return this._coneOuterAngle
  }

  set coneOuterAngle(value) {
    this._coneOuterAngle = isNumber(value) ? value : defaults.coneOuterAngle
    if (this.pannerNode) {
      this.pannerNode.coneOuterAngle = this._coneOuterAngle
    }
  }

  get coneOuterGain() {
    return this._coneOuterGain
  }

  set coneOuterGain(value) {
    this._coneOuterGain = isNumber(value) ? value : defaults.coneOuterGain
    if (this.pannerNode) {
      this.pannerNode.coneOuterGain = this._coneOuterGain
    }
  }

  get currentTime() {
    const audio = this.ctx.world.audio
    if (!audio) {
      return 0
    }
    if (this.source) {
      return audio.ctx.currentTime - this.startTime
    }
    return this.offset
  }

  set currentTime(time) {
    if (!isNumber(time)) return
    const offset = Math.max(0, time)
    if (this.source) {
      this.stop()
      this.offset = offset
      this.play()
    } else {
      this.offset = offset
    }
  }

  async play() {
    const loader = this.ctx.world.loader
    const audio = this.ctx.world.audio
    if (!audio) return
    if (!this._src) return
    if (this.source) return
    const n = ++this.n
    let buffer
    try {
      buffer = loader.get('audio', this._src)
      if (!buffer) buffer = await loader.load('audio', this._src)
    } catch (err) {
      console.error(err)
      return
    }
    if (n !== this.n) return

    this.source = audio.ctx.createBufferSource()
    this.source.buffer = buffer
    this.source.loop = this._loop

    this.gainNode = audio.ctx.createGain()
    this.gainNode.gain.value = this._volume

    if (this._spatial) {
      this.pannerNode = audio.ctx.createPanner()
      this.pannerNode.panningModel = 'HRTF'
      this.pannerNode.distanceModel = this._distanceModel
      this.pannerNode.refDistance = this._refDistance
      this.pannerNode.maxDistance = this._maxDistance
      this.pannerNode.rolloffFactor = this._rolloffFactor
      this.pannerNode.coneInnerAngle = this._coneInnerAngle
      this.pannerNode.coneOuterAngle = this._coneOuterAngle
      this.pannerNode.coneOuterGain = this._coneOuterGain
      this.source.connect(this.gainNode)
      this.gainNode.connect(this.pannerNode)
      this.pannerNode.connect(audio.groupGains[this._group])
      this.move()
    } else {
      this.source.connect(this.gainNode)
      this.gainNode.connect(audio.groupGains[this._group])
    }

    audio.requireGesture(() => {
      if (n !== this.n) return
      this.startTime = audio.ctx.currentTime - this.offset
      this.source.start(0, this.offset)
      if (!this._loop) {
        this.source.onended = () => this.stop()
      }
    })
  }

  pause() {
    const audio = this.ctx.world.audio
    if (!audio) return
    if (this.source) {
      this.n++
      this.offset = audio.ctx.currentTime - this.startTime
      this.source.onended = null
      this.source.stop()
      this.source = null
      this.gainNode?.disconnect()
      this.gainNode = null
      this.pannerNode?.disconnect()
      this.pannerNode = null
    }
  }

  stop() {
    const audio = this.ctx.world.audio
    if (!audio) return
    this.n++
    this.offset = 0
    if (this.source) {
      this.source.onended = null
      this.source?.stop()
      this.source = null
      this.gainNode?.disconnect()
      this.gainNode = null
      this.pannerNode?.disconnect()
      this.pannerNode = null
    }
  }

  getProxy() {
    var self = this
    if (!this.proxy) {
      let proxy = {
        get src() {
          return self.src
        },
        set src(value) {
          self.src = value
        },
        get volume() {
          return self.volume
        },
        set volume(value) {
          self.volume = value
        },
        get loop() {
          return self.loop
        },
        set loop(value) {
          self.loop = value
        },
        get group() {
          return self.group
        },
        set group(value) {
          self.group = value
        },
        get spatial() {
          return self.spatial
        },
        set spatial(value) {
          self.spatial = value
        },
        get distanceModel() {
          return self.distanceModel
        },
        set distanceModel(value) {
          self.distanceModel = value
        },
        get refDistance() {
          return self.refDistance
        },
        set refDistance(value) {
          self.refDistance = value
        },
        get maxDistance() {
          return self.maxDistance
        },
        set maxDistance(value) {
          self.maxDistance = value
        },
        get rolloffFactor() {
          return self.rolloffFactor
        },
        set rolloffFactor(value) {
          self.rolloffFactor = value
        },
        get coneInnerAngle() {
          return self.coneInnerAngle
        },
        set coneInnerAngle(value) {
          self.coneInnerAngle = value
        },
        get coneOuterAngle() {
          return self.coneOuterAngle
        },
        set coneOuterAngle(value) {
          self.coneOuterAngle = value
        },
        get coneOuterGain() {
          return self.coneOuterGain
        },
        set coneOuterGain(value) {
          self.coneOuterGain = value
        },
        get currentTime() {
          return self.currentTime
        },
        set currentTime(value) {
          self.currentTime = value
        },
        play() {
          self.play()
        },
        pause() {
          self.pause()
        },
        stop() {
          self.stop()
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function isDistanceModel(value) {
  return distanceModels.includes(value)
}

function isCategory(value) {
  return groups.includes(value)
}

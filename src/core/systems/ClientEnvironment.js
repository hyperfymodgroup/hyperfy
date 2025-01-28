import * as THREE from '../extras/three'

import { System } from './System'

import { CSM } from '../libs/csm/CSM'

const csmLevels = {
  none: {
    cascades: 1,
    shadowMapSize: 1024,
    castShadow: false,
    lightIntensity: 3,
    // shadowBias: 0.000002,
    // shadowNormalBias: 0.001,
    shadowIntensity: 2,
  },
  low: {
    cascades: 1,
    shadowMapSize: 2048,
    castShadow: true,
    lightIntensity: 1,
    shadowBias: 0.0000009,
    shadowNormalBias: 0.001,
    shadowIntensity: 2,
  },
  med: {
    cascades: 3,
    shadowMapSize: 1024,
    castShadow: true,
    lightIntensity: 1,
    shadowBias: 0.000002,
    shadowNormalBias: 0.002,
    shadowIntensity: 2,
  },
  high: {
    cascades: 3,
    shadowMapSize: 2048,
    castShadow: true,
    lightIntensity: 1,
    shadowBias: 0.000003,
    shadowNormalBias: 0.002,
    shadowIntensity: 2,
  },
}

const defaults = {
  sky: '/day2-2k.jpg',
  hdr: '/day2.hdr',
}

/**
 * Environment System
 *
 * - Runs on the client
 * - Sets up the sky, hdr, sun, shadows, fog etc
 *
 */
export class ClientEnvironment extends System {
  constructor(world) {
    super(world)

    this.sky = null
    this.skyUrl = null
    this.skyN = 0
    this.skys = []

    this.hdr = null
    this.hdrUrl = null
    this.hdrN = 0
    this.hdrs = []
  }

  async start() {
    this.buildCSM()
    this.updateSky()
    this.updateHDR()

    this.world.client.settings.on('change', this.onSettingsChange)
    this.world.graphics.on('resize', this.onViewportResize)

    // TEMP: the following sets up a the base environment
    // but eventually you'll do this with an environment app

    // ground
    const glb = await this.world.loader.load('model', '/base-environment.glb')
    const root = glb.toNodes()
    root.activate({ world: this.world, physics: true, label: 'base-environment' })
  }

  addSky(url) {
    const handle = {
      url,
      destroy: () => {
        const idx = this.skys.indexOf(handle)
        if (idx === -1) return
        this.skys.splice(idx, 1)
        this.updateSky()
      },
    }
    this.skys.push(handle)
    this.updateSky()
    return handle
  }

  async updateSky() {
    const url = this.skys[this.skys.length - 1]?.url || defaults.sky
    if (this.skyUrl === url) return
    this.skyUrl = url
    if (!this.sky) {
      const geometry = new THREE.SphereGeometry(1000, 60, 40)
      const material = new THREE.MeshBasicMaterial({ side: THREE.BackSide })
      this.sky = new THREE.Mesh(geometry, material)
      this.sky.geometry.computeBoundsTree()
      this.sky.material.needsUpdate = true
      this.sky.material.fog = false
      this.sky.material.toneMapped = false
      this.sky.matrixAutoUpdate = false
      this.sky.matrixWorldAutoUpdate = false
      this.sky.visible = false
      this.world.stage.scene.add(this.sky)
    }
    const n = ++this.skyN
    const texture = await this.world.loader.load('texture', url)
    if (n !== this.skyN) return
    // texture = texture.clone()
    texture.minFilter = texture.magFilter = THREE.LinearFilter
    texture.mapping = THREE.EquirectangularReflectionMapping
    // texture.encoding = Encoding[this.encoding]
    texture.colorSpace = THREE.SRGBColorSpace
    this.sky.material.map = texture
    this.sky.visible = true
  }

  addHDR(url) {
    const handle = {
      url,
      destroy: () => {
        const idx = this.hdrs.indexOf(handle)
        if (idx === -1) return
        this.hdrs.splice(idx, 1)
        this.updateHDR()
      },
    }
    this.hdrs.push(handle)
    this.updateHDR()
    return handle
  }

  async updateHDR() {
    const url = this.hdrs[this.hdrs.length - 1]?.url || defaults.hdr
    if (this.hdrUrl === url) return
    this.hdrUrl = url
    const n = ++this.hdrN
    const texture = await this.world.loader.load('hdr', url)
    if (n !== this.hdrN) return
    // texture.colorSpace = THREE.NoColorSpace
    // texture.colorSpace = THREE.SRGBColorSpace
    // texture.colorSpace = THREE.LinearSRGBColorSpace
    texture.mapping = THREE.EquirectangularReflectionMapping
    this.world.stage.scene.environment = texture
  }

  update(delta) {
    this.csm.update()
  }

  buildCSM() {
    if (this.csm) this.csm.dispose()
    const scene = this.world.stage.scene
    const camera = this.world.camera
    const options = csmLevels[this.world.client.settings.shadows]
    this.csm = new CSM({
      mode: 'practical', // uniform, logarithmic, practical, custom
      // mode: 'custom',
      // customSplitsCallback: function (cascadeCount, nearDistance, farDistance) {
      //   return [0.05, 0.2, 0.5]
      // },
      cascades: 3,
      shadowMapSize: 2048,
      maxFar: 100,
      lightIntensity: 1,
      lightDirection: new THREE.Vector3(-1, -2, -2).normalize(),
      fade: true,
      parent: scene,
      camera: camera,
      // note: you can play with bias in console like this:
      // var csm = world.graphics.csm
      // csm.shadowBias = 0.00001
      // csm.shadowNormalBias = 0.002
      // csm.updateFrustums()
      // shadowBias: 0.00001,
      // shadowNormalBias: 0.002,
      // lightNear: 0.0000001,
      // lightFar: 5000,
      // lightMargin: 200,
      // noLastCascadeCutOff: true,
      ...options,
      // note: you can test changes in console and then call csm.updateFrustrums() to debug
    })
    for (const light of this.csm.lights) {
      light.shadow.intensity = options.shadowIntensity
    }
    if (!options.castShadow) {
      for (const light of this.csm.lights) {
        light.castShadow = false
      }
    }
  }

  onSettingsChange = changes => {
    if (changes.shadows) {
      this.buildCSM()
    }
  }

  onViewportResize = () => {
    this.csm.updateFrustums()
  }
}

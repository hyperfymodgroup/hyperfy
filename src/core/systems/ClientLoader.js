import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'

import { System } from './System'
import { createNode } from '../extras/createNode'
import { createVRMFactory } from '../extras/createVRMFactory'
import { glbToNodes } from '../extras/glbToNodes'
import { createEmoteFactory } from '../extras/createEmoteFactory'
import { TextureLoader } from 'three'

/**
 * Client Loader System
 *
 * - Runs on the client
 * - Basic file loader for many different formats, cached.
 *
 */
export class ClientLoader extends System {
  constructor(world) {
    super(world)
    this.promises = new Map()
    this.results = new Map()
    this.rgbeLoader = new RGBELoader()
    this.texLoader = new TextureLoader()
    this.gltfLoader = new GLTFLoader()
    this.gltfLoader.register(parser => new VRMLoaderPlugin(parser))
  }

  start() {
    this.vrmHooks = {
      camera: this.world.camera,
      scene: this.world.stage.scene,
      octree: this.world.stage.octree,
      setupMaterial: this.world.setupMaterial,
      loader: this.world.loader,
    }
  }

  has(type, url) {
    const key = `${type}/${url}`
    return this.promises.has(key)
  }

  get(type, url) {
    const key = `${type}/${url}`
    return this.results.get(key)
  }

  preload(items) {
    // console.log('preload', items)
    const promises = items.map(item => this.load(item.type, item.url))
    this.preloader = Promise.allSettled(promises).then(() => {
      this.preloader = null
    })
  }

  async load(type, url) {
    if (this.preloader) {
      await this.preloader
    }
    const key = `${type}/${url}`
    if (this.promises.has(key)) {
      return this.promises.get(key)
    }
    url = this.resolveURL(url)
    let promise
    if (type === 'hdr') {
      promise = this.rgbeLoader.loadAsync(url).then(texture => {
        this.results.set(key, texture)
        return texture
      })
    }
    if (type === 'texture') {
      promise = this.texLoader.loadAsync(url).then(texture => {
        this.results.set(key, texture)
        return texture
      })
    }
    if (type === 'model') {
      promise = this.gltfLoader.loadAsync(url).then(glb => {
        const node = glbToNodes(glb, this.world)
        const model = {
          toNodes() {
            return node.clone(true)
          },
        }
        this.results.set(key, model)
        return model
      })
    }
    if (type === 'emote') {
      promise = this.gltfLoader.loadAsync(url).then(glb => {
        const factory = createEmoteFactory(glb, url)
        const emote = {
          toClip(options) {
            return factory.toClip(options)
          },
        }
        this.results.set(key, emote)
        return emote
      })
    }
    if (type === 'avatar') {
      promise = this.gltfLoader.loadAsync(url).then(glb => {
        const factory = createVRMFactory(glb, this.world.setupMaterial)
        const node = createNode({ name: 'group' })
        const node2 = createNode({ id: 'avatar', name: 'avatar', factory, hooks: this.vrmHooks })
        node.add(node2)
        const avatar = {
          toNodes(customHooks) {
            const clone = node.clone(true)
            if (customHooks) {
              clone.get('avatar').hooks = customHooks
            }
            return clone
          },
        }
        this.results.set(key, avatar)
        return avatar
      })
    }
    if (type === 'script') {
      promise = new Promise(async (resolve, reject) => {
        try {
          const resp = await fetch(url)
          const code = await resp.text()
          const script = this.world.scripts.evaluate(code)
          this.results.set(key, script)
          resolve(script)
        } catch (err) {
          reject(err)
        }
      })
    }
    this.promises.set(key, promise)
    return promise
  }

  insert(type, url, file) {
    const key = `${type}/${url}`
    const localUrl = URL.createObjectURL(file)
    let promise
    if (type === 'hdr') {
      promise = this.rgbeLoader.loadAsync(localUrl).then(texture => {
        this.results.set(key, texture)
        return texture
      })
    }
    if (type === 'texture') {
      promise = this.texLoader.loadAsync(localUrl).then(texture => {
        this.results.set(key, texture)
        return texture
      })
    }
    if (type === 'model') {
      promise = this.gltfLoader.loadAsync(localUrl).then(glb => {
        const node = glbToNodes(glb, this.world)
        const model = {
          toNodes() {
            return node.clone(true)
          },
        }
        this.results.set(key, model)
        return model
      })
    }
    if (type === 'emote') {
      promise = this.gltfLoader.loadAsync(localUrl).then(glb => {
        const factory = createEmoteFactory(glb, url)
        const emote = {
          toClip(options) {
            return factory.toClip(options)
          },
        }
        this.results.set(key, emote)
        return emote
      })
    }
    if (type === 'avatar') {
      promise = this.gltfLoader.loadAsync(localUrl).then(glb => {
        const factory = createVRMFactory(glb, this.world.setupMaterial)
        const node = createNode({ name: 'group' })
        const node2 = createNode({ id: 'avatar', name: 'avatar', factory, hooks: this.vrmHooks })
        node.add(node2)
        const avatar = {
          toNodes(customHooks) {
            const clone = node.clone(true)
            if (customHooks) {
              clone.get('avatar').hooks = customHooks
            }
            return clone
          },
        }
        this.results.set(key, avatar)
        return avatar
      })
    }
    if (type === 'script') {
      promise = new Promise(async (resolve, reject) => {
        try {
          const code = await file.text()
          const script = this.world.scripts.evaluate(code)
          this.results.set(key, script)
          resolve(script)
        } catch (err) {
          reject(err)
        }
      })
    }
    this.promises.set(key, promise)
  }

  resolveURL(url) {
    if (url.startsWith('asset://')) {
      return url.replace('asset:/', process.env.PUBLIC_ASSETS_URL)
    }
    return url
  }
}

import { Node } from './Node'

const defaults = {
  url: null,
}

export class Sky extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'sky'
    this.url = data.url === undefined ? defaults.url : data.url
  }

  mount() {
    this.handle = this.ctx.world.environment?.addSky(this._url)
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.handle?.destroy()
      this.handle = this.ctx.world.environment?.addSky(this._url)
      this.needsRebuild = false
    }
    if (didMove) {
      // this.worldPos.setFromMatrixPosition(this.matrixWorld)
    }
  }

  unmount() {
    this.handle?.destroy()
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._url = source._url
    return this
  }

  get url() {
    return this._url
  }

  set url(value) {
    if (this._url === value) return
    this._url = value
    this.needsRebuild = true
    this.setDirty()
  }

  getProxy() {
    var self = this
    if (!this.proxy) {
      let proxy = {
        get url() {
          return self.url
        },
        set url(value) {
          self.url = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

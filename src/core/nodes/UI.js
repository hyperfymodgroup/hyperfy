import * as THREE from '../extras/three'
import { isBoolean, isNumber, isString } from 'lodash-es'

import { Node } from './Node'
import { fillRoundRect } from '../extras/fillRoundRect'
import {
  AlignContent,
  AlignItems,
  FlexDirection,
  FlexWrap,
  isAlignContent,
  isAlignItem,
  isFlexDirection,
  isFlexWrap,
  isJustifyContent,
  JustifyContent,
} from '../extras/yoga'
import CustomShaderMaterial from '../libs/three-custom-shader-material'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const v3 = new THREE.Vector3()
const q1 = new THREE.Quaternion()
const q2 = new THREE.Quaternion()
const m1 = new THREE.Matrix4()

const iQuaternion = new THREE.Quaternion(0, 0, 0, 1)
const iScale = new THREE.Vector3(1, 1, 1)

const billboards = ['none', 'full', 'y']
const pivots = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

const defaults = {
  width: 100,
  height: 100,
  size: 0.01,
  res: 2,

  lit: false,
  doubleside: true,
  billboard: 'none',
  pivot: 'center',

  transparent: true,
  backgroundColor: null,
  borderRadius: 0,
  padding: 0,
  flexDirection: 'column',
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  alignContent: 'flex-start',
  flexWrap: 'no-wrap',
  gap: 0,
}

export class UI extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'ui'

    this.width = data.width
    this.height = data.height
    this.size = data.size
    this.res = data.res

    this.lit = data.lit
    this.doubleside = data.doubleside
    this.billboard = data.billboard
    this.pivot = data.pivot

    this.transparent = data.transparent
    this.backgroundColor = data.backgroundColor
    this.borderRadius = data.borderRadius
    this.padding = data.padding
    this.flexDirection = data.flexDirection
    this.justifyContent = data.justifyContent
    this.alignItems = data.alignItems
    this.alignContent = data.alignContent
    this.flexWrap = data.flexWrap
    this.gap = data.gap

    this.ui = this
  }

  build() {
    this.unbuild()
    this.canvas = document.createElement('canvas')
    this.canvas.width = this._width * this._res
    this.canvas.height = this._height * this._res
    this.canvasCtx = this.canvas.getContext('2d')
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.anisotropy = this.ctx.world.graphics.maxAnisotropy
    // this.texture.minFilter = THREE.LinearFilter // or THREE.NearestFilter for pixel-perfect but potentially aliased text
    // this.texture.magFilter = THREE.LinearFilter
    // this.texture.generateMipmaps = true
    this.geometry = new THREE.PlaneGeometry(this._width, this._height)
    this.geometry.scale(this._size, this._size, this._size)
    applyPivot(this._pivot, this.geometry, this._width * this._size, this._height * this._size)
    this.material = this.createMaterial(this._lit, this.texture, this._billboard, this._transparent, this._doubleside)
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.matrixAutoUpdate = false
    this.mesh.matrixWorldAutoUpdate = false
    if (this._billboard !== 'none') {
      v1.setFromMatrixPosition(this.matrixWorld)
      this.mesh.matrixWorld.compose(v1, iQuaternion, iScale)
    } else {
      this.mesh.matrixWorld.copy(this.matrixWorld)
    }
    this.ctx.world.stage.scene.add(this.mesh)
    this.sItem = {
      matrix: this.matrixWorld,
      geometry: this.geometry,
      material: this.material,
      getEntity: () => this.ctx.entity,
      node: this,
    }
    this.ctx.world.stage.octree.insert(this.sItem)
    this.needsRebuild = false
  }

  unbuild() {
    if (this.mesh) {
      this.ctx.world.stage.scene.remove(this.mesh)
      this.texture.dispose()
      this.mesh.material.dispose()
      this.mesh.geometry.dispose()
      this.mesh = null
      this.ctx.world.stage.octree.remove(this.sItem)
      this.sItem = null
    }
  }

  draw() {
    this.yogaNode.calculateLayout(this._width * this._res, this._height * this._res, Yoga.DIRECTION_LTR)
    const ctx = this.canvasCtx
    ctx.clearRect(0, 0, this._width * this._res, this._height * this._res)
    const left = this.yogaNode.getComputedLeft()
    const top = this.yogaNode.getComputedTop()
    const width = this.yogaNode.getComputedWidth()
    const height = this.yogaNode.getComputedHeight()
    if (this._backgroundColor) {
      ctx.fillStyle = this._backgroundColor
      if (this._borderRadius) {
        fillRoundRect(ctx, left, top, width, height, this._borderRadius * this._res)
      } else {
        ctx.fillRect(left, top, width, height)
      }
    }
    this.box = { left, top, width, height }
    this.children.forEach(child => child.draw(ctx, left, top))
    this.texture.needsUpdate = true
    this.needsRedraw = false
  }

  mount() {
    if (this.ctx.world.network.isServer) return
    if (this.parent?.ui) return console.error('ui: cannot be nested inside another ui')
    this.yogaNode = Yoga.Node.create()
    this.yogaNode.setWidth(this._width * this._res)
    this.yogaNode.setHeight(this._height * this._res)
    this.yogaNode.setPadding(Yoga.EDGE_ALL, this._padding * this._res)
    this.yogaNode.setFlexDirection(FlexDirection[this._flexDirection])
    this.yogaNode.setJustifyContent(JustifyContent[this._justifyContent])
    this.yogaNode.setAlignItems(AlignItems[this._alignItems])
    this.yogaNode.setAlignContent(AlignContent[this._alignContent])
    this.yogaNode.setFlexWrap(FlexWrap[this._flexWrap])
    this.yogaNode.setGap(Yoga.GUTTER_ALL, this._gap)
    this.build()
    this.needsRedraw = true
    this.setDirty()
  }

  commit(didMove) {
    if (this.ctx.world.network.isServer) {
      return
    }
    if (this.needsRebuild) {
      this.build()
    }
    if (this.needsRedraw) {
      this.draw()
    }
    if (didMove) {
      if (this._billboard !== 'none') {
        v1.setFromMatrixPosition(this.matrixWorld)
        this.mesh.matrixWorld.compose(v1, iQuaternion, iScale)
      } else {
        this.mesh.matrixWorld.copy(this.matrixWorld)
        this.ctx.world.stage.octree.move(this.sItem)
      }
    }
  }

  unmount() {
    if (this.ctx.world.network.isServer) return
    this.unbuild()
    this.needRebuild = false
    this.needsRedraw = false
    this.yogaNode?.free()
    this.yogaNode = null
    this.box = null
  }

  rebuild() {
    this.needsRebuild = true
    this.needsRedraw = true
    this.setDirty()
  }

  redraw() {
    this.needsRedraw = true
    this.setDirty()
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._width = source._width
    this._height = source._height
    this._size = source._size
    this._res = source._res
    this._backgroundColor = source._backgroundColor
    this._borderRadius = source._borderRadius
    this._padding = source._padding
    this._flexDirection = source._flexDirection
    this._justifyContent = source._justifyContent
    this._alignItems = source._alignItems
    this._alignContent = source._alignContent
    this._flexWrap = source._flexWrap
    this._gap = source._gap
    return this
  }

  resolveHit(hit) {
    if (!hit || !hit.point) return null

    const inverseMatrix = m1.copy(this.mesh.matrixWorld).invert()

    // Convert world hit point to canvas coordinates
    v1.copy(hit.point)
      .applyMatrix4(inverseMatrix)
      .multiplyScalar(1 / this._size)

    const x = (v1.x + this._width / 2) * this._res
    const y = (-v1.y + this._height / 2) * this._res

    const findHitNode = (node, offsetX = 0, offsetY = 0) => {
      if (!node.box || node._display === 'none') return null

      const left = offsetX + node.box.left
      const top = offsetY + node.box.top
      const width = node.box.width
      const height = node.box.height

      if (x < left || x > left + width || y < top || y > top + height) {
        return null
      }

      // Check children from front to back
      for (let i = node.children.length - 1; i >= 0; i--) {
        const childHit = findHitNode(node.children[i], left, top)
        if (childHit) return childHit
      }

      return node
    }

    return findHitNode(this)
  }

  createMaterial(lit, texture, billboard, transparent, doubleside) {
    if (billboard === 'none') {
      const material = lit
        ? new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 })
        : new THREE.MeshBasicMaterial({})
      material.color.set('white')
      material.transparent = transparent
      material.map = texture
      material.side = doubleside ? THREE.DoubleSide : THREE.FrontSide
      this.ctx.world.setupMaterial(material)
      return material
    }
    const uniforms = {
      uBillboard: { value: billboard === 'full' ? 1 : billboard === 'y' ? 2 : 0 },
      uOrientation: { value: this.ctx.world.rig.quaternion },
    }
    const material = new CustomShaderMaterial({
      baseMaterial: lit ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial,
      ...(lit ? { roughness: 1, metalness: 0 } : {}),
      color: 'white',
      transparent,
      // depthTest: true,
      // depthWrite: false,
      map: texture,
      side: THREE.DoubleSide,
      uniforms,
      vertexShader: `
        uniform vec4 uOrientation;
        uniform int uBillboard; // 0: none, 1: full, 2: y-axis

        vec3 applyQuaternion(vec3 pos, vec4 quat) {
          vec3 qv = vec3(quat.x, quat.y, quat.z);
          vec3 t = 2.0 * cross(qv, pos);
          return pos + quat.w * t + cross(qv, t);
        }

        void main() {
          if (uBillboard == 1) { 
             // full billboard
             csm_Position = applyQuaternion(position, uOrientation);
          } 
          else if (uBillboard == 2) { 
            // y-axis billboard
            vec3 objToCam = normalize(cameraPosition - modelMatrix[3].xyz);
            objToCam.y = 0.0; // Project onto XZ plane
            objToCam = normalize(objToCam);            
            float cosAngle = objToCam.z;
            float sinAngle = objToCam.x;            
            mat3 rotY = mat3(
              cosAngle, 0.0, -sinAngle,
              0.0, 1.0, 0.0,
              sinAngle, 0.0, cosAngle
            );            
            csm_Position = rotY * position;
          }
        }
      `,
    })
    this.ctx.world.setupMaterial(material)
    return material
  }

  get width() {
    return this._width
  }

  set width(value = defaults.width) {
    if (!isNumber(value)) {
      throw new Error('[ui] width not a number')
    }
    if (this._width === value) return
    this._width = value
    this.yogaNode?.setWidth(this._width * this._res)
    this.rebuild()
  }

  get height() {
    return this._height
  }

  set height(value = defaults.height) {
    if (!isNumber(value)) {
      throw new Error('[ui] height not a number')
    }
    if (this._height === value) return
    this._height = value
    this.yogaNode?.setHeight(this._height * this._res)
    this.rebuild()
  }

  get size() {
    return this._size
  }

  set size(value = defaults.size) {
    if (!isNumber(value)) {
      throw new Error('[ui] size not a number')
    }
    if (this._size === value) return
    this._size = value
    this.rebuild()
  }

  get res() {
    return this._res
  }

  set res(value = defaults.res) {
    if (!isNumber(value)) {
      throw new Error('[ui] res not a number')
    }
    if (this._res === value) return
    this._res = value
    this.rebuild()
  }

  get lit() {
    return this._lit
  }

  set lit(value = defaults.lit) {
    if (!isBoolean(value)) {
      throw new Error('[ui] lit not a boolean')
    }
    if (this._lit === value) return
    this._lit = value
    this.rebuild()
  }

  get doubleside() {
    return this._doubleside
  }

  set doubleside(value = defaults.doubleside) {
    if (!isBoolean(value)) {
      throw new Error('[ui] doubleside not a boolean')
    }
    if (this._doubleside === value) return
    this._doubleside = value
    this.rebuild()
  }

  get billboard() {
    return this._billboard
  }

  set billboard(value = defaults.billboard) {
    if (!isBillboard(value)) {
      throw new Error(`[ui] billboard invalid: ${value}`)
    }
    if (this._billboard === value) return
    this._billboard = value
    this.rebuild()
  }

  get pivot() {
    return this._pivot
  }

  set pivot(value = defaults.pivot) {
    if (!isPivot(value)) {
      throw new Error(`[ui] pivot invalid: ${value}`)
    }
    if (this._pivot === value) return
    this._pivot = value
    this.rebuild()
  }

  get transparent() {
    return this._transparent
  }

  set transparent(value = defaults.transparent) {
    if (!isBoolean(value)) {
      throw new Error('[ui] transparent not a boolean')
    }
    if (this._transparent === value) return
    this._transparent = value
    this.redraw()
  }

  get backgroundColor() {
    return this._backgroundColor
  }

  set backgroundColor(value = defaults.backgroundColor) {
    if (value !== null && !isString(value)) {
      throw new Error('[ui] backgroundColor not a string')
    }
    if (this._backgroundColor === value) return
    this._backgroundColor = value
    this.redraw()
  }

  get borderRadius() {
    return this._borderRadius
  }

  set borderRadius(value = defaults.borderRadius) {
    if (!isNumber(value)) {
      throw new Error('[ui] borderRadius not a number')
    }
    if (this._borderRadius === value) return
    this._borderRadius = value
    this.redraw()
  }

  get padding() {
    return this._padding
  }

  set padding(value = defaults.padding) {
    if (!isNumber(value)) {
      throw new Error('[ui] padding not a number')
    }
    if (this._padding === value) return
    this._padding = value
    this.yogaNode?.setPadding(Yoga.EDGE_ALL, this._padding * this._res)
    this.redraw()
  }

  get flexDirection() {
    return this._flexDirection
  }

  set flexDirection(value = defaults.flexDirection) {
    if (!isFlexDirection(value)) {
      throw new Error(`[ui] flexDirection invalid: ${value}`)
    }
    if (this._flexDirection === value) return
    this._flexDirection = value
    this.yogaNode?.setFlexDirection(FlexDirection[this._flexDirection])
    this.redraw()
  }

  get justifyContent() {
    return this._justifyContent
  }

  set justifyContent(value = defaults.justifyContent) {
    if (!isJustifyContent(value)) {
      throw new Error(`[ui] justifyContent invalid: ${value}`)
    }
    if (this._justifyContent === value) return
    this._justifyContent = value
    this.yogaNode?.setJustifyContent(JustifyContent[this._justifyContent])
    this.redraw()
  }

  get alignItems() {
    return this._alignItems
  }

  set alignItems(value = defaults.alignItems) {
    if (!isAlignItem(value)) {
      throw new Error(`[ui] alignItems invalid: ${value}`)
    }
    if (this._alignItems === value) return
    this._alignItems = value
    this.yogaNode?.setAlignItems(AlignItems[this._alignItems])
    this.redraw()
  }

  get alignContent() {
    return this._alignContent
  }

  set alignContent(value = defaults.alignContent) {
    if (!isAlignContent(value)) {
      throw new Error(`[ui] alignContent invalid: ${value}`)
    }
    if (this._alignContent === value) return
    this._alignContent = value
    this.yogaNode?.setAlignContent(AlignContent[this._alignContent])
    this.redraw()
  }

  get flexWrap() {
    return this.flexWrap
  }

  set flexWrap(value = defaults.flexWrap) {
    if (!isFlexWrap(value)) {
      throw new Error(`[uiview] flexWrap invalid: ${value}`)
    }
    if (this._flexWrap === value) return
    this._flexWrap = value
    this.yogaNode?.setFlexWrap(FlexWrap[this._flexWrap])
    this.redraw()
  }

  get gap() {
    return this._gap
  }

  set gap(value = defaults.gap) {
    if (!isNumber(value)) {
      throw new Error(`[uiview] gap not a number`)
    }
    if (this._gap === value) return
    this._gap = value
    this.yogaNode?.setGap(Yoga.GUTTER_ALL, this._gap)
    this.redraw()
  }

  getProxy() {
    if (!this.proxy) {
      var self = this
      let proxy = {
        get width() {
          return self.width
        },
        set width(value) {
          self.width = value
        },
        get height() {
          return self.height
        },
        set height(value) {
          self.height = value
        },
        get size() {
          return self.size
        },
        set size(value) {
          self.size = value
        },
        get res() {
          return self.res
        },
        set res(value) {
          self.res = value
        },
        get lit() {
          return self.lit
        },
        set lit(value) {
          self.lit = value
        },
        get doubleside() {
          return self.doubleside
        },
        set doubleside(value) {
          self.doubleside = value
        },
        get billboard() {
          return self.billboard
        },
        set billboard(value) {
          self.billboard = value
        },
        get pivot() {
          return self.pivot
        },
        set pivot(value) {
          self.pivot = value
        },
        get transparent() {
          return self.transparent
        },
        set transparent(value) {
          self.transparent = value
        },
        get backgroundColor() {
          return self.backgroundColor
        },
        set backgroundColor(value) {
          self.backgroundColor = value
        },
        get borderRadius() {
          return self.borderRadius
        },
        set borderRadius(value) {
          self.borderRadius = value
        },
        get padding() {
          return self.padding
        },
        set padding(value) {
          self.padding = value
        },
        get flexDirection() {
          return self.flexDirection
        },
        set flexDirection(value) {
          self.flexDirection = value
        },
        get justifyContent() {
          return self.justifyContent
        },
        set justifyContent(value) {
          self.justifyContent = value
        },
        get alignItems() {
          return self.alignItems
        },
        set alignItems(value) {
          self.alignItems = value
        },
        get alignContent() {
          return self.alignContent
        },
        set alignContent(value) {
          self.alignContent = value
        },
        get flexWrap() {
          return self.flexWrap
        },
        set flexWrap(value) {
          self.flexWrap = value
        },
        get gap() {
          return self.gap
        },
        set gap(value) {
          self.gap = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function applyPivot(pivot, geometry, width, height) {
  const halfWidth = width / 2
  const halfHeight = height / 2
  switch (pivot) {
    case 'top-left':
      geometry.translate(halfWidth, -halfHeight, 0)
      break
    case 'top-center':
      geometry.translate(0, -halfHeight, 0)
      break
    case 'top-right':
      geometry.translate(-halfWidth, -halfHeight, 0)
      break
    case 'center-left':
      geometry.translate(halfWidth, 0, 0)
      break
    case 'center-right':
      geometry.translate(-halfWidth, 0, 0)
      break
    case 'bottom-left':
      geometry.translate(halfWidth, halfHeight, 0)
      break
    case 'bottom-center':
      geometry.translate(0, halfHeight, 0)
      break
    case 'bottom-right':
      geometry.translate(-halfWidth, halfHeight, 0)
      break
    case 'center':
    default:
      break
  }
}

function isBillboard(value) {
  return billboards.includes(value)
}

function isPivot(value) {
  return pivots.includes(value)
}

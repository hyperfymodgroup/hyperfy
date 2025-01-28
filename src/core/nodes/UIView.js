import * as THREE from '../extras/three'
import { isNumber } from 'lodash-es'

import { Node } from './Node'
import { fillRoundRect } from '../extras/fillRoundRect'
import { AlignItems, AlignContent, FlexDirection, JustifyContent, Display, FlexWrap } from '../extras/yoga'

const defaults = {
  display: 'flex',
  width: null,
  height: null,
  backgroundColor: null,
  borderRadius: 0,
  margin: 0,
  padding: 0,
  flexDirection: 'column',
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  alignContent: 'flex-start',
  flexBasis: null,
  flexGrow: 0,
  flexShrink: 1,
  flexWrap: 'no-wrap',
  gap: 0,
}

export class UIView extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'uiview'

    this.display = data.display === undefined ? defaults.display : data.display
    this.width = data.width === undefined ? defaults.width : data.width
    this.height = data.height === undefined ? defaults.height : data.height
    this.backgroundColor = data.backgroundColor === undefined ? defaults.backgroundColor : data.backgroundColor
    this.borderRadius = data.borderRadius === undefined ? defaults.borderRadius : data.borderRadius
    this.margin = data.margin === undefined ? defaults.margin : data.margin
    this.padding = data.padding === undefined ? defaults.padding : data.padding
    this.flexDirection = data.flexDirection === undefined ? defaults.flexDirection : data.flexDirection
    this.justifyContent = data.justifyContent === undefined ? defaults.justifyContent : data.justifyContent
    this.alignItems = data.alignItems === undefined ? defaults.alignItems : data.alignItems
    this.alignContent = data.alignContent === undefined ? defaults.alignContent : data.alignContent
    this.flexBasis = data.flexBasis === undefined ? defaults.flexBasis : data.flexBasis
    this.flexGrow = data.flexGrow === undefined ? defaults.flexGrow : data.flexGrow
    this.flexShrink = data.flexShrink === undefined ? defaults.flexShrink : data.flexShrink
    this.flexWrap = data.flexWrap === undefined ? defaults.flexWrap : data.flexWrap
    this.gap = data.gap === undefined ? defaults.gap : data.gap
  }

  draw(ctx, offsetLeft, offsetTop) {
    if (this._display === 'none') return
    this.box = {}
    const left = offsetLeft + this.yogaNode.getComputedLeft()
    const top = offsetTop + this.yogaNode.getComputedTop()
    const width = this.yogaNode.getComputedWidth()
    const height = this.yogaNode.getComputedHeight()
    if (this._backgroundColor) {
      ctx.fillStyle = this._backgroundColor
      if (this.borderRadius) {
        fillRoundRect(ctx, left, top, width, height, this._borderRadius * this.ui._res)
      } else {
        ctx.fillRect(left, top, width, height)
      }
    }
    this.box = { left, top, width, height }
    this.children.forEach(child => child.draw(ctx, left, top))
  }

  mount() {
    if (this.ctx.world.network.isServer) return
    this.ui = this.parent?.ui
    if (!this.ui) return console.error('uiview: must be child of ui node')
    this.yogaNode = Yoga.Node.create()
    this.yogaNode.setDisplay(Display[this._display])
    this.yogaNode.setWidth(this._width === null ? undefined : this._width * this.ui._res)
    this.yogaNode.setHeight(this._height === null ? undefined : this._height * this.ui._res)
    this.yogaNode.setMargin(Yoga.EDGE_ALL, this._margin * this.ui._res)
    this.yogaNode.setPadding(Yoga.EDGE_ALL, this._padding * this.ui._res)
    this.yogaNode.setFlexDirection(FlexDirection[this._flexDirection])
    this.yogaNode.setJustifyContent(JustifyContent[this._justifyContent])
    this.yogaNode.setAlignItems(AlignItems[this._alignItems])
    this.yogaNode.setAlignContent(AlignContent[this._alignContent])
    this.yogaNode.setFlexBasis(this._flexBasis === null ? 'auto' : this._flexBasis)
    this.yogaNode.setFlexGrow(this._flexGrow)
    this.yogaNode.setFlexShrink(this._flexShrink)
    this.yogaNode.setFlexWrap(FlexWrap[this._flexWrap])
    this.yogaNode.setGap(Yoga.GUTTER_ALL, this._gap)
    this.parent.yogaNode.insertChild(this.yogaNode, this.parent.yogaNode.getChildCount())
  }

  commit(didMove) {
    // ...
  }

  unmount() {
    if (this.ctx.world.network.isServer) return
    if (this.yogaNode) {
      this.parent.yogaNode?.removeChild(this.yogaNode)
      this.yogaNode.free()
      this.yogaNode = null
      this.box = null
    }
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._display = source._display
    this._width = source._width
    this._height = source._height
    this._backgroundColor = source._backgroundColor
    this._borderRadius = source._borderRadius
    this._margin = source._margin
    this._padding = source._padding
    this._flexDirection = source._flexDirection
    this._justifyContent = source._justifyContent
    this._alignItems = source._alignItems
    this._alignContent = source._alignContent
    this._flexBasis = source._flexBasis
    this._flexGrow = source._flexGrow
    this._flexShrink = source._flexShrink
    this._flexWrap = source._flexWrap
    this._gap = source._gap
    return this
  }

  get display() {
    return this._display
  }

  set display(value) {
    this._display = value || defaults.display
    this.yogaNode?.setDisplay(Display[this._display])
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get width() {
    return this._width
  }

  set width(value) {
    this._width = isNumber(value) ? value : defaults.width
    this.yogaNode?.setWidth(this._width === null ? undefined : this._width * this.ui._res)
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get height() {
    return this._height
  }

  set height(value) {
    this._height = isNumber(value) ? value : defaults.height
    this.yogaNode?.setHeight(this._height === null ? undefined : this._height * this.ui._res)
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get backgroundColor() {
    return this._backgroundColor
  }

  set backgroundColor(value) {
    this._backgroundColor = value || defaults.backgroundColor
    this.ui?.redraw()
  }

  get borderRadius() {
    return this._borderRadius
  }

  set borderRadius(value) {
    this._borderRadius = isNumber(value) ? value : defaults.borderRadius
    this.ui?.redraw()
  }

  get margin() {
    return this._margin
  }

  set margin(value) {
    this._margin = isNumber(value) ? value : defaults.margin
    this.yogaNode?.setMargin(Yoga.EDGE_ALL, this._margin * this.ui._res)
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get padding() {
    return this._padding
  }

  set padding(value) {
    this._padding = isNumber(value) ? value : defaults.padding
    this.yogaNode?.setPadding(Yoga.EDGE_ALL, this._padding * this.ui._res)
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get flexDirection() {
    return this._flexDirection
  }

  set flexDirection(value) {
    this._flexDirection = value || defaults.flexDirection
    this.yogaNode?.setFlexDirection(FlexDirection[this._flexDirection])
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get justifyContent() {
    return this._justifyContent
  }

  set justifyContent(value) {
    this._justifyContent = value || defaults.justifyContent
    this.yogaNode?.setJustifyContent(JustifyContent[this._justifyContent])
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get alignItems() {
    return this._alignItems
  }

  set alignItems(value) {
    this._alignItems = value || defaults.alignItems
    this.yogaNode?.setAlignItems(AlignItems[this._alignItems])
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get alignContent() {
    return this._alignContent
  }

  set alignContent(value) {
    this._alignContent = value || defaults.alignContent
    this.yogaNode?.setAlignContent(AlignContent[this._alignContent])
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get flexBasis() {
    return this._flexBasis
  }

  set flexBasis(value) {
    this._flexBasis = value || defaults.flexBasis
    this.yogaNode?.setFlexBasis(this._flexBasis === null ? 'auto' : this._flexBasis)
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get flexGrow() {
    return this._flexGrow
  }

  set flexGrow(value) {
    this._flexGrow = value || defaults.flexGrow
    this.yogaNode?.setFlexGrow(this._flexGrow)
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get flexShrink() {
    return this._flexShrink
  }

  set flexShrink(value) {
    this._flexShrink = value || defaults.flexShrink
    this.yogaNode?.setFlexShrink(this._flexShrink)
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get flexWrap() {
    return this.flexWrap
  }

  set flexWrap(value) {
    this._flexWrap = value || defaults.flexWrap
    this.yogaNode?.setFlexWrap(FlexWrap[this._flexWrap])
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get gap() {
    return this._gap
  }

  set gap(value) {
    this._gap = value || defaults.gap
    this.yogaNode?.setGap(Yoga.GUTTER_ALL, this._gap)
    // this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  getProxy() {
    var self = this
    if (!this.proxy) {
      let proxy = {
        get display() {
          return self.display
        },
        set display(value) {
          self.display = value
        },
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
        get margin() {
          return self.margin
        },
        set margin(value) {
          self.margin = value
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
        get flexBasis() {
          return self.flexBasis
        },
        set flexBasis(value) {
          self.flexBasis = value
        },
        get flexGrow() {
          return self.flexGrow
        },
        set flexGrow(value) {
          self.flexGrow = value
        },
        get flexShrink() {
          return self.flexShrink
        },
        set flexShrink(value) {
          self.flexShrink = value
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

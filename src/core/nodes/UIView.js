import * as THREE from '../extras/three'
import { isNumber, isString } from 'lodash-es'

import { Node } from './Node'
import { fillRoundRect } from '../extras/fillRoundRect'
import {
  AlignItems,
  AlignContent,
  FlexDirection,
  JustifyContent,
  Display,
  FlexWrap,
  isDisplay,
  isFlexDirection,
  isJustifyContent,
  isAlignItem,
  isAlignContent,
  isFlexWrap,
} from '../extras/yoga'

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
  flexWrap: 'no-wrap',
  gap: 0,
  flexBasis: 'auto',
  flexGrow: 0,
  flexShrink: 1,
}

export class UIView extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'uiview'

    this.display = data.display
    this.width = data.width
    this.height = data.height
    this.backgroundColor = data.backgroundColor
    this.borderRadius = data.borderRadius
    this.margin = data.margin
    this.padding = data.padding
    this.flexDirection = data.flexDirection
    this.justifyContent = data.justifyContent
    this.alignItems = data.alignItems
    this.alignContent = data.alignContent
    this.flexWrap = data.flexWrap
    this.gap = data.gap
    this.flexBasis = data.flexBasis
    this.flexGrow = data.flexGrow
    this.flexShrink = data.flexShrink
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
    this.yogaNode.setFlexWrap(FlexWrap[this._flexWrap])
    this.yogaNode.setGap(Yoga.GUTTER_ALL, this._gap)
    this.yogaNode.setFlexBasis(this._flexBasis)
    this.yogaNode.setFlexGrow(this._flexGrow)
    this.yogaNode.setFlexShrink(this._flexShrink)
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

  set display(value = defaults.display) {
    if (!isDisplay(value)) {
      throw new Error(`[uiview] display invalid: ${value}`)
    }
    if (this._display === value) return
    this._display = value
    this.yogaNode?.setDisplay(Display[this._display])
    this.ui?.redraw()
  }

  get width() {
    return this._width
  }

  set width(value = defaults.width) {
    if (value !== null && !isNumber(value)) {
      throw new Error(`[uiview] width not a number`)
    }
    if (this._width === value) return
    this._width = value
    this.yogaNode?.setWidth(this._width === null ? undefined : this._width * this.ui._res)
    this.ui?.redraw()
  }

  get height() {
    return this._height
  }

  set height(value = defaults.height) {
    if (value !== null && !isNumber(value)) {
      throw new Error(`[uiview] height not a number`)
    }
    if (this._height === value) return
    this._height = value
    this.yogaNode?.setHeight(this._height === null ? undefined : this._height * this.ui._res)
    this.ui?.redraw()
  }

  get backgroundColor() {
    return this._backgroundColor
  }

  set backgroundColor(value = defaults.backgroundColor) {
    if (value !== null && !isString(value)) {
      throw new Error(`[uiview] backgroundColor not a string`)
    }
    if (this._backgroundColor === value) return
    this._backgroundColor = value
    this.ui?.redraw()
  }

  get borderRadius() {
    return this._borderRadius
  }

  set borderRadius(value = defaults.borderRadius) {
    if (!isNumber(value)) {
      throw new Error(`[uiview] borderRadius not a number`)
    }
    if (this._borderRadius === value) return
    this._borderRadius = value
    this.ui?.redraw()
  }

  get margin() {
    return this._margin
  }

  set margin(value = defaults.margin) {
    if (!isNumber(value)) {
      throw new Error(`[uiview] margin not a number`)
    }
    if (this._margin === value) return
    this._margin = value
    this.yogaNode?.setMargin(Yoga.EDGE_ALL, this._margin * this.ui._res)
    this.ui?.redraw()
  }

  get padding() {
    return this._padding
  }

  set padding(value = defaults.padding) {
    if (!isNumber(value)) {
      throw new Error(`[uiview] padding not a number`)
    }
    if (this._padding === value) rturn
    this._padding = value
    this.yogaNode?.setPadding(Yoga.EDGE_ALL, this._padding * this.ui._res)
    this.ui?.redraw()
  }

  get flexDirection() {
    return this._flexDirection
  }

  set flexDirection(value = defaults.flexDirection) {
    if (!isFlexDirection(value)) {
      throw new Error(`[uiview] flexDirection invalid: ${value}`)
    }
    if (this._flexDirection === value) return
    this._flexDirection = value
    this.yogaNode?.setFlexDirection(FlexDirection[this._flexDirection])
    this.ui?.redraw()
  }

  get justifyContent() {
    return this._justifyContent
  }

  set justifyContent(value = defaults.justifyContent) {
    if (!isJustifyContent(value)) {
      throw new Error(`[uiview] justifyContent invalid: ${value}`)
    }
    if (this._justifyContent === value) return
    this._justifyContent = value
    this.yogaNode?.setJustifyContent(JustifyContent[this._justifyContent])
    this.ui?.redraw()
  }

  get alignItems() {
    return this._alignItems
  }

  set alignItems(value = defaults.alignItems) {
    if (!isAlignItem(value)) {
      throw new Error(`[uiview] alignItems invalid: ${value}`)
    }
    if (this._alignItems === value) return
    this._alignItems = value
    this.yogaNode?.setAlignItems(AlignItems[this._alignItems])
    this.ui?.redraw()
  }

  get alignContent() {
    return this._alignContent
  }

  set alignContent(value = defaults.alignContent) {
    if (!isAlignContent(value)) {
      throw new Error(`[uiview] alignContent invalid: ${value}`)
    }
    if (this._alignContent === value) return
    this._alignContent = value
    this.yogaNode?.setAlignContent(AlignContent[this._alignContent])
    this.ui?.redraw()
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
    this.ui?.redraw()
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
    this.ui?.redraw()
  }

  get flexBasis() {
    return this._flexBasis
  }

  set flexBasis(value = defaults.flexBasis) {
    if (!isNumber(value) && !isString(value)) {
      throw new Error(`[uiview] flexBasis invalid`)
    }
    if (this._flexBasis === value) return
    this._flexBasis = value
    this.yogaNode?.setFlexBasis(this._flexBasis)
    this.ui?.redraw()
  }

  get flexGrow() {
    return this._flexGrow
  }

  set flexGrow(value = defaults.flexGrow) {
    if (!isNumber(value)) {
      throw new Error(`[uiview] flexGrow not a number`)
    }
    if (this._flexGrow === value) return
    this._flexGrow = value
    this.yogaNode?.setFlexGrow(this._flexGrow)
    this.ui?.redraw()
  }

  get flexShrink() {
    return this._flexShrink
  }

  set flexShrink(value = defaults.flexShrink) {
    if (!isNumber(value)) {
      throw new Error(`[uiview] flexShrink not a number`)
    }
    if (this._flexShrink === value) return
    this._flexShrink = value
    this.yogaNode?.setFlexShrink(this._flexShrink)
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
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

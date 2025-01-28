import { isNumber } from 'lodash-es'

import { Node } from './Node'
import { Display } from '../extras/yoga'

const defaults = {
  display: 'flex',
  value: '',
  fontSize: 16,
  color: '#000000',
  lineHeight: 1.2,
  textAlign: 'left',
  fontFamily: 'Rubik',
  fontWeight: 'normal',
}

let offscreenContext
const getOffscreenContext = () => {
  if (!offscreenContext) {
    const offscreenCanvas = document.createElement('canvas')
    offscreenContext = offscreenCanvas.getContext('2d')
  }
  return offscreenContext
}

export class UIText extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'uitext'

    this.display = data.display === undefined ? defaults.display : data.display
    this.value = data.value === undefined ? defaults.value : data.value
    this.fontSize = data.fontSize === undefined ? defaults.fontSize : data.fontSize
    this.color = data.color === undefined ? defaults.color : data.color
    this.lineHeight = data.lineHeight === undefined ? defaults.lineHeight : data.lineHeight
    this.textAlign = data.textAlign === undefined ? defaults.textAlign : data.textAlign
    this.fontFamily = data.fontFamily === undefined ? defaults.fontFamily : data.fontFamily
    this.fontWeight = data.fontWeight === undefined ? defaults.fontWeight : data.fontWeight
  }

  draw(ctx, offsetLeft, offsetTop) {
    if (this._display === 'none') return
    const left = offsetLeft + this.yogaNode.getComputedLeft()
    const top = offsetTop + this.yogaNode.getComputedTop()
    const width = this.yogaNode.getComputedWidth()
    const height = this.yogaNode.getComputedHeight()
    ctx.font = `${this._fontWeight} ${this._fontSize * this.ui._res}px ${this._fontFamily}`
    ctx.textBaseline = 'alphabetic'
    // ctx.textBaseline = 'top'
    ctx.textAlign = this._textAlign
    ctx.fillStyle = this._color
    ctx.fillStyle = this._color
    const paddingLeft = this.yogaNode.getComputedPadding(Yoga.EDGE_LEFT)
    const paddingTop = this.yogaNode.getComputedPadding(Yoga.EDGE_TOP)
    const paddingRight = this.yogaNode.getComputedPadding(Yoga.EDGE_RIGHT)
    const innerWidth = width - paddingLeft - paddingRight
    let innerX = left + paddingLeft
    if (this._textAlign === 'center') {
      innerX = left + width / 2
    } else if (this._textAlign === 'right') {
      innerX = left + width - paddingRight
    }
    const innerY = top + paddingTop
    const lines = wrapText(ctx, this._value, innerWidth)
    const metrics = ctx.measureText('Mg')
    const ascent = metrics.actualBoundingBoxAscent
    const descent = metrics.actualBoundingBoxDescent
    const naturalLineHeight = ascent + descent
    const baselineGap = naturalLineHeight * this._lineHeight
    let currentBaselineY = innerY + ascent // first line's baseline
    lines.forEach((line, i) => {
      ctx.fillText(line, innerX, currentBaselineY)
      currentBaselineY += baselineGap
    })
    this.box = { left, top, width, height }
  }

  mount() {
    if (this.ctx.world.network.isServer) return
    this.ui = this.parent?.ui
    if (!this.ui) return console.error('uitext: must be child of ui node')
    this.yogaNode = Yoga.Node.create()
    this.yogaNode.setMeasureFunc(this.measureTextFunc())
    this.yogaNode.setDisplay(Display[this._display])
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
    this._value = source._value
    this._fontSize = source._fontSize
    this._color = source._color
    this._lineHeight = source._lineHeight
    return this
  }

  measureTextFunc() {
    const ctx = getOffscreenContext()
    return (width, widthMode, height, heightMode) => {
      ctx.font = `${this._fontWeight} ${this._fontSize * this.ui._res}px ${this._fontFamily}`
      ctx.textBaseline = 'alphabetic'
      // ctx.textBaseline = 'top'
      // We'll use a dummy string to measure ascenders+descenders.
      // ("Mg" has both tall ascender & long descender in many fonts)
      const metrics = ctx.measureText('Mg')
      const ascent = metrics.actualBoundingBoxAscent
      const descent = metrics.actualBoundingBoxDescent
      const naturalLineHeight = ascent + descent
      // The distance from one line's baseline to the next line's baseline
      // can be bigger or smaller than the natural lineHeight if desired.
      const baselineGap = naturalLineHeight * this._lineHeight
      // Figure out how many lines we need, based on the available width.
      let lines
      if (widthMode === Yoga.MEASURE_MODE_EXACTLY || widthMode === Yoga.MEASURE_MODE_AT_MOST) {
        lines = wrapText(ctx, this._value, width)
      } else {
        lines = [this._value]
      }
      // For the measured width, find the longest line.
      let measuredWidth = 0
      for (const line of lines) {
        const w = ctx.measureText(line).width
        if (w > measuredWidth) {
          measuredWidth = w
        }
      }
      if (widthMode === Yoga.MEASURE_MODE_AT_MOST) {
        measuredWidth = Math.min(measuredWidth, width)
      }
      // Height logic:
      //  - If we have at least one line, the first line's full bounding box is: (ascent+descent).
      //  - For each additional line, add the "baselineGap."
      //    i.e. totalHeight = naturalLineHeight + (lines.length - 1)* baselineGap
      let measuredHeight = 0
      if (lines.length > 0) {
        measuredHeight = naturalLineHeight + (lines.length - 1) * baselineGap
      }

      return { width: measuredWidth, height: measuredHeight }
    }
  }

  get display() {
    return this._display
  }

  set display(value) {
    if (this._display === value) return
    this._display = value || defaults.display
    this.yogaNode?.setDisplay(Display[this._display])
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get value() {
    return this._value
  }

  set value(val) {
    if (this._value === val) return
    this._value = val || defaults.value
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get fontSize() {
    return this._fontSize
  }

  set fontSize(value) {
    if (this._fontSize === value) return
    this._fontSize = isNumber(value) ? value : defaults.fontSize
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get color() {
    return this._color
  }

  set color(value) {
    if (this._color === value) return
    this._color = value || defaults.color
    this.ui?.redraw()
  }

  get lineHeight() {
    return this._lineHeight
  }

  set lineHeight(value) {
    if (this._lineHeight === value) return
    this._lineHeight = isNumber(value) ? value : defaults.lineHeight
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get textAlign() {
    return this._textAlign
  }

  set textAlign(value) {
    if (this._textAlign === value) return
    this._textAlign = value || defaults.textAlign
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get fontFamily() {
    return this._fontFamily
  }

  set fontFamily(value) {
    if (this._fontFamily === value) return
    this._fontFamily = value || defaults.fontFamily
    this.yogaNode?.markDirty()
    this.ui?.redraw()
  }

  get fontWeight() {
    return this._fontWeight
  }

  set fontWeight(value) {
    if (this._fontWeight === value) return
    this._fontWeight = value || defaults.fontWeight
    this.yogaNode?.markDirty()
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
        get value() {
          return self.value
        },
        set value(value) {
          self.value = value
        },
        get fontSize() {
          return self.fontSize
        },
        set fontSize(value) {
          self.fontSize = value
        },
        get color() {
          return self.color
        },
        set color(value) {
          self.color = value
        },
        get lineHeight() {
          return self.lineHeight
        },
        set lineHeight(value) {
          self.lineHeight = value
        },
        get textAlign() {
          return self.textAlign
        },
        set textAlign(value) {
          self.textAlign = value
        },
        get fontFamily() {
          return self.fontFamily
        },
        set fontFamily(value) {
          self.fontFamily = value
        },
        get fontWeight() {
          return self.fontWeight
        },
        set fontWeight(value) {
          self.fontWeight = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let currentLine = words[0]

  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const width = ctx.measureText(currentLine + ' ' + word).width
    if (width <= maxWidth) {
      currentLine += ' ' + word
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }
  lines.push(currentLine)

  return lines
}

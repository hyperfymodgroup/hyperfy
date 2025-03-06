import { getRef } from '../nodes/Node'
import { clamp, uuid } from '../utils'
import * as THREE from './three'

const HEALTH_MAX = 100

export function createPlayerProxy(player) {
  const world = player.world
  const position = new THREE.Vector3()
  const rotation = new THREE.Euler()
  const quaternion = new THREE.Quaternion()
  let activeEffectConfig = null
  return {
    get networkId() {
      return player.data.owner
    },
    get id() {
      return player.data.id
    },
    get userId() {
      return player.data.userId
    },
    get name() {
      return player.data.name
    },
    get health() {
      return player.data.health
    },
    get position() {
      return position.copy(player.base.position)
    },
    get rotation() {
      return rotation.copy(player.base.rotation)
    },
    get quaternion() {
      return quaternion.copy(player.base.quaternion)
    },
    teleport(position, rotationY) {
      if (player.data.owner === world.network.id) {
        // if player is local we can set directly
        world.network.enqueue('onPlayerTeleport', { position: position.toArray(), rotationY })
      } else if (world.network.isClient) {
        // if we're a client we need to notify server
        world.network.send('playerTeleport', { networkId: player.data.owner, position: position.toArray(), rotationY })
      } else {
        // if we're the server we need to notify the player
        world.network.sendTo(player.data.owner, 'playerTeleport', { position: position.toArray(), rotationY })
      }
    },
    getBoneTransform(boneName) {
      return player.avatar?.getBoneTransform?.(boneName)
    },
    setSessionAvatar(url) {
      const avatar = url
      if (player.data.owner === world.network.id) {
        // if player is local we can set directly
        world.network.enqueue('onPlayerSessionAvatar', { avatar })
      } else if (world.network.isClient) {
        // if we're a client we need to notify server
        world.network.send('playerSessionAvatar', { networkId: player.data.owner, avatar })
      } else {
        // if we're the server we need to notify the player
        world.network.sendTo(player.data.owner, 'playerSessionAvatar', { avatar })
      }
    },
    damage(amount) {
      const health = clamp(player.data.health - amount, 0, HEALTH_MAX)
      if (player.data.health === health) return
      player.modify({ health })
      if (world.network.isServer) {
        world.network.send('entityModified', { id: player.data.id, health })
      }
    },
    heal(amount) {
      const health = clamp(player.data.health + amount, 0, HEALTH_MAX)
      if (player.data.health === health) return
      player.modify({ health })
      if (world.network.isServer) {
        world.network.send('entityModified', { id: player.data.id, health })
      }
    },
    hasEffect() {
      return !!player.data.effect
    },
    applyEffect(opts) {
      if (!opts) return
      const effect = {}
      // effect.id = uuid()
      if (opts.anchor) effect.anchorId = opts.anchor.anchorId
      if (opts.emote) effect.emote = opts.emote
      if (opts.snare) effect.snare = opts.snare
      if (opts.freeze) effect.freeze = opts.freeze
      if (opts.turn) effect.turn = opts.turn
      if (opts.duration) effect.duration = opts.duration
      if (opts.cancellable) {
        effect.cancellable = opts.cancellable
        delete effect.freeze // overrides
      }
      const config = {
        effect,
        onEnd: () => {
          if (activeEffectConfig !== config) return
          activeEffectConfig = null
          player.setEffect(null)
          opts.onEnd?.()
        },
      }
      activeEffectConfig = config
      player.setEffect(config.effect, config.onEnd)
      if (world.network.isServer) {
        world.network.send('entityModified', { id: player.data.id, ef: config.effect })
      }
      return {
        get active() {
          return activeEffectConfig === config
        },
        cancel: () => {
          config.onEnd()
        },
      }
    },
    cancelEffect() {
      activeEffectConfig?.onEnd()
    },
  }
}

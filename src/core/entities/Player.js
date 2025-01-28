import { PlayerLocal } from '../extras/PlayerLocal'
import { PlayerRemote } from '../extras/PlayerRemote'

import { Entity } from './Entity'

export class Player extends Entity {
  constructor(world, data, local) {
    super(world, data, local)
    this.isPlayer = true
    if (data.owner === this.world.network.id) {
      this.player = new PlayerLocal(this)
    } else {
      this.player = new PlayerRemote(this)
    }
  }

  modify(data) {
    this.player.modify(data)
  }

  destroy(local) {
    this.player?.destroy()
    this.player = null
    super.destroy(local)
  }
}

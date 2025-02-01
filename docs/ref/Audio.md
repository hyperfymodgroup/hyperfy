# Audio

Represents a single audio clip that can be played in the world.

## Properties

### `audio.src`: String

An absolute url to an audio file, or an asset url from an audio file embedded in the app.

Currently only `mp3` files are supported.

### `audio.volume`: Number

The audio volume. Defaults to `1`.

### `audio.loop`: Boolean

Whether the audio should loop. Defaults to `false`.

### `audio.group`: Enum('music', 'sfx')

The type of audio being played. Choose `music` for ambient sounds or live event music etc. Choose `sfx` for short sound effects that happen throughout the world.

Users are able to adjust the global audio volume for these groups independently.

Defaults to `music`.

### `audio.spatial`: Boolean

Whether music should be played spatially and heard by people nearby. Defaults to `true`.

### `audio.distanceModel`: Enum('linear', 'inverse', 'expontential')

When spatial is enabled, the distance model to use. Defaults to `inverse`.

### `audio.refDistance`: Number

When spatial is enabled, the reference distance to use. Defaults to `1`.

### `audio.maxDistance`: Number

When spatial is enabled, the max distance to use. Defaults to `40`.

### `audio.rolloffFactor`: Number

When spatial is enabled, the rolloff factor to use. Defaults to `3`.

### `audio.coneInnerAngle`: Number

When spatial is enabled, the cone inner angle to use. Defaults to `360`.

### `audio.coneOuterAngle`: Number

When spatial is enabled, the cone inner angle to use. Defaults to `360`.

### `audio.coneOuterGain`: Number

When spatial is enabled, the cone inner angle to use. Defaults to `0`.

### `audio.currentTime`: Number

Gets and sets the current playback time, in seconds.

### `audio.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

## Methods

### `audio.play()`

Plays the audio. 

NOTE: If no click gesture has ever happened within the world, playback won't begin until it has.

### `audio.pause()`

Pauses the audio, retaining the current time.

### `audio.stop()`

Stops the audio and resets the time back to zero.

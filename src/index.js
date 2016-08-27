const AGILITY = 700
const MAX_SPEED = 200
const DRAG = 0.05
const DRAG_FACTOR = 1 - DRAG

const BALL_SCALE = 0.35

var player
var ball
var pitch

window.onload = function() {
  var game = new Phaser.Game(800, 600, Phaser.AUTO, 'phaser-game', {
    preload: preload,
    create: create,
    update: update,
    render: render
  })

  function preload() {
    game.load.image('logo', 'phaser.png')
    game.load.image('pitch', 'grass.jpg')
    game.load.atlas('player', 'player/player.png', 'player/player.json')
    game.load.atlas('ball', 'ball/ball.png', 'ball/ball.json')
  }

  function create() {
    //  This will run in Canvas mode, so let's gain a little speed and display
    game.renderer.clearBeforeRender = false
    game.renderer.roundPixels = true

    //  We need arcade physics
    game.physics.startSystem(Phaser.Physics.ARCADE)

    game.world.setBounds(0, 0, 2000, 2000)
    pitch = game.add.tileSprite(0, 0, 800, 600, 'pitch')
    pitch.fixedToCamera = true

    ball = game.add.sprite(game.world.centerX + 50, game.world.centerY + 200, 'ball')
    ball.animations.add('roll', Phaser.Animation.generateFrameNames('ball-', 0, 7, '', 2), 20, true)
    ball.animations.play('roll')
    ball.anchor.setTo(0.5, 0.5)
    ball.scale.setMagnitude(BALL_SCALE)
    game.physics.enable(ball, Phaser.Physics.ARCADE)
    ball.body.collideWorldBounds = true
    ball.body.drag.setTo(75, 75)
    ball.body.bounce.setTo(1, 1)
    ball.body.mass = 40
    ball.altitude = 0
    ball.verticalSpeed = 0

    player = game.add.sprite(game.world.centerX, game.world.centerY, 'player')
    player.animations.add('run', Phaser.Animation.generateFrameNames('running-', 0, 11, '', 2), 10, true)
    player.animations.add('stand', ['standing'], 10, true)
    player.animations.play('stand')
    player.anchor = new Phaser.Point(0.6, 0.4)
    player.scale = new Phaser.Point(1, 1)
    //  and its physics settings
    game.physics.enable(player, Phaser.Physics.ARCADE)
    player.body.collideWorldBounds = true
    player.body.maxVelocity.set(MAX_SPEED)
    player.body.friction.setTo(10, 10)
    player.body.bounce.setTo(0.01, 0.01)
    player.body.mass = 70

    game.camera.follow(player)
    game.camera.deadzone = new Phaser.Rectangle(350, 250, 100, 100)
      //  Game input
    addSignal(player)
    registerKeyboard(game, player, ball)
    registerHandlers(game, player, ball)
  }

  function update() {
    let accel = player.body.acceleration.getMagnitude()
    player.body.acceleration.setMagnitude(accel > (AGILITY / 100) ? accel * 0.9 : 0)

    player.body.velocity.set(player.body.velocity.x * DRAG_FACTOR, player.body.velocity.y * DRAG_FACTOR)
    if (player.action) player.animations.play(player.action)
    else if (player.body.speed > MAX_SPEED / 10) player.animations.play('run')
    else player.animations.play('stand')

    if (player.body.speed > MAX_SPEED / 40) {
      var idealTurn = Phaser.Math.wrapAngle(player.body.velocity.angle(new Phaser.Point(0, 1)) - player.rotation, 1)
      var actualTurn = Math.sign(idealTurn) * Math.min(Math.abs(idealTurn), 0.2)
      player.rotation = Phaser.Math.normalizeAngle(player.rotation + actualTurn)
    }

    var speedDiff = Phaser.Point.subtract(player.body.velocity, ball.body.velocity).getMagnitude()
    var offset1 = new Phaser.Point(-15, 0).rotate(0, 0, player.rotation)
    var offset2 = new Phaser.Point(-40, 0).rotate(0, 0, player.rotation)
    player.ballDist = game.physics.arcade.distanceBetween(Phaser.Point.add(player.body.center, offset1), ball.body.center)
    if (speedDiff > 300 || player.action) game.physics.arcade.collide(player, ball)
    else {
      if (player.ballDist < 20) {
        if (player.kick) {
          ball.body.velocity = player.body.acceleration.clone().setMagnitude(player.kick)
          ball.verticalSpeed = player.kick / 2
          player.signal.dispatch({ kick: 0 })
          player.signal.dispatch({ cancelKickCancel: true })
        } else {
          var target = Phaser.Point.add(player.body.center, offset2)
          var playerSpeed = player.body.speed
          var minKick = (player.ballDist < 5) ? 0 : 25
          var kickVector = Phaser.Point.subtract(target, ball.body.center).setMagnitude(Math.max((playerSpeed + player.ballDist) * 1.05, minKick))
          ball.body.velocity.setTo(kickVector.x, kickVector.y)
          player.lastTouch = new Date().getTime()
        }
      }
    }

    ball.verticalSpeed -= 0.15
    ball.altitude += ball.verticalSpeed
    if (ball.altitude < 0) {
      ball.altitude = 0
      ball.verticalSpeed = -0.5 * ball.verticalSpeed
    }
    ball.scale.setMagnitude((1 + (ball.altitude / 100)) * BALL_SCALE)
    ball.animations.getAnimation('roll').speed = ball.body.speed / 5
    if (ball.body.speed > 5) {
      ball.animations.play('roll')
      ball.rotation = ball.body.velocity.angle(new Phaser.Point(0, 1))
    }
    else ball.animations.stop('roll')

    pitch.tilePosition.x = -game.camera.x
    pitch.tilePosition.y = -game.camera.y
  }

  function render() {}
}

function addSignal(player) {
  player.signal = new Phaser.Signal()
}

function registerKeyboard(game, player, ball) {
  var cursors = game.input.keyboard.createCursorKeys()
  var space = game.input.keyboard.addKey(32)
  var spaceTimer = 0

  Object.keys(cursors).forEach(key => {
    cursors[key].onHoldCallback = () => {
      player.signal.dispatch({ direction: key })
    }
  })
  space.onDown.add(() => {
    spaceTimer = new Date().getTime()
  })
  space.onUp.add(() => {
    if (new Date().getTime() - player.lastTouch < 1000 || player.ballDist < 40) {
      player.signal.dispatch({
        kick: Math.min(Math.max(new Date().getTime() - spaceTimer, 500), 1500)
      })
      player.kickCancel = setInterval(() => player.signal.dispatch({ kick: -1 }), 1000)
    } else {
      player.signal.dispatch({ slide: true })
    }
  })
}

function registerHandlers(game, player, ball) {
  player.signal.add((details = {}) => {
    if (!player.action) {
      switch (details.direction) {
        case 'up':
          return player.body.acceleration.y = -AGILITY
        case 'down':
          return player.body.acceleration.y = AGILITY
        case 'left':
          return player.body.acceleration.x = -AGILITY
        case 'right':
          return player.body.acceleration.x = AGILITY
        default:
      }
      if (typeof details.kick === 'number') {
        player.kick = details.kick
        if (details.kick) {
          player.action = 'kick'
          return setTimeout(() => {
            if (player.action === 'kick') player.action = null
          }, 1000)
        }
      }
      if (details.slide) {
        player.action = 'slide'
        player.body.velocity.setMagnitude(MAX_SPEED * 1.25)
        return setTimeout(() => {
          if (player.action === 'slide') player.action = null
        }, 1000)
      }
    }

    if (details.cancelKickCancel) {
      return clearInterval(player.kickCancel)
    }
  })
}

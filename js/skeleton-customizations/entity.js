import RL from '../skeleton/rl.js';
import ROT from '../rotjs/rot.js';

// Defaults
RL.Entity.prototype.bgColor = false;
RL.Entity.prototype.charStrokeColor = false;
RL.Entity.prototype.charStrokeWidth = 0;
RL.Entity.prototype.maxLife = 1;
RL.Entity.prototype.life = 1;
RL.Entity.prototype.damage = 1;
RL.Entity.prototype.fovRadius = 3;
RL.Entity.prototype.fireImmune = false;
RL.Entity.prototype.acidImmune = false;
RL.Entity.prototype.stumbleChance = 0.25;
RL.Entity.prototype.movement = 'towards';
RL.Entity.prototype.aggression = 'always';
RL.Entity.prototype.drops = {
  nothing: 50,
  gold: 30,
  threeGold: 10,
  bomb: 10,
};

RL.Entity.prototype.initialize = function initialize() {
  this.life = this.maxLife;
};

RL.Entity.prototype.adjacentTo = function adjacentTo(x, y) {
  const dx = Math.abs(x - this.x);
  const dy = Math.abs(y - this.y);
  if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
    return true;
  }

  return false;
};

RL.Entity.prototype.distanceTo = function distanceTo(x, y) {
  const dx = Math.abs(x - this.x);
  const dy = Math.abs(y - this.y);
  // return dx+dy; //treats like movement -- no diagonals
  // return Math.max(dx,dy); //diagonals with distance of 1
  return Math.sqrt((dx ** 2) + (dy ** 2)); // realistic (1.41 diagonals)
};

RL.Entity.prototype.validMovement = function validMovement(pos) {
  return (
    pos[0] !== 0
    && pos[0] !== this.game.dungeon.roomWidth - 1
    && pos[1] !== 0
    && pos[1] !== this.game.dungeon.roomHeight - 1
    && this.game.map.get(pos[0], pos[1]).passable
    && !this.game.entityManager.get(pos[0], pos[1])
  );
};

RL.Entity.prototype.getWanderDest = function getWanderDest() {
  const adjacentPositions = [
    [this.x, this.y + 1],
    [this.x, this.y - 1],
    [this.x + 1, this.y],
    [this.x - 1, this.y],
  ];

  const possiblePositions = adjacentPositions.filter(pos => this.validMovement(pos));

  if (possiblePositions.length) {
    const choice = RL.Util.randomChoice(possiblePositions);
    return {
      x: choice[0],
      y: choice[1],
    };
  }

  return null;
};

RL.Entity.prototype.getAwayFromDest = function getAwayFromDest(x, y) {
  const adjacentPositions = [
    [this.x, this.y + 1],
    [this.x, this.y - 1],
    [this.x + 1, this.y],
    [this.x - 1, this.y],
  ];

  const possiblePositions = adjacentPositions.filter(pos => (
    this.validMovement(pos)
    && (
      Math.abs(pos[0] - x) > Math.abs(this.x - x)
      || Math.abs(pos[1] - y) > Math.abs(this.y - y)
    )
    && !this.game.entityManager.get(...pos)
  ));

  if (possiblePositions.length) {
    const choice = RL.Util.randomChoice(possiblePositions);
    return {
      x: choice[0],
      y: choice[1],
    };
  }

  return null;
};


// AI
RL.Entity.prototype.update = function update() {
  if (Math.random() < this.stumbleChance) {
    this.game.console.log(`The <strong>${this.name}</strong> stumbles`);

    // Move randomly or do nothing?
    return true;
  }

  // attack if can and matches aggression
  if (
    (
      this.aggression === 'always'
      && this.adjacentTo(this.game.player.x, this.game.player.y)
    )
    || (
      this.aggression === 'provoked'
      && this.life < this.maxLife
      && this.adjacentTo(this.game.player.x, this.game.player.y)
    )
  ) {
    this.game.console.log(`The <strong>${this.name}</strong> attacks you!`);
    this.game.player.takeDamage(this.damage);
    return true;
  }

  // Check for random and stationary movement patterns
  if (this.movement === 'random') {
    const destination = this.getWanderDest();
    if (destination) {
      this.moveTo(destination.x, destination.y);
    }
    return true;
  }

  if (this.movement === 'stationary') {
    // Do nothing
    return true;
  }

  // Otherwise move toward or away from player if aware, or randomly
  if (this.distanceTo(this.game.player.x, this.game.player.y) <= this.fovRadius) {
    if (this.movement === 'towards') {
      const destination = this.getNextPathTile(this.game.player.x,
        this.game.player.y,
        true);
      if (destination && this.canMoveTo(destination.x, destination.y)) {
        this.moveTo(destination.x, destination.y);
      }
      return true;
    }

    if (this.movement === 'away') {
      const destination = this.getAwayFromDest(
        this.game.player.x,
        this.game.player.y,
        true,
      );
      if (destination && this.canMoveTo(destination.x, destination.y)) {
        this.moveTo(destination.x, destination.y);
      }
      return true;
    }
  } else {
    const destination = this.getWanderDest();
    if (destination) {
      this.moveTo(destination.x, destination.y);
    }
    return true;
  }

  return false;
};

RL.Entity.prototype.takeDamage = function takeDamage(amount) {
  this.life -= amount;
  if (this.life < 0) {
    this.life = 0;
  }
  if (this.life === 0) {
    this.die();
  }
};

// Death (drop item)
RL.Entity.prototype.die = function die() {
  this.dead = true;
  const itemType = RL.Util.mappedWeightedChoice(this.drops);
  if (Object.hasOwnProperty.call(RL.Item.Types, itemType)) {
    const item = new RL.Item(this.game, itemType, this.x, this.y);
    this.game.itemManager.add(item.x, item.y, itemType);
  }
};

// from Escape from ECMA Labs
RL.Entity.prototype.getNextPathTile = function getNextPathTile(x, y, ignoreExtra) {
  const path = this.getPathToTile(x, y, ignoreExtra);
  path.splice(0, 1);
  if (path[0] && Number.isFinite(path[0].x) && Number.isFinite(path[0].y)) {
    return path[0];
  }

  return null;
};

RL.Entity.prototype.getPathToTile = function getPathToTile(destX, destY, ignoreExtra) {
  const path = [];

  const computeCallback = (x, y) => {
    path.push({ x, y });
  };

  const passableCallback = (x, y) => {
    if (this.x === x && this.y === y) {
      return true;
    }
    return this.canMoveTo(x, y, ignoreExtra);
  };

    // prepare path to given coords
  const aStar = new ROT.Path.AStar(destX, destY, passableCallback, {
    topology: 4,
  });

  // compute from current tile coords
  aStar.compute(this.x, this.y, computeCallback);
  return path;
};

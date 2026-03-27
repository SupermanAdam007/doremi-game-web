// How far ahead of the wall we start checking (units)
const APPROACH_ZONE = 1.5;

export function checkCollision(ball, wall) {
  if (wall.passed) return null;

  const ballR = ball.geometry.parameters.radius;
  const ballZ = ball.position.z;
  const wallZ = wall.group.position.z;

  // dist: positive means wall is ahead of ball (not yet reached)
  const dist = wallZ - ballZ;

  // Only check when wall is close to the ball.
  // Rear threshold of -2 safely covers max BOUNCE_AMP=1.2 without catching
  // walls that are far away in the scene.
  if (dist > APPROACH_ZONE || dist < -2) return null;

  const ballY = ball.position.y;
  const ballBottom = ballY - ballR;
  const ballTop = ballY + ballR;

  if (ballBottom >= wall.holeBottom && ballTop <= wall.holeTop) {
    return 'pass';
  }

  return 'blocked';
}

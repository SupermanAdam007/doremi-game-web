// How far ahead of the wall we start checking (units)
const APPROACH_ZONE = 1.0;

export function checkCollision(ball, wall) {
  if (wall.passed) return null;

  const ballR = ball.geometry.parameters.radius;
  const ballZ = ball.position.z;
  const wallZ = wall.group.position.z;

  // dist: positive means wall is ahead of ball (not yet reached)
  const dist = wallZ - ballZ;

  // Only check when wall is within the approach zone
  // Use a generous exit threshold so a Z-bounce never accidentally returns null
  // while the wall is still blocking (would leave blockedWall stuck forever)
  if (dist > APPROACH_ZONE || dist < -(ballR * 6)) return null;

  const ballY = ball.position.y;
  const ballBottom = ballY - ballR;
  const ballTop = ballY + ballR;

  if (ballBottom >= wall.holeBottom && ballTop <= wall.holeTop) {
    return 'pass';
  }

  return 'blocked';
}

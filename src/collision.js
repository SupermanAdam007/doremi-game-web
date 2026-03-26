const CONTACT_THRESHOLD = 0.5;

export function checkCollision(ball, wall) {
  if (wall.passed) return null;

  const ballR = ball.geometry.parameters.radius;
  const ballZ = ball.position.z;
  const wallZ = wall.group.position.z;

  const dist = wallZ - ballZ;
  if (dist > CONTACT_THRESHOLD || dist < -ballR) return null;

  const ballY = ball.position.y;
  const ballBottom = ballY - ballR;
  const ballTop = ballY + ballR;

  if (ballBottom >= wall.holeBottom && ballTop <= wall.holeTop) {
    return 'pass';
  }

  if (dist > -ballR && dist < CONTACT_THRESHOLD) {
    return 'blocked';
  }

  return null;
}

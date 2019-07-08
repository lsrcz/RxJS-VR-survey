import { BRICK_GAP, PADDLE_WIDTH, PADDLE_HEIGHT, BALL_RADIUS } from "./constants";

import { stopTick } from "./tick";
import { Ball, Brick } from "./interface";

export const canvas = < HTMLCanvasElement > document.getElementById('stage');
const context = canvas.getContext('2d');
context.fillStyle = 'pink';

export function drawTitle() {
    context.textAlign = 'center';
    context.font = '24px Courier New';
    context.fillText('rxjs breakout', canvas.width / 2, canvas.height / 2 - 24);
}

export function drawControls() {
    context.textAlign = 'center';
    context.font = '16px Courier New';
    context.fillText('press [<] and [>] to play', canvas.width / 2, canvas.height / 2);
}

export function drawGameOver(text) {
    context.clearRect(canvas.width / 4, canvas.height / 3, canvas.width / 2, canvas.height / 3);
    context.textAlign = 'center';
    context.font = '24px Courier New';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
}

export function drawAuthor() {
    context.textAlign = 'center';
    context.font = '16px Courier New';
    context.fillText('by Manuel Wieser', canvas.width / 2, canvas.height / 2 + 24);
}

export function drawScore(score) {
    context.textAlign = 'left';
    context.font = '16px Courier New';
    context.fillText(score, BRICK_GAP, 16);
}

export function drawPaddle(position: number) {
    context.beginPath();
    context.rect(
        position - PADDLE_WIDTH / 2,
        context.canvas.height - PADDLE_HEIGHT,
        PADDLE_WIDTH,
        PADDLE_HEIGHT);

    context.fill();
    context.closePath();
}

export function drawBall(ball: Ball) {
    context.beginPath();
    context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.closePath();
}

export function drawBrick(brick: Brick) {
    context.beginPath();
    context.rect(
        brick.x - brick.width / 2,
        brick.y - brick.height / 2,
        brick.width,
        brick.height);

    context.fill();
    context.closePath();
}

export function drawBricks(bricks: Brick[]) {
    bricks.forEach(brick => drawBrick(brick));
}

export function drawAll(paddlePos: number, bricks: Brick[], ball: Ball, score: number, shut: boolean, cg: boolean) {
    context.clearRect(0, 0, canvas.width, canvas.height);

    drawPaddle(paddlePos);
    drawBall(ball);
    drawBricks(bricks);
    drawScore(score);

    if (cg) {
        drawGameOver("Game over");
    }
    if (bricks.length == 0) {
        drawGameOver("Win");
    }

    if (shut) {
        stopTick();
    }
}


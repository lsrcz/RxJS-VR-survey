import {
    fromEvent,
    Observable,
    merge,
    animationFrameScheduler,
    interval,
    zip,
    BehaviorSubject,
    Subject,
    NEVER
} from "rxjs";
import {
    map,
    filter,
    distinctUntilChanged,
    withLatestFrom,
    startWith,
    scan,
    tap,
    share,
    switchMap,
    take
} from "rxjs/operators";

// CONTANTS

const PADDLE_KEYS = {
    left: 37,
    right: 39
};

const TICKER_INTERVAL = 17;

const BRICK_ROWS = 5;
const BRICK_COLUMNS = 7;
const BRICK_HEIGHT = 20;
const BRICK_GAP = 3;

const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 20;

const BALL_RADIUS = 10;


const canvas = < HTMLCanvasElement > document.getElementById('stage');
const context = canvas.getContext('2d');
context.fillStyle = 'pink';

class Ball {
    x: number;
    y: number;
};

class BallDir {
    x: number;
    y: number;
}

class Brick {
    x: number;
    y: number;
    width: number;
    height: number;
}

function factory() {
    let width = (canvas.width - BRICK_GAP - BRICK_GAP * BRICK_COLUMNS) / BRICK_COLUMNS;
    let bricks = [];

    for (let i = 0; i < BRICK_ROWS; i++) {
        for (let j = 0; j < BRICK_COLUMNS; j++) {
            bricks.push({
                x: j * (width + BRICK_GAP) + width / 2 + BRICK_GAP,
                y: i * (BRICK_HEIGHT + BRICK_GAP) + BRICK_HEIGHT / 2 + BRICK_GAP + 20,
                width: width,
                height: BRICK_HEIGHT
            });

        }
    }
    return bricks;
}

// ASYNC
const paddleDir$: Observable < number > = merge(
    fromEvent(document, 'keydown').pipe(
        map((e: KeyboardEvent) => {
            switch (e.keyCode) {
                case PADDLE_KEYS.left:
                    return -1;
                case PADDLE_KEYS.right:
                    return 1;
                default:
                    return 0;
            }
        })),
    fromEvent(document, 'keyup').pipe(
        map((e: KeyboardEvent) => 0)
    )
).pipe(
    distinctUntilChanged(),
    share()
);

paddleDir$.pipe(
    take(1),
    tap(_ => control$.next(true))
).subscribe()

const control$: BehaviorSubject < boolean > = new BehaviorSubject(false);

// TICK

const tick$ = control$.asObservable().pipe(
    distinctUntilChanged(),
    switchMap(isTicking => {
        return isTicking ? interval(TICKER_INTERVAL, animationFrameScheduler) : NEVER;
    })
);

function syncWithTick < T > (v: Observable < T > ): Observable < T > {
    return tick$.pipe(
        withLatestFrom(v),
        map(([_, v]) => v)
    );
}

function syncedInput < T1, T2, T3, T4, T5, T6 > (
    v1: Observable < T1 > ,
    v2 ? : Observable < T2 > ,
    v3 ? : Observable < T3 > ,
    v4 ? : Observable < T4 > ,
    v5 ? : Observable < T5 > ,
    v6 ? : Observable < T6 > ): Observable < (T1 | T2 | T3 | T4 | T5 | T6)[] > {
    if (typeof v2 == 'undefined') {
        return zip(tick$, v1).pipe(
            map(([_, v1]) => [v1]),
            share()
        );
    } else if (typeof v3 == 'undefined') {
        return zip(tick$, v1, v2).pipe(
            map(([_, v1, v2]) => [v1, v2])
        );
    } else if (typeof v4 == 'undefined') {
        return zip(tick$, v1, v2, v3).pipe(
            map(([_, v1, v2, v3]) => [v1, v2, v3])
        );
    } else if (typeof v5 == 'undefined') {
        return zip(tick$, v1, v2, v3, v4).pipe(
            map(([_, v1, v2, v3, v4]) => [v1, v2, v3, v4])
        );
    } else if (typeof v6 == 'undefined') {
        return zip(tick$, v1, v2, v3, v4, v5).pipe(
            map(([_, v1, v2, v3, v4, v5]) => [v1, v2, v3, v4, v5])
        );
    } else {
        return zip(tick$, v1, v2, v3, v4, v5, v6).pipe(
            map(([_, v1, v2, v3, v4, v5, v6]) => [v1, v2, v3, v4, v5, v6])
        );
    }
}

// RELAY
const paddleDirRelay$ = syncWithTick(paddleDir$);

// SUBJECTS
const paddlePos$: BehaviorSubject < number > = new BehaviorSubject < number > (canvas.width / 2);
const ballDir$: BehaviorSubject < BallDir > = new BehaviorSubject < BallDir > ({
    x: 2,
    y: 2
});
const bricks$: BehaviorSubject < Brick[] > = new BehaviorSubject < Brick[] > (factory());
const ball$: BehaviorSubject < Ball > = new BehaviorSubject < Ball > ({
    x: canvas.width / 2,
    y: canvas.height / 2
});
const score$: BehaviorSubject < number > = new BehaviorSubject < number > (0);
const shouldShutdown$: BehaviorSubject < boolean > = new BehaviorSubject < boolean > (false);

const collisionBrick$: Subject < number > = new Subject < number > ();
const collisionWall$: Subject < boolean > = new Subject < boolean > ();
const collisionPaddle$: Subject < boolean > = new Subject < boolean > ();
const collisionGround$: Subject < boolean > = new Subject < boolean > ();
const collisionCeiling$: Subject < boolean > = new Subject < boolean > ();

const collisionY$: Subject < boolean > = new Subject < boolean > ();

// FUNCTIONS

function isCollidedPaddle(paddlePos: number, ball: Ball): boolean {
    return ball.x > paddlePos - PADDLE_WIDTH / 2 &&
        ball.x < paddlePos + PADDLE_WIDTH / 2 &&
        ball.y > canvas.height - PADDLE_HEIGHT - BALL_RADIUS / 2;
}

function collision(brick: Brick, ball: Ball): boolean {
    return ball.x > brick.x - brick.width / 2 &&
        ball.x < brick.x + brick.width / 2 &&
        ball.y > brick.y - brick.height / 2 &&
        ball.y < brick.y + brick.height / 2;
}

function isCollidedBrick(bricks: Brick[], ball: Ball): number {
    let idx = -1;
    bricks.forEach((brick, i) => {
        if (collision(brick, ball)) {
            idx = i;
        }
    });
    return idx;
}

function isCollidedWall(ball: Ball): boolean {
    return ball.x < BALL_RADIUS || ball.x > canvas.width - BALL_RADIUS;
}

function isCollidedGround(paddlePos: number, ball: Ball): boolean {
    return ball.y > canvas.height - PADDLE_HEIGHT - BALL_RADIUS / 2 && !isCollidedPaddle(paddlePos, ball);
}

function isCollidedCeiling(ball: Ball): boolean {
    return ball.y < BALL_RADIUS;
}

function calculateBallPos(ballDir: BallDir, ball: Ball, collisionX: boolean, collisionY: boolean): Ball {
    ball.x += ballDir.x * (collisionX ? -1 : 1);
    ball.y += ballDir.y * (collisionY ? -1 : 1);
    return ball;
}

function calculateNewScore(brick: number, score: number): number {
    if (brick == -1) {
        return score;
    }
    return score + 10;
}

function calculateNewBrickSet(bricks: Brick[], collision: number): Brick[] {
    if (collision == -1) {
        return bricks;
    }
    bricks.splice(collision, 1);
    return bricks;
}

function calculateNewPaddlePos(paddleDir: number, paddlePos: number) {
    return paddlePos + paddleDir * 10;
}

function calculateNewDir(collisionX: boolean, collisionY: boolean, ballDir: BallDir): BallDir {
    if (collisionX) {
        ballDir.x *= -1;
    }
    if (collisionY) {
        ballDir.y *= -1;
    }
    return ballDir;
}

// STREAMS

const collisionPaddle$$ = syncedInput(paddlePos$.asObservable(), ball$.asObservable()).pipe(
    map(([paddle, ball]) => isCollidedPaddle( < number > paddle, < Ball > ball)),
    tap(e => collisionPaddle$.next(e))
);

const collisionBrick$$ = syncedInput(bricks$.asObservable(), ball$.asObservable()).pipe(
    map(([bricks, ball]) => isCollidedBrick( < Brick[] > bricks, < Ball > (ball))),
    tap(e => collisionBrick$.next(e))
);

const collisionWall$$ = syncedInput(ball$.asObservable()).pipe(
    map(([ball]) => isCollidedWall( < Ball > (ball))),
    tap(e => collisionWall$.next(e))
);

const collisionGround$$ = syncedInput(paddlePos$.asObservable(), ball$.asObservable()).pipe(
    map(([paddle, ball]) => isCollidedGround( < number > paddle, < Ball > (ball))),
    tap(e => collisionGround$.next(e))
);

const collisionCeiling$$ = syncedInput(ball$.asObservable()).pipe(
    map(([ball]) => isCollidedCeiling( < Ball > (ball))),
    tap(e => collisionCeiling$.next(e))
);

const ball$$ = syncedInput(ballDir$.asObservable(), ball$.asObservable(), collisionWall$.asObservable(), collisionY$.asObservable()).pipe(
    map(([ballDir, ball, cX, cY]) => calculateBallPos( < BallDir > ballDir, < Ball > ball, < boolean > cX, < boolean > cY)),
    tap(e => ball$.next(e))
);

const score$$ = syncedInput(collisionBrick$.asObservable(), score$.asObservable()).pipe(
    map(([brick, score]) => calculateNewScore( < number > brick, < number > score)),
    tap(e => score$.next(e))
);

const brick$$ = syncedInput(bricks$.asObservable(), collisionBrick$.asObservable()).pipe(
    map(([bricks, collision]) => calculateNewBrickSet( < Brick[] > (bricks), < number > (collision))),
    tap(e => bricks$.next(e))
);

const paddlePos$$ = syncedInput(paddleDirRelay$, paddlePos$.asObservable()).pipe(
    map(([paddleDir, paddlePos]) => calculateNewPaddlePos( < number > paddleDir, < number > paddlePos)),
    tap(e => paddlePos$.next(e))
);

const collisionY$$ = syncedInput(collisionBrick$.asObservable(), collisionCeiling$.asObservable(), collisionPaddle$.asObservable()).pipe(
    map(([cB, cC, cP]) => [cB != -1, cC, cP]),
    map(([cB, cC, cP]) => cB || cC || cP),
    tap((e: boolean) => collisionY$.next(e))
);

const ballDir$$ = syncedInput(collisionWall$.asObservable(), collisionY$.asObservable(), ballDir$.asObservable()).pipe(
    map(([cX, cY, d]) => calculateNewDir( < boolean > cX, < boolean > cY, < BallDir > d)),
    tap(e => ballDir$.next(e))
);

const shouldShutdown$$ = syncedInput(bricks$.asObservable(), collisionGround$.asObservable()).pipe(
    map(([b, cg]) => ( < Brick[] > b).length == 0 || < boolean > cg),
    tap(e => shouldShutdown$.next(e))
);

// DRIVER
merge(
    collisionPaddle$$,
    collisionBrick$$,
    collisionWall$$,
    collisionGround$$,
    collisionCeiling$$,
    ball$$,
    score$$,
    brick$$,
    paddlePos$$,
    collisionY$$,
    ballDir$$,
    shouldShutdown$$
).subscribe()


// UI
function drawTitle() {
    context.textAlign = 'center';
    context.font = '24px Courier New';
    context.fillText('rxjs breakout', canvas.width / 2, canvas.height / 2 - 24);
}

function drawControls() {
    context.textAlign = 'center';
    context.font = '16px Courier New';
    context.fillText('press [<] and [>] to play', canvas.width / 2, canvas.height / 2);
}

function drawGameOver(text) {
    context.clearRect(canvas.width / 4, canvas.height / 3, canvas.width / 2, canvas.height / 3);
    context.textAlign = 'center';
    context.font = '24px Courier New';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
}

function drawAuthor() {
    context.textAlign = 'center';
    context.font = '16px Courier New';
    context.fillText('by Manuel Wieser', canvas.width / 2, canvas.height / 2 + 24);
}

function drawScore(score) {
    context.textAlign = 'left';
    context.font = '16px Courier New';
    context.fillText(score, BRICK_GAP, 16);
}

function drawPaddle(position: number) {
    context.beginPath();
    context.rect(
        position - PADDLE_WIDTH / 2,
        context.canvas.height - PADDLE_HEIGHT,
        PADDLE_WIDTH,
        PADDLE_HEIGHT);

    context.fill();
    context.closePath();
}

function drawBall(ball: Ball) {
    context.beginPath();
    context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.closePath();
}

function drawBrick(brick: Brick) {
    context.beginPath();
    context.rect(
        brick.x - brick.width / 2,
        brick.y - brick.height / 2,
        brick.width,
        brick.height);

    context.fill();
    context.closePath();
}

function drawBricks(bricks: Brick[]) {
    bricks.forEach(brick => drawBrick(brick));
}

function drawAll(paddlePos: number, bricks: Brick[], ball: Ball, score: number, shut: boolean, cg: boolean) {
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
        control$.next(false);
    }
}

// OBSERVER
syncedInput(paddlePos$.asObservable(), bricks$.asObservable(), ball$.asObservable(), score$.asObservable(), shouldShutdown$.asObservable(), collisionGround$.asObservable()).pipe(
    tap(([paddlePos, bricks, ball, score, shut, cg]) => drawAll( < number > paddlePos, < Brick[] > bricks, < Ball > ball, < number > score, < boolean > shut, < boolean > cg))
).subscribe();

drawTitle();
drawAuthor();
drawControls();
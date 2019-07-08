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
    take,
    skip,
    pluck
} from "rxjs/operators";

// CONTANTS

const PADDLE_KEYS = {
    left: 37,
    right: 39
};

const TICKER_INTERVAL = 17;

const BRICK_ROWS = 1;
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
const keyCodeAsync$: Observable < number > = merge(
    fromEvent(document, 'keydown').pipe(
        map((e: KeyboardEvent) => e.keyCode)),
    fromEvent(document, 'keyup').pipe(
        map((e: KeyboardEvent) => 0)
    )
).pipe(
    distinctUntilChanged(),
    share()
);

keyCodeAsync$.pipe(
    take(1),
    tap(_ => control$.next(true))
).subscribe()

const control$: BehaviorSubject < boolean > = new BehaviorSubject(false);

// TICK

const tick$ = control$.asObservable().pipe(
    distinctUntilChanged(),
    switchMap(isTicking => {
        return isTicking ? /*interval(TICKER_INTERVAL, animationFrameScheduler)*/ interval(TICKER_INTERVAL / 5) : NEVER;
    })
);

function syncWithTick < T > (v: Observable < T > ): Observable < T > {
    return tick$.pipe(
        withLatestFrom(v),
        map(([_, v]) => v),
        share()
    );
}

function syncedInput(...args: (Observable < any > | Subject < any > )[]): Observable < any[] > {
    return zip(tick$, ...(args.map(o => {
        if (o instanceof Subject) {
            return o.asObservable();
        }
        return o;
    }))).pipe(
        map(([x, ...args]) => args),
        share()
    );
}

function splitStream(stream: Observable < any[] > , num: number): Observable < any > [] {
    var ret: Subject < any > [] = [];
    for (var i = 0; i < num; ++i) {
        ret.push(new Subject());
    }
    stream.pipe(
        tap(arr => {
            for (var i = 0; i < num; ++i) {
                ret[i].next(arr[i]);
            }
        })
    ).subscribe();
    return ret.map(e => e.asObservable());
}

function syncedStreams(...args: (Observable < any > | Subject < any > )[]): Observable < any > [] {
    return splitStream(syncedInput(...args), args.length);
}

function link(f: (inputs: Observable < any > []) => Observable < any > ,
    outSubject: Subject < any > ,
    ...args: (Observable < any > | Subject < any > )[]) {
    return f(
        syncedStreams(...args)
    ).pipe(
        tap(e => outSubject.next(e))
    );
}

// OPERATORS
function constant < T > (x: T): Observable < T > {
    return tick$.pipe(
        map(e => x)
    );
}

function lessThan(lhs: Observable < number > , rhs: Observable < number > ): Observable < boolean > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l < r)
    );
}

function equalTo(lhs: Observable < number > , rhs: Observable < number > ): Observable < boolean > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l == r)
    );
}

function and(lhs: Observable < boolean > , rhs: Observable < boolean > ): Observable < boolean > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l && r)
    );
}

function or(lhs: Observable < boolean > , rhs: Observable < boolean > ): Observable < boolean > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l || r)
    );
}

function not(input: Observable < boolean > ): Observable < boolean > {
    return input.pipe(map(e => !e));
}

function ifOp<T1, T2>(pred: Observable < boolean >, thenv: Observable < T1 >, elsev: Observable < T2 >): Observable<T1|T2> {
    return zip(pred, thenv, elsev).pipe(
        map(([p, t, e]) => {
            if (p) {
                return t;
            } else {
                return e;
            }
        })
    )
}

function add(lhs: Observable < number > , rhs: Observable < number > ): Observable < number > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l + r)
    );
}

function sub(lhs: Observable < number > , rhs: Observable < number > ): Observable < number > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l - r)
    );
}

function times(lhs: Observable < number > , rhs: Observable < number > ): Observable < number > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l * r)
    );
}

function map1 < T, R > (s: Observable < T > , f: (x: T) => R): Observable < R > {
    return s.pipe(
        map(f)
    );
}

function map2 < T1, T2, R > (s1: Observable < T1 > , s2: Observable < T2 > , f: (x: T1, y: T2) => R): Observable < R > {
    return zip(s1, s2).pipe(
        map(([x, y]) => f(x, y)),
    );
}

function map3 < T1, T2, T3, R > (s1: Observable < T1 > , s2: Observable < T2 > , s3: Observable < T3 > ,
    f: (x: T1, y: T2, z: T3) => R): Observable < R > {
    return zip(s1, s2, s3).pipe(
        map(([x, y, z]) => f(x, y, z))
    );
}

function map4 < T1, T2, T3, T4, R > (s1: Observable < T1 > , s2: Observable < T2 > , s3: Observable < T3 > , s4: Observable < T4 > ,
    f: (x: T1, y: T2, z: T3, a: T4) => R): Observable < R > {
    return zip(s1, s2, s3, s4).pipe(
        map(([x, y, z, a]) => f(x, y, z, a))
    );
}

function getField < T, K1 extends keyof T > (s: Observable < T > , k1: K1): Observable < T[K1] > {
    return s.pipe(
        pluck(k1)
    );
}

// RELAY
const keyCodeRelay$ = syncWithTick(keyCodeAsync$);

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

const paddleDir$: Subject < number > = new Subject < number > ();
const collisionBrick$: Subject < number > = new Subject < number > ();
const collisionWall$: Subject < boolean > = new Subject < boolean > ();
const collisionPaddle$: Subject < boolean > = new Subject < boolean > ();
const collisionGround$: Subject < boolean > = new Subject < boolean > ();
const collisionCeiling$: Subject < boolean > = new Subject < boolean > ();

const collisionY$: Subject < boolean > = new Subject < boolean > ();

// NEXT SUBJECTS -- for "next" dependencies
const nextBallDir$ = ballDir$.asObservable().pipe(skip(1));

// USER FUNCTIONS

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
    ball.x += ballDir.x * (collisionX ? -1 : 1) * 0.2;
    ball.y += ballDir.y * (collisionY ? -1 : 1) * 0.2;
    return ball;
}

function calculateBallPosNext(nextBallDir: BallDir, ball: Ball): Ball {
    ball.x += nextBallDir.x * 0.2;
    ball.y += nextBallDir.y * 0.2;
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
    return paddlePos + paddleDir * 2;
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

// STREAMS -- OLD STYLE

const collisionPaddle$$ = syncedInput(paddlePos$, ball$).pipe(
    map(([paddle, ball]) => isCollidedPaddle( < number > paddle, < Ball > ball)),
    tap(e => collisionPaddle$.next(e))
);

const collisionBrick$$ = syncedInput(bricks$, ball$).pipe(
    map(([bricks, ball]) => isCollidedBrick( < Brick[] > bricks, < Ball > (ball))),
    tap(e => collisionBrick$.next(e))
);

const collisionWall$$ = syncedInput(ball$).pipe(
    map(([ball]) => isCollidedWall( < Ball > (ball))),
    tap(e => collisionWall$.next(e))
);

const collisionGround$$ = syncedInput(paddlePos$, ball$).pipe(
    map(([paddle, ball]) => isCollidedGround( < number > paddle, < Ball > (ball))),
    tap(e => collisionGround$.next(e))
);

const collisionCeiling$$ = syncedInput(ball$).pipe(
    map(([ball]) => isCollidedCeiling( < Ball > (ball))),
    tap(e => collisionCeiling$.next(e))
);

const ball$$ = syncedInput(nextBallDir$, ball$).pipe(
    map(([nextDir, ball]) => calculateBallPosNext(nextDir, ball)),
    tap(e => ball$.next(e))
);

const score$$ = syncedInput(collisionBrick$, score$).pipe(
    map(([brick, score]) => calculateNewScore( < number > brick, < number > score)),
    tap(e => score$.next(e))
);

const brick$$ = syncedInput(bricks$, collisionBrick$).pipe(
    map(([bricks, collision]) => calculateNewBrickSet( < Brick[] > (bricks), < number > (collision))),
    tap(e => bricks$.next(e))
);

const paddleDir$$ = syncedInput(keyCodeRelay$).pipe(
    map(([keyCode]) => {
        if (keyCode == PADDLE_KEYS.left) {
            return -1;
        } else if (keyCode == PADDLE_KEYS.right) {
            return 1;
        }
        return 0;
    }),
    tap(e => paddleDir$.next(e))
)

const paddlePos$$ = syncedInput(paddleDir$, paddlePos$).pipe(
    map(([paddleDir, paddlePos]) => calculateNewPaddlePos( < number > paddleDir, < number > paddlePos)),
    tap(e => paddlePos$.next(e))
);

const collisionY$$ = syncedInput(collisionBrick$, collisionCeiling$, collisionPaddle$).pipe(
    map(([cB, cC, cP]) => [cB != -1, cC, cP]),
    map(([cB, cC, cP]) => cB || cC || cP),
    tap((e: boolean) => collisionY$.next(e))
);

const ballDir$$ = syncedInput(collisionWall$, collisionY$, ballDir$).pipe(
    map(([cX, cY, d]) => calculateNewDir( < boolean > cX, < boolean > cY, < BallDir > d)),
    tap(e => ballDir$.next(e))
);

const shouldShutdown$$ = syncedInput(bricks$, collisionGround$).pipe(
    map(([b, cg]) => ( < Brick[] > b).length == 0 || < boolean > cg),
    tap(e => shouldShutdown$.next(e))
);


// FUNCTIONS TO SYNTHESIZE

function collisionPaddleFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // paddlePos$
    var r2 = inputs[1]; // ball$
    var r3 = zip(r1, r2);
    var r4 = r3.pipe(
        map(([paddle, ball]) => isCollidedPaddle( < number > paddle, < Ball > ball))
    );
    return r4;
}

function collisionBrickFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // bricks$
    var r2 = inputs[1]; // ball$
    var r3 = zip(r1, r2);
    var r4 = r3.pipe(
        map(([bricks, ball]) => isCollidedBrick( < Brick[] > bricks, < Ball > (ball)))
    )
    return r4;
}

function collisionWallFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // ball$
    var r2 = r1.pipe(
        map(ball => isCollidedWall(ball))
    );
    return r2;
}

function collisionGroundFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // paddlePos$ 
    var r2 = inputs[1]; // ball$
    var r3 = zip(r1, r2);
    var r4 = r3.pipe(
        map(([paddle, ball]) => isCollidedGround( < number > paddle, < Ball > (ball)))
    );
    return r4;
}

function collisionCeilingFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // ball$
    var r2 = getField(r1, "y");
    var r3 = constant(BALL_RADIUS);
    var r4 = lessThan(r2, r3);
    return r4;
    /*
    var r1 = inputs[0]; // ball$
    var r2 = r1.pipe(
        map(ball => isCollidedCeiling(ball)),
    );
    return r2;
    */
}

function ballFunc(inputs: Observable < any > []): Observable < any > {
    // The function may be shown in linear form as:
    // 4 inputs, 5 instructions, 2 return values
    // field access can be handled by the synthesizer
    var r1 = getField(inputs[0], "x"); // nextBallDir.x
    var r2 = getField(inputs[0], "y"); // nextBallDir.y
    var r3 = getField(inputs[1], "x"); // ball.x
    var r4 = getField(inputs[1], "y"); // ball.y

    var r5 = constant(0.2);
    var r6 = times(r1, r5);
    var r7 = times(r2, r5);
    var r8 = add(r3, r6);
    var r9 = add(r4, r7);

    var r10 = map2(r8, r9, (_x, _y) => {
        return {
            x: _x,
            y: _y
        }
    });
    return r10;
    /*
    var r1 = inputs[0]; // nextBallDir$
    var r2 = inputs[1]; // ball$ 
    var r3 = getField(r1, "x");
    var r4 = getField(r1, "y");
    var r5 = map1(r3, e => e * 0.2);
    var r6 = map1(r4, e => e * 0.2);
    var r7 = getField(r2, "x");
    var r8 = getField(r2, "y");
    var r9 = add(r5, r7);
    var r10 = add(r6, r8);
    var r11 = map2(r9, r10, (_x, _y) => {
        return {
            x: _x,
            y: _y
        }
    });
    return r11;
    */
    /*
    var r1 = inputs[0]; // nextBallDir$
    var r2 = inputs[1]; // ball$
    var r3 = map2(r1, r2, calculateBallPosNext);
    return r3;
    */
    /*
    var r1 = inputs[0]; // nextBallDir$
    var r2 = inputs[1]; // ball$
    var r3 = zip(r1, r2);
    var r4 = r3.pipe(
        map(([nextDir, ball]) => calculateBallPosNext(nextDir, ball))
    );
    return r4;
    */
}

function scoreFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // collisionBrick$
    var r2 = inputs[1]; // score$
    var r3 = map1(r1, e => e == -1);
    var r4 = constant(10);
    var r5 = add(r2, r4);
    var r6 = ifOp(r3, r2, r5);
    return r6;
    /*
    var r1 = inputs[0]; // collisionBrick$
    var r2 = inputs[1]; // score$
    var r3 = zip(r1, r2);
    var r4 = r3.pipe(
        map(([brick, score]) => calculateNewScore( < number > brick, < number > score))
    );
    return r4;*/
}

function bricksFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // bricks$
    var r2 = inputs[1]; // collision$
    var r3 = zip(r1, r2);
    var r4 = r3.pipe(
        map(([bricks, collision]) => calculateNewBrickSet( < Brick[] > (bricks), < number > (collision)))
    );
    return r4;
}

function paddleDirFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // keyCodeRelay$
    var r2 = r1.pipe(
        map(keyCode => {
            if (keyCode == PADDLE_KEYS.left) {
                return -1;
            } else if (keyCode == PADDLE_KEYS.right) {
                return 1;
            }
            return 0;
        })
    );
    return r2;
}

function paddlePosFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // paddleDir$
    var r2 = inputs[1]; // paddlePos$
    var r3 = zip(r1, r2);
    var r4 = r3.pipe(
        map(([paddleDir, paddlePos]) => calculateNewPaddlePos( < number > paddleDir, < number > paddlePos))
    );
    return r4;
}

function collisionYFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // collisionBrick$
    var r2 = inputs[1]; // collisionCeiling$
    var r3 = inputs[2]; // collisionPaddle$
    var r4 = r1.pipe(map(e => e != -1));
    var r5 = zip(r4, r2, r3);
    var r6 = r5.pipe(
        map(([cB, cC, cP]) => cB || cC || cP)
    );
    return r6;
}

function ballDirFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // collisionWall$
    var r2 = inputs[1]; // collisionY$
    var r3 = inputs[2]; // ballDir$
    var r4 = zip(r1, r2, r3);
    var r5 = r4.pipe(
        map(([cX, cY, d]) => calculateNewDir( < boolean > cX, < boolean > cY, < BallDir > d))
    );
    return r5;
}

function shouldShutdownFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // bricks$
    var r2 = inputs[1]; // collisionGround$
    var r3 = zip(r1, r2);
    var r4 = r3.pipe(
        map(([b, cg]) => ( < Brick[] > b).length == 0 || < boolean > cg)
    );
    return r4;
}

// DRIVER
merge(
    link(collisionPaddleFunc, collisionPaddle$, paddlePos$, ball$),
    link(collisionBrickFunc, collisionBrick$, bricks$, ball$),
    link(collisionWallFunc, collisionWall$, ball$),
    link(collisionGroundFunc, collisionGround$, paddlePos$, ball$),
    link(collisionCeilingFunc, collisionCeiling$, ball$),
    link(ballFunc, ball$, nextBallDir$, ball$),
    link(scoreFunc, score$, collisionBrick$, score$),
    link(bricksFunc, bricks$, bricks$, collisionBrick$),
    link(paddleDirFunc, paddleDir$, keyCodeRelay$),
    link(paddlePosFunc, paddlePos$, paddleDir$, paddlePos$),
    link(collisionYFunc, collisionY$, collisionBrick$, collisionCeiling$, collisionPaddle$),
    link(ballDirFunc, ballDir$, collisionWall$, collisionY$, ballDir$),
    link(shouldShutdownFunc, shouldShutdown$, bricks$, collisionGround$)
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

// DRAW

const screenTick$ = control$.asObservable().pipe(
    distinctUntilChanged(),
    switchMap(isTicking => {
        return isTicking ? interval(TICKER_INTERVAL, animationFrameScheduler) : NEVER;
    })
);

screenTick$.pipe(
    withLatestFrom(syncedInput(paddlePos$, bricks$, ball$, score$, shouldShutdown$, collisionGround$)),
    map(([_, t]) => t),
    tap(([paddlePos, bricks, ball, score, shut, cg]) => drawAll( < number > paddlePos, < Brick[] > bricks, < Ball > ball, < number > score, < boolean > shut, < boolean > cg))
).subscribe();

drawTitle();
drawAuthor();
drawControls();
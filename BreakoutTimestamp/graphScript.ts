import {
    fromEvent,
    Observable,
    merge,
    zip,
    BehaviorSubject,
    Subject,
} from "rxjs";
import {
    map,
    distinctUntilChanged,
    tap,
    share,
    take,
    skip,
} from "rxjs/operators";
import {
    startTick,
    syncWithTick,
    link,
    observeWithFrame
} from "./tick";
import {
    getField,
    constant,
    lessThan,
    mul as mul,
    add,
    map2,
    map1,
    ifOp,
    equalTo,
    not,
    or,
    sub,
    and,
    lessThanOrEqualTo
} from "./operators";
import {
    BRICK_GAP,
    BRICK_COLUMNS,
    BRICK_ROWS,
    BRICK_HEIGHT,
    PADDLE_WIDTH,
    PADDLE_HEIGHT,
    BALL_RADIUS,
    PADDLE_KEYS
} from "./constants";
import {
    BallDir,
    Brick,
    Ball
} from "./interface";
import {
    drawAll,
    drawTitle,
    drawAuthor,
    drawControls,
    canvas
} from "./ui";

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
    tap(_ => startTick())
).subscribe()

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
    ball.x += ballDir.x * (collisionX ? -1 : 1) * 0.5;
    ball.y += ballDir.y * (collisionY ? -1 : 1) * 0.5;
    return ball;
}

function calculateBallPosNext(nextBallDir: BallDir, ball: Ball): Ball {
    ball.x += nextBallDir.x * 0.5;
    ball.y += nextBallDir.y * 0.5;
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
    return paddlePos + paddleDir * 4;
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

// FUNCTIONS TO SYNTHESIZE

function collisionPaddleFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // paddlePos$
    var r2 = getField(inputs[1], "x"); // ball$.x
    var r3 = getField(inputs[1], "y"); // ball$.y
    var r4 = constant(PADDLE_WIDTH / 2);
    var r5 = constant(canvas.height - PADDLE_HEIGHT);
    var r6 = constant(BALL_RADIUS / 2);
    var r7 = sub(r1, r4);
    var r8 = lessThan(r7, r2);
    var r9 = add(r1, r4);
    var r10 = lessThan(r2, r9);
    var r11 = sub(r5, r6);
    var r12 = lessThan(r11, r3);
    var r13 = and(r8, r10);
    var r14 = and(r12, r13);
    return r14;
    /*
    var r1 = inputs[0]; // paddlePos$
    var r2 = inputs[1]; // ball$
    var r3 = zip(r1, r2);
    var r4 = r3.pipe(
        map(([paddle, ball]) => isCollidedPaddle( < number > paddle, < Ball > ball))
    );
    return r4;
    */
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
    var r1 = getField(inputs[0], 'x'); // ball$.x
    var r2 = getField(inputs[0], 'y'); // ball$.y
    var r3 = constant(BALL_RADIUS);
    var r4 = constant(canvas.width);
    var r5 = sub(r4, r3);
    var r6 = lessThan(r1, r3);
    var r7 = lessThan(r5, r1);
    var r8 = or(r6, r7);
    return r8;
    /*
    var r1 = inputs[0]; // ball$
    var r2 = r1.pipe(
        map(ball => isCollidedWall(ball))
    );
    return r2;
    */
}

function collisionGroundFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // paddlePos$
    var r2 = getField(inputs[1], "x"); // ball$.x
    var r3 = getField(inputs[1], "y"); // ball$.y
    var r4 = constant(PADDLE_WIDTH / 2);
    var r5 = constant(canvas.height - PADDLE_HEIGHT);
    var r6 = constant(BALL_RADIUS / 2);
    var r7 = sub(r1, r4);
    var r8 = lessThanOrEqualTo(r2, r7);
    var r9 = add(r1, r4);
    var r10 = lessThanOrEqualTo(r9, r2);
    var r11 = sub(r5, r6);
    var r12 = lessThan(r11, r3);
    var r13 = or(r8, r10);
    var r14 = and(r12, r13);
    return r14;
    /*
    var r1 = inputs[0]; // paddlePos$ 
    var r2 = inputs[1]; // ball$
    var r3 = zip(r1, r2);
    var r4 = r3.pipe(
        map(([paddle, ball]) => isCollidedGround( < number > paddle, < Ball > (ball)))
    );
    return r4;
    */
}

function collisionCeilingFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = getField(inputs[0], "x"); // ball$.x
    var r2 = getField(inputs[0], "y"); // ball$.y
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

    var r5 = constant(0.5);
    var r6 = mul(r1, r5);
    var r7 = mul(r2, r5);
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
    var r5 = map1(r3, e => e * 0.5);
    var r6 = map1(r4, e => e * 0.5);
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
    var r2 = constant(0);
    var r3 = constant(1);
    var r4 = constant(-1);
    var r5 = constant(PADDLE_KEYS.left);
    var r6 = constant(PADDLE_KEYS.right); // constant pool?
    var r7 = equalTo(r1, r5);
    var r8 = equalTo(r1, r6);
    var r9 = ifOp(r7, r4, r2);
    var r10 = ifOp(r8, r3, r9);
    return r10;
    /*
    var r1 = inputs[0];
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
    */
}

function paddlePosFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // paddleDir$
    var r2 = inputs[1]; // paddlePos$ 
    var r3 = constant(4);
    var r4 = mul(r1, r3);
    var r5 = add(r2, r4);
    return r5;
    /*
    var r1 = inputs[0]; // paddleDir$
    var r2 = inputs[1]; // paddlePos$
    var r3 = zip(r1, r2);
    var r4 = r3.pipe(
        map(([paddleDir, paddlePos]) => calculateNewPaddlePos( < number > paddleDir, < number > paddlePos))
    );
    return r4;
    */
}

function collisionYFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // collisionBrick$
    var r2 = inputs[1]; // collisionCeiling$
    var r3 = inputs[2]; // collisionPaddle$
    var r4 = constant(-1);
    var r5 = equalTo(r1, r4);
    var r6 = not(r5);
    var r7 = or(r2, r3);
    var r8 = or(r6, r7);
    return r8;
    /*
    var r1 = inputs[0]; // collisionBrick$
    var r2 = inputs[1]; // collisionCeiling$
    var r3 = inputs[2]; // collisionPaddle$
    var r4 = r1.pipe(map(e => e != -1));
    var r5 = zip(r4, r2, r3);
    var r6 = r5.pipe(
        map(([cB, cC, cP]) => cB || cC || cP)
    );
    return r6;
    */
}

function ballDirFunc(inputs: Observable < any > []): Observable < any > {
    var r1 = inputs[0]; // collisionWall$
    var r2 = inputs[1]; // collisionY$
    var r3 = getField(inputs[2], "x"); // ballDir$.x
    var r4 = getField(inputs[2], "y"); // ballDir$.y
    var r5 = constant(-1);
    var r6 = mul(r3, r5);
    var r7 = mul(r4, r5);
    var r8 = ifOp(r1, r6, r3);
    var r9 = ifOp(r2, r7, r4);
    var r10 = map2(r8, r9, (_x, _y) => {
        return {
            x: _x,
            y: _y
        };
    });
    return r10;
    /*
    var r1 = inputs[0]; // collisionWall$
    var r2 = inputs[1]; // collisionY$
    var r3 = inputs[2]; // ballDir$
    var r4 = zip(r1, r2, r3);
    var r5 = r4.pipe(
        map(([cX, cY, d]) => calculateNewDir( < boolean > cX, < boolean > cY, < BallDir > d))
    );
    return r5;
    */
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
drawTitle();
drawAuthor();
drawControls();
observeWithFrame(paddlePos$, bricks$, ball$, score$, shouldShutdown$, collisionGround$).subscribe(
    ([paddlePos, bricks, ball, score, shut, cg]) => drawAll( < number > paddlePos, < Brick[] > bricks, < Ball > ball, < number > score, < boolean > shut, < boolean > cg)
);
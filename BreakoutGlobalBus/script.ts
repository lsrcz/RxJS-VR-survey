import {
    fromEvent,
    Observable,
    merge,
    interval,
    combineLatest,
    animationFrameScheduler,
} from "rxjs";
import {
    map,
    distinctUntilChanged,
    tap,
    share,
    take,
    skip,
    withLatestFrom,
    scan,
    filter,
    startWith,
    sample,
    sampleTime,
} from "rxjs/operators";
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
    Ball,
    Message
} from "./interface";
import {
    drawAll,
    drawTitle,
    drawAuthor,
    drawControls,
    canvas,
    drawGameOver
} from "./ui";
import { MessageQueue } from "./msgQueue";

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



const msgQueue = new MessageQueue();

// STREAMS
const keyCode$: Observable <number> = msgQueue.subqueue("keycode");
const ticker$: Observable < number > = msgQueue.subqueue("ticker");
const paddlePos$: Observable < number > = msgQueue.subqueue("paddlepos");
const bricks$: Observable < Brick[] > = msgQueue.subqueue("bricks");
const ball$: Observable < Ball > = msgQueue.subqueue("ball");
const cBricks$: Observable < number > = msgQueue.subqueue("cbricks");
const cPaddle$: Observable < boolean > = msgQueue.subqueue("cpaddle");
const cGround$: Observable < boolean > = msgQueue.subqueue("cground");
const cWall$: Observable < boolean > = msgQueue.subqueue("cwall");
const cCeiling$: Observable < boolean > = msgQueue.subqueue("cceiling");
const ballDir$: Observable < BallDir > = msgQueue.subqueue("balldir");
const score$: Observable < number > = msgQueue.subqueue("score");

// PROVIDERS

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
const cBricksProvider = ball$.pipe(
    withLatestFrom(bricks$),
    map(([ball, bricks]) => {
        return isCollidedBrick(bricks, ball)
    }),
    filter(e => e != -1),
    share()
);

const cPaddleProvider = ball$.pipe(
    filter(({
        x,
        y
    }) => y > canvas.height - PADDLE_HEIGHT - BALL_RADIUS / 2),
    withLatestFrom(paddlePos$),
    filter(([bpos, ppos]) => bpos.x > ppos - PADDLE_WIDTH / 2),
    filter(([bpos, ppos]) => bpos.x < ppos + PADDLE_WIDTH / 2),
    map(e => true),
    share()
);

const cGroundProvider = ball$.pipe(
    filter(({
        x,
        y
    }) => y > canvas.height - PADDLE_HEIGHT - BALL_RADIUS / 2),
    withLatestFrom(paddlePos$),
    filter(([bpos, ppos]) => bpos.x < ppos - PADDLE_WIDTH / 2 || bpos.x > ppos + PADDLE_WIDTH / 2),
    map(e => true),
    share()
);

const cWallProvider = ball$.pipe(
    filter(({
        x,
        y
    }) => x < BALL_RADIUS || x > canvas.width - BALL_RADIUS),
    map(e => true),
    share()
);

const cCeilingProvider = ball$.pipe(
    filter(({
        x,
        y
    }) => y < BALL_RADIUS),
    map(e => true),
    share()
);

const ballDirProvider = merge(
    merge(cBricks$, cPaddle$, cCeiling$).pipe(map(e => {
        return {
            x: 1,
            y: -1
        };
    })),
    cWall$.pipe(map(e => {
        return {
            x: -1,
            y: 1
        };
    }))
).pipe(
    startWith({
        x: 2,
        y: 2
    }),
    scan(({
        x,
        y
    }, dxy) => {
        return {
            x: x * dxy.x,
            y: y * dxy.y
        };
    }),
    share()
);

const scoreProvider = cBricks$.pipe(
    startWith(0),
    scan((acc, _) => acc + 10),
    share()
).pipe(
    tap(e => msgQueue.put("score", e))
);

const paddlePosProvider = ticker$.pipe(
    withLatestFrom(keyCode$),
    map(([_, b]) => b),
    startWith(canvas.width / 2),
    scan((position, dir) => {
        let next = position + dir * 10;
        return Math.max(Math.min(next, canvas.width - PADDLE_WIDTH / 2), PADDLE_WIDTH / 2);
    }),
    share()
);

const initBall: BallDir = {
    x: canvas.width / 2,
    y: canvas.height / 2
};

const ballProvider = ticker$.pipe(
    withLatestFrom(ballDir$),
    startWith(initBall),
    scan((position: BallDir, [_, bdir]: any) => {
        const newBall: BallDir = {
            x: position.x + ( < BallDir > bdir).x,
            y: position.y + ( < BallDir > bdir).y
        };
        return newBall;
    }),
    share()
);

const bricksProvider = cBricks$.pipe(
    startWith(factory()),
    scan((bricks: Brick[], idx: number) => {
        bricks.splice(idx, 1);
        return bricks;
    }),
    share(),
);

const keyCodeProvider: Observable < number > = merge(
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
        })
    ),
    fromEvent(document, 'keyup').pipe(
        map((e: KeyboardEvent) => 0)
    )
).pipe(
    startWith(0),
    distinctUntilChanged(),
    share()
);

// UI
drawTitle();
drawAuthor();
drawControls();

cGround$.subscribe(_ => {
    game.unsubscribe();
    drawGameOver("Game over");
});

bricks$.pipe(
    filter(b => b.length == 0)
).subscribe(_ => {
    game.unsubscribe();
    drawGameOver("Win");
});

msgQueue.addProvider("cbricks", cBricksProvider);
msgQueue.addProvider("cpaddle", cPaddleProvider);
msgQueue.addProvider("cceiling", cCeilingProvider);
msgQueue.addProvider("cground", cGroundProvider);
msgQueue.addProvider("cwall", cWallProvider);
msgQueue.addProvider("ticker", interval(16, animationFrameScheduler));
msgQueue.addProvider("paddlepos", paddlePosProvider);
msgQueue.addProvider("bricks", bricksProvider);
msgQueue.addProvider("ball", ballProvider);
msgQueue.addProvider("balldir", ballDirProvider);
msgQueue.addProvider("score", scoreProvider);
msgQueue.addProvider("keycode", keyCodeProvider);

msgQueue.start();

const game = ticker$.pipe(
    withLatestFrom(combineLatest(score$, bricks$, ball$, paddlePos$)),
    map(([_, a]) => a)
).subscribe(([score, bricks, ball, paddle]) => drawAll(paddle, bricks, ball, score));
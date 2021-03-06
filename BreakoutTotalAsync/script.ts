import {
    fromEvent,
    Observable,
    merge,
    zip,
    BehaviorSubject,
    Subject,
    interval,
    combineLatest,
    ReplaySubject,
    of,
    asyncScheduler,
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
    Ball
} from "./interface";
import {
    drawAll,
    drawTitle,
    drawAuthor,
    drawControls,
    canvas,
    drawGameOver
} from "./ui";

var x = of(1, 2, 3, 4, asyncScheduler);

x.pipe(
    startWith(20),
    scan((a, y) => y)
).subscribe(console.log);

// x.subscribe(console.log);

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

const keyCode$: Observable < number > = merge(
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


const ticker$: Observable < number > = interval(17);


enum PADDLE_OR_GROUND {
    PADDLE,
    GROUND
};

const paddlePos$: Subject < number > = new ReplaySubject < number > (1);
const bricks$: Subject < Brick[] > = new ReplaySubject < Brick[] > (1); // factory()
const ball$: Subject < Ball > = new ReplaySubject < Ball > (1);


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

const cBricks = ball$.pipe(
    withLatestFrom(bricks$.asObservable()),
    map(([ball, bricks]) => {
        return isCollidedBrick(bricks, ball)
    }),
    filter(e => e != -1),
    share()
);

const cPaddle = ball$.pipe(
    filter(({
        x,
        y
    }) => y > canvas.height - PADDLE_HEIGHT - BALL_RADIUS / 2),
    withLatestFrom(paddlePos$),
    filter(([bpos, ppos]) => bpos.x > ppos - PADDLE_WIDTH / 2),
    filter(([bpos, ppos]) => bpos.x < ppos + PADDLE_WIDTH / 2),
    share()
);

const cGround = ball$.pipe(
    filter(({
        x,
        y
    }) => y > canvas.height - PADDLE_HEIGHT - BALL_RADIUS / 2),
    withLatestFrom(paddlePos$),
    filter(([bpos, ppos]) => bpos.x < ppos - PADDLE_WIDTH / 2 || bpos.x > ppos + PADDLE_WIDTH / 2),
    share()
);


const cWall = ball$.pipe(
    filter(({
        x,
        y
    }) => x < BALL_RADIUS || x > canvas.width - BALL_RADIUS),
    share()
);

const cCeiling = ball$.pipe(
    filter(({
        x,
        y
    }) => y < BALL_RADIUS),
    share()
);

const ballDir$ = merge(
    merge(cBricks, cPaddle, cCeiling).pipe(map(e => {
        return {
            x: 1,
            y: -1
        };
    })),
    cWall.pipe(map(e => {
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

const score$ = cBricks.pipe(
    startWith(0),
    scan((acc, _) => acc + 10),
    share()
);

ticker$.pipe(
    withLatestFrom(keyCode$),
    map(([_, b]) => b),
    startWith(canvas.width / 2),
    scan((position, dir) => {
        let next = position + dir * 10;
        return Math.max(Math.min(next, canvas.width - PADDLE_WIDTH / 2), PADDLE_WIDTH / 2);
    }),
    share()
).subscribe(e => paddlePos$.next(e));

const initBall: BallDir = {
    x: canvas.width / 2,
    y: canvas.height / 2
};

ticker$.pipe(
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
).subscribe((e: Ball) => ball$.next(e));

cBricks.pipe(
    startWith(factory()),
    scan((bricks: Brick[], idx: number) => {
        bricks.splice(idx, 1);
        return bricks;
    }),
    share(),
).subscribe(e => bricks$.next(e));

// UI
drawTitle();
drawAuthor();
drawControls();

cGround.subscribe(_ => {
    game.unsubscribe();
    drawGameOver("Game over");
});

bricks$.pipe(
    filter(b => b.length == 0)
).subscribe(_ => {
    game.unsubscribe();
    drawGameOver("Win");
});


const game = combineLatest(score$, bricks$.asObservable(), ball$.asObservable(), paddlePos$.asObservable()).pipe(
    sampleTime(17),
).subscribe(([score, bricks, ball, paddle]) => drawAll(paddle, bricks, ball, score));
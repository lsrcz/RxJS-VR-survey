import {
    Observable,
    merge,
    NEVER,
    fromEvent,
    Subject,
    interval,
    animationFrameScheduler,
    of ,
    ReplaySubject,
    combineLatest
} from 'rxjs';
import {
    map,
    filter,
    distinctUntilChanged,
    flatMap,
    switchMap,
    startWith,
    scan,
    withLatestFrom,
    share,
    publishReplay,
    refCount,
    tap
} from 'rxjs/operators';
import {
    fromJS,
    Map
} from 'immutable';

interface Brick {
    x: number;
    y: number;
    width: number;
    height: number;
};

interface Ball {
    x: number;
    y: number;
}

const PADDLE_KEYS = {
    left: 37,
    right: 39
};

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



export const canvas = < HTMLCanvasElement > document.getElementById('stage');
const context = canvas.getContext('2d');
context.fillStyle = 'pink';

function main(sources) {
    const tick$: Observable < number > = sources['tick'];
    const keydown$: Observable < KeyboardEvent > = sources['keydown'];
    const keyup$: Observable < KeyboardEvent > = sources['keyup'];
    const click$: Observable < MouseEvent > = sources['click'];
    const gamestate$: Observable < string > = sources['gamestate'];
    const paddle$: Observable < number > = sources['paddle'];
    const bricks$: Observable < Brick[] > = sources['bricks'];
    const ball$: Observable < Ball > = sources['ball'];
    const stop$: Observable < boolean > = sources['stop'];

    const stopableTick$ = stop$.pipe(
        switchMap(e => {
            if (e) {
                return NEVER;
            } else {
                return tick$;
            }
        }),
        share(),
    );

    const cPaddle$ = ball$.pipe(
        filter(({
            x,
            y
        }) => y > canvas.height - PADDLE_HEIGHT - BALL_RADIUS / 2),
        withLatestFrom(paddle$),
        filter(([bpos, ppos]) => bpos.x > ppos - PADDLE_WIDTH / 2),
        filter(([bpos, ppos]) => bpos.x < ppos + PADDLE_WIDTH / 2),
        map(e => true),
        share()
    );

    const cGround$ = ball$.pipe(
        filter(({
            x,
            y
        }) => y > canvas.height - PADDLE_HEIGHT - BALL_RADIUS / 2),
        withLatestFrom(paddle$),
        filter(([bpos, ppos]) => bpos.x < ppos - PADDLE_WIDTH / 2 || bpos.x > ppos + PADDLE_WIDTH / 2),
        share()
    );

    const cCeiling$ = ball$.pipe(
        filter(({
            x,
            y
        }) => y < BALL_RADIUS),
        share()
    )

    const cWall$ = ball$.pipe(
        filter(({
            x,
            y
        }) => x < BALL_RADIUS || x > canvas.width - BALL_RADIUS),
        share()
    )

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

    const cBricks$ = ball$.pipe(
        withLatestFrom(bricks$),
        map(([ball, bricks]) => {
            return isCollidedBrick(bricks, ball)
        }),
        filter(e => e != -1),
        share(),

    );

    const ballDir$ = gamestate$.pipe(
        switchMap(e => {
            switch (e) {
                case 'gaming':
                    return merge(
                        merge(cPaddle$, cCeiling$, cBricks$).pipe(map(e => {
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
                            x: 3,
                            y: 3
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
                default:
                    return of({
                        x: 3,
                        y: 3
                    })
            }
        }),
        share(),
    );

    const ballSink$ = gamestate$.pipe(
        switchMap(e => {
            switch (e) {
                case 'gaming':
                    return stopableTick$.pipe(
                        withLatestFrom(ballDir$),
                        startWith({
                            x: canvas.width / 2,
                            y: canvas.height / 2
                        }),
                        scan((position, [_, bdir]: any) => {
                            const newBall = {
                                x: position.x + (bdir).x,
                                y: position.y + (bdir).y
                            };
                            return newBall;
                        }),
                        share()
                    );
                default:
                    return of({
                        x: canvas.width / 2,
                        y: canvas.height / 2
                    });
            }
        }),
        share(),
    );

    const gameStateSink$ = merge(
        click$.pipe(
            map(e => 'gaming')
        ),
        cGround$.pipe(
            map(e => 'lose')
        ),
        bricks$.pipe(
            filter((bricks: Brick[]) => bricks.length == 0),
            map(e => 'win')
        )
    ).pipe(
        startWith('waiting'),
        distinctUntilChanged(),
        share()
    );

    const stopSink$ = gamestate$.pipe(
        switchMap(e => {
            switch (e) {
                case 'gaming':
                    return click$.pipe(
                        startWith(false),
                        scan((acc, _) => !acc)
                    );
                default:
                    return of(false);
            }
        }),
        distinctUntilChanged(),
        share(),
    )

    const paddleDir$: Observable < number > = merge(
        keydown$.pipe(
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
        keyup$.pipe(
            map((e: KeyboardEvent) => 0)
        ),
    ).pipe(
        share()
    );

    const paddleSink$: Observable < number > = gamestate$.pipe(
        switchMap((e: string) => {
            switch (e) {
                case 'gaming':
                    return stopableTick$.pipe(
                        withLatestFrom(paddleDir$),
                        map(([_, dir]) => dir),
                        startWith(canvas.width / 2),
                        scan((acc: number, val: number) => {
                            let next = acc + val * 8;
                            return Math.max(
                                Math.min(
                                    next,
                                    canvas.width - PADDLE_WIDTH / 2),
                                PADDLE_WIDTH / 2)
                        }),
                        share()
                    );
                default:
                    return of(canvas.width / 2)
            }
        }),
        share()
    );

    const bricksSink$ = gamestate$.pipe(
        switchMap(e => {
            switch (e) {
                case 'gaming':
                    return cBricks$.pipe(
                        startWith(factory()),
                        scan((bricks: Brick[], idx: number) => {
                            bricks.splice(idx, 1);
                            return bricks;
                        })
                    )
                default:
                    return of(factory());
            }
        }),
        share(),
    )

    const scoreSink$ = gamestate$.pipe(
        switchMap(e => {
            switch (e) {
                case 'gaming':
                    return cBricks$.pipe(
                        startWith(0),
                        scan((acc, _) => acc + 10),
                        share()
                    );
                default:
                    return of(0);
            }
        }),
        share()
    );

    return {
        paddle: paddleSink$,
        gamestate: gameStateSink$,
        ball: ballSink$,
        bricks: bricksSink$,
        score: scoreSink$,
        stop: stopSink$,
    }
}


function run(main) {
    const tick$ = interval(16, animationFrameScheduler);
    const keyup$ = fromEvent(document, 'keyup');
    const keydown$ = fromEvent(document, 'keydown');
    const click$ = fromEvent(document, 'click');
    const fakeGamestate$ = new ReplaySubject(1);
    const fakePaddle$ = new ReplaySubject(1);
    const fakeBall$ = new ReplaySubject(1);
    const fakeBricks$ = new ReplaySubject(1);
    const fakeScore$ = new ReplaySubject(1);
    const fakeStop$ = new ReplaySubject(1);


    const ret = main({
        tick: tick$,
        keyup: keyup$,
        keydown: keydown$,
        click: click$,
        gamestate: fakeGamestate$.asObservable(),
        paddle: fakePaddle$.asObservable(),
        ball: fakeBall$.asObservable(),
        bricks: fakeBricks$.asObservable(),
        stop: fakeStop$.asObservable(),
    });

    return merge(
        ret['gamestate'].pipe(tap(e => fakeGamestate$.next(e))),
        ret['paddle'].pipe(tap(e => fakePaddle$.next(e))),
        ret['ball'].pipe(tap(e => fakeBall$.next(e))),
        ret['bricks'].pipe(tap(e => fakeBricks$.next(e))),
        ret['score'].pipe(tap(e => fakeScore$.next(e))),
        ret['stop'].pipe(tap(e => fakeStop$.next(e))),

        tick$.pipe(
            withLatestFrom(combineLatest(
                fakeGamestate$,
                fakePaddle$,
                fakeBall$,
                fakeBricks$,
                fakeScore$)),
            map(([_, a]) => a),
            tap(([gamestate, paddle, ball, bricks, score]) =>
                drawAll(gamestate, paddle, ball, bricks, score))
        )
    ).subscribe();

}




export function drawInner(text) {
    context.clearRect(canvas.width / 4, canvas.height / 3, canvas.width / 2, canvas.height / 3);
    context.textAlign = 'center';
    context.font = '24px Courier New';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
}

export const TICKER_INTERVAL = 17;

export const BRICK_ROWS = 1;
export const BRICK_COLUMNS = 7;
export const BRICK_HEIGHT = 20;
export const BRICK_GAP = 3;

export const PADDLE_WIDTH = 100;
export const PADDLE_HEIGHT = 20;

export const BALL_RADIUS = 10;


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

export function drawScore(score) {
    context.textAlign = 'left';
    context.font = '16px Courier New';
    context.fillText(score, BRICK_GAP, 16);
}

function drawAll(gamestate, paddle, ball, bricks, score) {
    if (gamestate == 'waiting') {
        drawInner('Click to start');
    } else if (gamestate == 'lose') {
        drawInner('Lose! Click to restart.');
    } else if (gamestate == 'win') {
        drawInner('Win! Click to restart.');
    } else {
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawPaddle(paddle);
        drawBall(ball);
        drawBricks(bricks);
        drawScore(score);
    }
}

run(main);